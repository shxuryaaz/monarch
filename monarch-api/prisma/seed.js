import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const assets = [
        {
            onchainAssetId: "austin-residential-01",
            tokenAddress: "0xC910e62BF7bd5C3Aa6e0c89d91041a88b8f194F0",
            name: "Austin Residential Complex",
            symbol: "ARC",
            type: "REAL_ESTATE",
            location: "Austin, Texas",
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
            tokenAddress: "0x0000000000000000000000000000000000000002",
            name: "Napa Valley Vineyard",
            symbol: "NVV",
            type: "AGRICULTURE",
            location: "Napa, California",
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
            tokenAddress: "0x0000000000000000000000000000000000000003",
            name: "Miami Waterfront Tower",
            symbol: "MWT",
            type: "REAL_ESTATE",
            location: "Miami, Florida",
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
