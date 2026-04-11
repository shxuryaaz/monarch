import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { getSecondaryTreasuryAddress, isChainSettlementEnabled } from "./services/blockchain.service.js";
import { chainId, contracts, getMilestoneEscrowAddress } from "./services/contracts.js";
import adminRoutes from "./routes/admin.routes.js";
import assetsRoutes from "./routes/assets.routes.js";
import authRoutes from "./routes/auth.routes.js";
import portfolioRoutes from "./routes/portfolio.routes.js";
import purchasesRoutes from "./routes/purchases.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import yieldRoutes from "./routes/yield.routes.js";
import listingsRoutes from "./routes/listings.routes.js";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/** Liveness probe for uptime monitors (e.g. UptimeRobot). No auth; keep cheap. */
app.get("/ping", (req, res) => {
  const xf = req.headers["x-forwarded-for"];
  const clientIp =
    typeof xf === "string" ? xf.split(",")[0]?.trim() : Array.isArray(xf) ? xf[0] : req.socket.remoteAddress;
  const ua = req.get("user-agent") ?? "";
  // eslint-disable-next-line no-console
  console.log(
    `[ping] ${new Date().toISOString()} ip=${clientIp ?? "unknown"} ua=${JSON.stringify(ua.slice(0, 160))}`
  );
  res.status(200).json({ service: "monarch-api", status: "ok" });
});

app.get("/config", (_req, res) => {
  const secondaryTreasury = getSecondaryTreasuryAddress();
  res.json({
    chainSettlementEnabled: isChainSettlementEnabled(),
    chainId,
    /** Secondary-market token sink + settlement anchor (sells). */
    secondaryTreasuryAddress: secondaryTreasury,
    /** @deprecated Same as secondaryTreasuryAddress — kept for older clients. */
    treasuryAddress: secondaryTreasury,
    mockUsdcAddress: contracts.MockUSDC,
    milestoneEscrowAddress: getMilestoneEscrowAddress() ?? null,
    kycMode: env.KYC_MODE
  });
});

app.use("/auth", authRoutes);
app.use("/assets", assetsRoutes);
app.use("/portfolio", portfolioRoutes);
app.use("/admin", adminRoutes);
app.use("/purchases", purchasesRoutes);
app.use("/sales", salesRoutes);
app.use("/yield", yieldRoutes);
app.use("/listings", listingsRoutes);

app.use(errorHandler);
