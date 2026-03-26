import type { Asset } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { createAssetRecord, defaultListingTokenAddress } from "./asset-creation.service.js";
import { assertSubmitterKycForApproval } from "./kyc.service.js";

/** Creates marketplace Asset + marks listing APPROVED (same as POST /admin/listings/:id/approve). */
export async function publishSubmittedListing(listingId: string): Promise<Asset> {
  const listing = await prisma.assetListing.findUnique({ where: { id: listingId } });
  if (!listing) {
    throw new Error("Listing not found");
  }
  if (listing.status !== "SUBMITTED") {
    throw new Error("Listing is not pending review");
  }
  if (listing.createdAssetId) {
    throw new Error("Listing already has an asset");
  }

  await assertSubmitterKycForApproval(listing.submitterId);

  const onchainAssetId = `listing-${listing.id}`;
  const tokenAddress = defaultListingTokenAddress();

  const asset = await createAssetRecord({
    onchainAssetId,
    tokenAddress,
    name: listing.name,
    symbol: listing.symbol,
    type: listing.type,
    location: listing.location,
    description: listing.description,
    tokenPriceUsd: listing.tokenPriceUsd,
    totalAssetValue: listing.totalAssetValue,
    availableSupply: listing.tokensOffered,
    tokensOffered: listing.tokensOffered,
    expectedYieldPct: listing.expectedYieldPct
  });

  await prisma.assetListing.update({
    where: { id: listing.id },
    data: { status: "APPROVED", createdAssetId: asset.id }
  });

  return asset;
}
