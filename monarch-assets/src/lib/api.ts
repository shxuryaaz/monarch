import {
  clearMonarchJwtFromStorage,
  notifyMonarchJwtInvalid
} from "@/lib/auth-token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  ""
);

const DEFAULT_FETCH_MS = 120_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function purchaseErrorDescription(err: unknown): string {
  const base =
    err instanceof ApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Unknown error";
  const lower = base.toLowerCase();
  if (
    lower.includes("replacement fee") ||
    lower.includes("-32000") ||
    lower.includes("underpriced") ||
    lower.includes("fee too low")
  ) {
    return `${base} In your wallet, cancel or speed up any pending transaction, then try again. For local dev, use a relayer PRIVATE_KEY that is not the same account as MetaMask.`;
  }
  if (err instanceof ApiError && err.status === 502) {
    return `${base} RPC or network issue — try again shortly.`;
  }
  if (lower.includes("timed out")) {
    return `${base} Check your wallet and network, then try again.`;
  }
  return base;
}

export async function getPublicConfig() {
  return apiFetch<{
    chainSettlementEnabled: boolean;
    chainId: number;
    /** Secondary-market RWA sink (sells). */
    secondaryTreasuryAddress: string;
    /** @deprecated Same as secondaryTreasuryAddress */
    treasuryAddress: string;
    mockUsdcAddress: string;
    milestoneEscrowAddress: string | null;
    kycMode: "stub" | "strict";
  }>("/config");
}

export type Asset = {
  id: string;
  onchainAssetId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  type: string;
  location: string;
  description?: string | null;
  tokenPriceUsd: number;
  totalAssetValue: number;
  availableSupply: number;
  tokensOffered: number;
  /** 0–1 fraction of tranche still open (from API). */
  pctRemaining?: number;
  expectedYieldPct: number;
  oraclePriceUsd?: number | null;
  oracleYieldPct?: number | null;
  riskScore?: number | null;
  riskLabel?: string | null;
  escrowContractAddress?: string | null;
  escrowBeneficiary?: string | null;
};

export type AssetListingRow = {
  id: string;
  status: string;
  name: string;
  symbol: string;
  type: string;
  location: string;
  description?: string | null;
  tokenPriceUsd: number;
  totalAssetValue: number;
  tokensOffered: number;
  expectedYieldPct: number;
  adminNote?: string | null;
  createdAssetId?: string | null;
  createdAt: string;
  createdAsset?: Asset | null;
};

export async function createListing(
  token: string,
  body: {
    name: string;
    symbol: string;
    type: string;
    location: string;
    description?: string;
    tokenPriceUsd: number;
    totalAssetValue: number;
    tokensOffered: number;
    expectedYieldPct: number;
  }
) {
  return apiFetch<{ listing: AssetListingRow; asset?: Asset }>(
    "/listings",
    { method: "POST", body: JSON.stringify(body) },
    token
  );
}

export async function getMyListings(token: string) {
  return apiFetch<{ listings: AssetListingRow[] }>("/listings/me", undefined, token);
}

export type YieldHistoryResponse = {
  distributions: Array<{
    id: string;
    assetId: string;
    amountUsd: number;
    status: string;
    txHash?: string | null;
    /** Stellar transaction hash — present when yield was also paid via Stellar XLM */
    stellarTxHash?: string | null;
    createdAt: string;
    asset: { id: string; name: string; tokenAddress: string };
  }>;
  dbClaims: Array<{
    id: string;
    amountUsd: number;
    claimedAt: string;
    txHash?: string | null;
    stellarTxHash?: string | null;
    distribution: {
      id: string;
      amountUsd: number;
      asset: { id: string; name: string; tokenAddress: string };
    };
  }>;
  onchainClaimable: OnchainClaimableItem[];
  payoutDistributorAddress: string;
  note?: string;
};

export async function getYieldHistory(token: string) {
  return apiFetch<YieldHistoryResponse>("/yield/history", undefined, token);
}

export async function setStellarPublicKey(token: string, stellarPublicKey: string | null) {
  return apiFetch<{ user: { id: string; wallet: string; stellarPublicKey: string | null } }>(
    "/users/me/stellar",
    { method: "PATCH", body: JSON.stringify({ stellarPublicKey }) },
    token
  );
}

export async function distributeYield(token: string, assetId: string, amountUsd: number) {
  return apiFetch<{ id: string; assetId: string; amountUsd: number; status: string; stellarTxHash: string | null }>(
    "/yield/distribute",
    { method: "POST", body: JSON.stringify({ assetId, amountUsd }) },
    token
  );
}

export async function getStellarStatus(token: string) {
  return apiFetch<{
    hasTrustline: boolean;
    trustlineSetupUrl: string | null;
    usdcIssuer?: string;
  }>("/users/me/stellar-status", undefined, token);
}

export async function getMe(token: string) {
  return apiFetch<{ user: { id: string; wallet: string; stellarPublicKey: string | null; isAdmin: boolean } }>(
    "/users/me",
    undefined,
    token
  );
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  token?: string,
  timeoutMs: number = DEFAULT_FETCH_MS
): Promise<T> {
  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      }
    });
    if (!res.ok) {
      if (res.status === 401 && token) {
        clearMonarchJwtFromStorage();
        notifyMonarchJwtInvalid();
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; code?: string };
      const msg =
        typeof body.error === "string"
          ? body.error
          : typeof body.message === "string"
            ? body.message
            : `Request failed: ${res.status}`;
      throw new ApiError(msg, res.status, typeof body.code === "string" ? body.code : undefined);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(`Request timed out after ${timeoutMs / 1000}s`, 408, "TIMEOUT");
    }
    throw e;
  } finally {
    window.clearTimeout(tid);
  }
}

export async function getAssets() {
  return apiFetch<{ assets: Asset[] }>("/assets");
}

export async function getAsset(id: string) {
  return apiFetch<{ asset: Asset }>(`/assets/${encodeURIComponent(id)}`);
}

export type AssetTransparencyReport = {
  asset: {
    id: string;
    name: string;
    tokenAddress: string;
    escrowContractAddress: string | null;
    escrowBeneficiary: string | null;
  };
  milestones: Array<{
    id: string;
    sortOrder: number;
    description: string;
    releaseBps: number;
    completed: boolean;
    proofHash: string | null;
    completedAt: string | null;
  }>;
  onchainEscrow: {
    beneficiary: string | null;
    totalDeposited: string;
    totalReleased: string;
    milestoneChain: Array<{ index: number; releaseBps: number; released: boolean; proofHash: string }>;
  } | null;
  disclosure: string;
};

export async function getAssetTransparency(assetId: string) {
  return apiFetch<AssetTransparencyReport>(`/assets/${encodeURIComponent(assetId)}/transparency`);
}

export async function getPortfolio(token: string) {
  return apiFetch<{
    totalInvested: number;
    totalValue: number;
    totalReturns: number;
    positions: Array<{ tokenBalance: number; avgCostUsd: number; asset: Asset }>;
  }>("/portfolio/me", undefined, token);
}

export type PurchasePayment =
  | {
      mode: "treasury";
      chainId: number;
      usdcAddress: string;
      treasuryAddress: string;
      amountBaseUnits: string;
      decimals: number;
    }
  | {
      mode: "escrow";
      chainId: number;
      usdcAddress: string;
      escrowAddress: string;
      assetTokenAddress: string;
      amountBaseUnits: string;
      decimals: number;
    };

export async function createPurchaseIntent(token: string, assetId: string, usdcAmount: number) {
  return apiFetch<{
    intent: { id: string; status: string };
    chainSettlementRequired: boolean;
    payment: PurchasePayment | null;
  }>(
    "/purchases/intent",
    {
      method: "POST",
      body: JSON.stringify({ assetId, usdcAmount })
    },
    token,
    DEFAULT_FETCH_MS
  );
}

export async function confirmPurchase(token: string, intentId: string, paymentTxHash?: string) {
  return apiFetch(
    "/purchases/confirm",
    {
      method: "POST",
      body: JSON.stringify({ intentId, paymentTxHash })
    },
    token,
    DEFAULT_FETCH_MS
  );
}

export type SaleTransfer = {
  chainId: number;
  assetTokenAddress: string;
  /** Where RWA tokens go on sell (secondary pool). */
  secondaryTreasuryAddress: string;
  /** @deprecated Same as secondaryTreasuryAddress */
  treasuryAddress: string;
  amountTokenBaseUnits: string;
  tokenDecimals: number;
  expectedUsdcOut: number;
  expectedUsdcBaseUnits: string;
};

export async function createSaleIntent(token: string, assetId: string, tokenAmount: number) {
  return apiFetch<{ sale: { id: string }; transfer: SaleTransfer }>("/sales/intent", {
    method: "POST",
    body: JSON.stringify({ assetId, tokenAmount })
  }, token);
}

export async function settleSale(token: string, saleId: string, assetTokenTxHash: string) {
  return apiFetch<{ sale: { id: string; status: string }; usdcPayoutTxHash: string }>("/sales/settle", {
    method: "POST",
    body: JSON.stringify({ saleId, assetTokenTxHash })
  }, token);
}

export type OnchainClaimableItem = {
  assetId: string;
  name: string;
  tokenAddress: string;
  claimableBaseUnits: string;
};

export async function getOnchainClaimable(token: string) {
  return apiFetch<{ items: OnchainClaimableItem[]; payoutDistributorAddress: string }>(
    "/yield/onchain-claimable",
    undefined,
    token
  );
}

export type PurchaseIntentRow = {
  id: string;
  usdcAmount: number;
  tokenAmount: number;
  status: string;
  createdAt: string;
  asset: Asset;
};

export async function getMyPurchases(token: string) {
  return apiFetch<{ purchases: PurchaseIntentRow[] }>("/purchases/me", undefined, token);
}

export type SaleIntentRow = {
  id: string;
  tokenAmount: number;
  usdcOut: number;
  status: string;
  createdAt: string;
  asset: Asset;
};

export async function getMySales(token: string) {
  return apiFetch<{ sales: SaleIntentRow[] }>("/sales/me", undefined, token);
}
