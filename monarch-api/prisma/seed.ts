import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const assets = [
    {
      onchainAssetId: "austin-residential-01",
      tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
      name: "Manyata Tech Park Annex",
      symbol: "MTP",
      type: "REAL_ESTATE",
      location: "Bengaluru, Karnataka",
      tokenPriceUsd: 50,
      totalAssetValue: 1_000_000,
      availableSupply: 20_000,
      expectedYieldPct: 8.2,
      oraclePriceUsd: 52,
      oracleYieldPct: 8.3,
      riskScore: 0.26,
      riskLabel: "LOW"
    },
    {
      onchainAssetId: "napa-vineyard-01",
      // Same on-chain token as primary listing for demo relayer minting; DB prices differ per “offering”
      tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
      name: "Nashik Valley Vineyards",
      symbol: "NVV",
      type: "AGRICULTURE",
      location: "Nashik, Maharashtra",
      tokenPriceUsd: 22,
      totalAssetValue: 750_000,
      availableSupply: 30_000,
      expectedYieldPct: 6.8,
      oraclePriceUsd: 21.4,
      oracleYieldPct: 6.9,
      riskScore: 0.42,
      riskLabel: "MEDIUM"
    },
    {
      onchainAssetId: "miami-waterfront-01",
      tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
      name: "Bandra Seafront Residences",
      symbol: "BSR",
      type: "REAL_ESTATE",
      location: "Mumbai, Maharashtra",
      tokenPriceUsd: 75,
      totalAssetValue: 2_500_000,
      availableSupply: 40_000,
      expectedYieldPct: 9.1,
      oraclePriceUsd: 77.2,
      oracleYieldPct: 9.0,
      riskScore: 0.39,
      riskLabel: "MEDIUM"
    }
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { onchainAssetId: asset.onchainAssetId },
      update: asset,
      create: asset
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
