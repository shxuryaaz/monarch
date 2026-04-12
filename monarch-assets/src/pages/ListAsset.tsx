import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createListing, getMyListings, distributeYield, type AssetListingRow } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ParticipantAcknowledgment } from "@/components/ParticipantAcknowledgment";
import { formatTrancheLeftLabel, tranchePctRemaining } from "@/lib/tranche";

function DistributeYieldInline({ assetId, token, suggestedAmount }: {
  assetId: string;
  token: string;
  suggestedAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: (amountUsd: number) => distributeYield(token, assetId, amountUsd),
    onSuccess: (dist) => {
      const stellar = dist.stellarTxHash ? " ⚡ Stellar payout sent!" : "";
      setMsg({ text: `Distributed!${stellar}`, ok: true });
      setAmount("");
      setTimeout(() => { setMsg(null); setOpen(false); }, 4000);
    },
    onError: (e) => setMsg({ text: e instanceof Error ? e.message : "Failed", ok: false })
  });

  const handleSend = () => {
    const amt = parseFloat(amount) || suggestedAmount;
    if (amt <= 0) return;
    setMsg(null);
    mutation.mutate(amt);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Distribute yield →
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Suggested: {formatUsd(suggestedAmount)}/mo · based on {((suggestedAmount * 12) / 100).toFixed(1)}% APY
      </p>
      <div className="flex flex-wrap gap-1.5">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setMsg(null); }}
          placeholder={suggestedAmount.toFixed(2)}
          className="h-7 w-28 rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSend}
          disabled={mutation.isPending}
          className="h-7 rounded bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
        >
          {mutation.isPending ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => { setOpen(false); setMsg(null); setAmount(""); }}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}

const steps = ["Basics", "Economics", "Review"] as const;

function listingStatusCaption(L: AssetListingRow): string {
  if (L.createdAssetId) return "Live on marketplace";
  if (L.status === "SUBMITTED") return "Awaiting publish (admin or auto-publish)";
  return L.status;
}

function listingStatusTone(L: AssetListingRow): "live" | "pending" {
  return L.createdAssetId ? "live" : "pending";
}

export default function ListAsset() {
  const { token } = useWalletAuth();
  const { kycStatus } = useKycStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const { data: myListings, isLoading: listingsLoading } = useQuery({
    queryKey: ["listings-me", token],
    queryFn: () => getMyListings(token!),
    enabled: !!token,
    refetchInterval: 30_000
  });
  const offerings = myListings?.listings ?? [];

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("REAL_ESTATE");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const [tokenPriceUsd, setTokenPriceUsd] = useState("50");
  const [totalAssetValue, setTotalAssetValue] = useState("1000000");
  const [tokensOffered, setTokensOffered] = useState("20000");
  const [expectedYieldPct, setExpectedYieldPct] = useState("7.5");
  const [issuerAck, setIssuerAck] = useState(false);

  const submit = async () => {
    if (!token) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!issuerAck) {
      toast({
        title: "Confirmation required",
        description: "Confirm you have read the issuer confirmation before submitting.",
        variant: "destructive"
      });
      return;
    }
    const tp = Number(tokenPriceUsd);
    const tv = Number(totalAssetValue);
    const to = Number(tokensOffered);
    const y = Number(expectedYieldPct);
    if (!name.trim() || !symbol.trim() || !location.trim()) {
      toast({ title: "Complete required fields", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(tp) || tp <= 0 || !Number.isFinite(tv) || tv <= 0 || !Number.isFinite(to) || to <= 0) {
      toast({ title: "Check numeric economics", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await createListing(token, {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        type,
        location: location.trim(),
        description: description.trim() || undefined,
        tokenPriceUsd: tp,
        totalAssetValue: tv,
        tokensOffered: to,
        expectedYieldPct: Number.isFinite(y) ? y : 0
      });
      toast({
        title: res.asset ? "Listing published" : "Listing submitted",
        description: res.asset
          ? "Your offering is live on the marketplace."
          : "An admin can approve it to publish on the marketplace."
      });
      await queryClient.invalidateQueries({ queryKey: ["listings-me", token] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      setStep(0);
      setName("");
      setSymbol("");
      setLocation("");
      setDescription("");
      setIssuerAck(false);
    } catch (e) {
      toast({
        title: "Submit failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">List an asset</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Submit an issuer-led offering. It is published to the marketplace as soon as the server accepts it (unless
            auto-publish is disabled). Use real economics and documentation you are willing to stand behind.
          </p>

          {token && kycStatus !== "APPROVED" ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 py-16 text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10">
                <ShieldCheck className="h-7 w-7 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">KYC required to list an asset</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete your identity verification to unlock asset listing.
                </p>
              </div>
              <Button onClick={() => navigate("/kyc")}>
                Verify Identity <ShieldCheck className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : token ? (
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Your listed offerings</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Issuances you submitted. Tranche float updates as investors subscribe.
                  </p>
                </div>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Investor holdings → Dashboard
                </Link>
              </div>
              {listingsLoading ? (
                <p className="mt-8 text-sm text-muted-foreground">Loading your listings…</p>
              ) : offerings.length === 0 ? (
                <p className="mt-8 rounded-2xl border border-dashed border-border bg-secondary/10 px-6 py-10 text-center text-sm text-muted-foreground">
                  You have not listed an offering yet. Use the form below to create one.
                </p>
              ) : (
                <ul className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {offerings.map((L) => {
                    const asset = L.createdAsset ?? undefined;
                    const pct =
                      asset && L.createdAssetId ? tranchePctRemaining(asset) : null;
                    const tone = listingStatusTone(L);
                    return (
                      <li
                        key={L.id}
                        className="flex flex-col rounded-2xl border border-border bg-card/80 p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold text-foreground">
                              {L.name}
                              <span className="ml-1.5 font-normal text-muted-foreground">({L.symbol})</span>
                            </p>
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                              <span>{L.location}</span>
                            </p>
                          </div>
                          <span
                            className={
                              tone === "live"
                                ? "shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
                                : "shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                            }
                          >
                            {tone === "live" ? "Live" : "Pending"}
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-snug text-muted-foreground">
                          {listingStatusCaption(L)}
                        </p>
                        <dl className="mt-4 grid gap-2 text-xs">
                          <div className="flex justify-between gap-2 border-t border-border/60 pt-3">
                            <dt className="text-muted-foreground">Reference / yield</dt>
                            <dd className="text-right font-medium tabular-nums text-foreground">
                              ${L.tokenPriceUsd.toFixed(2)} · {L.expectedYieldPct}%
                            </dd>
                          </div>
                          {pct != null ? (
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted-foreground">Tranche float</dt>
                              <dd className="text-right font-medium tabular-nums text-foreground">
                                {formatTrancheLeftLabel(pct)}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                        <div className="mt-auto pt-5 space-y-3">
                          {L.createdAssetId ? (
                            <Link
                              to={`/marketplace/${L.createdAssetId}`}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                            >
                              View listing
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          ) : (
                            <p className="rounded-xl border border-dashed border-border bg-muted/20 py-2.5 text-center text-xs text-muted-foreground">
                              No marketplace link until published
                            </p>
                          )}
                          {L.createdAssetId && token ? (
                            <div className="border-t border-border/60 pt-3">
                              <DistributeYieldInline
                                assetId={L.createdAssetId}
                                token={token}
                                suggestedAmount={(L.totalAssetValue * (L.expectedYieldPct / 100)) / 12}
                              />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {(!token || kycStatus === "APPROVED") && <div className="mx-auto mt-14 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New offering</p>
            <div className="mt-3 flex gap-2 border-b border-border pb-4">
            {steps.map((s, i) => (
              <span
                key={s}
                className={`text-xs font-medium uppercase tracking-wide ${
                  i === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {i + 1}. {s}
              </span>
            ))}
            </div>

            <div className="mt-8 space-y-6">
            {step === 0 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Offering name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sym">Symbol</Label>
                  <Input id="sym" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. MTP" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="REAL_ESTATE">Real estate</option>
                    <option value="AGRICULTURE">Agriculture</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, region" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label>Token price (USD)</Label>
                  <Input inputMode="decimal" value={tokenPriceUsd} onChange={(e) => setTokenPriceUsd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Total asset value (USD)</Label>
                  <Input inputMode="decimal" value={totalAssetValue} onChange={(e) => setTotalAssetValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tokens offered (tranche size)</Label>
                  <Input inputMode="numeric" value={tokensOffered} onChange={(e) => setTokensOffered(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Expected yield (%)</Label>
                  <Input inputMode="decimal" value={expectedYieldPct} onChange={(e) => setExpectedYieldPct(e.target.value)} />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <div className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
                <p>
                  <span className="text-foreground">{name}</span> ({symbol}) · {type.replace("_", " ")}
                </p>
                <p className="mt-2">{location}</p>
                <p className="mt-4">
                  ${Number(tokenPriceUsd).toLocaleString()} / token · pool ${Number(totalAssetValue).toLocaleString()} ·{" "}
                  {Number(tokensOffered).toLocaleString()} tokens · {expectedYieldPct}% yield
                </p>
                {description ? <p className="mt-4 whitespace-pre-wrap">{description}</p> : null}
                <div className="mt-6 border-t border-border pt-6">
                  <ParticipantAcknowledgment
                    variant="card"
                    requireAccept
                    accepted={issuerAck}
                    onAcceptedChange={setIssuerAck}
                    idPrefix="list-asset"
                  />
                </div>
              </div>
            ) : null}
            </div>

            <div className="mt-10 flex justify-between gap-4">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                className="gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={busy || !token || !issuerAck} onClick={() => void submit()}>
                {busy ? "Submitting…" : "Publish offering"}
              </Button>
            )}
            </div>

            {!token ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Sign in with your wallet from the sidebar.
              </p>
            ) : null}
          </div>}
        </motion.div>
      </div>
    </div>
  );
}
