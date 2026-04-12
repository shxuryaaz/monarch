import { prisma } from "../db/prisma.js";
import { HttpError } from "../lib/http-error.js";

export interface KYCSubmitData {
  fullName: string;
  dateOfBirth: string;
  country: string;
  address: string;
}

export interface KYCFilePaths {
  idFrontPath: string;
  idBackPath: string;
  selfiePath: string;
}

/** Submit KYC info + documents. Auto-approves immediately (demo mode). */
export async function submitKyc(
  userId: string,
  data: KYCSubmitData,
  files: KYCFilePaths
): Promise<{ kycStatus: string }> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.kYCSubmission.upsert({
      where: { userId },
      create: {
        userId,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        country: data.country,
        address: data.address,
        idFrontPath: files.idFrontPath,
        idBackPath: files.idBackPath,
        selfiePath: files.selfiePath
      },
      update: {
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
        country: data.country,
        address: data.address,
        idFrontPath: files.idFrontPath,
        idBackPath: files.idBackPath,
        selfiePath: files.selfiePath
      }
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: { kycStatus: "APPROVED" }
    });

    return updated;
  });

  return { kycStatus: result.kycStatus };
}

/** Assert that a user's KYC is APPROVED before allowing an invest/purchase. */
export async function assertUserKyc(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "User not found", "AUTH");
  if (user.kycStatus !== "APPROVED") {
    throw new HttpError(
      403,
      "KYC verification required before investing. Complete your KYC at /kyc.",
      "KYC_REQUIRED"
    );
  }
}

/** Assert that a listing submitter's KYC is APPROVED. Always enforced. */
export async function assertSubmitterKycForListing(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "User not found", "AUTH");
  if (user.kycStatus !== "APPROVED") {
    throw new HttpError(
      403,
      "KYC verification required before submitting an asset listing. Complete your KYC at /kyc.",
      "KYC_REQUIRED"
    );
  }
}

/** Assert that a listing submitter's KYC is APPROVED at admin approval time. */
export async function assertSubmitterKycForApproval(submitterId: string): Promise<void> {
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
