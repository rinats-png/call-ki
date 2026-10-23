-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "secretEnc" TEXT;

-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "voiceProvider" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingNote" TEXT,
ADD COLUMN     "includedMinutesOverride" INTEGER,
ADD COLUMN     "overageCentsOverride" INTEGER,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "priceOverrideCents" INTEGER,
ADD COLUMN     "voiceAgentId" TEXT,
ADD COLUMN     "voiceProvider" TEXT;

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "monthlyPriceCents" INTEGER NOT NULL,
    "setupFeeCents" INTEGER NOT NULL DEFAULT 0,
    "includedMinutes" INTEGER NOT NULL,
    "overageCentsPerMinute" INTEGER NOT NULL,
    "overageMode" TEXT NOT NULL DEFAULT 'CHARGE',
    "billingIncrementSec" INTEGER NOT NULL DEFAULT 60,
    "includedSms" INTEGER NOT NULL DEFAULT 0,
    "smsCents" INTEGER NOT NULL DEFAULT 0,
    "maxNumbers" INTEGER,
    "maxUsers" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Beispiel-Pakete (frei änderbar unter Verwaltung → Preise & Pakete). Beträge netto in Cent.
INSERT INTO "Plan" ("id", "key", "name", "description", "monthlyPriceCents", "setupFeeCents", "includedMinutes", "overageCentsPerMinute", "overageMode", "billingIncrementSec", "includedSms", "smsCents", "maxNumbers", "maxUsers", "features", "sortOrder", "updatedAt") VALUES
  ('plan_starter', 'STARTER', 'Starter', 'Für Einzelunternehmer: KI nimmt Anrufe an, erfasst Anliegen und bucht Termine im internen Kalender.', 4900, 0, 100, 39, 'CHARGE', 60, 0, 15, 1, 2,
   ARRAY['calendar_internal','email_notifications','emergency_forwarding']::TEXT[], 1, CURRENT_TIMESTAMP),
  ('plan_business', 'BUSINESS', 'Business', 'Für Teams: mehr Minuten, Outlook/Google-Kalender, SMS-Bestätigungen und eigene Begrüßung.', 12900, 9900, 400, 32, 'CHARGE', 60, 100, 12, 2, 10,
   ARRAY['calendar_internal','email_notifications','emergency_forwarding','calendar_external','sms','custom_greeting']::TEXT[], 2, CURRENT_TIMESTAMP),
  ('plan_premium', 'PREMIUM', 'Premium', 'Für Betriebe mit hohem Anrufaufkommen: eigener KI-Agent, Aufzeichnung, mehrere Nummern, bevorzugter Support.', 29900, 19900, 1200, 27, 'CHARGE', 60, 300, 10, 5, NULL,
   ARRAY['calendar_internal','email_notifications','emergency_forwarding','calendar_external','sms','custom_greeting','recording','own_agent','priority_support']::TEXT[], 3, CURRENT_TIMESTAMP);

-- Bestehende Mandanten dem gleichnamigen Paket zuordnen
UPDATE "Tenant" SET "planId" = 'plan_' || lower("plan") WHERE "planId" IS NULL AND lower("plan") IN ('starter','business','premium');
