import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { SiweMessage } from "siwe";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../db/prisma.js";

function normalizeOriginUrl(s: string): string {
  return s.replace(/\/+$/, "");
}

/** True if this URI is allowed for SIWE (same list as CORS frontends + legacy SIWE_ORIGIN). */
function isAllowedSiweUri(uri: string): boolean {
  const n = normalizeOriginUrl(uri);
  if (n === normalizeOriginUrl(env.SIWE_ORIGIN)) return true;
  return env.FRONTEND_ORIGINS.some((o) => normalizeOriginUrl(o) === n);
}

/**
 * Build EIP-4361 domain + URI. Prefer the browser `Origin` when it matches an allowed frontend
 * so local dev (localhost) and production (Vercel) both work without swapping .env — same as
 * when you only used the deployed site earlier.
 */
function resolveSiweDomainAndUri(requestOrigin: string | undefined): { domain: string; uri: string } {
  if (requestOrigin) {
    const norm = normalizeOriginUrl(requestOrigin.trim());
    try {
      const url = new URL(norm);
      if (env.FRONTEND_ORIGINS.some((o) => normalizeOriginUrl(o) === norm)) {
        return { domain: url.host, uri: url.origin };
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const fallback = new URL(normalizeOriginUrl(env.SIWE_ORIGIN));
    return { domain: fallback.host, uri: fallback.origin };
  } catch {
    return { domain: env.SIWE_DOMAIN, uri: env.SIWE_ORIGIN };
  }
}

export async function createChallenge(wallet: string, requestOrigin?: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  await prisma.authNonce.create({
    data: {
      wallet: wallet.toLowerCase(),
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  const { domain, uri } = resolveSiweDomainAndUri(requestOrigin);

  const message = new SiweMessage({
    domain,
    address: wallet,
    statement: "Sign in to Monarch",
    uri,
    version: "1",
    chainId: 11155111,
    nonce
  }).prepareMessage();

  return { nonce, message };
}

export async function verifyChallenge(message: string, signature: string) {
  const parsed = new SiweMessage(message);
  if (!isAllowedSiweUri(parsed.uri)) {
    throw new HttpError(403, "Sign-in origin is not allowed", "SIWE_URI");
  }
  const result = await parsed.verify({ signature, domain: parsed.domain });
  if (!result.success) {
    throw new HttpError(401, String(result.error ?? "Invalid SIWE signature"), "SIWE");
  }
  const wallet = result.data.address.toLowerCase();
  const nonce = result.data.nonce;

  const nonceRow = await prisma.authNonce.findUnique({ where: { nonce } });
  if (!nonceRow || nonceRow.used || nonceRow.wallet !== wallet || nonceRow.expiresAt < new Date()) {
    throw new Error("Invalid or expired nonce");
  }

  await prisma.authNonce.update({ where: { nonce }, data: { used: true } });

  const user = await prisma.user.upsert({
    where: { wallet },
    update: { lastLogin: new Date() },
    create: {
      wallet,
      lastLogin: new Date(),
      isAdmin: false,
      kycStatus: env.KYC_MODE === "strict" ? "NOT_STARTED" : "APPROVED"
    }
  });

  const token = jwt.sign({ sub: user.id, wallet: user.wallet, isAdmin: user.isAdmin }, env.JWT_SECRET, {
    expiresIn: "7d"
  });

  return { token, user };
}
