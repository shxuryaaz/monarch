import { createConfig, fallback, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { mainnet, sepolia } from "wagmi/chains";

/**
 * Viem aggregates failures across transports. A `fallback` of several **public** Sepolia RPCs
 * often hits rate limits and surfaces "RPC endpoint returned too many errors, retrying…".
 *
 * When `VITE_SEPOLIA_RPC_URL` is set (Alchemy/Infura), we use **only** that endpoint with
 * generous retries — no rotation into flaky public nodes.
 */
function sepoliaHttpOpts() {
  return {
    batch: false as const,
    retryCount: 10,
    retryDelay: 1_500,
    timeout: 60_000
  };
}

function sepoliaTransport() {
  const primary = import.meta.env.VITE_SEPOLIA_RPC_URL;
  const secondary = import.meta.env.VITE_SEPOLIA_RPC_FALLBACK_URL;
  const opts = sepoliaHttpOpts();

  if (typeof primary === "string" && primary.startsWith("http")) {
    const second =
      typeof secondary === "string" && secondary.startsWith("http") ? secondary : null;
    if (second) {
      return fallback([http(primary, opts), http(second, opts)], { rank: false, retryCount: 2 });
    }
    return http(primary, opts);
  }

  const chainDefault = sepolia.rpcUrls.default.http[0];
  const extras = ["https://rpc.sepolia.org", "https://ethereum-sepolia-rpc.publicnode.com"] as const;
  const urls = [...new Set([chainDefault, ...extras])];
  return fallback(urls.map((url) => http(url, opts)), { rank: false, retryCount: 2 });
}

/**
 * metaMask() uses @metamask/connect-evm so users can connect when `window.ethereum`
 * is missing (e.g. Incognito without extension). injected() covers other wallets.
 *
 * Include mainnet so SIWE / signMessage works when the wallet is on Ethereum mainnet
 * (eip155:1). Product flows that touch contracts still switch to Sepolia where needed.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [metaMask(), injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: sepoliaTransport(),
    [mainnet.id]: http({ retryCount: 3, retryDelay: 400, timeout: 25_000 })
  }
});
