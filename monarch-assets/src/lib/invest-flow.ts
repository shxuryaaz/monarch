import { waitForTransactionReceipt } from "@wagmi/core";
import type { Config } from "@wagmi/core";
import { confirmPurchase, createPurchaseIntent } from "@/lib/api";
import { erc20Abi } from "@/lib/chain";
import { milestoneEscrowAbi } from "@/lib/milestone-escrow-abi";

export type RitualPhase = "idle" | "open" | "sign" | "settle" | "mint" | "success" | "error";

const RECEIPT_WAIT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export type PurchaseFlowCallbacks = {
  onPhase: (phase: RitualPhase, payload?: { paymentTxHash?: string }) => void;
};

export async function executePurchaseFlow(
  options: {
    token: string;
    assetId: string;
    investUsd: number;
    chainSettlement: boolean;
    writeContractAsync: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) => Promise<`0x${string}`>;
    wagmiConfig: Config;
  } & PurchaseFlowCallbacks
): Promise<void> {
  const { token, assetId, investUsd, chainSettlement, writeContractAsync, wagmiConfig, onPhase } = options;

  onPhase("open");
  const created = await createPurchaseIntent(token, assetId, investUsd);

  if (created.chainSettlementRequired && created.payment) {
    const pay = created.payment;
    let hash: `0x${string}`;

    if (pay.mode === "escrow") {
      onPhase("sign");
      const approveHash = await writeContractAsync({
        address: pay.usdcAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [pay.escrowAddress as `0x${string}`, BigInt(pay.amountBaseUnits)]
      });
      await withTimeout(
        waitForTransactionReceipt(wagmiConfig, { hash: approveHash }),
        RECEIPT_WAIT_MS,
        "USDC approval"
      );
      onPhase("settle");
      hash = await writeContractAsync({
        address: pay.escrowAddress as `0x${string}`,
        abi: milestoneEscrowAbi,
        functionName: "deposit",
        args: [pay.assetTokenAddress as `0x${string}`, BigInt(pay.amountBaseUnits)]
      });
      onPhase("mint", { paymentTxHash: hash });
      await withTimeout(
        waitForTransactionReceipt(wagmiConfig, { hash }),
        RECEIPT_WAIT_MS,
        "Escrow deposit"
      );
      await confirmPurchase(token, created.intent.id, hash);
    } else {
      onPhase("sign");
      hash = await writeContractAsync({
        address: pay.usdcAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [pay.treasuryAddress as `0x${string}`, BigInt(pay.amountBaseUnits)]
      });
      onPhase("settle", { paymentTxHash: hash });
      await withTimeout(
        waitForTransactionReceipt(wagmiConfig, { hash }),
        RECEIPT_WAIT_MS,
        "Transaction confirmation"
      );
      onPhase("mint");
      await confirmPurchase(token, created.intent.id, hash);
    }
  } else {
    onPhase("mint");
    await confirmPurchase(token, created.intent.id);
  }
  onPhase("success");
}
