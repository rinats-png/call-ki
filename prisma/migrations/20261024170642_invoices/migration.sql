-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingVatId" TEXT;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "issuer" JSONB NOT NULL,
    "recipient" JSONB NOT NULL,
    "lines" JSONB NOT NULL,
    "netCents" INTEGER NOT NULL,
    "vatPercent" DOUBLE PRECISION NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_year_month_idx" ON "Invoice"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_year_month_key" ON "Invoice"("tenantId", "year", "month");
