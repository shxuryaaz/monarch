import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AssetCard from "@/components/AssetCard";
import { useAssets } from "@/hooks/use-assets";
import { assetImageAt } from "@/lib/asset-images";
import { tranchePctRemaining } from "@/lib/tranche";

const FeaturedAssets = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, dataUpdatedAt } = useAssets();
  const list = (data?.assets ?? []).slice(0, 3);

  return (
    <section id="featured" className="scroll-mt-20 border-t border-border px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Featured assets</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Curated opportunities</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Pricing and yield track the same live data as the marketplace—refreshed on a short interval.
          </p>
        </motion.div>

        {isError && (
          <p className="mt-8 text-sm text-muted-foreground">Could not load assets. Is the API running?</p>
        )}
        {isLoading && !data && (
          <p className="mt-8 text-sm text-muted-foreground">Loading featured assets…</p>
        )}
        {!isLoading && list.length === 0 && !isError && (
          <p className="mt-8 text-sm text-muted-foreground">No assets in the catalog yet.</p>
        )}

        <div className="mt-12 flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
          {list.map((a, i) => {
            const mark = a.oraclePriceUsd ?? a.tokenPriceUsd;
            const yieldPct = a.oracleYieldPct ?? a.expectedYieldPct;
            const pctRemaining = tranchePctRemaining(a);
            return (
              <div key={a.id} className="min-w-[280px] flex-shrink-0">
                <AssetCard
                  image={assetImageAt(i)}
                  name={a.name}
                  location={a.location}
                  type={a.type === "REAL_ESTATE" ? "Real Estate" : "Agriculture"}
                  yield_pct={`${yieldPct.toFixed(1)}%`}
                  tokenPrice={`$${mark.toFixed(2)}`}
                  pctRemaining={pctRemaining}
                  pollKey={dataUpdatedAt}
                  index={i}
                  investLabel="Invest on marketplace"
                  onInvest={() => navigate("/marketplace")}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedAssets;
