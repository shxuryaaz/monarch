import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  Check,
  Link2,
  Copy,
  Leaf,
  LineChart as LineChartIcon,
  MapPin,
  Radio,
  Scale,
  Shield
} from "lucide-react";
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
import SellRitualOverlay from "@/components/SellRitualOverlay";
import { SupplyMeter } from "@/components/SupplyMeter";
import { SellRwaPanel } from "@/components/SellRwaPanel";
import { AssetMapEmbed } from "@/components/AssetMapEmbed";
import { getAssetTransparency, getPublicConfig, purchaseErrorDescription } from "@/lib/api";
import { executePurchaseFlow, type RitualPhase } from "@/lib/invest-flow";
import type { SellRitualPhase, SellRitualPhasePayload } from "@/lib/sell-flow";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useAsset } from "@/hooks/use-asset";
import { useWalletLiquidity } from "@/hooks/use-wallet-liquidity";
import { useToast } from "@/hooks/use-toast";
import { wagmiConfig } from "@/lib/wagmi";
import { tryAddSepoliaWithProjectRpc } from "@/lib/wallet-sepolia";
import { assetImageAt } from "@/lib/asset-images";
import { useAssets } from "@/hooks/use-assets";
import { usePortfolio } from "@/hooks/use-portfolio";
import { ParticipantAcknowledgment } from "@/components/ParticipantAcknowledgment";
import { getTrustFinancialMetrics, getIotTelemetrySignal } from "@/lib/asset-trust-dmetrics";
import { ownershipRightsParagraph, spvStructureParagraph } from "@/lib/asset-legal-copy";
import { InvestAmountSelector } from "@/components/InvestAmountSelector";
import {
  clampUsd,
  computeInvestBounds,
  hasEnoughUsdcBalance,
  INVEST_GLOBAL_MAX,
  usdToUsdcBaseUnits
} from "@/lib/invest-amount";
import { tranchePctRemaining } from "@/lib/tranche";

type SampleRow = { i: number; t: number; price: number; yieldPct: number };

const EXPLORER = "https://sepolia.etherscan.io/address/";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

const fmtTime = (ts: number) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

function fallbackNarrative(asset: {
  name: string;
  location: string;
  type: string;
  totalAssetValue: number;
  expectedYieldPct: number;
  tokenPriceUsd: number;
}): string[] {
  const sleeve = asset.type === "REAL_ESTATE" ? "real estate" : "agriculture and land-backed";
  return [
    `${asset.name} is listed as a tokenized ${sleeve} sleeve in ${asset.location}. The table below summarizes issuer-modeled cash yield, token reference price, and notional pool size.`,
    "No long-form offering memo is on file for this listing yet. Ask your sponsor for the private placement deck, distribution policy, and any lock-up or transfer restrictions before transferring funds."
  ];
}

function CopyAddr({ address, label }: { address: string; label: string }) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const short = `${address.slice(0, 10)}…${address.slice(-8)}`;
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-foreground">{short}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground hover:bg-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setDone(true);
              toast({ title: "Copied", description: "Address copied to clipboard." });
              window.setTimeout(() => setDone(false), 2000);
            } catch {
              toast({ title: "Copy failed", variant: "destructive" });
            }
          }}
        >
          {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {done ? "Copied" : "Copy"}
        </button>
        <a
          href={`${EXPLORER}${address}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-foreground underline underline-offset-2 hover:opacity-90"
        >
          Etherscan
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </dd>
    </div>
  );
}

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
  const { data, isLoading, isError, dataUpdatedAt } = useAsset(assetId);
  const { data: assetsList, refetch: refetchAssets } = useAssets();
  const { data: portfolio, dataUpdatedAt: portfolioUpdatedAt = 0 } = usePortfolio(token ?? undefined);

  const { data: apiConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: getPublicConfig
  });

  const { data: transparency } = useQuery({
    queryKey: ["asset-transparency", assetId],
    queryFn: () => getAssetTransparency(assetId!),
    enabled: Boolean(assetId)
  });

  const chainSettlement = apiConfig?.chainSettlementEnabled ?? false;
  const needsUsdc = Boolean(chainSettlement);

  const [investingId, setInvestingId] = useState<string | null>(null);
  const [participantAck, setParticipantAck] = useState(false);
  const [investUsd, setInvestUsd] = useState(INVEST_GLOBAL_MAX);
  const [series, setSeries] = useState<SampleRow[]>([]);
  const [ritual, setRitual] = useState<{
    open: boolean;
    phase: RitualPhase;
    name: string;
    tx: string | null;
    err: string | null;
  }>({ open: false, phase: "idle", name: "", tx: null, err: null });

  const [sellRitual, setSellRitual] = useState<{
    open: boolean;
    phase: SellRitualPhase;
    name: string;
    transferTx: string | null;
    payoutTx: string | null;
    err: string | null;
  }>({ open: false, phase: "idle", name: "", transferTx: null, payoutTx: null, err: null });

  const asset = data?.asset;

  const investBounds = useMemo(() => (asset ? computeInvestBounds(asset) : null), [asset]);

  useEffect(() => {
    if (!asset?.id) return;
    const b = computeInvestBounds(asset);
    if (!b.valid) return;
    setInvestUsd((prev) => {
      if (prev >= b.minUsd && prev <= b.maxUsd) return clampUsd(b.minUsd, b.maxUsd, prev);
      return b.minUsd;
    });
  }, [asset, dataUpdatedAt]);

  const investUsdClamped =
    investBounds?.valid ? clampUsd(investBounds.minUsd, investBounds.maxUsd, investUsd) : investUsd;
  const investBaseUnits = usdToUsdcBaseUnits(investUsdClamped);

  const listIndex = useMemo(() => {
    if (!assetId || !assetsList?.assets.length) return 0;
    const idx = assetsList.assets.findIndex((a) => a.id === assetId);
    return idx >= 0 ? idx : 0;
  }, [assetId, assetsList?.assets]);

  const assetIdRef = useRef(asset?.id);

  useEffect(() => {
    if (!asset) return;

    if (assetIdRef.current !== asset.id) {
      setSeries([]);
      assetIdRef.current = asset.id;
    }

    const price = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
    const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
    const t = Date.now();
    setSeries((prev) => [...prev, { i: prev.length, t, price, yieldPct }].slice(-48));
  }, [dataUpdatedAt, asset?.id]);

  const chartPriceData = useMemo(
    () => series.map((s, idx) => ({ name: String(idx + 1), v: s.price })),
    [series]
  );
  const chartYieldData = useMemo(
    () => series.map((s, idx) => ({ name: String(idx + 1), v: s.yieldPct })),
    [series]
  );

  const descriptionParagraphs = useMemo(() => {
    if (!asset) return [];
    const raw = asset.description?.trim();
    if (raw) return raw.split(/\n\n+/).filter(Boolean);
    return fallbackNarrative(asset);
  }, [asset]);

  const trustFin = useMemo(() => {
    if (!asset) return null;
    const yieldPct = asset.oracleYieldPct ?? asset.expectedYieldPct;
    return getTrustFinancialMetrics({
      onchainAssetId: asset.onchainAssetId,
      totalAssetValue: asset.totalAssetValue,
      yieldPct
    });
  }, [asset]);

  const iotSignal = useMemo(() => (asset ? getIotTelemetrySignal(asset.onchainAssetId) : null), [asset]);

  const dismissRitualError = useCallback(() => {
    setRitual((r) => ({ ...r, open: false, phase: "idle", err: null }));
  }, []);

  const onRitualSuccessDone = useCallback(() => {
    setRitual({ open: false, phase: "idle", name: "", tx: null, err: null });
  }, []);

  const dismissSellRitualError = useCallback(() => {
    setSellRitual({ open: false, phase: "idle", name: "", transferTx: null, payoutTx: null, err: null });
  }, []);

  const onSellRitualSuccessDone = useCallback(() => {
    setSellRitual({ open: false, phase: "idle", name: "", transferTx: null, payoutTx: null, err: null });
  }, []);

  const handleSellPhase = useCallback((phase: SellRitualPhase, payload?: SellRitualPhasePayload) => {
    setSellRitual((r) => ({
      open: true,
      phase,
      name: payload?.name ?? r.name,
      transferTx: payload?.transferTxHash ?? r.transferTx,
      payoutTx: payload?.payoutTxHash ?? r.payoutTx,
      err: phase === "error" ? (payload?.message ?? "Unknown error") : null
    }));
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

    if (!participantAck) {
      toast({
        title: "Confirmation required",
        description: "Please read and confirm the participant terms before you subscribe."
      });
      return;
    }

    if (!investBounds?.valid) {
      toast({
        title: "Cannot subscribe",
        description: investBounds?.invalidReason ?? "No valid subscription range for this listing.",
        variant: "destructive"
      });
      return;
    }

    if (chainSettlement && chainId !== sepolia.id) {
      try {
        await switchChainAsync?.({ chainId: sepolia.id });
      } catch {
        toast({ title: "Wrong network", description: "Switch to Sepolia in your wallet.", variant: "destructive" });
        return;
      }
    }
    if (chainSettlement && !hasEnoughUsdcBalance(needsUsdc, usdcRaw, usdToUsdcBaseUnits(investUsdClamped))) {
      toast({
        title: "Insufficient USDC",
        description: `You need at least ${investUsdClamped} USDC on Sepolia. Use test USDC from the header.`,
        variant: "destructive"
      });
      return;
    }

    const assetName = asset.name;
    setInvestingId(assetId);
    setRitual({ open: true, phase: "open", name: assetName, tx: null, err: null });

    try {
      if (chainSettlement) {
        await tryAddSepoliaWithProjectRpc();
      }
      await executePurchaseFlow({
        token,
        assetId,
        investUsd: investUsdClamped,
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
        title: chainSettlement ? "Subscription settled on-chain" : "Subscription recorded",
        description: chainSettlement
          ? "USDC received and receipt tokens issued per this offering’s configuration."
          : "Your allocation was recorded through the platform API."
      });
      await refetchAssets();
      await refetchAll();
      await queryClient.invalidateQueries({ queryKey: ["portfolio", token] });
      await queryClient.invalidateQueries({ queryKey: ["purchases", token] });
      await queryClient.refetchQueries({ queryKey: ["asset", assetId] });
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
    usdcRaw,
    needsUsdc,
    toast,
    writeContractAsync,
    refetchAssets,
    refetchAll,
    queryClient,
    investUsdClamped,
    investBounds,
    participantAck
  ]);

  useEffect(() => {
    if (isError && !isLoading) {
      navigate("/marketplace", { replace: true });
    }
  }, [isError, isLoading, navigate]);

  if (isLoading || !asset || !trustFin) {
    return (
      <div className="min-h-screen bg-background px-4 pb-20 pt-6 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1400px] animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-[min(420px,45vh)] rounded-2xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const typeLabel = asset.type === "REAL_ESTATE" ? "Real Estate" : "Agriculture";
  const TypeIcon = asset.type === "REAL_ESTATE" ? Building2 : Leaf;
  const displayYield = (asset.oracleYieldPct ?? asset.expectedYieldPct).toFixed(1);
  const displayPrice = (asset.oraclePriceUsd ?? asset.tokenPriceUsd).toFixed(2);
  const investLoading = investingId === assetId;
  const walletLine =
    investLoading && isWalletWritePending ? "Waiting in wallet…" : investLoading ? "Processing…" : null;
  const gradientPriceId = `detailPrice-${asset.id}`;
  const riskLabel = asset.riskLabel ?? "—";
  const holding = portfolio?.positions.find((p) => p.asset.id === asset.id);
  const displayAvailableSupply =
    holding && holding.asset.id === asset.id ? holding.asset.availableSupply : asset.availableSupply;
  const pctRemaining = tranchePctRemaining({
    availableSupply: displayAvailableSupply,
    tokensOffered: asset.tokensOffered
  });
  const supplyMeterPollKey = `${dataUpdatedAt}-${portfolioUpdatedAt}-${displayAvailableSupply}`;
  const oracleMarksActive =
    asset.oraclePriceUsd != null || asset.oracleYieldPct != null || dataUpdatedAt > 0;

  const investSubline = chainSettlement
    ? "Primary settlement uses USDC on Sepolia for this deployment."
    : "Allocations are recorded through the platform API until on-chain settlement is enabled.";

  const canAfford = !needsUsdc || hasEnoughUsdcBalance(needsUsdc, usdcRaw, investBaseUnits);

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

      <SellRitualOverlay
        open={sellRitual.open}
        phase={sellRitual.phase}
        assetName={sellRitual.name || asset.name}
        transferTxHash={sellRitual.transferTx}
        payoutTxHash={sellRitual.payoutTx}
        errorMessage={sellRitual.err}
        chainMode={chainSettlement}
        onDismissError={dismissSellRitualError}
        onSuccessDone={onSellRitualSuccessDone}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-10">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="grid lg:grid-cols-[1.05fr_1fr]">
            <div className="relative aspect-[4/3] min-h-[240px] lg:aspect-auto lg:min-h-[400px]">
              <img
                src={assetImageAt(listIndex)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                width={1400}
                height={900}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-background/15 lg:to-background/95" />
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <TypeIcon className="h-3.5 w-3.5 opacity-80" />
                {typeLabel}
              </span>
            </div>
            <div className="flex flex-col justify-center gap-6 p-6 sm:p-8 lg:p-10 lg:pl-8">
              <div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[2.25rem]">
                  {asset.name}
                </h1>
                <p className="mt-2 flex items-start gap-2 text-base text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {asset.location}
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/25 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Target cash yield (model)
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                  {displayYield}%
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Reference token price</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-foreground">${displayPrice}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Notional pool</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{fmtUsd(asset.totalAssetValue)}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                <ParticipantAcknowledgment
                  variant="compact"
                  requireAccept
                  accepted={participantAck}
                  onAcceptedChange={setParticipantAck}
                  idPrefix={`asset-${asset.id}`}
                />
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subscribe</p>
                  {investBounds?.valid ? (
                    <>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmtUsd(investUsdClamped)}</p>
                      <div className="mt-3">
                        <InvestAmountSelector
                          bounds={investBounds}
                          valueUsd={investUsdClamped}
                          onValueUsdChange={setInvestUsd}
                          disabled={investLoading}
                          idPrefix={`asset-${asset.id}`}
                          defaultCollapsed
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground leading-snug">
                      {investBounds?.invalidReason ??
                        "Subscription amounts are not available for this listing."}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground leading-snug">{investSubline}</p>
                  <button
                    type="button"
                    disabled={
                      !investBounds?.valid ||
                      Boolean(token && needsUsdc && !canAfford) ||
                      investLoading ||
                      !participantAck
                    }
                    onClick={() => void runInvest()}
                    className="mt-4 w-full rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {walletLine ?? `Invest ${fmtUsd(investUsdClamped)}`}
                  </button>
                  {needsUsdc && !canAfford && token ? (
                    <p className="mt-3 text-center text-xs text-amber-200/90">
                      Fund at least {fmtUsd(investUsdClamped)} USDC on Sepolia first.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mt-10 rounded-2xl border border-border bg-card/50 p-6 sm:p-8"
        >
          <h2 className="text-lg font-semibold text-foreground">Offering float</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{displayAvailableSupply.toLocaleString()}</span> tokens still open
            of <span className="font-medium text-foreground">{asset.tokensOffered.toLocaleString()}</span> in this tranche.
          </p>
          <div className="mt-6 max-w-xl">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Remaining</span>
              <span className="tabular-nums text-foreground">{(pctRemaining * 100).toFixed(1)}%</span>
            </div>
            <SupplyMeter pctRemaining={pctRemaining} size="lg" className="mt-2" pollKey={supplyMeterPollKey} />
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-10 grid gap-6 lg:grid-cols-3"
        >
          <section className="rounded-2xl border border-border bg-card/40 p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-foreground/80" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Financials</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Issuer-modeled operating view for diligence—not audited statements.</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Projected equity multiple</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{trustFin.projectedEquityMultipleLabel}</dd>
                <dd className="mt-1 text-xs leading-snug text-muted-foreground">{trustFin.projectedEquityMultipleCaption}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Implied rental / operating income (annual)</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{fmtUsd(trustFin.rentalIncomeAnnualUsd)}</dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  ~{fmtUsd(trustFin.rentalIncomeMonthlyUsd)} / month (model allocation)
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Occupancy (operating)</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{trustFin.occupancyPct.toFixed(1)}%</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card/40 p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-foreground/80" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">On-chain proof</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Verify contract deployment and how funds route for this sleeve.</p>
            <dl className="mt-5 space-y-4 text-sm">
              <CopyAddr address={asset.tokenAddress} label="Token contract" />
              <div>
                <dt className="text-muted-foreground">Registry ID</dt>
                <dd className="mt-1 font-mono text-xs break-all text-foreground">{asset.onchainAssetId}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">Symbol: {asset.symbol}</dd>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`${EXPLORER}${asset.tokenAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  View token on Etherscan
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                {asset.escrowContractAddress?.trim() ? (
                  <a
                    href={`${EXPLORER}${asset.escrowContractAddress.trim()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    Escrow contract
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </dl>

            {transparency ? (
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Release schedule &amp; escrow</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{transparency.disclosure}</p>
                {transparency.asset.escrowContractAddress ? (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    Escrow: {transparency.asset.escrowContractAddress.slice(0, 14)}… · Beneficiary:{" "}
                    {transparency.asset.escrowBeneficiary
                      ? `${transparency.asset.escrowBeneficiary.slice(0, 10)}…`
                      : "—"}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Primary flow routes USDC to the issuer or listing wallet (not the resale pool) until an escrow
                    contract is linked for this offering.
                  </p>
                )}
                {transparency.onchainEscrow ? (
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">USDC deposited (raw wei)</dt>
                      <dd className="font-mono text-foreground">{transparency.onchainEscrow.totalDeposited}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">USDC released</dt>
                      <dd className="font-mono text-foreground">{transparency.onchainEscrow.totalReleased}</dd>
                    </div>
                  </dl>
                ) : null}
                <ul className="mt-4 space-y-2">
                  {transparency.milestones.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-2.5 text-xs"
                    >
                      <p className="font-medium text-foreground">{m.description}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {((m.releaseBps / 10000) * 100).toFixed(1)}% of deposited pool ·{" "}
                        {m.completed ? "Released (ops)" : "Pending"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card/40 p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-foreground/80" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Legal</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Summary only—execute on the issuer’s offering documents.</p>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">SPV structure</p>
                <p className="mt-2 text-pretty">{spvStructureParagraph(asset.type)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Ownership rights</p>
                <p className="mt-2 text-pretty">{ownershipRightsParagraph()}</p>
              </div>
            </div>
          </section>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-10 rounded-2xl border border-border bg-card/40 p-6 sm:p-8"
        >
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-foreground/80" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">Live data</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Signals the sponsor exposes for this sleeve. Reference marks refresh while you keep this page open.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                <LineChartIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Oracle verified</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {oracleMarksActive
                    ? "Price and yield marks are live from the API feed."
                    : "Waiting for first oracle sample from the API."}
                </p>
                <p className="mt-1 text-[10px] font-mono text-muted-foreground">Updated {fmtTime(dataUpdatedAt)}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                <Radio className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">IoT data active</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Operational telemetry (pilot)—simulated handshake for investor UX.
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">{iotSignal?.lastPingLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-border p-5 surface-elevated">
              <p className="text-sm font-semibold text-foreground">Reference price mark</p>
              <p className="mt-1 text-xs text-muted-foreground">Samples while this tab is open.</p>
              <div className="mt-4 h-56 w-full min-h-[200px]">
                {chartPriceData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPriceData}>
                      <defs>
                        <linearGradient id={gradientPriceId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.14} />
                          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        width={52}
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
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={1.5}
                        fill={`url(#${gradientPriceId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                    Collecting samples…
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border p-5 surface-elevated">
              <p className="text-sm font-semibold text-foreground">Reference yield mark</p>
              <p className="mt-1 text-xs text-muted-foreground">Oracle vs modeled yield from the API.</p>
              <div className="mt-4 h-56 w-full min-h-[200px]">
                {chartYieldData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartYieldData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis
                        width={44}
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
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 text-sm text-muted-foreground">
                    Collecting samples…
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="mt-10"
        >
          <AssetMapEmbed location={asset.location} />
        </motion.div>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="lg:col-span-8 space-y-6"
          >
            <div className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">Offering overview</h2>
              <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                {descriptionParagraphs.map((p, i) => (
                  <p key={i} className="text-pretty">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </motion.section>

          <aside className="space-y-6 lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.09 }}
              className="lg:sticky lg:top-24 space-y-6"
            >
              {holding && holding.tokenBalance > 0 ? (
                <SellRwaPanel
                  asset={asset}
                  tokenBalance={holding.tokenBalance}
                  authToken={token ?? undefined}
                  onSellPhase={handleSellPhase}
                  onDone={async () => {
                    await queryClient.refetchQueries({ queryKey: ["asset", assetId] });
                    await queryClient.invalidateQueries({ queryKey: ["portfolio", token] });
                    await queryClient.invalidateQueries({ queryKey: ["sales", token] });
                    await refetchAssets();
                  }}
                />
              ) : null}

              <div className="rounded-2xl border border-border bg-secondary/25 p-6">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk (model)</p>
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{riskLabel}</p>
                {asset.riskScore != null ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Blended score {asset.riskScore.toFixed(2)} — weighted heuristics only, not a rating agency opinion.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No live risk score on file for this sleeve.</p>
                )}
              </div>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
}
