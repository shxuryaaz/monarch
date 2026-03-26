import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/http-error.js";
import {
  assetTokenWeiFromHuman,
  buildMintPayload,
  isChainSettlementEnabled,
  relayerMint,
  usdcBaseUnitsFromUsd,
  verifyErc20Transfer
} from "../services/blockchain.service.js";
import { chainId, contracts } from "../services/contracts.js";
import { getPrimaryUsdcRecipient } from "../services/purchase-recipient.service.js";

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
    const refUsd = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
    if (!Number.isFinite(refUsd) || refUsd <= 0) {
      return res.status(400).json({ error: "Asset has no valid reference price for subscription sizing" });
    }
    const tokenAmount = body.usdcAmount / refUsd;
    if (tokenAmount > asset.availableSupply + 1e-9) {
      return res.status(400).json({ error: "Amount exceeds available tranche supply" });
    }
    const chain = isChainSettlementEnabled();
    const escrowAddr = asset.escrowContractAddress?.trim();
    const useEscrow = Boolean(chain && escrowAddr);
    const amountBaseUnits = usdcBaseUnitsFromUsd(body.usdcAmount).toString();
    let directRecipient = "";
    if (chain && !useEscrow) {
      try {
        directRecipient = await getPrimaryUsdcRecipient(
          body.assetId,
          asset.escrowContractAddress,
          asset.escrowBeneficiary
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment routing failed";
        return res.status(400).json({ error: msg });
      }
    }
    const intent = await prisma.purchaseIntent.create({
      data: {
        userId: req.user!.sub,
        assetId: body.assetId,
        usdcAmount: body.usdcAmount,
        tokenAmount,
        status: chain ? "PENDING_PAYMENT" : "PENDING_APPROVAL"
      }
    });
    const payment = chain
      ? useEscrow && escrowAddr
        ? {
            mode: "escrow" as const,
            chainId,
            usdcAddress: contracts.MockUSDC,
            escrowAddress: escrowAddr,
            assetTokenAddress: asset.tokenAddress,
            amountBaseUnits,
            decimals: 6
          }
        : {
            mode: "treasury" as const,
            chainId,
            usdcAddress: contracts.MockUSDC,
            treasuryAddress: directRecipient,
            amountBaseUnits,
            decimals: 6
          }
      : null;
    res.status(201).json({ intent, payment, chainSettlementRequired: chain });
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
      let payTo: string;
      try {
        payTo = await getPrimaryUsdcRecipient(
          intent.assetId,
          intent.asset.escrowContractAddress,
          intent.asset.escrowBeneficiary
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment verification routing failed";
        throw new HttpError(400, msg, "PAYMENT_ROUTE_INVALID");
      }
      try {
        await verifyErc20Transfer({
          txHash: body.paymentTxHash,
          tokenAddress: contracts.MockUSDC,
          expectedFrom: req.user!.wallet,
          expectedTo: payTo,
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

    const nextSupply = intent.asset.availableSupply - intent.tokenAmount;
    if (nextSupply < -1e-9) {
      return res.status(400).json({ error: "Tranche sold out — not enough available supply" });
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

    await prisma.asset.update({
      where: { id: intent.assetId },
      data: { availableSupply: Math.max(0, nextSupply) }
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
