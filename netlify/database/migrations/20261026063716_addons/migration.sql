-- CreateTable
CREATE TABLE "AddonPrice" (
    "key" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonPrice_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TenantAddon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "bookedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAddon_tenantId_key_idx" ON "TenantAddon"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "TenantAddon" ADD CONSTRAINT "TenantAddon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

