import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/http-error.js";
import {
  assetTokenWeiFromHuman,
  buildApprovalPayload,
  buildMintPayload,
  getTreasuryAddress,
  isChainSettlementEnabled,
  relayerMint,
  usdcBaseUnitsFromUsd,
  verifyErc20Transfer
} from "../services/blockchain.service.js";
import { chainId, contracts } from "../services/contracts.js";

const router = Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const purchases = await prisma.purchaseIntent.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { asset: true }
    });
    res.json({ purchases });
  } catch (error) {
    next(error);
  }
});

router.post("/intent", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ assetId: z.string(), usdcAmount: z.number().positive() }).parse(req.body);
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: body.assetId } });
    const tokenAmount = body.usdcAmount / asset.tokenPriceUsd;
    const chain = isChainSettlementEnabled();
    const intent = await prisma.purchaseIntent.create({
      data: {
        userId: req.user!.sub,
        assetId: body.assetId,
        usdcAmount: body.usdcAmount,
        tokenAmount,
        status: chain ? "PENDING_PAYMENT" : "PENDING_APPROVAL"
      }
    });
    const approvalPayload = await buildApprovalPayload(req.user!.wallet, contracts.PayoutDistributor, body.usdcAmount.toString());
    const payment = chain
      ? {
          chainId,
          usdcAddress: contracts.MockUSDC,
          treasuryAddress: getTreasuryAddress(),
          amountBaseUnits: usdcBaseUnitsFromUsd(body.usdcAmount).toString(),
          decimals: 6
        }
      : null;
    res.status(201).json({ intent, approvalPayload, payment, chainSettlementRequired: chain });
  } catch (error) {
    next(error);
  }
});

router.post("/confirm", requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        intentId: z.string(),
        paymentTxHash: z.string().optional(),
        approvalTxHash: z.string().optional(),
        mintTxHash: z.string().optional()
      })
      .parse(req.body);

    const intent = await prisma.purchaseIntent.findUniqueOrThrow({
      where: { id: body.intentId },
      include: { asset: true }
    });

    if (intent.userId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (intent.status === "CONFIRMED") {
      return res.status(400).json({ error: "Intent already confirmed" });
    }

    const chain = isChainSettlementEnabled();
    let mintTxHash = body.mintTxHash ?? null;

    if (chain) {
      if (!body.paymentTxHash) {
        return res.status(400).json({ error: "paymentTxHash is required when chain settlement is enabled" });
      }
      const expectedUnits = usdcBaseUnitsFromUsd(intent.usdcAmount);
      try {
        await verifyErc20Transfer({
          txHash: body.paymentTxHash,
          tokenAddress: contracts.MockUSDC,
          expectedFrom: req.user!.wallet,
          expectedTo: getTreasuryAddress(),
          expectedValue: expectedUnits
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment could not be verified on-chain";
        throw new HttpError(400, msg, "PAYMENT_VERIFY_FAILED");
      }
      const amountWei = assetTokenWeiFromHuman(intent.tokenAmount);
      try {
        mintTxHash = await relayerMint(intent.asset.tokenAddress, req.user!.wallet, amountWei);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        if (
          lower.includes("replacement fee") ||
          lower.includes("underpriced") ||
          lower.includes("nonce too low") ||
          lower.includes("could not coalesce error") ||
          lower.includes("timeout") ||
          lower.includes("econn") ||
          lower.includes("503") ||
          lower.includes("429")
        ) {
          throw new HttpError(502, msg, "RPC_OR_NETWORK_ERROR");
        }
        throw new HttpError(400, msg, "MINT_FAILED");
      }
    }

    const updated = await prisma.purchaseIntent.update({
      where: { id: body.intentId },
      data: {
        approvalTxHash: body.approvalTxHash ?? undefined,
        paymentTxHash: body.paymentTxHash ?? undefined,
        mintTxHash: mintTxHash ?? undefined,
        status: "CONFIRMED"
      }
    });

    const payload = await buildMintPayload(req.user!.wallet, intent.asset.tokenAddress, intent.tokenAmount.toString());

    const prev = await prisma.portfolioPosition.findUnique({
      where: { userId_assetId: { userId: req.user!.sub, assetId: intent.assetId } }
    });
    const prevBal = prev?.tokenBalance ?? 0;
    const prevCost = prev?.avgCostUsd ?? 0;
    const newBal = prevBal + intent.tokenAmount;
    const newAvgCost =
      newBal > 0 ? (prevBal * prevCost + intent.usdcAmount) / newBal : intent.usdcAmount / intent.tokenAmount;

    await prisma.portfolioPosition.upsert({
      where: { userId_assetId: { userId: req.user!.sub, assetId: intent.assetId } },
      create: {
        userId: req.user!.sub,
        assetId: intent.assetId,
        tokenBalance: intent.tokenAmount,
        avgCostUsd: intent.usdcAmount / intent.tokenAmount
      },
      update: {
        tokenBalance: newBal,
        avgCostUsd: newAvgCost
      }
    });

    res.json({ intent: updated, mintPayload: payload });
  } catch (error) {
    next(error);
  }
});

export default router;
