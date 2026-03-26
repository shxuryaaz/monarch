import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { toAssetApiJson } from "../lib/asset-json.js";
import { getAssetTransparency } from "../services/escrow.service.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ assets: rows.map(toAssetApiJson) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/transparency", async (req, res, next) => {
  try {
    const report = await getAssetTransparency(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json({ asset: toAssetApiJson(asset) });
  } catch (error) {
    next(error);
  }
});

export default router;
