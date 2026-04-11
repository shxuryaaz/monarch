import { Horizon, Keypair, Networks, Asset, TransactionBuilder, Operation, BASE_FEE } from "@stellar/stellar-sdk";
import { env } from "../config/env.js";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

let _server: Horizon.Server | null = null;

function getServer(): Horizon.Server {
  if (!_server) _server = new Horizon.Server(HORIZON_URL);
  return _server;
}

export function isStellarEnabled(): boolean {
  return Boolean(env.STELLAR_SECRET_KEY && env.STELLAR_PUBLIC_KEY);
}

export function getStellarRelayer(): Keypair {
  if (!env.STELLAR_SECRET_KEY) throw new Error("STELLAR_SECRET_KEY not configured");
  return Keypair.fromSecret(env.STELLAR_SECRET_KEY);
}

/**
 * Send XLM from the relayer to a recipient Stellar address.
 * XLM is Stellar's native asset — no trustline required, works on any account.
 * Used for pro-rata yield payouts: fast (5 s), near-zero cost ($0.00001).
 */
export async function stellarXlmTransfer(toPublicKey: string, amountXlm: string): Promise<string> {
  const server = getServer();
  const relayer = getStellarRelayer();

  const account = await server.loadAccount(relayer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: Asset.native(),
        amount: amountXlm
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(relayer);

  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Ensure a Stellar account exists — if not, fund it via Friendbot (testnet only).
 * Real deployments would use createAccount instead.
 */
export async function ensureAccountFunded(publicKey: string): Promise<void> {
  const server = getServer();
  try {
    await server.loadAccount(publicKey);
  } catch {
    // Account doesn't exist on testnet — fund via Friendbot
    await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
  }
}

/**
 * Testnet USDC on Stellar — issued by Circle's testnet account.
 * On mainnet: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 (same issuer).
 */
const TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const STELLAR_USDC = new Asset("USDC", TESTNET_USDC_ISSUER);

/**
 * Check whether a Stellar account has a USDC trustline.
 * Returns false if the account doesn't exist yet or has no USDC balance line.
 */
export async function hasStellarUsdcTrustline(publicKey: string): Promise<boolean> {
  const server = getServer();
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.some(
      (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        b.asset_type === "credit_alphanum4" &&
        b.asset_code === "USDC" &&
        b.asset_issuer === TESTNET_USDC_ISSUER
    );
  } catch {
    return false;
  }
}

/**
 * Send USDC on Stellar from the relayer to a recipient.
 * Recipient must have a USDC trustline — call hasStellarUsdcTrustline first.
 * Falls back gracefully: callers should catch and retry with stellarXlmTransfer.
 */
export async function stellarUsdcTransfer(toPublicKey: string, amountUsdc: string): Promise<string> {
  const server = getServer();
  const relayer = getStellarRelayer();

  const account = await server.loadAccount(relayer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: STELLAR_USDC,
        amount: amountUsdc
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(relayer);

  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Verify a Stellar XLM payment from a user to the relayer.
 * Checks the transaction on Horizon by hash and validates sender/recipient/amount.
 */
export async function verifyStellarXlmPayment(params: {
  txHash: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmountXlm: string;
}): Promise<void> {
  const server = getServer();
  const tx = await server.transactions().transaction(params.txHash).call();
  const ops = await server.operations().forTransaction(params.txHash).call();

  const payment = ops.records.find(
    (op: { type: string; from?: string; to?: string; asset_type?: string; amount?: string }) =>
      op.type === "payment" &&
      op.from?.toLowerCase() === params.expectedFrom.toLowerCase() &&
      op.to?.toLowerCase() === params.expectedTo.toLowerCase() &&
      op.asset_type === "native" &&
      parseFloat(op.amount ?? "0") >= parseFloat(params.expectedAmountXlm) - 0.0001
  );

  if (!payment) {
    throw new Error(
      `Stellar payment not found: expected ${params.expectedAmountXlm} XLM from ${params.expectedFrom} to ${params.expectedTo} in tx ${params.txHash}`
    );
  }

  void tx; // tx loaded — confirms it exists on-chain
}
