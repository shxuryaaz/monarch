import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../lib/http-error.js";

/** Stub: extend with Persona/Onfido; strict mode enforces DB status. */
export async function assertSubmitterKycForListing(userId: string): Promise<void> {
  if (env.KYC_MODE !== "strict") return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "User not found", "AUTH");
  if (user.kycStatus !== "APPROVED") {
    throw new HttpError(
      403,
      "Asset owner KYC must be APPROVED before submitting a listing. Contact support.",
      "KYC_REQUIRED"
    );
  }
}

export async function assertSubmitterKycForApproval(submitterId: string): Promise<void> {
  if (env.KYC_MODE !== "strict") return;
  const user = await prisma.user.findUnique({ where: { id: submitterId } });
  if (!user) throw new HttpError(400, "Submitter not found", "KYC_INCOMPLETE");
  if (user.kycStatus !== "APPROVED") {
    throw new HttpError(
      400,
      "Cannot approve listing: submitter KYC is not APPROVED.",
      "KYC_INCOMPLETE"
    );
  }
}
