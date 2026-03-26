import type { Asset as PrismaAsset } from "@prisma/client";

export type AssetApiRow = PrismaAsset & {
  pctRemaining: number;
};

export function toAssetApiJson(asset: PrismaAsset): AssetApiRow {
  // Use actual tokensOffered value, no fallback
  const offered = asset.tokensOffered;

  // Calculate percentage remaining (0% if no tranche defined)
  const pctRemaining = offered > 0
    ? Math.min(1, Math.max(0, asset.availableSupply / offered))
    : 0;

  return {
    ...asset,
    tokensOffered: offered,
    pctRemaining
  };
}
