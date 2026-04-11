import { useState } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "viem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getYieldHistory, getMe, getStellarStatus, setStellarPublicKey } from "@/lib/api";

const ETHERSCAN = "https://sepolia.etherscan.io";
const STELLAR_EXPERT = "https://stellar.expert/explorer/testnet";

export function DashboardYieldSection({ authToken }: { authToken: string }) {
  const queryClient = useQueryClient();
  const [stellarInput, setStellarInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["yield-history", authToken],
    queryFn: () => getYieldHistory(authToken),
    enabled: !!authToken,
    refetchInterval: 30_000
  });

  const { data: meData } = useQuery({
    queryKey: ["me", authToken],
    queryFn: () => getMe(authToken),
    enabled: !!authToken
  });

  const savedStellarKey = meData?.user.stellarPublicKey ?? null;

  const { data: stellarStatus } = useQuery({
    queryKey: ["stellar-status", authToken],
    queryFn: () => getStellarStatus(authToken),
    enabled: !!authToken && !!savedStellarKey,
    refetchInterval: 60_000
  });

  const stellarMutation = useMutation({
    mutationFn: (key: string | null) => setStellarPublicKey(authToken, key),
    onSuccess: () => {
      setStellarInput("");
      void queryClient.invalidateQueries({ queryKey: ["me", authToken] });
      void queryClient.invalidateQueries({ queryKey: ["stellar-status", authToken] });
    }
  });

  if (isLoading && !data) {
    return (
      <motion.div className="rounded-xl border border-border p-6 surface-elevated">
        <p className="text-sm text-muted-foreground">Loading yield history…</p>
      </motion.div>
    );
  }

  const dists = data?.distributions ?? [];
  const claims = data?.dbClaims ?? [];
  const onchain = (data?.onchainClaimable ?? []).filter((x) => BigInt(x.claimableBaseUnits) > 0n);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="space-y-4"
    >
      {/* Stellar setup — prominent when no address saved */}
      {!savedStellarKey && (
        <div className="rounded-xl border border-border surface-elevated">
          <div className="px-6 py-4">
            <p className="text-sm font-medium text-foreground">Receive yield via Stellar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Yield distributions are settled on Stellar — instant global payments at $0.00001/tx, the same
              network Circle uses to issue USDC cross-border. Register your Stellar address once to receive
              all future payouts in USDC on Stellar alongside your Ethereum balance.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                value={stellarInput}
                onChange={(e) => setStellarInput(e.target.value)}
                placeholder="G… Stellar public key"
                className="h-8 flex-1 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => stellarMutation.mutate(stellarInput.trim())}
                disabled={stellarMutation.isPending || !stellarInput.trim()}
                className="h-8 rounded-md bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
              >
                {stellarMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yield & distributions */}
      <div className="rounded-xl border border-border surface-elevated">
        {/* Header with compact Stellar address when saved */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">Yield &amp; distributions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              USDC lands in your Ethereum wallet. The same payment also settles on Stellar — faster and
              cheaper than any Ethereum transaction.
            </p>
          </div>

          {/* Stellar address — compact when registered */}
          {savedStellarKey && (
            <div className="shrink-0 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-emerald-400">⚡</span>
                <a
                  href={`${STELLAR_EXPERT}/account/${savedStellarKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-emerald-400 underline underline-offset-2"
                >
                  {savedStellarKey.slice(0, 6)}…{savedStellarKey.slice(-4)}
                </a>
                <button
                  onClick={() => stellarMutation.mutate(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove Stellar address"
                >
                  ×
                </button>
              </div>
              {/* Trustline status */}
              {stellarStatus && !stellarStatus.hasTrustline && stellarStatus.trustlineSetupUrl && (
                <a
                  href={stellarStatus.trustlineSetupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs text-amber-400 underline underline-offset-2"
                >
                  Add USDC trustline → receive USDC (not XLM)
                </a>
              )}
              {stellarStatus?.hasTrustline && (
                <p className="text-xs text-emerald-400">⚡ Ready to receive USDC on Stellar</p>
              )}
            </div>
          )}
        </div>

        <div className="divide-y divide-border">
          {/* Recent distributions */}
          {dists.length > 0 ? (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-muted-foreground">Recent distributions</p>
              <ul className="mt-3 space-y-2 text-sm">
                {dists.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground">{d.asset.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      ${d.amountUsd.toFixed(2)} · {d.status}
                      {d.txHash ? (
                        <a href={`${ETHERSCAN}/tx/${d.txHash}`} target="_blank" rel="noreferrer" className="underline">
                          Etherscan
                        </a>
                      ) : null}
                      {d.stellarTxHash ? (
                        <a
                          href={`${STELLAR_EXPERT}/tx/${d.stellarTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 no-underline hover:bg-emerald-500/20"
                        >
                          ⚡ Stellar
                        </a>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-6 py-4 text-sm text-muted-foreground">
              No distribution records for your positions yet.
            </div>
          )}

          {/* Yield settlements — per-holder claims with dual tx links */}
          {claims.length > 0 ? (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-muted-foreground">Yield settlements</p>
              <ul className="mt-3 space-y-2 text-sm">
                {claims.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground">{c.distribution.asset.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span className="text-emerald-400 font-medium">+${c.amountUsd.toFixed(2)} USDC</span>
                      {c.txHash ? (
                        <a href={`${ETHERSCAN}/tx/${c.txHash}`} target="_blank" rel="noreferrer" className="underline">
                          Ethereum
                        </a>
                      ) : null}
                      {c.stellarTxHash ? (
                        <a
                          href={`${STELLAR_EXPERT}/tx/${c.stellarTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 no-underline hover:bg-emerald-500/20"
                        >
                          ⚡ Stellar
                        </a>
                      ) : null}
                      <span className="text-xs">{new Date(c.claimedAt).toLocaleDateString()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {onchain.length > 0 ? (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-foreground">On-chain claimable</p>
              <p className="mt-1 text-xs text-muted-foreground">Use "Claim yield on-chain" below to execute claims.</p>
              <ul className="mt-3 space-y-2">
                {onchain.map((x) => (
                  <li key={x.assetId} className="flex items-center justify-between text-sm">
                    <span>{x.name}</span>
                    <span className="text-muted-foreground">{formatUnits(BigInt(x.claimableBaseUnits), 6)} USDC</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!dists.length && !claims.length && !onchain.length ? (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">
              Nothing here yet — yield settlements will appear once an issuer runs a payout.
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
