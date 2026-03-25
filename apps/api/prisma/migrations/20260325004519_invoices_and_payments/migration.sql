-- CreateEnum
CREATE TYPE "accounting"."InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "accounting"."PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'DIRECT_DEBIT', 'OTHER');

-- CreateTable
CREATE TABLE "accounting"."invoices" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "status" "accounting"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "accounting"."PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_contractId_periodMonth_periodYear_key" ON "accounting"."invoices"("contractId", "periodMonth", "periodYear");

-- AddForeignKey
ALTER TABLE "accounting"."payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "accounting"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
