-- CreateEnum
CREATE TYPE "PreSaleStatus" AS ENUM ('AGUARDANDO_CAIXA', 'EM_ATENDIMENTO', 'FINALIZADA', 'CANCELADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CashRegisterStatus" AS ENUM ('ABERTO', 'FECHADO');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'OUTRO';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CAIXA';

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_productId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_userId_fkey";

-- DropIndex
DROP INDEX "sales_productId_idx";

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "costAtSale",
DROP COLUMN "productId",
DROP COLUMN "quantity",
DROP COLUMN "totalPrice",
DROP COLUMN "unitPrice",
DROP COLUMN "userId",
ADD COLUMN     "cashRegisterId" TEXT,
ADD COLUMN     "cashierId" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "commissionAmount" DECIMAL(12,2),
ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "costAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customerDocument" TEXT,
ADD COLUMN     "installments" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "preSaleId" TEXT,
ADD COLUMN     "sellerId" TEXT,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'FINALIZADA',
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL;

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "imei" TEXT,
    "serialNumber" TEXT,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT,
    "commissionAmount" DECIMAL(12,2),

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_sales" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "PreSaleStatus" NOT NULL DEFAULT 'AGUARDANDO_CAIXA',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "installments" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerDocument" TEXT,
    "sellerId" TEXT NOT NULL,
    "cashierId" TEXT,
    "unitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "pre_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_sale_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "imei" TEXT,
    "serialNumber" TEXT,
    "preSaleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT,

    CONSTRAINT "pre_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CashRegisterStatus" NOT NULL DEFAULT 'ABERTO',
    "cashierId" TEXT NOT NULL,
    "unitId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "summary" JSONB,
    "notes" TEXT,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "sale_items_imei_idx" ON "sale_items"("imei");

-- CreateIndex
CREATE INDEX "sale_items_serialNumber_idx" ON "sale_items"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pre_sales_code_key" ON "pre_sales"("code");

-- CreateIndex
CREATE INDEX "pre_sales_status_idx" ON "pre_sales"("status");

-- CreateIndex
CREATE INDEX "pre_sales_sellerId_idx" ON "pre_sales"("sellerId");

-- CreateIndex
CREATE INDEX "pre_sales_createdAt_idx" ON "pre_sales"("createdAt");

-- CreateIndex
CREATE INDEX "pre_sale_items_preSaleId_idx" ON "pre_sale_items"("preSaleId");

-- CreateIndex
CREATE INDEX "pre_sale_items_productId_idx" ON "pre_sale_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_code_key" ON "cash_registers"("code");

-- CreateIndex
CREATE INDEX "cash_registers_cashierId_idx" ON "cash_registers"("cashierId");

-- CreateIndex
CREATE INDEX "cash_registers_status_idx" ON "cash_registers"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_code_key" ON "sales"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_preSaleId_key" ON "sales"("preSaleId");

-- CreateIndex
CREATE INDEX "sales_sellerId_idx" ON "sales"("sellerId");

-- CreateIndex
CREATE INDEX "sales_cashierId_idx" ON "sales"("cashierId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_preSaleId_fkey" FOREIGN KEY ("preSaleId") REFERENCES "pre_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sales" ADD CONSTRAINT "pre_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sales" ADD CONSTRAINT "pre_sales_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sales" ADD CONSTRAINT "pre_sales_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sales" ADD CONSTRAINT "pre_sales_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sale_items" ADD CONSTRAINT "pre_sale_items_preSaleId_fkey" FOREIGN KEY ("preSaleId") REFERENCES "pre_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_sale_items" ADD CONSTRAINT "pre_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

