import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { computeRiskScore } from "../services/risk.service.js";

const router = Router();

router.post("/assets", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = z
      .object({
        onchainAssetId: z.string(),
        tokenAddress: z.string(),
        name: z.string(),
        symbol: z.string(),
        type: z.string(),
        location: z.string(),
        tokenPriceUsd: z.number(),
        totalAssetValue: z.number(),
        availableSupply: z.number(),
        expectedYieldPct: z.number()
      })
      .parse(req.body);

    const risk = await computeRiskScore({
      type: body.type,
      expectedYieldPct: body.expectedYieldPct
    });

    const asset = await prisma.asset.create({
      data: { ...body, riskScore: risk.score, riskLabel: risk.label }
    });
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

export default router;
