import { createConfig, fallback, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { mainnet, sepolia } from "wagmi/chains";

/** Set in Vercel/CI — Alchemy/Infura HTTPS URL for Sepolia (baked in at build time). */
const sepoliaRpc =
  typeof import.meta.env.VITE_SEPOLIA_RPC_URL === "string" &&
  import.meta.env.VITE_SEPOLIA_RPC_URL.length > 0
    ? import.meta.env.VITE_SEPOLIA_RPC_URL
    : undefined;

/**
 * Extra public endpoints so viem can rotate when one rate-limits ("RPC returned too many errors").
 * Wallet **submission** still uses MetaMask’s Sepolia RPC — users may need to set that RPC in the wallet.
 */
const SEPOLIA_PUBLIC_FALLBACKS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org"
] as const;

function sepoliaHttpTransport() {
  const urls = [
    ...(sepoliaRpc ? [sepoliaRpc] : []),
    ...SEPOLIA_PUBLIC_FALLBACKS
  ];
  const transports = urls.map((url) => http(url));
  if (transports.length === 1) return transports[0]!;
  return fallback(transports);
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
    [sepolia.id]: sepoliaHttpTransport(),
    [mainnet.id]: http()
  }
});
