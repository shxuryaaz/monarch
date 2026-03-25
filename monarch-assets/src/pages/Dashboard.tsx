import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getMyPurchases } from "@/lib/api";
import { AssetHoldingsWithSell, OnchainYieldClaims } from "@/components/DashboardOnchainPanels";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { usePortfolio } from "@/hooks/use-portfolio";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

const DashboardSummaryRow = ({
  totalValue,
  totalInvested,
  returnPct,
  wallet
}: {
  totalValue: number;
  totalInvested: number;
  returnPct: number | null;
  wallet: string;
}) => (
  <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Portfolio overview and activity (oracle marks refresh automatically)</p>
    </div>
    <div className="flex flex-wrap items-center gap-6">
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Portfolio value</p>
        <p className="text-lg font-semibold text-foreground">{fmtUsd(totalValue)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Invested cost</p>
        <p className="text-lg font-semibold text-foreground">{fmtUsd(totalInvested)}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Total return</p>
        <p className="text-lg font-semibold text-foreground">
          {returnPct === null ? "—" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-foreground opacity-40" />
        <span className="text-sm text-secondary-foreground">{wallet || "Not signed in"}</span>
      </div>
    </div>
  </div>
);

function PortfolioStats({
  totalInvested,
  totalValue,
  totalReturns,
  returnPct,
  positionCount,
  reCount,
  agCount
}: {
  totalInvested: number;
  totalValue: number;
  totalReturns: number;
  returnPct: number | null;
  positionCount: number;
  reCount: number;
  agCount: number;
}) {
  const cards = [
    {
      label: "Total invested",
      value: fmtUsd(totalInvested),
      sub: positionCount ? `${positionCount} position${positionCount === 1 ? "" : "s"}` : "No open positions yet"
    },
    {
      label: "Portfolio value",
      value: fmtUsd(totalValue),
      sub: "Marked with latest oracle price"
    },
    {
      label: "Unrealized P&L",
      value: fmtUsd(totalReturns),
      sub:
        returnPct === null
          ? "Buy an asset to track performance"
          : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}% vs cost`
    },
    {
      label: "Active sleeves",
      value: `${reCount} RE · ${agCount} Ag`,
      sub: positionCount ? "By underlying asset type" : "—"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="rounded-xl border border-border p-5 surface-elevated"
        >
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
        </motion.div>
      ))}
    </div>
  );
}

const SPARKLINE_CAP = 36;

function PerformanceChart({ samples, returnPct }: { samples: number[]; returnPct: number | null }) {
  const { points, areaPoints } = useMemo(() => {
    if (samples.length === 0) {
      return { points: "0,50 100,50", areaPoints: "0,100 0,50 100,50 100,100" };
    }
    if (samples.length === 1) {
      const y = 50;
      return { points: `0,${y} 100,${y}`, areaPoints: `0,100 0,${y} 100,${y} 100,100` };
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const rawSpread = max - min;
    // When every sample is the same (oracle idle / rounding), draw a steady midline instead of a degenerate scale.
    const spread = rawSpread > 1e-9 ? rawSpread : 1;
    const pts = samples
      .map((v, i) => {
        const x = (i / (samples.length - 1)) * 100;
        const t = rawSpread > 1e-9 ? (v - min) / spread : 0.5;
        const y = 100 - t * 100;
        return `${x},${y}`;
      })
      .join(" ");
    return { points: pts, areaPoints: `0,100 ${pts} 100,100` };
  }, [samples]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border border-border p-6 surface-elevated"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Portfolio value — live</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {returnPct === null ? "—" : `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One point per poll (15s). Line moves when oracle marks change; flat means value stable between ticks.
          </p>
        </div>
      </div>

      <div className="mt-6 h-48">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.08" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#chartGradient)" />
          <polyline
            points={points}
            fill="none"
            stroke="hsl(0 0% 100%)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: "1.5px" }}
          />
        </svg>
      </div>
    </motion.div>
  );
}

function Transactions({
  purchases,
  loading
}: {
  purchases: import("@/lib/api").PurchaseIntentRow[];
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="rounded-xl border border-border surface-elevated"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-foreground">Purchase activity</p>
      </div>
      {loading ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
      ) : purchases.length === 0 ? (
        <div className="px-6 py-8">
          <p className="text-sm text-muted-foreground">
            No purchase records for this wallet yet. On-chain indexers can extend this list later.
          </p>
          <Link to="/marketplace" className="mt-3 inline-block text-sm text-foreground underline underline-offset-4">
            Go to marketplace
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {purchases.map((t) => {
            const date = new Date(t.createdAt);
            const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const statusLabel = t.status.replace(/_/g, " ");
            return (
              <div key={t.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-xs font-medium text-foreground">
                    B
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Buy</p>
                    <p className="text-xs text-muted-foreground">{t.asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{fmtUsd(t.usdcAmount)}</p>
                  <p className="text-xs text-secondary-foreground">
                    {statusLabel} · {dateStr}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function RightPanel({
  allocation,
  riskLabel,
  riskScore
}: {
  allocation: { label: string; pct: number }[];
  riskLabel: string | null;
  riskScore: number | null;
}) {
  const riskBarPct =
    riskScore === null ? 25 : Math.min(100, Math.max(8, Math.round((1 - riskScore) * 100)));

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="rounded-xl border border-border p-6 surface-elevated"
      >
        <p className="text-xs text-muted-foreground">Blended oracle risk</p>
        <p className="mt-2 text-3xl font-semibold text-foreground">{riskLabel ?? "—"}</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground/40 transition-all" style={{ width: `${riskBarPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Weighted by current position value (demo)</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="rounded-xl border border-border p-6 surface-elevated"
      >
        <p className="text-xs text-muted-foreground">Allocation</p>
        <div className="mt-4 space-y-4">
          {allocation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No positions to allocate.</p>
          ) : (
            allocation.map((a) => (
              <div key={a.label}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{a.label}</span>
                  <span className="text-sm text-muted-foreground">{a.pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${a.pct}%`, opacity: a.pct > 50 ? 0.8 : 0.4 }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

const Dashboard = () => {
  const { token, shortAddress } = useWalletAuth();
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    isSuccess: portfolioSuccess,
    dataUpdatedAt: portfolioUpdatedAt
  } = usePortfolio(token ?? undefined);
  const { data: purchaseData, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases", token],
    queryFn: () => getMyPurchases(token!),
    enabled: !!token,
    refetchInterval: 15_000
  });

  // Store samples in state (not a ref) so PerformanceChart's useMemo([samples]) sees a new array
  // reference after each poll; mutating a ref in place left the same reference → chart never redrawed.
  const [valueSamples, setValueSamples] = useState<number[]>([]);

  useEffect(() => {
    setValueSamples([]);
  }, [token]);

  useEffect(() => {
    if (!portfolioSuccess || portfolio?.totalValue === undefined) return;
    setValueSamples((prev) => [...prev, portfolio.totalValue].slice(-SPARKLINE_CAP));
  }, [portfolioSuccess, portfolioUpdatedAt, portfolio]);

  const returnPct = useMemo(() => {
    if (!portfolio || portfolio.totalInvested <= 0) return null;
    return ((portfolio.totalValue - portfolio.totalInvested) / portfolio.totalInvested) * 100;
  }, [portfolio]);

  const allocation = useMemo(() => {
    const positions = portfolio?.positions ?? [];
    if (!positions.length) return [];
    let reVal = 0;
    let agVal = 0;
    for (const p of positions) {
      const mark = p.asset.oraclePriceUsd ?? p.asset.tokenPriceUsd;
      const v = mark * p.tokenBalance;
      if (p.asset.type === "REAL_ESTATE") reVal += v;
      else agVal += v;
    }
    const t = reVal + agVal;
    if (t <= 0) return [];
    return [
      { label: "Real estate", pct: Math.round((reVal / t) * 100) },
      { label: "Agriculture", pct: Math.round((agVal / t) * 100) }
    ];
  }, [portfolio?.positions]);

  const { riskLabel, riskScore } = useMemo(() => {
    const positions = portfolio?.positions ?? [];
    if (!positions.length) return { riskLabel: null as string | null, riskScore: null as number | null };
    let num = 0;
    let den = 0;
    for (const p of positions) {
      const mark = p.asset.oraclePriceUsd ?? p.asset.tokenPriceUsd;
      const v = mark * p.tokenBalance;
      const rs = p.asset.riskScore;
      if (rs != null && v > 0) {
        num += rs * v;
        den += v;
      }
    }
    if (den <= 0) return { riskLabel: null, riskScore: null };
    const score = num / den;
    const label =
      score < 0.33 ? "Low" : score < 0.55 ? "Medium" : "Elevated";
    return { riskLabel: label, riskScore: score };
  }, [portfolio?.positions]);

  const reCount = useMemo(
    () => (portfolio?.positions ?? []).filter((p) => p.asset.type === "REAL_ESTATE").length,
    [portfolio?.positions]
  );
  const agCount = useMemo(
    () => (portfolio?.positions ?? []).filter((p) => p.asset.type !== "REAL_ESTATE").length,
    [portfolio?.positions]
  );

  const totalValue = portfolio?.totalValue ?? 0;
  const totalInvested = portfolio?.totalInvested ?? 0;
  const totalReturns = portfolio?.totalReturns ?? 0;
  const positions = portfolio?.positions ?? [];
  const samples = valueSamples;

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-foreground">Sign in with your wallet to view your portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <DashboardSummaryRow
          totalValue={totalValue}
          totalInvested={totalInvested}
          returnPct={returnPct}
          wallet={shortAddress}
        />
        {portfolioLoading && !portfolio ? (
          <p className="text-sm text-muted-foreground">Loading portfolio…</p>
        ) : (
          <>
            <PortfolioStats
              totalInvested={totalInvested}
              totalValue={totalValue}
              totalReturns={totalReturns}
              returnPct={returnPct}
              positionCount={positions.length}
              reCount={reCount}
              agCount={agCount}
            />

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-6">
                <PerformanceChart samples={samples} returnPct={returnPct} />
                <OnchainYieldClaims authToken={token} />
                <AssetHoldingsWithSell positions={positions} authToken={token} />
                <Transactions purchases={purchaseData?.purchases ?? []} loading={purchasesLoading} />
              </div>
              <RightPanel allocation={allocation} riskLabel={riskLabel} riskScore={riskScore} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
