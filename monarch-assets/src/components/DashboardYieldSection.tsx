import { motion } from "framer-motion";
import { formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";
import { getYieldHistory } from "@/lib/api";

const EXPLORER = "https://sepolia.etherscan.io/address/";

export function DashboardYieldSection({ authToken }: { authToken: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["yield-history", authToken],
    queryFn: () => getYieldHistory(authToken),
    enabled: !!authToken,
    refetchInterval: 30_000
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
      className="rounded-xl border border-border surface-elevated"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-foreground">Yield &amp; distributions</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data?.note ??
            "On-chain claimable USDC is authoritative; DB rows below are for reporting when present."}
        </p>
        {data?.payoutDistributorAddress ? (
          <a
            href={`${EXPLORER}${data.payoutDistributorAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-foreground underline underline-offset-4"
          >
            Payout distributor on Etherscan
          </a>
        ) : null}
      </div>

      <div className="divide-y divide-border">
        {dists.length > 0 ? (
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground">Recent distributions (your sleeves)</p>
            <ul className="mt-3 space-y-2 text-sm">
              {dists.slice(0, 8).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground">{d.asset.name}</span>
                  <span className="text-muted-foreground">
                    ${d.amountUsd.toFixed(2)} · {d.status}
                    {d.txHash ? (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${d.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 underline"
                      >
                        tx
                      </a>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="px-6 py-4 text-sm text-muted-foreground">No distribution records for your positions yet.</div>
        )}

        {claims.length > 0 ? (
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground">DB claim ledger (non-custodial)</p>
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
            <p className="text-xs font-medium text-foreground">On-chain claimable preview</p>
            <p className="mt-1 text-xs text-muted-foreground">Use “Claim yield on-chain” below to execute claims.</p>
            <ul className="mt-3 space-y-2">
              {onchain.map((x) => (
                <li key={x.assetId} className="flex items-center justify-between text-sm">
                  <span>{x.name}</span>
                  <span className="text-muted-foreground">
                    {formatUnits(BigInt(x.claimableBaseUnits), 6)} USDC
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!dists.length && !claims.length && !onchain.length ? (
          <div className="px-6 py-6 text-center text-sm text-muted-foreground">
            Nothing here yet — after an admin runs yield distribution (and on-chain settle), activity will appear.
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
