-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'EM_ABERTO';

-- AlterTable
ALTER TABLE "sale_payments" ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledById" TEXT,
ADD COLUMN     "settledMethod" "PaymentMethod";

