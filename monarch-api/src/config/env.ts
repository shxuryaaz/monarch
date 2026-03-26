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
  /** Receives USDC for buys; defaults to deployer in contracts JSON if unset */
  TREASURY_ADDRESS: z.string().optional(),
  /** When set, /config and treasury resolution prefer Safe (display / routing only until full Safe tx flow). */
  TREASURY_SAFE_ADDRESS: z.string().optional(),
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
