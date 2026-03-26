import { prisma } from "../db/prisma.js";
import { computeRiskScore } from "./risk.service.js";
import { contracts } from "./contracts.js";

type EconomicFields = {
  name: string;
  symbol: string;
  type: string;
  location: string;
  description?: string | null;
  tokenPriceUsd: number;
  totalAssetValue: number;
  availableSupply: number;
  tokensOffered: number;
  expectedYieldPct: number;
  escrowContractAddress?: string | null;
  escrowBeneficiary?: string | null;
};

export async function createAssetRecord(input: EconomicFields & { onchainAssetId: string; tokenAddress: string }) {
  if (input.tokensOffered <= 0 || input.availableSupply < 0) {
    throw new Error("Invalid supply fields");
  }
  if (input.availableSupply > input.tokensOffered + 1e-9) {
    throw new Error("availableSupply cannot exceed tokensOffered");
  }

  const risk = await computeRiskScore({
    type: input.type,
    expectedYieldPct: input.expectedYieldPct
  });

  return prisma.asset.create({
    data: {
      onchainAssetId: input.onchainAssetId,
      tokenAddress: input.tokenAddress,
      name: input.name,
      symbol: input.symbol,
      type: input.type,
      location: input.location,
      description: input.description ?? undefined,
      tokenPriceUsd: input.tokenPriceUsd,
      totalAssetValue: input.totalAssetValue,
      availableSupply: input.availableSupply,
      tokensOffered: input.tokensOffered,
      expectedYieldPct: input.expectedYieldPct,
      riskScore: risk.score,
      riskLabel: risk.label,
      escrowContractAddress: input.escrowContractAddress ?? undefined,
      escrowBeneficiary: input.escrowBeneficiary ?? undefined
    }
  });
}

/** Demo: new listings use the deployed demo token; economics differ per DB row. */
export function defaultListingTokenAddress(): string {
  return contracts.DemoAssetToken;
}
