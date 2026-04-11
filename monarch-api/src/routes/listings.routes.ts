import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { toAssetApiJson } from "../lib/asset-json.js";
import { requireAuth } from "../middleware/auth.js";
import { assertSubmitterKycForListing } from "../services/kyc.service.js";
import { publishSubmittedListing } from "../services/listing-publish.service.js";

/** Maximum allowed deviation between (tokenPrice × tokensOffered) and totalAssetValue. */
const LISTING_ECONOMICS_TOLERANCE = 0.05; // 5 %

/** Upper bound on expected annual yield for a submitted listing. */
const LISTING_MAX_YIELD_PCT = 20;

const listingCreate = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1).max(12),
  type: z.string().min(1),
  location: z.string().min(1),
  description: z.string().optional(),
  tokenPriceUsd: z.number().positive(),
  totalAssetValue: z.number().positive(),
  tokensOffered: z.number().positive(),
  expectedYieldPct: z.number()
});

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    await assertSubmitterKycForListing(req.user!.sub);
    const body = listingCreate.parse(req.body);

    // Validate economics: token price × tokens offered should ≈ total asset value
    const impliedValue = body.tokenPriceUsd * body.tokensOffered;
    const valueDiff = Math.abs(impliedValue - body.totalAssetValue);
    const valueDiffPct = valueDiff / body.totalAssetValue;

    if (valueDiffPct > LISTING_ECONOMICS_TOLERANCE) {
      return res.status(400).json({
        error: "Economics mismatch",
        message: `Token price ($${body.tokenPriceUsd.toFixed(2)}) × tokens offered (${body.tokensOffered}) = $${impliedValue.toFixed(2)}, but total asset value is $${body.totalAssetValue.toFixed(2)}. Difference: ${(valueDiffPct * 100).toFixed(1)}%. Please adjust values to within ${(LISTING_ECONOMICS_TOLERANCE * 100).toFixed(0)}% tolerance.`
      });
    }

    // Validate yield is reasonable
    if (body.expectedYieldPct < 0 || body.expectedYieldPct > LISTING_MAX_YIELD_PCT) {
      return res.status(400).json({
        error: "Invalid yield",
        message: `Expected yield must be between 0% and ${LISTING_MAX_YIELD_PCT}%. Received: ${body.expectedYieldPct.toFixed(1)}%`
      });
    }

    // Validate all numeric fields are positive
    if (body.tokenPriceUsd <= 0 || body.totalAssetValue <= 0 || body.tokensOffered <= 0) {
      return res.status(400).json({
        error: "Invalid values",
        message: "Token price, total asset value, and tokens offered must all be greater than 0"
      });
    }

    const listing = await prisma.assetListing.create({
      data: {
        submitterId: req.user!.sub,
        status: "SUBMITTED",
        name: body.name,
        symbol: body.symbol,
        type: body.type,
        location: body.location,
        description: body.description,
        tokenPriceUsd: body.tokenPriceUsd,
        totalAssetValue: body.totalAssetValue,
        tokensOffered: body.tokensOffered,
        expectedYieldPct: body.expectedYieldPct
      }
    });

    let asset = undefined;
    if (env.LISTINGS_AUTO_PUBLISH) {
      try {
        const created = await publishSubmittedListing(listing.id);
        asset = toAssetApiJson(created);
      } catch (err) {
        void err; // Auto-publish failure is non-fatal; listing remains in SUBMITTED state.
      }
    }

    const fresh = await prisma.assetListing.findUnique({ where: { id: listing.id } });
    res.status(201).json({ listing: fresh, asset });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const listings = await prisma.assetListing.findMany({
      where: { submitterId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      include: { createdAsset: true }
    });
    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

export default router;
