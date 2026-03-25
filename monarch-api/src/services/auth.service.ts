import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { SiweMessage } from "siwe";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

export async function createChallenge(wallet: string) {
  const nonce = crypto.randomBytes(16).toString("hex");
  await prisma.authNonce.create({
    data: {
      wallet: wallet.toLowerCase(),
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  const message = new SiweMessage({
    domain: env.SIWE_DOMAIN,
    address: wallet,
    statement: "Sign in to Monarch",
    uri: env.SIWE_ORIGIN,
    version: "1",
    chainId: 11155111,
    nonce
  }).prepareMessage();

  return { nonce, message };
}

export async function verifyChallenge(message: string, signature: string) {
  const parsed = new SiweMessage(message);
  const result = await parsed.verify({ signature, domain: env.SIWE_DOMAIN });
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
    create: { wallet, lastLogin: new Date(), isAdmin: false }
  });

  const token = jwt.sign({ sub: user.id, wallet: user.wallet, isAdmin: user.isAdmin }, env.JWT_SECRET, {
    expiresIn: "7d"
  });

  return { token, user };
}
