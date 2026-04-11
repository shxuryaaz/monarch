import { Router } from "express";
import { ethers } from "ethers";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getProvider,
  isChainSettlementEnabled,
  relayerDistributeYield,
  relayerMintUsdc,
  usdcBaseUnitsFromUsd
} from "../services/blockchain.service.js";
import { contracts } from "../services/contracts.js";
import {
  isStellarEnabled,
  stellarXlmTransfer,
  stellarUsdcTransfer,
  ensureAccountFunded
} from "../services/stellar.service.js";

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

router.post("/distribute", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ assetId: z.string(), amountUsd: z.number().positive() }).parse(req.body);
    const asset = await prisma.asset.findUniqueOrThrow({
      where: { id: body.assetId },
      include: { listingOrigin: { select: { submitterId: true } } }
    });

    const isSubmitter = asset.listingOrigin?.submitterId === req.user!.sub;
    const isAdmin = req.user!.isAdmin as boolean;
    if (!isSubmitter && !isAdmin) {
      return res.status(403).json({ error: "Only the asset issuer can distribute yield" });
    }

    let txHash: string | undefined;
    let snapshotId: number | undefined;
    let status = "QUEUED";

    if (isChainSettlementEnabled()) {
      try {
        const out = await relayerDistributeYield(asset.tokenAddress, body.amountUsd);
        txHash = out.txHash;
        snapshotId = out.snapshotId;
        status = "SETTLED";
      } catch {
        // On-chain settlement failed (e.g. relayer missing DISTRIBUTOR_ROLE on token contract).
        // Fall through — record the distribution as QUEUED and still attempt Stellar payouts.
        status = "QUEUED";
      }
    }

    // --- Load all holders for pro-rata payouts ---
    const positions = await prisma.portfolioPosition.findMany({
      where: { assetId: body.assetId, tokenBalance: { gt: 0 } },
      include: { user: { select: { id: true, wallet: true, stellarPublicKey: true } } }
    });
    const totalTokens = positions.reduce((sum, p) => sum + p.tokenBalance, 0);

    // --- Mock USDC payouts — mint pro-rata USDC directly to each holder's wallet ---
    // Relayer must hold MINTER_ROLE on MockUSDC (true for the demo deploy).
    // Best-effort: a failure here does not abort the distribution record.
    const claimTxHashes: Record<string, string> = {};
    if (isChainSettlementEnabled() && totalTokens > 0) {
      for (const pos of positions) {
        try {
          const shareUsd = (pos.tokenBalance / totalTokens) * body.amountUsd;
          const shareBaseUnits = usdcBaseUnitsFromUsd(shareUsd);
          if (shareBaseUnits > 0n) {
            const claimTxHash = await relayerMintUsdc(pos.user.wallet, shareBaseUnits);
            claimTxHashes[pos.user.id] = claimTxHash;
          }
        } catch {
          // Best-effort — one holder failure does not block the rest
        }
      }
    }

    // --- Stellar payouts — USDC on Stellar (with XLM fallback) ---
    // For holders with a registered Stellar address, pay their pro-rata share via Stellar.
    // Tries Stellar USDC first (Circle-issued, same USDC as Ethereum).
    // Falls back to XLM if the recipient has no USDC trustline set up yet.
    let stellarTxHash: string | undefined;
    const stellarClaimTxHashes: Record<string, string> = {};
    if (isStellarEnabled() && totalTokens > 0) {
      for (const pos of positions) {
        if (!pos.user.stellarPublicKey) continue;
        try {
          const shareUsd = (pos.tokenBalance / totalTokens) * body.amountUsd;
          const amountStr = Math.max(shareUsd, 0.0000001).toFixed(7);
          await ensureAccountFunded(pos.user.stellarPublicKey);
          let txHash: string;
          try {
            // Try USDC on Stellar first
            txHash = await stellarUsdcTransfer(pos.user.stellarPublicKey, amountStr);
          } catch {
            // Recipient has no USDC trustline — fall back to XLM
            txHash = await stellarXlmTransfer(pos.user.stellarPublicKey, amountStr);
          }
          stellarClaimTxHashes[pos.user.id] = txHash;
          stellarTxHash = txHash; // last one stored on the distribution record
        } catch {
          // Best-effort per holder — never fail the distribution
        }
      }
    }

    const dist = await prisma.yieldDistribution.create({
      data: {
        assetId: body.assetId,
        amountUsd: body.amountUsd,
        status,
        txHash: txHash ?? null,
        snapshotId: snapshotId ?? null,
        stellarTxHash: stellarTxHash ?? null
      }
    });

    // Auto-create YieldClaim records for each holder — stores both USDC tx and Stellar tx
    if (totalTokens > 0) {
      await Promise.all(
        positions.map((pos) => {
          const shareUsd = (pos.tokenBalance / totalTokens) * body.amountUsd;
          return prisma.yieldClaim.create({
            data: {
              userId: pos.user.id,
              distributionId: dist.id,
              amountUsd: Number(shareUsd.toFixed(2)),
              txHash: claimTxHashes[pos.user.id] ?? null,       // Ethereum USDC tx
              stellarTxHash: stellarClaimTxHashes[pos.user.id] ?? null  // Stellar USDC/XLM tx
            }
          });
        })
      );
    }

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
