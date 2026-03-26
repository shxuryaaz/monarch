/** Deterministic “diligence-style” metrics for trust UI until real data feeds exist. */

function stableUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

export type TrustFinancialMetrics = {
  /** Display e.g. "1.42×" */
  projectedEquityMultipleLabel: string;
  projectedEquityMultipleCaption: string;
  rentalIncomeAnnualUsd: number;
  rentalIncomeMonthlyUsd: number;
  occupancyPct: number;
};

export function getTrustFinancialMetrics(input: {
  onchainAssetId: string;
  totalAssetValue: number;
  yieldPct: number;
}): TrustFinancialMetrics {
  const u = stableUnit(input.onchainAssetId + ":fin");
  const yieldDec = Math.max(0, input.yieldPct) / 100;
  const holdYears = 5;
  const reinvestFudge = 0.88 + u * 0.28;
  const multiple = 1 + holdYears * yieldDec * reinvestFudge;
  const rounded = Math.round(multiple * 100) / 100;
  const impliedNoi = input.totalAssetValue * yieldDec;
  const rentalAnnual = impliedNoi * (0.92 + u * 0.16);
  const occupancy = 82 + Math.round(u * 16 * 10) / 10;
  return {
    projectedEquityMultipleLabel: `${rounded.toFixed(2)}×`,
    projectedEquityMultipleCaption: `Illustrative ${holdYears}-yr model on issuer cash-yield mark—not a forecast.`,
    rentalIncomeAnnualUsd: rentalAnnual,
    rentalIncomeMonthlyUsd: rentalAnnual / 12,
    occupancyPct: Math.min(98.5, Math.max(82, occupancy))
  };
}

export type IotTelemetrySignal = {
  status: "active";
  lastPingLabel: string;
};

export function getIotTelemetrySignal(onchainAssetId: string): IotTelemetrySignal {
  const u = stableUnit(onchainAssetId + ":iot");
  const minutes = 1 + Math.floor(u * 47);
  return {
    status: "active",
    lastPingLabel: minutes <= 1 ? "Last ping under 1 min ago" : `Last ping ${minutes} min ago`
  };
}
