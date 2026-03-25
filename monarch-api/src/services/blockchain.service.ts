import { ethers } from "ethers";
import { env } from "../config/env.js";
import { contracts } from "./contracts.js";
import deployed from "../../../monarch-contracts/deployed-addresses.json" with { type: "json" };

const ERC20_IFACE = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

const ERC20_ABI = [
  "function transfer(address to, uint256 value) external returns (bool)",
  "function mint(address to, uint256 amount) external"
];

export function getTreasuryAddress(): string {
  return (env.TREASURY_ADDRESS ?? deployed.deployer).toLowerCase();
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

export async function relayerUsdcTransfer(to: string, amountBaseUnits: bigint): Promise<string> {
  const signer = getRelayerWallet();
  const usdc = contracts.MockUSDC;
  const c = new ethers.Contract(usdc, ERC20_ABI, signer);
  const tx = await c.transfer(to, amountBaseUnits);
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
