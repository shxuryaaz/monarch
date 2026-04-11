import { motion } from "framer-motion";

type Size = "sm" | "md" | "lg";

export function SupplyMeter({
  pctRemaining,
  className = "",
  size = "sm",
  pollKey
}: {
  /** Fraction still open in the tranche (0–1). */
  pctRemaining: number;
  className?: string;
  size?: Size;
  /** Bump to replay the width animation when live data refreshes. */
  pollKey?: string | number;
}) {
  const pct = Math.min(100, Math.max(0, pctRemaining * 100));
  const trackH = size === "lg" ? "h-3" : size === "md" ? "h-2" : "h-1";

  return (
    <div className={className}>
      <div className={`relative w-full overflow-hidden rounded-full bg-muted ${trackH}`}>
        <motion.div
          key={pollKey ?? "static"}
          className="h-full rounded-full bg-gradient-to-r from-foreground/40 via-foreground/60 to-foreground/45"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 128, damping: 20, mass: 0.9 }}
        />
        {pollKey !== undefined ? (
          <motion.div
            key={`pulse-${pollKey}`}
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        ) : null}
      </div>
    </div>
  );
}
