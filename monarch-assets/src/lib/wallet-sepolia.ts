const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7" as const;

const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

/**
 * If the user has never added Sepolia, registers it with VITE_SEPOLIA_RPC_URL or a stable public RPC.
 * If Sepolia already exists in MetaMask (often with a flaky default), this no-ops — user may need to edit the network RPC in the wallet.
 */
export async function tryAddSepoliaWithProjectRpc(): Promise<void> {
  const envUrl = import.meta.env.VITE_SEPOLIA_RPC_URL;
  const url =
    typeof envUrl === "string" && envUrl.length > 0 ? envUrl : DEFAULT_SEPOLIA_RPC;
  const eth =
    typeof window !== "undefined"
      ? (window as unknown as { ethereum?: { request?: (args: unknown) => Promise<unknown> } }).ethereum
      : undefined;
  if (!eth || typeof eth.request !== "function") return;

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
