/*
  Warnings:

  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "pinHash" DROP DEFAULT;

-- DropTable
DROP TABLE "RefreshToken";

-- CreateTable
CREATE TABLE "userSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSeenIp" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "userSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "userSession_tokenHash_key" ON "userSession"("tokenHash");

-- CreateIndex
CREATE INDEX "userSession_userId_idx" ON "userSession"("userId");

-- CreateIndex
CREATE INDEX "userSession_family_idx" ON "userSession"("family");

-- AddForeignKey
ALTER TABLE "userSession" ADD CONSTRAINT "userSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
