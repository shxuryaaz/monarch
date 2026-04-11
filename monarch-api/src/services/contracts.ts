import { env } from "../config/env.js";
import deployed from "../../../monarch-contracts/deployed-addresses.json" with { type: "json" };

export const contracts = deployed.contracts;
export const chainId = Number(deployed.chainId);
export const deployerAddress = deployed.deployer as string;

/** Resolves optional MilestoneEscrow from env or deployment manifest. */
export function getMilestoneEscrowAddress(): string | undefined {
  const fromEnv = env.MILESTONE_ESCROW_ADDRESS?.trim();
  if (fromEnv) return fromEnv.toLowerCase();
  const raw = (deployed.contracts as Record<string, string | undefined>).MilestoneEscrow;
  return raw?.trim() ? raw.toLowerCase() : undefined;
}
