import { prisma } from "../db/prisma.js";
import { computeRiskScore } from "../services/risk.service.js";

export function startOracleWorker() {
  setInterval(async () => {
    const assets = await prisma.asset.findMany();
    for (const asset of assets) {
      const drift = (Math.random() - 0.5) * 0.02;
      const nextPrice = Number((asset.tokenPriceUsd * (1 + drift)).toFixed(2));
      const nextYield = Number((asset.expectedYieldPct * (1 + drift / 2)).toFixed(2));
      const risk = await computeRiskScore({
        type: asset.type,
        expectedYieldPct: asset.expectedYieldPct,
        oracleYieldPct: nextYield
      });
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          oraclePriceUsd: nextPrice,
          oracleYieldPct: nextYield,
          riskScore: risk.score,
          riskLabel: risk.label
        }
      });
    }
  }, 30_000);
}
