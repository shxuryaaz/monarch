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
  TREASURY_ADDRESS: z.string().optional()
});

export const env = schema.parse(process.env);
