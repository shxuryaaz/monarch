import { PrismaClient } from "@prisma/client";
import deployed from "../../monarch-contracts/deployed-addresses.json" with { type: "json" };
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

const milestonesAg = [
  { sortOrder: 0, description: "Land preparation verified (inspector)", releaseBps: 2000 },
  { sortOrder: 1, description: "Planting / establishment verified", releaseBps: 3000 },
  { sortOrder: 2, description: "Mid-season maintenance verified", releaseBps: 2000 },
  { sortOrder: 3, description: "Harvest / exit evidence verified", releaseBps: 3000 }
];

const milestonesRe = [
  { sortOrder: 0, description: "Acquisition / title evidence", releaseBps: 4000 },
  { sortOrder: 1, description: "Renovation / capex milestones", releaseBps: 3000 },
  { sortOrder: 2, description: "Stabilized tenancy or sales", releaseBps: 3000 }
];

async function main() {
  const assets = [
    {
      onchainAssetId: "austin-residential-01",
      tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
      name: "Manyata Tech Park Annex",
      symbol: "MTP",
      type: "REAL_ESTATE",
      location: "Bengaluru, Karnataka",
      description:
        "Grade-A IT/ITES annex adjacent to the Manyata Tech Park nucleus in Nagavara. The sleeve targets contractual rent escalations plus parking and amenity income tied to the master lease structure.\n\nTokens represent a pro-rata claim on distributions from this listing after fees; they are not direct title to dirt or condos. Use the metrics below for mark-to-market; oracle feeds refresh on a short cadence in this environment.",
      tokenPriceUsd: 50,
      totalAssetValue: 1_000_000,
      availableSupply: 20_000,
      tokensOffered: 25_000,
      expectedYieldPct: 8.2,
      oraclePriceUsd: 52,
      oracleYieldPct: 8.3,
      riskScore: 0.26,
      riskLabel: "LOW"
    },
    {
      onchainAssetId: "napa-vineyard-01",
      tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
      name: "Nashik Valley Vineyards",
      symbol: "NVV",
      type: "AGRICULTURE",
      location: "Nashik, Maharashtra",
      description:
        "Controlled-appellation table-grape and small-batch varietal program along the Godavari basin with forward contracts to domestic retail and export packers. Yield is driven by tonnage, pack-out quality bands, and power/water hedges—not weekend tasting-room traffic.\n\nAgricultural sleeves carry weather and input-cost convexity; the risk badge blends modelled variance with qualitative underwriting (irrigation source, offtake concentration).",
      tokenPriceUsd: 22,
      totalAssetValue: 750_000,
      availableSupply: 30_000,
      tokensOffered: 35_000,
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
      description:
        "Micro-market residential tower sleeve on the Bandra–Worli catchment: sea-view inventory, captive parking stack, and club-level amenity revenue share. Cash flows are modelled off stabilized leases, fit-out phases, and pre-sales escrow releases—not fractional deed ownership.\n\nNote: the on-chain registry key reads miami-waterfront-01 from the deployment template; it does not change the Mumbai/Bandra offering described here.\n\nEconomics are illustrative until you validate them against the full offering pack—review supply cadence, sponsor covenants, and oracle methodology before sizing.",
      tokenPriceUsd: 75,
      totalAssetValue: 2_500_000,
      availableSupply: 40_000,
      tokensOffered: 50_000,
      expectedYieldPct: 9.1,
      oraclePriceUsd: 77.2,
      oracleYieldPct: 9.0,
      riskScore: 0.39,
      riskLabel: "MEDIUM"
    }
  ];

  const escrowAddr = process.env.MILESTONE_ESCROW_ADDRESS?.trim();
  /** Primary USDC for seed catalog rows — issuer wallet only (see PRIMARY_ISSUER_ADDRESS, not secondary treasury). */
  const issuerPayout = env.PRIMARY_ISSUER_ADDRESS?.trim() || deployed.deployer;

  for (const asset of assets) {
    const extra: { escrowContractAddress?: string; escrowBeneficiary?: string | null } = {
      escrowBeneficiary: issuerPayout ?? null
    };
    if (escrowAddr && asset.onchainAssetId === "napa-vineyard-01") {
      extra.escrowContractAddress = escrowAddr;
    }
    await prisma.asset.upsert({
      where: { onchainAssetId: asset.onchainAssetId },
      update: { ...asset, ...extra },
      create: { ...asset, ...extra }
    });
  }

  const rows = await prisma.asset.findMany();
  for (const row of rows) {
    await prisma.escrowMilestone.deleteMany({ where: { assetId: row.id } });
    const template = row.type === "AGRICULTURE" ? milestonesAg : milestonesRe;
    for (const m of template) {
      await prisma.escrowMilestone.create({
        data: {
          assetId: row.id,
          sortOrder: m.sortOrder,
          description: m.description,
          releaseBps: m.releaseBps
        }
      });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
