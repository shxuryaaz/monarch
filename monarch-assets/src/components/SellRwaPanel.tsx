import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { Asset } from "@/lib/api";
import type { SellRitualPhase, SellRitualPhasePayload } from "@/lib/sell-flow";
import { useSellHolding } from "@/hooks/use-sell-holding";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export function SellRwaPanel({
  asset,
  tokenBalance,
  authToken,
  onDone,
  onSellPhase,
  variant = "default"
}: {
  asset: Asset;
  tokenBalance: number;
  authToken: string | undefined;
  onDone?: () => void | Promise<void>;
  onSellPhase?: (phase: SellRitualPhase, payload?: SellRitualPhasePayload) => void;
  /** `compact` matches the dashboard table cell footprint. */
  variant?: "default" | "compact";
}) {
  const max = tokenBalance;
  const [sliderVal, setSliderVal] = useState(0);
  const [compactAmount, setCompactAmount] = useState("");

  const tokenAmount = useMemo(() => (max * sliderVal) / 100, [max, sliderVal]);

  const mark = asset.oraclePriceUsd ?? asset.tokenPriceUsd;
  const estimatedUsdc = tokenAmount * mark;

  const { sellTokens, busy } = useSellHolding({
    authToken,
    asset,
    maxTokens: max,
    onSuccess: onDone,
    onPhase: onSellPhase
  });

  const setPreset = (pct: number) => {
    setSliderVal(Math.min(100, Math.max(0, pct)));
  };

  if (max <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No balance for this asset. Buy on the marketplace first.
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-1">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Amount"
          value={compactAmount}
          onChange={(e) => setCompactAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void sellTokens(Number(compactAmount));
          }}
          className="w-24 rounded border border-border bg-secondary px-2 py-1 text-right text-xs text-foreground"
        />
        <button
          type="button"
          disabled={busy || !authToken}
          onClick={() => void sellTokens(Number(compactAmount))}
          className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-50"
        >
          {busy ? "…" : "Sell"}
        </button>
        <p className="max-w-[140px] text-[10px] text-muted-foreground">Sepolia + relayer only</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Sell from this position</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Transfer RWA tokens to treasury; relayer sends mock USDC. Balance:{" "}
          <span className="font-medium text-foreground">{max.toFixed(4)}</span> tokens
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "25%", v: 25 },
          { label: "50%", v: 50 },
          { label: "Max", v: 100 }
        ].map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant={sliderVal === p.v ? "default" : "secondary"}
            className="rounded-lg"
            onClick={() => setPreset(p.v)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2 px-1">
        <Slider
          value={[sliderVal]}
          min={0}
          max={100}
          step={0.5}
          onValueChange={(v) => setSliderVal(v[0] ?? 0)}
          disabled={busy || !authToken}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="tabular-nums text-foreground">
            {tokenAmount.toFixed(4)} tokens ≈ {fmtUsd(estimatedUsdc)}
          </span>
          <span>100%</span>
        </div>
      </div>

      <Button
        type="button"
        className="w-full rounded-xl relative"
        disabled={busy || !authToken || tokenAmount <= 0}
        onClick={() => void sellTokens(tokenAmount)}
      >
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
        <span className={busy ? "opacity-0" : ""}>
          {busy ? "Working…" : "Confirm sale"}
        </span>
      </Button>
    </div>
  );
}
