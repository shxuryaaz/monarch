import { useState } from "react";
import { useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { sepolia } from "wagmi/chains";
import { createSaleIntent, settleSale, type Asset } from "@/lib/api";
import { erc20Abi } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmi";
import { useToast } from "@/hooks/use-toast";
import type { SellRitualPhase, SellRitualPhasePayload } from "@/lib/sell-flow";

export function useSellHolding({
  authToken,
  asset,
  maxTokens,
  onSuccess,
  onPhase
}: {
  authToken: string | undefined;
  asset: Asset;
  maxTokens: number;
  onSuccess?: () => void;
  onPhase?: (phase: SellRitualPhase, payload?: SellRitualPhasePayload) => void;
}) {
  const { toast } = useToast();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const sellTokens = async (tokenAmount: number) => {
    if (!authToken) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0 || tokenAmount > maxTokens + 1e-12) {
      toast({
        title: "Invalid amount",
        description: `Enter up to ${maxTokens.toFixed(6)} tokens.`,
        variant: "destructive"
      });
      return;
    }
    if (chainId !== sepolia.id) {
      try {
        await switchChainAsync?.({ chainId: sepolia.id });
      } catch {
        toast({ title: "Wrong network", description: "Switch to Sepolia.", variant: "destructive" });
        return;
      }
    }
    setBusy(true);
    try {
      onPhase?.("open", { name: asset.name });
      const { sale, transfer } = await createSaleIntent(authToken, asset.id, tokenAmount);
      onPhase?.("sign");
      toast({
        title: "Confirm in your wallet",
        description: "Approve the RWA token transfer to the treasury."
      });
      const hash = await writeContractAsync({
        address: transfer.assetTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [transfer.treasuryAddress as `0x${string}`, BigInt(transfer.amountTokenBaseUnits)]
      });
      onPhase?.("settle", { transferTxHash: hash });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      onPhase?.("payout");
      const settled = await settleSale(authToken, sale.id, hash);
      onPhase?.("success", { transferTxHash: hash, payoutTxHash: settled.usdcPayoutTxHash });
      toast({
        title: "Sold on-chain",
        description: `~$${transfer.expectedUsdcOut.toFixed(2)} USDC sent by relayer.`
      });
      onSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      onPhase?.("error", { message: msg });
      toast({
        title: "Sell failed",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  return { sellTokens, busy };
}
