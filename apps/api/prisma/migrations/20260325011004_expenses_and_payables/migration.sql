-- CreateEnum
CREATE TYPE "accounting"."PayableStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "accounting"."expenses" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "description" TEXT NOT NULL,
    "receiptPath" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceTaskId" TEXT,
    "journalEntryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."payables" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "accounting"."PayableStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "journalEntryId" TEXT,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payables_expenseId_key" ON "accounting"."payables"("expenseId");

-- AddForeignKey
ALTER TABLE "accounting"."expenses" ADD CONSTRAINT "expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounting"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."payables" ADD CONSTRAINT "payables_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "accounting"."expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
