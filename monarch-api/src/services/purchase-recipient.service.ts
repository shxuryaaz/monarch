import { prisma } from "../db/prisma.js";
import { getTreasuryAddress } from "./blockchain.service.js";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Primary offering USDC destination (buy flow).
 * - Escrow path: USDC goes to the milestone escrow contract (unchanged).
 * - Direct path: if the asset came from a user listing, send to the lister's wallet;
 *   otherwise platform treasury (seed / admin offerings).
 */
export async function getPrimaryUsdcRecipient(
  assetId: string,
  escrowContractAddress: string | null | undefined
): Promise<string> {
  const escrow = escrowContractAddress?.trim();
  if (escrow) return escrow;

  const listing = await prisma.assetListing.findUnique({
    where: { createdAssetId: assetId },
    include: { submitter: { select: { wallet: true } } }
  });

  const w = listing?.submitter?.wallet?.trim();
  if (w && ADDR_RE.test(w)) {
    return w;
  }

  return getTreasuryAddress();
}
