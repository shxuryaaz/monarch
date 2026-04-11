const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7" as const;

/**
 * If the user has never added Sepolia, registers it with the project RPC from env.
 * If Sepolia already exists in MetaMask (often with a flaky public RPC), this no-ops or fails silently — user must edit the network in MetaMask.
 */
export async function tryAddSepoliaWithProjectRpc(): Promise<void> {
  const url = import.meta.env.VITE_SEPOLIA_RPC_URL;
  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  if (typeof url !== "string" || url.length === 0 || !eth || typeof eth.request !== "function") return;

  try {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: SEPOLIA_CHAIN_ID_HEX,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [url],
          blockExplorerUrls: ["https://sepolia.etherscan.io"]
        }
      ]
    });
  } catch {
    // Already added with different RPC, user rejected, or wallet limitation — MM settings fix applies
  }
}
