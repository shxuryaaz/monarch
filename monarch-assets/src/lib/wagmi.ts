import { createConfig, http } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";

/**
 * metaMask() uses @metamask/connect-evm so users can connect when `window.ethereum`
 * is missing (e.g. Incognito without extension). injected() covers other wallets.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [metaMask(), injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http()
  }
});
