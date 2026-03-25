import { Router } from "express";
import { z } from "zod";
import { createChallenge, verifyChallenge } from "../services/auth.service.js";

const router = Router();

router.post("/challenge", async (req, res, next) => {
  try {
    const body = z.object({ wallet: z.string() }).parse(req.body);
    const challenge = await createChallenge(body.wallet);
    res.json(challenge);
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const body = z.object({ message: z.string(), signature: z.string() }).parse(req.body);
    const result = await verifyChallenge(body.message, body.signature);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
