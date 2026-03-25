import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { apiFetch } from "@/lib/api";

const TOKEN_KEY = "monarch_jwt";

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isSignPending } = useSignMessage();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
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
        const connector = connectors[0];
        if (!connector) throw new Error("No wallet connector available");
        const result = await connectAsync({
          connector,
          chainId: sepolia.id
        });
        const first = result.accounts[0];
        walletAddress = (typeof first === "string" ? first : first.address) as `0x${string}`;
      }
      if (!walletAddress) throw new Error("No account from wallet");
      await signInWithAddress(walletAddress);
    } finally {
      setAuthLoading(false);
    }
  }, [address, isConnected, connectors, connectAsync, signInWithAddress]);

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
