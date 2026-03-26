export type SellRitualPhase = "idle" | "open" | "sign" | "settle" | "payout" | "success" | "error";

export type SellRitualPhasePayload = {
  name?: string;
  transferTxHash?: string;
  payoutTxHash?: string;
  message?: string;
};
