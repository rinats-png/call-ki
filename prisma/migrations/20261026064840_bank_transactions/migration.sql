-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "counterparty" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "billId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_status_idx" ON "BankTransaction"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_tenantId_hash_key" ON "BankTransaction"("tenantId", "hash");

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

