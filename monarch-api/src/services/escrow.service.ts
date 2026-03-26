import { ethers } from "ethers";
import { prisma } from "../db/prisma.js";
import { getProvider, isChainSettlementEnabled } from "./blockchain.service.js";

const ESCROW_VIEW_ABI = [
  "function beneficiary(address assetToken) view returns (address)",
  "function totalDeposited(address assetToken) view returns (uint256)",
  "function totalReleased(address assetToken) view returns (uint256)",
  "function milestoneCount(address assetToken) view returns (uint256)",
  "function getMilestone(address assetToken, uint256 index) view returns (uint16 releaseBps, bool released, bytes32 proofHash)"
];

export async function getAssetTransparency(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { escrowMilestones: { orderBy: { sortOrder: "asc" } } }
  });
  if (!asset) return null;

  const escrowAddr = asset.escrowContractAddress?.trim();
  let onchain: {
    beneficiary: string | null;
    totalDeposited: string;
    totalReleased: string;
    milestoneChain: Array<{ index: number; releaseBps: number; released: boolean; proofHash: string }>;
  } | null = null;

  if (escrowAddr && isChainSettlementEnabled()) {
    try {
      const provider = getProvider();
      const c = new ethers.Contract(escrowAddr, ESCROW_VIEW_ABI, provider);
      const token = asset.tokenAddress;
      const ben = await c.beneficiary(token);
      const dep = await c.totalDeposited(token);
      const rel = await c.totalReleased(token);
      const n = Number(await c.milestoneCount(token));
      const milestoneChain: Array<{ index: number; releaseBps: number; released: boolean; proofHash: string }> = [];
      for (let i = 0; i < n; i++) {
        const row = await c.getMilestone(token, i);
        milestoneChain.push({
          index: i,
          releaseBps: Number(row.releaseBps),
          released: row.released,
          proofHash: row.proofHash
        });
      }
      onchain = {
        beneficiary: ben === ethers.ZeroAddress ? null : String(ben).toLowerCase(),
        totalDeposited: dep.toString(),
        totalReleased: rel.toString(),
        milestoneChain
      };
    } catch {
      onchain = null;
    }
  }

  return {
    asset: {
      id: asset.id,
      name: asset.name,
      tokenAddress: asset.tokenAddress,
      escrowContractAddress: asset.escrowContractAddress,
      escrowBeneficiary: asset.escrowBeneficiary
    },
    milestones: asset.escrowMilestones.map((m) => ({
      id: m.id,
      sortOrder: m.sortOrder,
      description: m.description,
      releaseBps: m.releaseBps,
      completed: m.completed,
      proofHash: m.proofHash,
      completedAt: m.completedAt?.toISOString() ?? null
    })),
    onchainEscrow: onchain,
    disclosure:
      "Milestones listed here are the sleeve’s published release schedule. When RPC and an escrow address are configured, we surface live deposited and released balances from the contract so you can compare against those terms. Operations teams attach proof hashes as milestones complete—on-chain rows update as that reconciliation runs."
  };
}
