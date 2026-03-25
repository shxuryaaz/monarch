import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Coins, ExternalLink, Landmark, Loader2, Sparkles, Wallet, X } from "lucide-react";
import type { RitualPhase } from "@/lib/invest-flow";
import { SEPOLIA_CHAIN_ID } from "@/lib/chain";

const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";

type Props = {
  open: boolean;
  phase: RitualPhase;
  assetName: string;
  paymentTxHash: string | null;
  errorMessage: string | null;
  chainMode: boolean;
  onDismissError: () => void;
  onSuccessDone: () => void;
};

function phaseCopy(phase: RitualPhase, chainMode: boolean, assetName: string): { title: string; sub: string } {
  switch (phase) {
    case "open":
      return { title: "Tokenizing", sub: assetName };
    case "sign":
      return { title: "Confirm in wallet", sub: "Approve the USDC transfer to the treasury" };
    case "settle":
      return { title: "Payment settling", sub: `On-chain (chain ${SEPOLIA_CHAIN_ID})` };
    case "mint":
      return {
        title: chainMode ? "Minting your tokens" : "Recording investment",
        sub: chainMode ? "Verifying payment and issuing RWA tokens" : "Saving your position (demo mode)"
      };
    case "success":
      return { title: "You're in", sub: `${assetName} is now in your portfolio` };
    case "error":
      return { title: "Could not finish", sub: "Something went wrong with this purchase" };
    default:
      return { title: "", sub: "" };
  }
}

export default function InvestRitualOverlay({
  open,
  phase,
  assetName,
  paymentTxHash,
  errorMessage,
  chainMode,
  onDismissError,
  onSuccessDone
}: Props) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open || phase !== "success") return;
    const t = window.setTimeout(onSuccessDone, reduceMotion ? 800 : 1800);
    return () => window.clearTimeout(t);
  }, [open, phase, onSuccessDone, reduceMotion]);

  if (typeof document === "undefined") return null;

  const { title, sub } = phaseCopy(phase, chainMode, assetName);
  const showPathAnim = chainMode && (phase === "settle" || phase === "mint") && !reduceMotion;
  const showFlyingCoin =
    chainMode && (phase === "settle" || phase === "mint" || phase === "success") && !reduceMotion;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-busy={phase !== "success" && phase !== "error"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={reduceMotion ? false : { scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 20%, hsl(var(--foreground)) 0%, transparent 50%),
                  radial-gradient(circle at 80% 60%, hsl(var(--foreground)) 0%, transparent 45%)`
              }}
            />

            <div className="relative px-8 pb-10 pt-12">
              {phase === "error" ? (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}

              <div className="flex flex-col items-center text-center">
                <motion.div
                  className="relative mb-8 flex h-36 w-full items-center justify-center"
                  initial={false}
                >
                  {/* Wallet → treasury path */}
                  {chainMode && phase !== "open" && phase !== "error" ? (
                    <svg
                      className="absolute inset-0 h-full w-full text-border"
                      viewBox="0 0 320 120"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M 48 78 Q 160 12 272 78"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray={showPathAnim ? "6 6" : "0"}
                        className="opacity-40"
                      />
                    </svg>
                  ) : null}

                  <div className="absolute left-[12%] top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
                    <motion.div
                      animate={
                        reduceMotion
                          ? {}
                          : {
                              scale: phase === "sign" ? [1, 1.06, 1] : 1
                            }
                      }
                      transition={{ repeat: phase === "sign" ? Infinity : 0, duration: 1.4 }}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary shadow-sm"
                    >
                      <Wallet className="h-6 w-6 text-foreground" />
                    </motion.div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">You</span>
                  </div>

                  <div className="absolute right-[12%] top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary shadow-sm">
                      <Landmark className="h-6 w-6 text-foreground" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Treasury</span>
                  </div>

                  {showFlyingCoin ? (
                    <motion.div
                      className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-foreground/20 bg-foreground text-background shadow-lg"
                      initial={{ left: "14%", top: "50%", x: "-50%", y: "-50%", opacity: 0.9 }}
                      animate={
                        phase === "success"
                          ? { left: "50%", top: "18%", x: "-50%", y: "-50%", scale: 1.15, opacity: 0 }
                          : { left: "78%", top: "50%", x: "-50%", y: "-50%", opacity: 1 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0.2 }
                          : phase === "success"
                            ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                            : { duration: 1.25, ease: [0.33, 1, 0.68, 1] }
                      }
                    >
                      <span className="text-xs font-bold">$</span>
                    </motion.div>
                  ) : null}

                  {phase === "mint" || phase === "success" ? (
                    <motion.div
                      className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {phase === "success" ? "Tokens issued" : "Issuing tokens"}
                    </motion.div>
                  ) : null}

                  {phase === "open" ? (
                    <motion.div
                      className="absolute bottom-2 left-1/2 -translate-x-1/2"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
                    >
                      <Loader2 className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  ) : null}

                  {phase === "success" ? (
                    <motion.div
                      className="absolute left-1/2 top-[22%] flex -translate-x-1/2 -translate-y-1/2"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background">
                        <Check className="h-8 w-8" strokeWidth={2.5} />
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>

                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{sub}</h2>

                {paymentTxHash && phase !== "error" ? (
                  <a
                    href={`${EXPLORER_TX}${paymentTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    View payment transaction <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}

                {phase === "mint" || phase === "settle" ? (
                  <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                    <Coins className="h-4 w-4" />
                    RWA tokens map to your wallet after mint
                  </div>
                ) : null}

                {phase === "error" && errorMessage ? (
                  <p className="mt-6 text-left text-sm leading-relaxed text-destructive">{errorMessage}</p>
                ) : null}

                {phase === "error" ? (
                  <button
                    type="button"
                    onClick={onDismissError}
                    className="mt-8 w-full rounded-lg bg-foreground py-3 text-sm font-medium text-background"
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
