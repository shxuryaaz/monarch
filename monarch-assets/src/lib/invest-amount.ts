import type { Asset } from "@/lib/api";

/** Hard cap for subscription size (USD). */
export const INVEST_GLOBAL_MAX = 5000;

/** Global floor (USD, cent precision). Per-listing minimum is at least one token via `computeInvestBounds`. */
export const INVEST_GLOBAL_MIN = 0.01;

export type InvestBoundsInput = Pick<Asset, "tokenPriceUsd" | "oraclePriceUsd" | "availableSupply">;

export type InvestBounds =
  | {
      valid: true;
      minUsd: number;
      maxUsd: number;
      lotUsd: number;
    }
  | {
      valid: false;
      minUsd: number;
      maxUsd: number;
      lotUsd: number;
      invalidReason: string;
    };

/** Two-decimal USD (cents). */
export function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clamp USD to [min, max] and round to cents (matches USDC base-unit rounding in `usdToUsdcBaseUnits`). */
export function clampUsd(minUsd: number, maxUsd: number, value: number): number {
  const v = Math.min(maxUsd, Math.max(minUsd, value));
  return roundUsd2(v);
}

/** Tuple for controlled `Slider` values (matches `@/components/ui/slider` usage). */
export function clampSelection(minUsd: number, maxUsd: number, valueUsd: number): [number] {
  return [clampUsd(minUsd, maxUsd, roundUsd2(valueUsd))];
}

/**
 * Continuous range: min = one token at reference mark, max = min($5k, tranche float in USD).
 * Reference: oraclePriceUsd ?? tokenPriceUsd (same notion as “lot” in UI).
 */
export function computeInvestBounds(asset: InvestBoundsInput): InvestBounds {
  const lotUsd = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
  if (!Number.isFinite(lotUsd) || lotUsd <= 0) {
    return {
      valid: false,
      minUsd: 0,
      maxUsd: 0,
      lotUsd: 0,
      invalidReason: "This listing has no valid reference price."
    };
  }

  const minUsd = Math.ceil(lotUsd * 100) / 100;
  const supply = Number.isFinite(asset.availableSupply) ? asset.availableSupply : 0;
  const availableUsd = Math.max(0, supply) * lotUsd;
  const capped = Math.min(INVEST_GLOBAL_MAX, availableUsd);
  const maxUsd = Math.floor(capped * 100) / 100;

  if (minUsd > maxUsd) {
    let invalidReason = "No subscription size fits the allowed range for this sleeve.";
    if (lotUsd > INVEST_GLOBAL_MAX) {
      invalidReason = "Reference lot is above the $5,000 maximum for this flow.";
    } else if (availableUsd < lotUsd) {
      invalidReason = "Not enough primary float left for even one token at the reference mark.";
    }
    return {
      valid: false,
      minUsd,
      maxUsd,
      lotUsd,
      invalidReason
    };
  }

  return { valid: true, minUsd, maxUsd, lotUsd };
}

export function usdToUsdcBaseUnits(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/** True if chain USDC is not required, or wallet has at least `requiredBaseUnits` (6-decimal USDC). */
export function hasEnoughUsdcBalance(
  needsChainUsdc: boolean,
  usdcRaw: bigint | undefined,
  requiredBaseUnits: bigint
): boolean {
  return !needsChainUsdc || (usdcRaw !== undefined && usdcRaw >= requiredBaseUnits);
}
