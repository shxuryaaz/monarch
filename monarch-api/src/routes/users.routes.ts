import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { hasStellarUsdcTrustline, isStellarEnabled } from "../services/stellar.service.js";

const TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const STELLAR_LAB_TRUSTLINE_URL =
  `https://laboratory.stellar.org/#txbuilder?params=eyJhdHRyaWJ1dGVzIjp7ImZlZSI6IjEwMCIsImJhc2VGZWUiOiIxMDAiLCJtaW5GZWUiOiIxMDAifSwib3BlcmF0aW9ucyI6W3siaWQiOjAsImF0dHJpYnV0ZXMiOnsiYXNzZXQiOnsiYXNzZXRDb2RlIjoiVVNEQyIsImFzc2V0SXNzdWVyIjoiR0JCRDQ3SUY2TFdLN1A3TURFVLNXQ1I3RFBVV1YzTlkzRFRRRVZGTDROQVQ0QVFIMzpMTEZMQTUifX19XX0%3D&network=test`;


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

/** Check if the authenticated user's Stellar account has a USDC trustline. */
router.get("/me/stellar-status", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.sub },
      select: { stellarPublicKey: true }
    });

    if (!user.stellarPublicKey || !isStellarEnabled()) {
      return res.json({ hasTrustline: false, trustlineSetupUrl: null });
    }

    const hasTrustline = await hasStellarUsdcTrustline(user.stellarPublicKey);
    const trustlineSetupUrl = hasTrustline
      ? null
      : `${STELLAR_LAB_TRUSTLINE_URL}&sourceAccount=${user.stellarPublicKey}`;

    res.json({ hasTrustline, trustlineSetupUrl, usdcIssuer: TESTNET_USDC_ISSUER });
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
