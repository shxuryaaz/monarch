import { ethers } from "ethers";
import { env } from "../config/env.js";
import { contracts } from "./contracts.js";
import deployed from "../../../monarch-contracts/deployed-addresses.json" with { type: "json" };

const ERC20_IFACE = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

const ERC20_ABI = [
  "function transfer(address to, uint256 value) external returns (bool)",
  "function mint(address to, uint256 amount) external",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const PAYOUT_DISTRIBUTOR_ABI = [
  "function distributeYield(address assetToken, uint256 totalAmount) external",
  "function getDistributionCount(address assetToken) view returns (uint256)",
  "function getDistribution(address assetToken, uint256 index) view returns (tuple(uint256 snapshotId,uint256 totalAmount,uint256 amountPerToken,uint256 timestamp,bool finalized))"
];

export function getTreasuryAddress(): string {
  const raw = env.TREASURY_SAFE_ADDRESS ?? env.TREASURY_ADDRESS ?? deployed.deployer;
  return raw.toLowerCase();
}

export function isChainSettlementEnabled(): boolean {
  return Boolean(env.SEPOLIA_RPC_URL && env.PRIVATE_KEY);
}

export function getProvider(): ethers.JsonRpcProvider {
  if (!env.SEPOLIA_RPC_URL) throw new Error("SEPOLIA_RPC_URL not configured");
  return new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL);
}

/** @deprecated Prefer getProvider / getRelayerWallet — used by tx-monitor heartbeat */
export function getChainContext() {
  let provider: ethers.JsonRpcProvider | null = null;
  try {
    if (env.SEPOLIA_RPC_URL) provider = getProvider();
  } catch {
    provider = null;
  }
  let signer: ethers.Wallet | null = null;
  if (provider && env.PRIVATE_KEY) {
    signer = new ethers.Wallet(env.PRIVATE_KEY, provider);
  }
  return { provider, signer, contracts };
}

export function getRelayerWallet(): ethers.Wallet {
  if (!env.SEPOLIA_RPC_URL || !env.PRIVATE_KEY) {
    throw new Error("Relayer wallet requires SEPOLIA_RPC_URL and PRIVATE_KEY");
  }
  const provider = getProvider();
  return new ethers.Wallet(env.PRIVATE_KEY, provider);
}

export function usdcBaseUnitsFromUsd(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/** Human token amount from DB (float) → 18-decimal bigint for AssetToken */
export function assetTokenWeiFromHuman(human: number): bigint {
  if (!Number.isFinite(human) || human <= 0) return 0n;
  const s = human.toFixed(12).replace(/\.?0+$/, "") || "0";
  return ethers.parseUnits(s, 18);
}

export async function verifyErc20Transfer(params: {
  txHash: string;
  tokenAddress: string;
  expectedFrom: string;
  expectedTo: string;
  expectedValue: bigint;
}): Promise<void> {
  const { txHash, tokenAddress, expectedFrom, expectedTo, expectedValue } = params;
  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction failed or not found");
  }
  const fromLc = expectedFrom.toLowerCase();
  const toLc = expectedTo.toLowerCase();
  const tokLc = tokenAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokLc) continue;
    try {
      const parsed = ERC20_IFACE.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name !== "Transfer") continue;
      const from = String(parsed.args[0]).toLowerCase();
      const to = String(parsed.args[1]).toLowerCase();
      const value = BigInt(parsed.args[2].toString());
      if (from === fromLc && to === toLc && value === expectedValue) return;
    } catch {
      continue;
    }
  }
  throw new Error("Matching ERC-20 Transfer not found in receipt");
}

function bumpFee(x: bigint | null | undefined): bigint | undefined {
  if (x === null || x === undefined || x <= 0n) return undefined;
  return (x * 115n) / 100n;
}

export async function relayerMint(assetTokenAddress: string, to: string, amountWei: bigint): Promise<string> {
  const signer = getRelayerWallet();
  const provider = signer.provider;
  let maxFeePerGas: bigint | undefined;
  let maxPriorityFeePerGas: bigint | undefined;
  if (provider) {
    const feeData = await provider.getFeeData();
    maxFeePerGas = bumpFee(feeData.maxFeePerGas ?? undefined);
    maxPriorityFeePerGas = bumpFee(feeData.maxPriorityFeePerGas ?? undefined);
  }
  const overrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
  if (maxFeePerGas !== undefined) overrides.maxFeePerGas = maxFeePerGas;
  if (maxPriorityFeePerGas !== undefined) overrides.maxPriorityFeePerGas = maxPriorityFeePerGas;

  const c = new ethers.Contract(assetTokenAddress, ERC20_ABI, signer);
  const tx = await c.mint(to, amountWei, overrides);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/**
 * Pulls USDC from the relayer into PayoutDistributor and opens a distribution for claimYield.
 * Relayer must hold enough Mock USDC and have DEFAULT_ADMIN_ROLE on the distributor (demo deploy).
 */
export async function relayerDistributeYield(
  assetTokenAddress: string,
  amountUsd: number
): Promise<{ txHash: string; snapshotId: number }> {
  const signer = getRelayerWallet();
  const distributorAddr = contracts.PayoutDistributor;
  const usdcAddr = contracts.MockUSDC;
  const amount = usdcBaseUnitsFromUsd(amountUsd);
  if (amount <= 0n) throw new Error("Amount must be positive");

  let maxFeePerGas: bigint | undefined;
  let maxPriorityFeePerGas: bigint | undefined;
  const provider = signer.provider;
  if (provider) {
    const feeData = await provider.getFeeData();
    maxFeePerGas = bumpFee(feeData.maxFeePerGas ?? undefined);
    maxPriorityFeePerGas = bumpFee(feeData.maxPriorityFeePerGas ?? undefined);
  }
  const feeOverrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
  if (maxFeePerGas !== undefined) feeOverrides.maxFeePerGas = maxFeePerGas;
  if (maxPriorityFeePerGas !== undefined) feeOverrides.maxPriorityFeePerGas = maxPriorityFeePerGas;

  const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
  const relayerAddress = await signer.getAddress();
  const allowance: bigint = await usdc.allowance(relayerAddress, distributorAddr);
  if (allowance < amount) {
    const apTx = await usdc.approve(distributorAddr, ethers.MaxUint256, feeOverrides);
    await apTx.wait();
  }

  const payout = new ethers.Contract(distributorAddr, PAYOUT_DISTRIBUTOR_ABI, signer);
  const tx = await payout.distributeYield(assetTokenAddress, amount, feeOverrides);
  const receipt = await tx.wait();
  const countBn: bigint = await payout.getDistributionCount(assetTokenAddress);
  const idx = countBn > 0n ? countBn - 1n : 0n;
  const dist = await payout.getDistribution(assetTokenAddress, idx);
  const snapshotId = Number(dist.snapshotId);
  return { txHash: receipt?.hash ?? tx.hash, snapshotId };
}

export async function relayerUsdcTransfer(to: string, amountBaseUnits: bigint): Promise<string> {
  const signer = getRelayerWallet();
  const usdc = contracts.MockUSDC;
  const c = new ethers.Contract(usdc, ERC20_ABI, signer);
  const tx = await c.transfer(to, amountBaseUnits);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

const MILESTONE_ESCROW_ACTION_ABI = [
  "function releaseMilestone(address assetToken, uint256 index, bytes32 proofHash) external"
];

export async function relayerReleaseEscrowMilestone(
  escrowAddress: string,
  assetTokenAddress: string,
  milestoneIndex: number,
  proofHashHex: string | undefined
): Promise<string> {
  const signer = getRelayerWallet();
  let maxFeePerGas: bigint | undefined;
  let maxPriorityFeePerGas: bigint | undefined;
  const provider = signer.provider;
  if (provider) {
    const feeData = await provider.getFeeData();
    maxFeePerGas = bumpFee(feeData.maxFeePerGas ?? undefined);
    maxPriorityFeePerGas = bumpFee(feeData.maxPriorityFeePerGas ?? undefined);
  }
  const feeOverrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } = {};
  if (maxFeePerGas !== undefined) feeOverrides.maxFeePerGas = maxFeePerGas;
  if (maxPriorityFeePerGas !== undefined) feeOverrides.maxPriorityFeePerGas = maxPriorityFeePerGas;

  const c = new ethers.Contract(escrowAddress, MILESTONE_ESCROW_ACTION_ABI, signer);
  const ph =
    proofHashHex?.startsWith("0x") === true && proofHashHex.length === 66
      ? proofHashHex
      : ethers.ZeroHash;
  const tx = await c.releaseMilestone(assetTokenAddress, milestoneIndex, ph, feeOverrides);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/** Legacy helpers — prefer encoding on the client with viem; kept for admin tooling */
export async function buildApprovalPayload(wallet: string, spender: string, usdcAmount: string) {
  return {
    wallet,
    spender,
    usdcAmount,
    to: contracts.MockUSDC,
    data: "0x",
    note: "Use ERC20 transfer to USDC to treasury — approval not required for simple transfer"
  };
}

export async function buildMintPayload(wallet: string, assetTokenAddress: string, amountHuman: string) {
  return {
    wallet,
    assetToken: assetTokenAddress,
    amount: amountHuman,
    to: assetTokenAddress,
    data: "0x",
    note: "Mint is executed by relayer after USDC payment is verified"
  };
}
