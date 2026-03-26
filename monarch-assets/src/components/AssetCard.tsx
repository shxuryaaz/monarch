import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SupplyMeter } from "@/components/SupplyMeter";
import { formatTrancheLeftLabel } from "@/lib/tranche";

interface AssetCardProps {
  image: string;
  name: string;
  location: string;
  type: "Real Estate" | "Agriculture";
  yield_pct: string;
  tokenPrice: string;
  /** Fraction of tranche still available (0–1). */
  pctRemaining: number;
  pollKey?: number;
  index: number;
  /** Primary CTA — e.g. open marketplace or run purchase flow */
  onInvest?: () => void | Promise<void>;
  investLabel?: string;
  investDisabled?: boolean;
  investLoading?: boolean;
  /** Opens asset detail; image and title link here without nesting the Invest button */
  detailHref?: string;
  /** Inline amount UI (e.g. collapsible slider) shown above the invest button */
  investAmountSlot?: ReactNode;
}

const AssetCard = ({
  image,
  name,
  location,
  type,
  yield_pct,
  tokenPrice,
  pctRemaining,
  pollKey,
  index,
  onInvest,
  investLabel = "Invest",
  investDisabled = false,
  investLoading = false,
  detailHref,
  investAmountSlot
}: AssetCardProps) => {
  const title = detailHref ? (
    <Link to={detailHref} className="block text-left hover:underline hover:decoration-foreground/40">
      <h3 className="text-base font-semibold text-foreground">{name}</h3>
    </Link>
  ) : (
    <h3 className="text-base font-semibold text-foreground">{name}</h3>
  );

  const media = (
    <>
      <img
        src={image}
        alt={name}
        loading="lazy"
        width={768}
        height={512}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <span className="absolute left-4 top-4 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
        {type}
      </span>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -6,
        boxShadow: "0 12px 40px rgba(255,255,255,0.08)"
      }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      className="group overflow-hidden rounded-xl border border-border surface-elevated"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        {detailHref ? (
          <Link to={detailHref} className="absolute inset-0 block">
            {media}
          </Link>
        ) : (
          media
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {title}
        <p className="mt-1 text-xs text-muted-foreground">{location}</p>

        {/* Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Expected Yield</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{yield_pct}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Token Price</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{tokenPrice}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Tranche float</p>
            <p className="text-xs font-medium tabular-nums text-foreground">
              {formatTrancheLeftLabel(pctRemaining)}
            </p>
          </div>
          <SupplyMeter pctRemaining={pctRemaining} className="mt-2" size="sm" pollKey={pollKey} />
        </div>

        {detailHref ? (
          <Link
            to={detailHref}
            className="mt-3 inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            View details
          </Link>
        ) : null}

        {investAmountSlot ? <div className="mt-4">{investAmountSlot}</div> : null}

        {/* CTA */}
        <button
          type="button"
          disabled={investDisabled || investLoading || !onInvest}
          onClick={() => onInvest?.()}
          className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {investLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default AssetCard;
