-- CreateTable
CREATE TABLE "MinuteTopUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinuteTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChangeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,

    CONSTRAINT "PlanChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinuteTopUp_tenantId_year_month_idx" ON "MinuteTopUp"("tenantId", "year", "month");

-- CreateIndex
CREATE INDEX "PlanChangeRequest_status_createdAt_idx" ON "PlanChangeRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MinuteTopUp" ADD CONSTRAINT "MinuteTopUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
