-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "tokensOffered" REAL NOT NULL DEFAULT 0;
UPDATE "Asset" SET "tokensOffered" = "availableSupply" WHERE "tokensOffered" = 0 OR "tokensOffered" IS NULL;

-- CreateTable
CREATE TABLE "AssetListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submitterId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "tokenPriceUsd" REAL NOT NULL,
    "totalAssetValue" REAL NOT NULL,
    "tokensOffered" REAL NOT NULL,
    "expectedYieldPct" REAL NOT NULL,
    "adminNote" TEXT,
    "createdAssetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetListing_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetListing_createdAssetId_fkey" FOREIGN KEY ("createdAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssetListing_createdAssetId_key" ON "AssetListing"("createdAssetId");
