-- CreateTable
CREATE TABLE "CallActivity" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallActivity_callId_createdAt_idx" ON "CallActivity"("callId", "createdAt");

-- CreateIndex
CREATE INDEX "CallActivity_createdAt_idx" ON "CallActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "CallActivity" ADD CONSTRAINT "CallActivity_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

