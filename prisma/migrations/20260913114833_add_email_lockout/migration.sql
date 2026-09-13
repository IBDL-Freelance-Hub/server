/*
  Warnings:

  - You are about to drop the `PasswordResetToken` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[emailNormalized]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `emailNormalized` to the `LoginAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emailNormalized` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('REVIEWER_OPERATOR', 'FINANCE_OFFICER', 'SYSTEM_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('ACTIVATION', 'PASSWORD_RESET', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "AssessmentCredentialStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'EXHAUSTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE 'UNACTIVATED';
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "LoginAttempt" ADD COLUMN     "emailNormalized" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNormalized" TEXT NOT NULL,
ADD COLUMN     "failedAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- DropTable
DROP TABLE "PasswordResetToken";

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRequestLog" (
    "id" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "lockoutThreshold" INTEGER NOT NULL DEFAULT 5,
    "lockoutWindowMinutes" INTEGER NOT NULL DEFAULT 15,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "resetTokenLifetimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "activationLinkLifetimeMinutes" INTEGER NOT NULL DEFAULT 10,
    "tokenRequestMaxPerEmail" INTEGER NOT NULL DEFAULT 5,
    "tokenRequestWindowMinutesPerEmail" INTEGER NOT NULL DEFAULT 60,
    "tokenRequestMaxPerIp" INTEGER NOT NULL DEFAULT 10,
    "tokenRequestWindowMinutesPerIp" INTEGER NOT NULL DEFAULT 60,
    "unactivatedRetentionMonths" INTEGER NOT NULL DEFAULT 12,
    "unactivatedReminderDaysBeforeCutoff" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SecurityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCredentialPool" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "accessUrl" TEXT,
    "status" "AssessmentCredentialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentCredentialPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLockout" (
    "emailNormalized" TEXT NOT NULL,
    "failedAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLockout_pkey" PRIMARY KEY ("emailNormalized")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE INDEX "TokenRequestLog_email_purpose_requestedAt_idx" ON "TokenRequestLog"("email", "purpose", "requestedAt");

-- CreateIndex
CREATE INDEX "TokenRequestLog_ipAddress_purpose_requestedAt_idx" ON "TokenRequestLog"("ipAddress", "purpose", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_purpose_expiresAt_idx" ON "VerificationToken"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCredentialPool_username_key" ON "AssessmentCredentialPool"("username");

-- CreateIndex
CREATE INDEX "AssessmentCredentialPool_status_idx" ON "AssessmentCredentialPool"("status");

-- CreateIndex
CREATE INDEX "LoginAttempt_emailNormalized_attemptedAt_idx" ON "LoginAttempt"("emailNormalized", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
