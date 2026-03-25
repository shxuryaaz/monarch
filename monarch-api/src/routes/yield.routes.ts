import { Router } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getProvider } from "../services/blockchain.service.js";
import { contracts } from "../services/contracts.js";

const router = Router();

router.get("/onchain-claimable", requireAuth, async (req, res, next) => {
  try {
    if (!env.SEPOLIA_RPC_URL) {
      return res.json({ items: [], payoutDistributorAddress: contracts.PayoutDistributor });
    }
    const wallet = req.user!.wallet as string;
    const positions = await prisma.portfolioPosition.findMany({
      where: { userId: req.user!.sub },
      include: { asset: true }
    });
    const provider = getProvider();
    const abi = ["function getClaimableYield(address assetToken, address user) view returns (uint256)"];
    const payout = new ethers.Contract(contracts.PayoutDistributor, abi, provider);
    const items: Array<{
      assetId: string;
      name: string;
      tokenAddress: string;
      claimableBaseUnits: string;
    }> = [];
    for (const p of positions) {
      const raw: bigint = await payout.getClaimableYield(p.asset.tokenAddress, wallet);
      if (raw > 0n) {
        items.push({
          assetId: p.asset.id,
          name: p.asset.name,
          tokenAddress: p.asset.tokenAddress,
          claimableBaseUnits: raw.toString()
        });
      }
    }
    res.json({ items, payoutDistributorAddress: contracts.PayoutDistributor });
  } catch (error) {
    next(error);
  }
});

router.post("/distribute", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({ assetId: z.string(), amountUsd: z.number().positive() }).parse(req.body);
    const dist = await prisma.yieldDistribution.create({
      data: {
        assetId: body.assetId,
        amountUsd: body.amountUsd,
        status: "QUEUED"
      }
    });
    res.status(201).json(dist);
  } catch (error) {
    next(error);
  }
});

router.post("/claim", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ distributionId: z.string() }).parse(req.body);
    const dist = await prisma.yieldDistribution.findUniqueOrThrow({ where: { id: body.distributionId } });
    const position = await prisma.portfolioPosition.findFirst({
      where: { userId: req.user!.sub, assetId: dist.assetId }
    });
    if (!position || position.tokenBalance <= 0) {
      return res.status(400).json({ error: "No position for asset" });
    }

    const totalSupply = await prisma.portfolioPosition.aggregate({
      where: { assetId: dist.assetId },
      _sum: { tokenBalance: true }
    });
    const claimAmount = dist.amountUsd * (position.tokenBalance / (totalSupply._sum.tokenBalance ?? 1));
    const claim = await prisma.yieldClaim.create({
      data: {
        userId: req.user!.sub,
        distributionId: dist.id,
        amountUsd: Number(claimAmount.toFixed(2))
      }
    });
    res.status(201).json(claim);
  } catch (error) {
    next(error);
  }
});

export default router;
