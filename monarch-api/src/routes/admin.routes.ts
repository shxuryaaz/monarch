import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { toAssetApiJson } from "../lib/asset-json.js";
import { createAssetRecord } from "../services/asset-creation.service.js";
import { publishSubmittedListing } from "../services/listing-publish.service.js";
import { relayerReleaseEscrowMilestone } from "../services/blockchain.service.js";

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
        description: z.string().optional(),
        tokenPriceUsd: z.number(),
        totalAssetValue: z.number(),
        availableSupply: z.number(),
        tokensOffered: z.number().optional(),
        expectedYieldPct: z.number()
      })
      .parse(req.body);

    const tokensOffered = body.tokensOffered ?? body.availableSupply;
    const asset = await createAssetRecord({
      onchainAssetId: body.onchainAssetId,
      tokenAddress: body.tokenAddress,
      name: body.name,
      symbol: body.symbol,
      type: body.type,
      location: body.location,
      description: body.description,
      tokenPriceUsd: body.tokenPriceUsd,
      totalAssetValue: body.totalAssetValue,
      availableSupply: body.availableSupply,
      tokensOffered,
      expectedYieldPct: body.expectedYieldPct
    });
    res.status(201).json(toAssetApiJson(asset));
  } catch (error) {
    next(error);
  }
});

router.post("/listings/:id/approve", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().parse(req.params.id);
    try {
      const asset = await publishSubmittedListing(id);
      res.status(201).json({ asset: toAssetApiJson(asset), listingId: id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Listing not found") return res.status(404).json({ error: msg });
      if (msg === "Listing is not pending review" || msg === "Listing already has an asset") {
        return res.status(400).json({ error: msg });
      }
      throw e;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/listings/:id/reject", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().parse(req.params.id);
    const body = z.object({ adminNote: z.string().optional() }).parse(req.body ?? {});
    const listing = await prisma.assetListing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listing.status !== "SUBMITTED") {
      return res.status(400).json({ error: "Listing is not pending review" });
    }
    const updated = await prisma.assetListing.update({
      where: { id },
      data: { status: "REJECTED", adminNote: body.adminNote ?? listing.adminNote }
    });
    res.json({ listing: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/assets/:assetId/escrow/release-milestone", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const assetId = z.string().parse(req.params.assetId);
    const body = z
      .object({
        milestoneIndex: z.coerce.number().int().min(0),
        proofHash: z.string().optional()
      })
      .parse(req.body ?? {});

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { escrowMilestones: { orderBy: { sortOrder: "asc" } } }
    });
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    const escrow = asset.escrowContractAddress?.trim();
    if (!escrow) {
      return res.status(400).json({ error: "Asset has no escrow contract" });
    }
    const ms = asset.escrowMilestones[body.milestoneIndex];
    if (!ms) {
      return res.status(400).json({ error: "Unknown milestone index" });
    }
    if (ms.completed) {
      return res.status(400).json({ error: "Milestone already marked complete" });
    }

    const txHash = await relayerReleaseEscrowMilestone(
      escrow,
      asset.tokenAddress,
      body.milestoneIndex,
      body.proofHash
    );

    await prisma.escrowMilestone.update({
      where: { id: ms.id },
      data: {
        completed: true,
        proofHash: body.proofHash ?? txHash,
        completedAt: new Date()
      }
    });

    res.json({ txHash, milestoneIndex: body.milestoneIndex });
  } catch (error) {
    next(error);
  }
});

export default router;
