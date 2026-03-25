import assetResidential from "@/assets/asset-residential.jpg";
import assetVineyard from "@/assets/asset-vineyard.jpg";
import assetWaterfront from "@/assets/asset-waterfront.jpg";
import assetFarmland from "@/assets/asset-farmland.jpg";
import assetCommercial from "@/assets/asset-commercial.jpg";
import assetTimber from "@/assets/asset-timber.jpg";

const IMAGES = [
  assetResidential,
  assetVineyard,
  assetWaterfront,
  assetFarmland,
  assetCommercial,
  assetTimber
];

export function assetImageAt(index: number): string {
  return IMAGES[((index % IMAGES.length) + IMAGES.length) % IMAGES.length];
}
