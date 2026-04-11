import { prisma } from "../db/prisma.js";
import { computeRiskScore } from "../services/risk.service.js";

export function startOracleWorker() {
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const assets = await prisma.asset.findMany({
        select: { id: true, type: true, tokenPriceUsd: true, expectedYieldPct: true }
      });

      // Compute all prices/yields/risk scores before touching the DB again.
      const updates = await Promise.all(
        assets.map(async (asset) => {
          const drift = (Math.random() - 0.5) * 0.02;
          const nextPrice = Number((asset.tokenPriceUsd * (1 + drift)).toFixed(2));
          const nextYield = Number((asset.expectedYieldPct * (1 + drift / 2)).toFixed(2));
          const risk = await computeRiskScore({
            type: asset.type,
            expectedYieldPct: asset.expectedYieldPct,
            oracleYieldPct: nextYield
          });
          return { id: asset.id, nextPrice, nextYield, risk };
        })
      );

      // Batch all writes into a single transaction — one connection, one round-trip.
      await prisma.$transaction(
        updates.map(({ id, nextPrice, nextYield, risk }) =>
          prisma.asset.update({
            where: { id },
            data: {
              oraclePriceUsd: nextPrice,
              oracleYieldPct: nextYield,
              riskScore: risk.score,
              riskLabel: risk.label
            }
          })
        )
      );
    } catch (e) {
      // Swallowed: transient RPC failures are expected and self-heal on the next tick.
    } finally {
      running = false;
    }
  }, 30_000);
}
