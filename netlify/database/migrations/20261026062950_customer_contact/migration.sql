-- AlterTable
ALTER TABLE "CallTicket" ADD COLUMN     "confirmation" TEXT,
ADD COLUMN     "confirmationAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobReport" ADD COLUMN     "reviewHandledAt" TIMESTAMP(3);

