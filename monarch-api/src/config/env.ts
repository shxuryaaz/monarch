import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default("file:./dev.db"),
  JWT_SECRET: z.string().min(8),
  FRONTEND_ORIGIN: z.string().default("http://localhost:8080"),
  SIWE_DOMAIN: z.string().default("localhost"),
  SIWE_ORIGIN: z.string().default("http://localhost:8080"),
  SEPOLIA_RPC_URL: z.string().optional(),
  PRIVATE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MOCK_USDC_ADDRESS: z.string().optional(),
  ASSET_REGISTRY_ADDRESS: z.string().optional(),
  PAYOUT_DISTRIBUTOR_ADDRESS: z.string().optional(),
  /**
   * Wallet that receives RWA tokens on **secondary sells**; relayer pays the seller USDC.
   * Prefer this over TREASURY_ADDRESS (legacy alias).
   */
  SECONDARY_TREASURY_ADDRESS: z.string().optional(),
  /** @deprecated Use SECONDARY_TREASURY_ADDRESS — kept as fallback for existing .env files */
  TREASURY_ADDRESS: z.string().optional(),
  /** Safe shown for secondary routing when set (display / routing only until full Safe tx flow). */
  TREASURY_SAFE_ADDRESS: z.string().optional(),
  /** Wallet receiving primary subscription USDC for **seed/catalog** assets (admin rows without a lister). */
  PRIMARY_ISSUER_ADDRESS: z.string().optional(),
  /** Optional MilestoneEscrow; overrides contracts JSON if both set */
  MILESTONE_ESCROW_ADDRESS: z.string().optional(),
  /** Stellar relayer secret key (S...) — enables XLM yield payouts via Stellar */
  STELLAR_SECRET_KEY: z.string().optional(),
  /** Stellar relayer public key (G...) — shown to users for payment instructions */
  STELLAR_PUBLIC_KEY: z.string().optional(),
  /** stub: allow all listings; strict: submitter must have User.kycStatus APPROVED */
  KYC_MODE: z.enum(["stub", "strict"]).default("stub"),
  /**
   * When true (default), POST /listings also creates the marketplace asset so it appears immediately.
   * Set LISTINGS_AUTO_PUBLISH=false to require POST /admin/listings/:id/approve.
   */
  LISTINGS_AUTO_PUBLISH: z.preprocess((val) => {
    if (val === undefined || val === "") return true;
    if (val === false || val === "false" || val === "0") return false;
    return true;
  }, z.boolean())
});

const parsed = schema.parse(process.env);

/** Split `FRONTEND_ORIGIN` (comma-separated). Outside production, also allow common Vite dev origins. */
function buildFrontendOrigins(frontEndOrigin: string): string[] {
  const parts = frontEndOrigin.split(",").map((s) => s.trim()).filter(Boolean);
  const seen = new Set(parts);
  if (process.env.NODE_ENV !== "production") {
    for (const local of ["http://localhost:8080", "http://127.0.0.1:8080"]) {
      if (!seen.has(local)) {
        parts.push(local);
        seen.add(local);
      }
    }
  }
  return parts;
}

export const env = {
  ...parsed,
  FRONTEND_ORIGINS: buildFrontendOrigins(parsed.FRONTEND_ORIGIN)
};
