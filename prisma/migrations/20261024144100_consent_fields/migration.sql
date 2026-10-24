-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "recordingConsent" TEXT,
ADD COLUMN     "recordingConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "smsConsentSource" TEXT,
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3);
