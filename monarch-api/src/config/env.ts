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

export const env = schema.parse(process.env);
