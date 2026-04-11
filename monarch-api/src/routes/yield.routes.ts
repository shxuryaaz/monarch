import { Router } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  getProvider,
  isChainSettlementEnabled,
  relayerDistributeYield
} from "../services/blockchain.service.js";
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

/** Reporting + pending ops; on-chain USDC claims are source of truth for cash payout. */
router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const wallet = req.user!.wallet as string;

    const positions = await prisma.portfolioPosition.findMany({
      where: { userId },
      select: { assetId: true }
    });
    const assetIds = [...new Set(positions.map((p) => p.assetId))];

    const [distributions, dbClaims] = await Promise.all([
      assetIds.length
        ? prisma.yieldDistribution.findMany({
            where: { assetId: { in: assetIds } },
            include: { asset: { select: { id: true, name: true, tokenAddress: true } } },
            orderBy: { createdAt: "desc" },
            take: 40
          })
        : [],
      prisma.yieldClaim.findMany({
        where: { userId },
        include: {
          distribution: {
            include: { asset: { select: { id: true, name: true, tokenAddress: true } } }
          }
        },
        orderBy: { claimedAt: "desc" },
        take: 40
      })
    ]);

    let onchainClaimable: Array<{
      assetId: string;
      name: string;
      tokenAddress: string;
      claimableBaseUnits: string;
    }> = [];

    if (env.SEPOLIA_RPC_URL && positions.length) {
      const fullPositions = await prisma.portfolioPosition.findMany({
        where: { userId },
        include: { asset: true }
      });
      const provider = getProvider();
      const abi = ["function getClaimableYield(address assetToken, address user) view returns (uint256)"];
      const payout = new ethers.Contract(contracts.PayoutDistributor, abi, provider);
      for (const p of fullPositions) {
        const raw: bigint = await payout.getClaimableYield(p.asset.tokenAddress, wallet);
        onchainClaimable.push({
          assetId: p.asset.id,
          name: p.asset.name,
          tokenAddress: p.asset.tokenAddress,
          claimableBaseUnits: raw.toString()
        });
      }
    }

    res.json({
      distributions,
      dbClaims,
      onchainClaimable,
      payoutDistributorAddress: contracts.PayoutDistributor,
      note:
        "USDC payout is on-chain via PayoutDistributor.claimYield. Rows in dbClaims are optional ledger entries only."
    });
  } catch (error) {
    next(error);
  }
});

router.post("/distribute", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({ assetId: z.string(), amountUsd: z.number().positive() }).parse(req.body);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: body.assetId } });

    let txHash: string | undefined;
    let snapshotId: number | undefined;
    let status = "QUEUED";

    if (isChainSettlementEnabled()) {
      try {
        const out = await relayerDistributeYield(asset.tokenAddress, body.amountUsd);
        txHash = out.txHash;
        snapshotId = out.snapshotId;
        status = "SETTLED";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const dist = await prisma.yieldDistribution.create({
          data: {
            assetId: body.assetId,
            amountUsd: body.amountUsd,
            status: "ONCHAIN_FAILED",
            txHash: null
          }
        });
        return res.status(502).json({
          error: msg,
          distribution: dist,
          hint: "Relayer needs Mock USDC balance and distributor ADMIN_ROLE; check API logs."
        });
      }
    }

    const dist = await prisma.yieldDistribution.create({
      data: {
        assetId: body.assetId,
        amountUsd: body.amountUsd,
        status,
        txHash: txHash ?? null,
        snapshotId: snapshotId ?? null
      }
    });

    res.status(201).json(dist);
  } catch (error) {
    next(error);
  }
});

/** Optional DB-only pro-rata record — does not move USDC. Prefer on-chain claimYield. */
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
