import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { syncPortfolioForUser } from "../services/sync.service.js";

const router = Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const data = await syncPortfolioForUser(req.user!.sub);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
