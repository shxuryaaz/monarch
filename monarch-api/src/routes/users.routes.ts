import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/** Register or update the authenticated user's Stellar public key for XLM yield payouts. */
router.patch("/me/stellar", requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        stellarPublicKey: z
          .string()
          .regex(/^G[A-Z2-7]{55}$/, "Must be a valid Stellar public key (starts with G, 56 chars)")
          .nullable()
      })
      .parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { stellarPublicKey: body.stellarPublicKey },
      select: { id: true, wallet: true, stellarPublicKey: true }
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/** Get the authenticated user's profile including Stellar key. */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.sub },
      select: { id: true, wallet: true, stellarPublicKey: true, isAdmin: true, kycStatus: true }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
