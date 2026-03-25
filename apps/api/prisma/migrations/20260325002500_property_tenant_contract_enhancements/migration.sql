-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('RESIDENTIAL_LEASE', 'COMMERCIAL_LEASE', 'PARKING', 'STORAGE', 'OTHER');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "type" "ContractType" NOT NULL DEFAULT 'RESIDENTIAL_LEASE';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "description" TEXT,
ADD COLUMN     "numberOfFloors" INTEGER,
ADD COLUMN     "yearBuilt" INTEGER;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "commercialRegisterNumber" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "isCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalForm" TEXT,
ADD COLUMN     "taxId" TEXT;

-- CreateTable
CREATE TABLE "property_notes" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "property_notes" ADD CONSTRAINT "property_notes_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
