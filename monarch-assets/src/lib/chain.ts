/** Sepolia contract addresses — override with VITE_* in .env */

export const SEPOLIA_CHAIN_ID = 11155111;

/**
 * Secondary-market pool: RWA **sells** send tokens here (primary buy recipient comes from API).
 * Override with VITE_SECONDARY_TREASURY_ADDRESS or legacy VITE_TREASURY_ADDRESS.
 */
const secondaryTreasuryResolved = (import.meta.env.VITE_SECONDARY_TREASURY_ADDRESS ??
  import.meta.env.VITE_TREASURY_ADDRESS ??
  "0xF11Be4cd94AAfE40A1d08B9842F351A60600Ab86") as `0x${string}`;

export const CONTRACTS = {
  mockUsdc: (import.meta.env.VITE_MOCK_USDC_ADDRESS ?? "0x52f3E714cff72DB398F70E9E607B15105b5F2302") as `0x${string}`,
  payoutDistributor: (import.meta.env.VITE_PAYOUT_DISTRIBUTOR_ADDRESS ??
    "0xff82ffF721997a4095Ed7f07d7232167C76d4dD8") as `0x${string}`,
  secondaryTreasury: secondaryTreasuryResolved,
  /** @deprecated Alias of secondaryTreasury */
  treasury: secondaryTreasuryResolved
} as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

/** MockUSDC includes open faucet for Sepolia demos */
export const mockUsdcAbi = [
  ...erc20Abi,
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  }
] as const;

export const payoutDistributorAbi = [
  {
    type: "function",
    name: "claimYield",
    stateMutability: "nonpayable",
    inputs: [{ name: "assetToken", type: "address" }],
    outputs: []
  }
] as const;
