-- CreateEnum
CREATE TYPE "accounting"."DepositStatus" AS ENUM ('HELD', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'FORFEITED');

-- CreateTable
CREATE TABLE "accounting"."security_deposits" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "status" "accounting"."DepositStatus" NOT NULL DEFAULT 'HELD',
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."deposit_deductions" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expenseId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."deposit_refunds" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_refunds_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "accounting"."deposit_deductions" ADD CONSTRAINT "deposit_deductions_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "accounting"."security_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."deposit_refunds" ADD CONSTRAINT "deposit_refunds_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "accounting"."security_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
