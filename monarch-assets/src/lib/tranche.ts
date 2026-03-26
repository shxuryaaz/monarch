import type { Asset } from "@/lib/api";

/** Fraction of primary tranche still open (0–1), from live supply numbers. */
export function tranchePctRemaining(
  asset: Pick<Asset, "availableSupply" | "tokensOffered">
): number {
  const offered = asset.tokensOffered;
  if (!(offered > 0)) return 0;
  const avail = Number.isFinite(asset.availableSupply) ? asset.availableSupply : 0;
  return Math.min(1, Math.max(0, avail / offered));
}

/** Human-readable percent still open (one decimal when needed; avoids 99.5% → "100%"). */
export function formatTranchePct(pctRemaining: number): string {
  const pct = Math.min(100, Math.max(0, pctRemaining * 100));
  const roundedTenth = Math.round(pct * 10) / 10;
  return Number.isInteger(roundedTenth) ? String(roundedTenth) : roundedTenth.toFixed(1);
}

/** Label used on asset cards: `99.5% left`. */
export function formatTrancheLeftLabel(pctRemaining: number): string {
  return `${formatTranchePct(pctRemaining)}% left`;
}
