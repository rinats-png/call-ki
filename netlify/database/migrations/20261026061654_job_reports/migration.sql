-- CreateTable
CREATE TABLE "JobReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "findings" TEXT NOT NULL DEFAULT '',
    "workDone" TEXT NOT NULL DEFAULT '',
    "materials" JSONB NOT NULL DEFAULT '[]',
    "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signatureName" TEXT,
    "signaturePng" BYTEA,
    "signedAt" TIMESTAMP(3),
    "billId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAppToken" (
    "hash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAppToken_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobReport_ticketId_key" ON "JobReport"("ticketId");

-- CreateIndex
CREATE INDEX "JobReport_tenantId_updatedAt_idx" ON "JobReport"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "JobPhoto_reportId_idx" ON "JobPhoto"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAppToken_employeeId_key" ON "EmployeeAppToken"("employeeId");

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CallTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "JobReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAppToken" ADD CONSTRAINT "EmployeeAppToken_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

