-- AlterTable
ALTER TABLE "PurchaseIntent" ADD COLUMN "paymentTxHash" TEXT;

-- CreateTable
CREATE TABLE "SaleIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "tokenAmount" REAL NOT NULL,
    "usdcOut" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "assetTokenTxHash" TEXT,
    "usdcPayoutTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaleIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleIntent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
