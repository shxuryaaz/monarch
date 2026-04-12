import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/http-error.js";
import { submitKyc } from "../services/kyc.service.js";
import { env } from "../config/env.js";

const router = Router();

/** Build per-user upload directory and multer storage dynamically. */
function buildStorage(userId: string) {
  const dest = path.join(env.UPLOADS_DIR, "kyc", userId);
  fs.mkdirSync(dest, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      const name = `${file.fieldname}-${Date.now()}${ext}`;
      cb(null, name);
    }
  });
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new HttpError(400, `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, PDF.`, "INVALID_FILE_TYPE"));
  }
}

const kycBodySchema = z.object({
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  country: z.string().min(2).max(100),
  address: z.string().min(5).max(500)
});

/** GET /kyc/status — returns current kycStatus + submission data */
router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      include: { kycSubmission: true }
    });
    if (!user) throw new HttpError(404, "User not found", "NOT_FOUND");

    const submission = user.kycSubmission
      ? {
          fullName: user.kycSubmission.fullName,
          dateOfBirth: user.kycSubmission.dateOfBirth,
          country: user.kycSubmission.country,
          address: user.kycSubmission.address,
          submittedAt: user.kycSubmission.submittedAt
        }
      : null;

    res.json({ kycStatus: user.kycStatus, submission });
  } catch (err) {
    next(err);
  }
});

/** POST /kyc/submit — multipart/form-data: personal fields + idFront, idBack, selfie files */
router.post("/submit", requireAuth, (req, res, next) => {
  const userId = req.user!.sub;

  const upload = multer({
    storage: buildStorage(userId),
    fileFilter,
    limits: { fileSize: MAX_FILE_BYTES }
  }).fields([
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
    { name: "selfie", maxCount: 1 }
  ]);

  upload(req, res, async (err) => {
    if (err) return next(err instanceof HttpError ? err : new HttpError(400, err.message, "UPLOAD_ERROR"));

    try {
      const body = kycBodySchema.parse(req.body);

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const idFront = files?.["idFront"]?.[0];
      const idBack = files?.["idBack"]?.[0];
      const selfie = files?.["selfie"]?.[0];

      if (!idFront || !idBack || !selfie) {
        throw new HttpError(400, "All three documents are required: idFront, idBack, selfie.", "MISSING_FILES");
      }

      const result = await submitKyc(userId, body, {
        idFrontPath: idFront.path,
        idBackPath: idBack.path,
        selfiePath: selfie.path
      });

      res.json({ kycStatus: result.kycStatus, message: "KYC verified successfully." });
    } catch (submitErr) {
      next(submitErr);
    }
  });
});

/** GET /kyc/documents/:filename — serve a previously uploaded KYC document (owner only) */
router.get("/documents/:filename", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const filename = req.params["filename"] as string;

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw new HttpError(400, "Invalid filename", "INVALID_PARAM");
    }

    const filePath = path.join(env.UPLOADS_DIR, "kyc", userId, filename);
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, "Document not found", "NOT_FOUND");
    }

    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
});

export default router;
