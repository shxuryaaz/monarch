import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import InvestRitualOverlay from "@/components/InvestRitualOverlay";
import { getPublicConfig, purchaseErrorDescription } from "@/lib/api";
import { executePurchaseFlow, type RitualPhase } from "@/lib/invest-flow";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useAsset } from "@/hooks/use-asset";
import { useWalletLiquidity } from "@/hooks/use-wallet-liquidity";
import { useToast } from "@/hooks/use-toast";
import { wagmiConfig } from "@/lib/wagmi";
import { erc20Abi } from "@/lib/chain";
import { assetImageAt } from "@/lib/asset-images";
import { useAssets } from "@/hooks/use-assets";

type SampleRow = { i: number; t: number; price: number; yieldPct: number };

const EXPLORER = "https://sepolia.etherscan.io/address/";

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { token } = useWalletAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isWalletWritePending } = useWriteContract();
  const { usdcRaw, refetchAll } = useWalletLiquidity();
  const { data, isLoading, isError } = useAsset(assetId);
  const { data: assetsList, refetch: refetchAssets } = useAssets();

  const { data: apiConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: getPublicConfig
  });

  const investUsd = 100;
  const investBaseUnits = BigInt(Math.round(investUsd * 1_000_000));
  const chainSettlement = apiConfig?.chainSettlementEnabled ?? false;
  const needsUsdc = Boolean(chainSettlement);
  const canAfford = !needsUsdc || (usdcRaw !== undefined && usdcRaw >= investBaseUnits);

  const [investingId, setInvestingId] = useState<string | null>(null);
  const [series, setSeries] = useState<SampleRow[]>([]);
  const [ritual, setRitual] = useState<{
    open: boolean;
    phase: RitualPhase;
    name: string;
    tx: string | null;
    err: string | null;
  }>({ open: false, phase: "idle", name: "", tx: null, err: null });

  const asset = data?.asset;

  const listIndex = useMemo(() => {
    if (!assetId || !assetsList?.assets.length) return 0;
    const idx = assetsList.assets.findIndex((a) => a.id === assetId);
    return idx >= 0 ? idx : 0;
  }, [assetId, assetsList?.assets]);

  useEffect(() => {
    if (!asset) return;
    const price = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
    const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
    const t = Date.now();
    setSeries((prev) => [...prev, { i: prev.length, t, price, yieldPct }].slice(-48));
  }, [asset]);

  const chartPriceData = useMemo(
    () => series.map((s, idx) => ({ name: String(idx + 1), v: s.price })),
    [series]
  );
  const chartYieldData = useMemo(
    () => series.map((s, idx) => ({ name: String(idx + 1), v: s.yieldPct })),
    [series]
  );

  const dismissRitualError = useCallback(() => {
    setRitual((r) => ({ ...r, open: false, phase: "idle", err: null }));
  }, []);

  const onRitualSuccessDone = useCallback(() => {
    setRitual({ open: false, phase: "idle", name: "", tx: null, err: null });
  }, []);

  const runInvest = useCallback(async () => {
    if (!token || !assetId || !asset) {
      if (!token) {
        toast({
          title: "Sign in required",
          description: "Use “Sign in with wallet” in the header before investing."
        });
      }
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

    const assetName = asset.name;
    setInvestingId(assetId);
    setRitual({ open: true, phase: "open", name: assetName, tx: null, err: null });

    try {
      await executePurchaseFlow({
        token,
        assetId,
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
          : "API demo mode (no chain settlement)."
      });
      await refetchAssets();
      await refetchAll();
      await queryClient.invalidateQueries({ queryKey: ["portfolio", token] });
      await queryClient.invalidateQueries({ queryKey: ["purchases", token] });
      await queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
    } catch (e) {
      const desc = purchaseErrorDescription(e);
      setRitual((r) => ({ ...r, phase: "error", err: desc }));
      toast({ title: "Could not complete purchase", description: desc, variant: "destructive" });
    } finally {
      setInvestingId(null);
    }
  }, [
    token,
    assetId,
    asset,
    investingId,
    chainSettlement,
    chainId,
    switchChainAsync,
    canAfford,
    toast,
    writeContractAsync,
    refetchAssets,
    refetchAll,
    queryClient,
    investUsd
  ]);

  useEffect(() => {
    if (isError && !isLoading) {
      navigate("/marketplace", { replace: true });
    }
  }, [isError, isLoading, navigate]);

  if (isLoading || !asset) {
    return (
      <div className="min-h-screen bg-background px-6 pb-20 pt-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const typeLabel = asset.type === "REAL_ESTATE" ? "Real Estate" : "Agriculture";
  const displayYield = (asset.oracleYieldPct ?? asset.expectedYieldPct).toFixed(1);
  const displayPrice = (asset.oraclePriceUsd ?? asset.tokenPriceUsd).toFixed(2);
  const investLoading = investingId === assetId;
  const walletLine = investLoading && isWalletWritePending ? "Waiting in wallet…" : investLoading ? "Processing…" : null;

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

      <div className="mx-auto max-w-4xl px-6 pb-20 pt-8">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Marketplace
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 overflow-hidden rounded-2xl border border-border surface-elevated"
        >
          <div className="relative h-56 md:h-72">
            <img
              src={assetImageAt(listIndex)}
              alt=""
              className="h-full w-full object-cover"
              width={1200}
              height={600}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <span className="absolute left-4 top-4 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
              {typeLabel}
            </span>
          </div>
          <div className="p-6 md:p-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{asset.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {asset.location}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground">Token price</p>
                <p className="mt-1 text-xl font-semibold">${displayPrice}</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground">Expected yield</p>
                <p className="mt-1 text-xl font-semibold">{displayYield}%</p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-xs text-muted-foreground">Available supply</p>
                <p className="mt-1 text-xl font-semibold">{asset.availableSupply.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
              <p>
                <span className="text-foreground/80">Token:</span>{" "}
                <a
                  href={`${EXPLORER}${asset.tokenAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-foreground underline underline-offset-2"
                >
                  {asset.tokenAddress}
                </a>
              </p>
              <p className="mt-1">
                <span className="text-foreground/80">Symbol:</span> {asset.symbol} · On-chain ID {asset.onchainAssetId}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={Boolean(token && needsUsdc && !canAfford) || investLoading}
                onClick={() => void runInvest()}
                className="rounded-lg bg-foreground px-8 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {walletLine ?? `Invest $${investUsd}`}
              </button>
              {needsUsdc && !canAfford && token ? (
                <p className="text-sm text-amber-200/90">Need at least {investUsd} USDC on Sepolia.</p>
              ) : null}
            </div>
          </div>
        </motion.div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border p-6 surface-elevated"
          >
            <p className="text-sm font-medium text-foreground">Oracle price (sampled)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">One point per ~15s poll while you stay on this page</p>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPriceData}>
                  <defs>
                    <linearGradient id="detailPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8
                    }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--foreground))" fill="url(#detailPrice)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border p-6 surface-elevated"
          >
            <p className="text-sm font-medium text-foreground">Yield mark (sampled)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Oracle vs expected yield over polls</p>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartYieldData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    width={40}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8
                    }}
                    formatter={(v: number) => [`${v.toFixed(2)}%`, "Yield"]}
                  />
                  <Line type="monotone" dataKey="v" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
