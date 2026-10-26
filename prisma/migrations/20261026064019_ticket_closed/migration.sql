-- AlterTable
ALTER TABLE "CallTicket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "reviewHandledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobReport" DROP COLUMN "reviewHandledAt";

