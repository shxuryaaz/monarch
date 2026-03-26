import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { clampSelection, clampUsd, INVEST_GLOBAL_MAX, type InvestBounds } from "@/lib/invest-amount";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

type Props = {
  bounds: Extract<InvestBounds, { valid: true }>;
  valueUsd: number;
  onValueUsdChange: (usd: number) => void;
  disabled?: boolean;
  idPrefix: string;
  /** When false, collapsible starts open (e.g. asset detail hero). */
  defaultCollapsed?: boolean;
};

export function InvestAmountSelector({
  bounds,
  valueUsd,
  onValueUsdChange,
  disabled = false,
  idPrefix,
  defaultCollapsed = true
}: Props) {
  const { minUsd, maxUsd, lotUsd } = bounds;
  const range = maxUsd - minUsd;
  const sliderDisabled = disabled || range < 0.01;
  const tokensApprox = lotUsd > 0 ? valueUsd / lotUsd : 0;

  return (
    <Collapsible defaultOpen={!defaultCollapsed} className="w-full">
      <CollapsibleTrigger
        type="button"
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary/50 disabled:opacity-50"
      >
        <span>Adjust amount</span>
        <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
          {fmtUsd(valueUsd)}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <p className="px-1 text-[11px] tabular-nums text-muted-foreground">
          ~{tokensApprox.toFixed(2)} tokens at reference mark ({fmtUsd(lotUsd)} / token)
        </p>
        <div className="px-1">
          <Slider
            disabled={sliderDisabled}
            min={minUsd}
            max={maxUsd}
            step={0.01}
            value={clampSelection(minUsd, maxUsd, valueUsd)}
            onValueChange={(v) => {
              const raw = v?.[0] ?? minUsd;
              onValueUsdChange(clampUsd(minUsd, maxUsd, raw));
            }}
            aria-label="Subscription amount"
            id={`${idPrefix}-invest-slider`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span className="tabular-nums">{fmtUsd(minUsd)}</span>
          <span className="tabular-nums">{fmtUsd(maxUsd)}</span>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          At least one token at the reference mark · up to {fmtUsd(INVEST_GLOBAL_MAX)} or remaining float (API
          settlement uses listing token price for token count).
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
