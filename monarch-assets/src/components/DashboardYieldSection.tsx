import { useState } from "react";
import { motion } from "framer-motion";
import { formatUnits } from "viem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getYieldHistory, getMe, setStellarPublicKey } from "@/lib/api";

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

  const stellarMutation = useMutation({
    mutationFn: (key: string | null) => setStellarPublicKey(authToken, key),
    onSuccess: () => {
      setStellarInput("");
      void queryClient.invalidateQueries({ queryKey: ["me", authToken] });
    }
  });

  const savedStellarKey = meData?.user.stellarPublicKey ?? null;

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
    >
      <div className="rounded-xl border border-border surface-elevated">
        {/* Header with inline Stellar address */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">Yield &amp; distributions</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.payoutDistributorAddress ? (
                <>
                  Claimable USDC settles via{" "}
                  <a
                    href={`${ETHERSCAN}/address/${data.payoutDistributorAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    PayoutDistributor
                  </a>
                  {" "}on Ethereum. Stellar payouts send alongside each distribution.
                </>
              ) : (
                "On-chain claimable USDC is authoritative; DB rows below are for reporting."
              )}
            </p>
          </div>

          {/* Stellar address — compact inline */}
          <div className="shrink-0">
            {savedStellarKey ? (
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
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">⚡</span>
                <input
                  type="text"
                  value={stellarInput}
                  onChange={(e) => setStellarInput(e.target.value)}
                  placeholder="G… Stellar address"
                  className="h-6 w-36 rounded border border-border bg-background px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => stellarMutation.mutate(stellarInput.trim())}
                  disabled={stellarMutation.isPending || !stellarInput.trim()}
                  className="h-6 rounded bg-foreground px-2 text-xs font-medium text-background disabled:opacity-50"
                >
                  {stellarMutation.isPending ? "…" : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="divide-y divide-border">
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
                        <a
                          href={`${ETHERSCAN}/tx/${d.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
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

          {claims.length > 0 ? (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-muted-foreground">DB claim ledger</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {claims.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    {c.distribution.asset.name}: ${c.amountUsd.toFixed(2)} at{" "}
                    {new Date(c.claimedAt).toLocaleString()}
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
              Nothing here yet — yield distributions will appear once an issuer runs a payout.
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
