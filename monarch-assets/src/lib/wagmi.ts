import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { mainnet, sepolia } from "wagmi/chains";

/** Prefer Alchemy/Infura/Neon RPC — public Sepolia endpoints often rate-limit and viem will error. */
const sepoliaRpc =
  typeof import.meta.env.VITE_SEPOLIA_RPC_URL === "string" &&
  import.meta.env.VITE_SEPOLIA_RPC_URL.length > 0
    ? import.meta.env.VITE_SEPOLIA_RPC_URL
    : undefined;

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
    [sepolia.id]: http(sepoliaRpc),
    [mainnet.id]: http()
  }
});
