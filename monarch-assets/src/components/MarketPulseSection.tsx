import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SupplyMeter } from "@/components/SupplyMeter";
import { useAssets } from "@/hooks/use-assets";
import { assetImageAt } from "@/lib/asset-images";
import { formatTranchePct, tranchePctRemaining } from "@/lib/tranche";

export function MarketPulseSection() {
  const { data, dataUpdatedAt } = useAssets();
  const assets = (data?.assets ?? []).slice(0, 6);

  if (assets.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border border-border surface-elevated"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-foreground">Market pulse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Live tranche float across offerings — same feed as the marketplace.
        </p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a, i) => {
          const pct = tranchePctRemaining(a);
          const y = a.oracleYieldPct ?? a.expectedYieldPct;
          return (
            <Link
              key={a.id}
              to={`/marketplace/${a.id}`}
              className="group flex gap-3 rounded-lg border border-border/80 bg-secondary/15 p-3 transition-colors hover:bg-accent/40"
            >
              <img
                src={assetImageAt(i)}
                alt=""
                className="h-16 w-20 shrink-0 rounded-md object-cover"
                width={80}
                height={64}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:underline">
                  {a.name}
                </p>
                <p className="text-xs text-muted-foreground">{y.toFixed(1)}% target · {a.location}</p>
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Float left</span>
                    <span className="tabular-nums text-foreground">{formatTranchePct(pct)}%</span>
                  </div>
                  <SupplyMeter pctRemaining={pct} size="sm" className="mt-1" pollKey={dataUpdatedAt} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.section>
  );
}
