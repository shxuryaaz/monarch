import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import AssetCard from "@/components/AssetCard";
import InvestRitualOverlay from "@/components/InvestRitualOverlay";
import { executePurchaseFlow, type RitualPhase } from "@/lib/invest-flow";
import { getPublicConfig, purchaseErrorDescription } from "@/lib/api";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useAssets } from "@/hooks/use-assets";
import { useWalletLiquidity } from "@/hooks/use-wallet-liquidity";
import { assetImageAt } from "@/lib/asset-images";
import { useToast } from "@/hooks/use-toast";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/chain";

const typeFilters = ["All", "Real Estate", "Agriculture"];
const yieldFilters = ["Any Yield", "5%+", "7%+", "9%+"];

const Marketplace = () => {
  const { token } = useWalletAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isWalletWritePending } = useWriteContract();
  const { usdcRaw, refetchAll } = useWalletLiquidity();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [yieldFilter, setYieldFilter] = useState("Any Yield");
  const [investingId, setInvestingId] = useState<string | null>(null);
  const [ritual, setRitual] = useState<{
    open: boolean;
    phase: RitualPhase;
    name: string;
    tx: string | null;
    err: string | null;
  }>({ open: false, phase: "idle", name: "", tx: null, err: null });
  const { data, refetch } = useAssets();

  const { data: apiConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: getPublicConfig
  });

  const investUsd = 100;
  const investBaseUnits = BigInt(Math.round(investUsd * 1_000_000));
  const chainSettlement = apiConfig?.chainSettlementEnabled ?? false;
  const needsUsdc = Boolean(chainSettlement);
  const canAfford =
    !needsUsdc || (usdcRaw !== undefined && usdcRaw >= investBaseUnits);

  const dismissRitualError = useCallback(() => {
    setRitual((r) => ({ ...r, open: false, phase: "idle", err: null }));
  }, []);

  const onRitualSuccessDone = useCallback(() => {
    setRitual({ open: false, phase: "idle", name: "", tx: null, err: null });
  }, []);

  const handleInvest = useCallback(
    async (rawId: string) => {
      if (!token) {
        toast({
          title: "Sign in required",
          description: "Use “Sign in with wallet” in the header before investing."
        });
        return;
      }
      if (investingId) return;

      if (chainSettlement && chainId !== sepolia.id) {
        try {
          await switchChainAsync?.({ chainId: sepolia.id });
        } catch {
          toast({ title: "Wrong network", description: "Switch to Sepolia in your wallet.", variant: "destructive" });
          return;
        }
      }
      if (chainSettlement && !canAfford) {
        toast({
          title: "Insufficient USDC",
          description: `You need at least ${investUsd} mock USDC on Sepolia. Use Test USDC in the header.`,
          variant: "destructive"
        });
        return;
      }

      const assetName = data?.assets?.find((a) => a.id === rawId)?.name ?? "Asset";
      setInvestingId(rawId);
      setRitual({ open: true, phase: "open", name: assetName, tx: null, err: null });

      try {
        await executePurchaseFlow({
          token,
          assetId: rawId,
          investUsd,
          chainSettlement,
          writeContractAsync,
          wagmiConfig,
          onPhase: (phase, payload) => {
            if (phase === "sign") {
              toast({
                title: "Confirm in your wallet",
                description: "Approve the USDC transfer in your wallet."
              });
            }
            setRitual((r) => ({ ...r, phase, tx: payload?.paymentTxHash ?? r.tx }));
          }
        });
        toast({
          title: chainSettlement ? "Purchase settled on-chain" : "Investment recorded",
          description: chainSettlement
            ? "USDC transferred and RWA tokens minted via relayer."
            : "API demo mode (no chain settlement). Configure PRIVATE_KEY + SEPOLIA_RPC_URL for real USDC flow."
        });

        await refetch();
        await refetchAll();
        await queryClient.invalidateQueries({ queryKey: ["portfolio", token] });
        await queryClient.invalidateQueries({ queryKey: ["purchases", token] });
      } catch (e) {
        const desc = purchaseErrorDescription(e);
        setRitual((r) => ({ ...r, phase: "error", err: desc }));
        toast({
          title: "Could not complete purchase",
          description: desc,
          variant: "destructive"
        });
      } finally {
        setInvestingId(null);
      }
    },
    [
      token,
      toast,
      refetch,
      refetchAll,
      queryClient,
      chainSettlement,
      chainId,
      switchChainAsync,
      writeContractAsync,
      canAfford,
      investingId,
      data?.assets,
      investUsd
    ]
  );

  const maxAvail = useMemo(() => Math.max(...(data?.assets ?? []).map((a) => a.availableSupply), 1), [data?.assets]);

  const filtered = useMemo(() => {
    const assets = (data?.assets ?? []).map((a, i) => ({
      image: assetImageAt(i),
      name: a.name,
      location: a.location,
      type: a.type === "REAL_ESTATE" ? ("Real Estate" as const) : ("Agriculture" as const),
      yield_pct: `${(a.oracleYieldPct ?? a.expectedYieldPct).toFixed(1)}%`,
      tokenPrice: `$${(a.oraclePriceUsd ?? a.tokenPriceUsd).toFixed(2)}`,
      supply: Math.min(100, Math.max(6, Math.round((a.availableSupply / maxAvail) * 100))),
      yieldNum: a.oracleYieldPct ?? a.expectedYieldPct,
      priceNum: a.oraclePriceUsd ?? a.tokenPriceUsd,
      rawId: a.id
    }));
    return assets.filter((a) => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.location.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (typeFilter !== "All" && a.type !== typeFilter) return false;
      if (yieldFilter === "5%+" && a.yieldNum < 5) return false;
      if (yieldFilter === "7%+" && a.yieldNum < 7) return false;
      if (yieldFilter === "9%+" && a.yieldNum < 9) return false;
      return true;
    });
  }, [data?.assets, maxAvail, search, typeFilter, yieldFilter]);

  return (
    <div className="min-h-screen bg-background">
      <InvestRitualOverlay
        open={ritual.open}
        phase={ritual.phase}
        assetName={ritual.name}
        paymentTxHash={ritual.tx}
        errorMessage={ritual.err}
        chainMode={chainSettlement}
        onDismissError={dismissRitualError}
        onSuccessDone={onRitualSuccessDone}
      />
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Marketplace</h1>
          <p className="mt-2 text-secondary-foreground">
            Browse tokenized RWAs. When chain settlement is on, you send Mock USDC to the treasury, then the relayer mints AssetTokens.
          </p>
          {chainSettlement && (
            <p className="mt-2 text-xs text-muted-foreground">
              Mock USDC: {CONTRACTS.mockUsdc} · Treasury: {apiConfig?.treasuryAddress?.slice(0, 10)}…
            </p>
          )}
          {needsUsdc && !canAfford && token && (
            <p className="mt-2 text-sm text-amber-200/90">You need at least {investUsd} USDC on Sepolia to invest. Grab test USDC from the header.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="sticky top-16 z-40 mt-8 flex flex-wrap items-center gap-3 border-b border-border bg-background/80 pb-5 pt-2 backdrop-blur-xl"
        >
          <div className="relative flex min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
      className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-1 rounded-lg border border-border p-1">
            {typeFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  typeFilter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex gap-1 rounded-lg border border-border p-1">
            {yieldFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setYieldFilter(f)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  yieldFilter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </motion.div>

        {filtered.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((asset, i) => (
              <div key={asset.rawId}>
                <AssetCard
                  {...asset}
                  index={i}
                  detailHref={`/marketplace/${asset.rawId}`}
                  investLabel={
                    investingId === asset.rawId && isWalletWritePending
                      ? "Waiting in wallet…"
                      : investingId === asset.rawId
                        ? "Processing…"
                        : `Invest $${investUsd}`
                  }
                  onInvest={() => handleInvest(asset.rawId)}
                  investLoading={investingId === asset.rawId}
                  investDisabled={Boolean(token && needsUsdc && !canAfford)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-24 text-center">
            <p className="text-lg font-medium text-foreground">No assets found</p>
            <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
