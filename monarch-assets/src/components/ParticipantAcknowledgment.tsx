import { FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const POINTS = [
  "In-app metrics summarize the offering; binding terms, eligibility, and risk factors live in the issuer’s offering documents (e.g. PPM or subscription agreement).",
  "Settlement follows this sleeve’s configuration—direct USDC to issuer / escrow / listing wallet for primary, secondary pool for resales, optional milestone escrow, and chain vs API mode—as shown on the asset page.",
  "You remain responsible for wallet custody, network fees, and your own tax reporting."
];

type Props = {
  variant?: "card" | "compact";
  requireAccept?: boolean;
  accepted?: boolean;
  onAcceptedChange?: (value: boolean) => void;
  idPrefix?: string;
};

export function ParticipantAcknowledgment({
  variant = "card",
  requireAccept = false,
  accepted = false,
  onAcceptedChange,
  idPrefix = "participant-ack"
}: Props) {
  const body = (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40">
        <FileText className="h-4 w-4 text-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Before you subscribe</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          You are reviewing an offering sleeve on Monarch. By proceeding, you confirm that you understand:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground marker:text-muted-foreground/80">
          {POINTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {requireAccept ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-secondary/25 px-3 py-3">
            <Checkbox
              id={`${idPrefix}-agree`}
              checked={accepted}
              onCheckedChange={(v) => onAcceptedChange?.(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor={`${idPrefix}-agree`}
              className="cursor-pointer text-xs font-normal leading-snug text-foreground"
            >
              I have read the above and agree to proceed.
            </Label>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <div
        className="rounded-xl border border-border bg-card/50 px-4 py-3"
        role="region"
        aria-label="Participant confirmation"
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm"
      role="region"
      aria-label="Participant confirmation"
    >
      {body}
    </div>
  );
}
