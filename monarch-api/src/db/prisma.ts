import { PrismaClient } from "@prisma/client";

/**
 * Single shared client. For Neon, prefer the pooler URL and optionally add query params, e.g.
 * `?sslmode=require&connection_limit=10&pool_timeout=30` to avoid pool exhaustion (P2024).
 */
export const prisma = new PrismaClient();
