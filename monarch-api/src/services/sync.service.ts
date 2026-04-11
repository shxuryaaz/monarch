import { prisma } from "../db/prisma.js";
import { toAssetApiJson } from "../lib/asset-json.js";

export async function syncPortfolioForUser(userId: string) {
  const positions = await prisma.portfolioPosition.findMany({
    where: { userId },
    include: { asset: true }
  });

  let invested = 0;
  let current = 0;
  for (const p of positions) {
    invested += p.avgCostUsd * p.tokenBalance;
    const mark = p.asset.oraclePriceUsd ?? p.asset.tokenPriceUsd;
    current += mark * p.tokenBalance;
  }

  return {
    totalInvested: invested,
    totalValue: current,
    totalReturns: current - invested,
    positions: positions.map((p) => ({
      ...p,
      asset: toAssetApiJson(p.asset)
    }))
  };
}
