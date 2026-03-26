import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  assetTokenWeiFromHuman,
  getTreasuryAddress,
  isChainSettlementEnabled,
  relayerUsdcTransfer,
  usdcBaseUnitsFromUsd,
  verifyErc20Transfer
} from "../services/blockchain.service.js";
import { chainId, contracts } from "../services/contracts.js";

const router = Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const sales = await prisma.saleIntent.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { asset: true }
    });
    res.json({ sales });
  } catch (error) {
    next(error);
  }
});

router.post("/intent", requireAuth, async (req, res, next) => {
  try {
    if (!isChainSettlementEnabled()) {
      return res.status(503).json({
        error: "On-chain sell requires SEPOLIA_RPC_URL and PRIVATE_KEY (relayer) on the API"
      });
    }
    const body = z
      .object({
        assetId: z.string(),
        tokenAmount: z.number().positive()
      })
      .parse(req.body);

    const position = await prisma.portfolioPosition.findFirst({
      where: { userId: req.user!.sub, assetId: body.assetId },
      include: { asset: true }
    });
    if (!position || position.tokenBalance < body.tokenAmount - 1e-12) {
      return res.status(400).json({ error: "Insufficient token balance for this asset" });
    }

    const mark = position.asset.oraclePriceUsd ?? position.asset.tokenPriceUsd;
    const usdcOut = body.tokenAmount * mark;

    const sale = await prisma.saleIntent.create({
      data: {
        userId: req.user!.sub,
        assetId: body.assetId,
        tokenAmount: body.tokenAmount,
        usdcOut,
        status: "PENDING_ASSET_TRANSFER"
      }
    });

    const tokenWei = assetTokenWeiFromHuman(body.tokenAmount);
    const transfer = {
      chainId,
      assetTokenAddress: position.asset.tokenAddress,
      treasuryAddress: getTreasuryAddress(),
      amountTokenBaseUnits: tokenWei.toString(),
      tokenDecimals: 18,
      expectedUsdcOut: usdcOut,
      expectedUsdcBaseUnits: usdcBaseUnitsFromUsd(usdcOut).toString()
    };

    res.status(201).json({ sale, transfer });
  } catch (error) {
    next(error);
  }
});

router.post("/settle", requireAuth, async (req, res, next) => {
  try {
    if (!isChainSettlementEnabled()) {
      return res.status(503).json({ error: "Relayer not configured" });
    }
    const body = z.object({ saleId: z.string(), assetTokenTxHash: z.string() }).parse(req.body);

    const sale = await prisma.saleIntent.findUniqueOrThrow({
      where: { id: body.saleId },
      include: { asset: true }
    });

    if (sale.userId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (sale.status !== "PENDING_ASSET_TRANSFER") {
      return res.status(400).json({ error: "Sale is not awaiting settlement" });
    }

    const tokenWei = assetTokenWeiFromHuman(sale.tokenAmount);
    await verifyErc20Transfer({
      txHash: body.assetTokenTxHash,
      tokenAddress: sale.asset.tokenAddress,
      expectedFrom: req.user!.wallet,
      expectedTo: getTreasuryAddress(),
      expectedValue: tokenWei
    });

    const payoutUnits = usdcBaseUnitsFromUsd(sale.usdcOut);
    const payoutTx = await relayerUsdcTransfer(req.user!.wallet, payoutUnits);

    const pos = await prisma.portfolioPosition.findUnique({
      where: { userId_assetId: { userId: req.user!.sub, assetId: sale.assetId } }
    });
    if (pos) {
      const newBal = pos.tokenBalance - sale.tokenAmount;
      if (newBal <= 1e-12) {
        await prisma.portfolioPosition.delete({
          where: { userId_assetId: { userId: req.user!.sub, assetId: sale.assetId } }
        });
      } else {
        await prisma.portfolioPosition.update({
          where: { userId_assetId: { userId: req.user!.sub, assetId: sale.assetId } },
          data: { tokenBalance: newBal }
        });
      }
    }

    const updated = await prisma.saleIntent.update({
      where: { id: sale.id },
      data: {
        status: "COMPLETED",
        assetTokenTxHash: body.assetTokenTxHash,
        usdcPayoutTxHash: payoutTx
      }
    });

    // Return sold tokens back to available supply
    const assetRow = await prisma.asset.findUniqueOrThrow({ where: { id: sale.assetId } });
    const newAvailable = assetRow.availableSupply + sale.tokenAmount;

    // Validate we're not exceeding total tranche size
    if (newAvailable > assetRow.tokensOffered) {
      throw new Error(
        `Cannot return ${sale.tokenAmount} tokens: would result in ${newAvailable} available, ` +
        `but only ${assetRow.tokensOffered} tokens were offered in tranche`
      );
    }

    await prisma.asset.update({
      where: { id: sale.assetId },
      data: { availableSupply: newAvailable }
    });

    res.json({ sale: updated, usdcPayoutTxHash: payoutTx });
  } catch (error) {
    next(error);
  }
});

export default router;
