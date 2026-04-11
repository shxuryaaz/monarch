/** Minimal ABI for primary subscription deposit into MilestoneEscrow. */
export const milestoneEscrowAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetToken", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;
