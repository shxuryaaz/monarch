import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProviderNotFoundError, useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { apiFetch } from "@/lib/api";
import { getValidStoredJwt, TOKEN_KEY } from "@/lib/jwt-storage";

const NO_WALLET_HELP =
  "No Ethereum wallet is available in this browser. Install MetaMask (or another Web3 wallet). If you use Incognito/private mode, allow the wallet extension for this site or use a normal window—extensions are often blocked there.";

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isSignPending } = useSignMessage();
  const [token, setToken] = useState<string | null>(() => getValidStoredJwt());
  const [authLoading, setAuthLoading] = useState(false);
  const autoSignAttemptedRef = useRef(false);

  const signInWithAddress = useCallback(
    async (walletAddress: `0x${string}`) => {
      const challenge = await apiFetch<{ message: string }>("/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ wallet: walletAddress })
      });
      const signature = await signMessageAsync({
        message: challenge.message,
        account: walletAddress
      });
      const verified = await apiFetch<{ token: string }>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ message: challenge.message, signature })
      });
      localStorage.setItem(TOKEN_KEY, verified.token);
      setToken(verified.token);
    },
    [signMessageAsync]
  );

  const connectAndSignIn = useCallback(async () => {
    setAuthLoading(true);
    try {
      let walletAddress = address as `0x${string}` | undefined;
      if (!isConnected || !walletAddress) {
        if (connectors.length === 0) {
          throw new Error(NO_WALLET_HELP);
        }
        let lastError: unknown;
        let connected: Awaited<ReturnType<typeof connectAsync>> | undefined;
        for (const connector of connectors) {
          try {
            connected = await connectAsync({
              connector,
              chainId: sepolia.id
            });
            break;
          } catch (e) {
            lastError = e;
            if (e instanceof ProviderNotFoundError) continue;
            if (
              e instanceof Error &&
              (e.message.includes("dependency \"@metamask/connect-evm\" not found") ||
                e.message.includes("@metamask/connect-evm"))
            ) {
              continue;
            }
            throw e;
          }
        }
        if (!connected) {
          if (lastError instanceof ProviderNotFoundError) {
            throw new Error(NO_WALLET_HELP);
          }
          throw lastError instanceof Error ? lastError : new Error(NO_WALLET_HELP);
        }
        const first = connected.accounts[0];
        walletAddress = (typeof first === "string" ? first : first.address) as `0x${string}`;
      }
      if (!walletAddress) throw new Error("No account from wallet");
      await signInWithAddress(walletAddress);
    } finally {
      setAuthLoading(false);
    }
  }, [address, isConnected, connectors, connectAsync, signInWithAddress]);

  useEffect(() => {
    const onJwtInvalid = () => setToken(null);
    window.addEventListener("monarch-jwt-invalid", onJwtInvalid);
    return () => window.removeEventListener("monarch-jwt-invalid", onJwtInvalid);
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      autoSignAttemptedRef.current = false;
      return;
    }
    if (token) return;
    if (autoSignAttemptedRef.current) return;
    autoSignAttemptedRef.current = true;
    void signInWithAddress(address as `0x${string}`).catch(() => {
      autoSignAttemptedRef.current = false;
    });
  }, [isConnected, address, token, signInWithAddress]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    autoSignAttemptedRef.current = false;
    disconnect();
  }, [disconnect]);

  const shortAddress = useMemo(
    () => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""),
    [address]
  );

  const isPending = isConnectPending || isSignPending || authLoading;

  return {
    token,
    address,
    shortAddress,
    isConnected,
    isPending,
    connectAndSignIn,
    logout
  };
}
