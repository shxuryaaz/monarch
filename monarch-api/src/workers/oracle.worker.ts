import { prisma } from "../db/prisma.js";
import { computeRiskScore } from "../services/risk.service.js";

/** Prevents overlapping ticks (slow OpenAI / many assets) from exhausting the DB pool (P2024). */
let oracleTickInFlight = false;

export function startOracleWorker() {
  setInterval(async () => {
    if (oracleTickInFlight) return;
    oracleTickInFlight = true;
    try {
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[oracle.worker]", err);
    } finally {
      oracleTickInFlight = false;
    }
  }, 30_000);
}
