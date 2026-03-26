import { prisma } from "../db/prisma.js";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Primary offering USDC destination (buy flow). No platform commission / treasury split:
 * - Escrow: USDC goes to the milestone escrow contract (unchanged).
 * - Direct: issuer wallet only — user listing submitter, else `escrowBeneficiary` on the asset
 *   (seed/admin offerings must set this to the sponsor payout address).
 */
export async function getPrimaryUsdcRecipient(
  assetId: string,
  escrowContractAddress: string | null | undefined,
  escrowBeneficiary: string | null | undefined
): Promise<string> {
  const escrow = escrowContractAddress?.trim();
  if (escrow) return escrow;

  const listing = await prisma.assetListing.findUnique({
    where: { createdAssetId: assetId },
    include: { submitter: { select: { wallet: true } } }
  });

  const listerWallet = listing?.submitter?.wallet?.trim();
  if (listerWallet && ADDR_RE.test(listerWallet)) {
    return listerWallet;
  }

  const beneficiary = escrowBeneficiary?.trim();
  if (beneficiary && ADDR_RE.test(beneficiary)) {
    return beneficiary;
  }

  throw new Error(
    "Cannot route USDC: this asset has no issuer wallet (listing submitter) and no escrowBeneficiary. " +
      "For catalog assets, set escrowBeneficiary to the sponsor payout address."
  );
}
