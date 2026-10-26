-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INVOICE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "customerId" TEXT NOT NULL,
    "ticketId" TEXT,
    "relatedId" TEXT,
    "issueDate" TIMESTAMP(3),
    "serviceDate" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "issuer" JSONB,
    "recipient" JSONB,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "taxes" JSONB NOT NULL DEFAULT '[]',
    "smallBusiness" BOOLEAN NOT NULL DEFAULT false,
    "introText" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "reminderLevel" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "publicToken" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillCounter" (
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BillCounter_pkey" PRIMARY KEY ("tenantId","year","kind")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_publicToken_key" ON "Bill"("publicToken");

-- CreateIndex
CREATE INDEX "Bill_tenantId_kind_status_idx" ON "Bill"("tenantId", "kind", "status");

-- CreateIndex
CREATE INDEX "Bill_status_dueAt_idx" ON "Bill"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_tenantId_number_key" ON "Bill"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CallTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
