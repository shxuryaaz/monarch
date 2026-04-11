import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { ProviderNotFoundError, useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { apiFetch } from "@/lib/api";
import {
  MONARCH_JWT_INVALID_EVENT,
  MONARCH_JWT_STORAGE_KEY
} from "@/lib/auth-token";

const NO_WALLET_HELP =
  "No Ethereum wallet is available in this browser. Install MetaMask (or another Web3 wallet). If you use Incognito/private mode, allow the wallet extension for this site or use a normal window—extensions are often blocked there.";

type WalletAuthContextValue = {
  token: string | null;
  address: `0x${string}` | undefined;
  shortAddress: string;
  isConnected: boolean;
  isPending: boolean;
  connectAndSignIn: () => Promise<void>;
  logout: () => void;
};

const WalletAuthContext = createContext<WalletAuthContextValue | null>(null);

/**
 * Single auth state for the app. Do not duplicate wallet logic in another hook — multiple
 * `useWalletAuth` instances used to each fire auto sign-in → many MetaMask requests.
 */
export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: isSignPending } = useSignMessage();
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(MONARCH_JWT_STORAGE_KEY)
  );
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
      localStorage.setItem(MONARCH_JWT_STORAGE_KEY, verified.token);
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

  useEffect(() => {
    const onJwtInvalid = () => {
      setToken(null);
    };
    window.addEventListener(MONARCH_JWT_INVALID_EVENT, onJwtInvalid);
    return () => window.removeEventListener(MONARCH_JWT_INVALID_EVENT, onJwtInvalid);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(MONARCH_JWT_STORAGE_KEY);
    setToken(null);
    autoSignAttemptedRef.current = false;
    disconnect();
  }, [disconnect]);

  const shortAddress = useMemo(
    () => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""),
    [address]
  );

  const isPending = isConnectPending || isSignPending || authLoading;

  const value = useMemo<WalletAuthContextValue>(
    () => ({
      token,
      address: address as `0x${string}` | undefined,
      shortAddress,
      isConnected,
      isPending,
      connectAndSignIn,
      logout
    }),
    [
      token,
      address,
      shortAddress,
      isConnected,
      isPending,
      connectAndSignIn,
      logout
    ]
  );

  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

export function useWalletAuth(): WalletAuthContextValue {
  const ctx = useContext(WalletAuthContext);
  if (!ctx) {
    throw new Error("useWalletAuth must be used within WalletAuthProvider");
  }
  return ctx;
}
