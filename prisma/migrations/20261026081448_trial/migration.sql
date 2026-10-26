-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialMinutes" INTEGER,
ADD COLUMN     "trialNextPlanId" TEXT,
ADD COLUMN     "trialNotice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

