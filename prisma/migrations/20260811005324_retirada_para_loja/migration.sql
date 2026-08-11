-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDENTE', 'APROVADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "MovementReason" ADD VALUE 'RETIRADA';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "withdrawalId" TEXT;

-- CreateTable
CREATE TABLE "stock_withdrawals" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "soldQuantity" INTEGER,
    "returnedQuantity" INTEGER,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,

    CONSTRAINT "stock_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_withdrawals_status_idx" ON "stock_withdrawals"("status");

-- CreateIndex
CREATE INDEX "stock_withdrawals_productId_unitId_idx" ON "stock_withdrawals"("productId", "unitId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "stock_withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_withdrawals" ADD CONSTRAINT "stock_withdrawals_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_withdrawals" ADD CONSTRAINT "stock_withdrawals_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
