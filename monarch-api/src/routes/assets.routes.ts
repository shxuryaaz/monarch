import { Router } from "express";
import { prisma } from "../db/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const assets = await prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ assets });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json({ asset });
  } catch (error) {
    next(error);
  }
});

export default router;
