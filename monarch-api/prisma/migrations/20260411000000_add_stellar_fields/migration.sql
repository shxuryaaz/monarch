-- Add Stellar public key to User (optional, for XLM yield payouts)
ALTER TABLE "User" ADD COLUMN "stellarPublicKey" TEXT;
CREATE UNIQUE INDEX "User_stellarPublicKey_key" ON "User"("stellarPublicKey");

-- Add Stellar tx hash to YieldDistribution
ALTER TABLE "YieldDistribution" ADD COLUMN "stellarTxHash" TEXT;
