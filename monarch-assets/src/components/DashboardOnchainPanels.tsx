import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { formatUnits } from "viem";
import { sepolia } from "wagmi/chains";
import { getOnchainClaimable, type Asset, type OnchainClaimableItem } from "@/lib/api";
import { CONTRACTS, payoutDistributorAbi } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";
import { useToast } from "@/hooks/use-toast";
import { SellRwaPanel } from "@/components/SellRwaPanel";

import { formatUsd } from "@/lib/utils";

type PositionRow = { tokenBalance: number; avgCostUsd: number; asset: Asset };

export function AssetHoldingsWithSell({
  positions,
  authToken
}: {
  positions: PositionRow[];
  authToken: string;
}) {
  const queryClient = useQueryClient();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-xl border border-border surface-elevated"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-foreground">Asset holdings</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sell transfers RWA tokens to the secondary pool {CONTRACTS.secondaryTreasury.slice(0, 8)}… — API relayer
          pays Mock USDC.
        </p>
      </div>
      <div className="overflow-x-auto">
        {positions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No holdings yet.{" "}
            <Link to="/marketplace" className="text-foreground underline underline-offset-4">
              Browse the marketplace
            </Link>
            .
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Asset</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Tokens</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Avg cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Mark</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">P&L</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground">Sell</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const mark = p.asset.oraclePriceUsd ?? p.asset.tokenPriceUsd;
                const invested = p.avgCostUsd * p.tokenBalance;
                const current = mark * p.tokenBalance;
                const pnl = current - invested;
                const typeLabel = p.asset.type === "REAL_ESTATE" ? "Real estate" : "Agriculture";
                return (
                  <tr key={p.asset.id} className="border-b border-border transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{p.asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.asset.symbol} · {typeLabel} · {p.asset.location}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-secondary-foreground">{p.tokenBalance.toFixed(4)}</td>
                    <td className="px-6 py-4 text-right text-sm text-secondary-foreground">{formatUsd(p.avgCostUsd)}</td>
                    <td className="px-6 py-4 text-right text-sm text-secondary-foreground">{formatUsd(mark)}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-foreground">{formatUsd(current)}</td>
                    <td
                      className={`px-6 py-4 text-right text-sm font-medium ${pnl >= 0 ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {formatUsd(pnl)}
                    </td>
                    <td className="px-6 py-4">
                      <SellRwaPanel
                        asset={p.asset}
                        tokenBalance={p.tokenBalance}
                        authToken={authToken}
                        variant="compact"
                        onDone={() =>
                          void Promise.all([
                            queryClient.invalidateQueries({ queryKey: ["portfolio", authToken] }),
                            queryClient.invalidateQueries({ queryKey: ["sales", authToken] })
                          ])
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}

export function OnchainYieldClaims({ authToken }: { authToken: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const { data, isLoading } = useQuery({
    queryKey: ["yield-onchain", authToken],
    queryFn: () => getOnchainClaimable(authToken),
    enabled: !!authToken,
    refetchInterval: 30_000
  });

  const claimOne = async (item: OnchainClaimableItem, payout: string) => {
    if (chainId !== sepolia.id) {
      try {
        await switchChainAsync?.({ chainId: sepolia.id });
      } catch {
        toast({ title: "Wrong network", description: "Switch to Sepolia.", variant: "destructive" });
        return;
      }
    }
    try {
      const hash = await writeContractAsync({
        address: payout as `0x${string}`,
        abi: payoutDistributorAbi,
        functionName: "claimYield",
        args: [item.tokenAddress as `0x${string}`]
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      toast({ title: "Yield claimed", description: `${item.name}: USDC sent to your wallet.` });
      await queryClient.invalidateQueries({ queryKey: ["yield-onchain", authToken] });
      await queryClient.invalidateQueries({ queryKey: ["portfolio", authToken] });
    } catch (e) {
      toast({
        title: "Claim failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (isLoading && !data) {
    return (
      <motion.div className="rounded-xl border border-border p-6 surface-elevated">
        <p className="text-sm text-muted-foreground">Loading on-chain yield…</p>
      </motion.div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border p-6 surface-elevated"
      >
        <p className="text-sm font-medium text-foreground">On-chain yield (PayoutDistributor)</p>
        <p className="mt-2 text-sm text-muted-foreground">Nothing to claim right now. Yield appears after an admin runs distributeYield on-chain.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border surface-elevated"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-foreground">Claim yield on-chain</p>
        <p className="mt-1 text-xs text-muted-foreground">Calls PayoutDistributor.claimYield — requires a live distribution on Sepolia.</p>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.assetId} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                Claimable: {formatUnits(BigInt(item.claimableBaseUnits), 6)} USDC
              </p>
            </div>
            <button
              type="button"
              onClick={() => void claimOne(item, data!.payoutDistributorAddress)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
            >
              Claim
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
