-- CreateEnum
CREATE TYPE "ImeiSituacao" AS ENUM ('NAO_CONSULTADO', 'REGULAR', 'IRREGULAR', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "TradeInStatus" AS ENUM ('AVALIADA', 'ACEITA', 'RECUSADA');

-- CreateEnum
CREATE TYPE "TradeInFotoTipo" AS ENUM ('ANATEL', 'DOCUMENTO', 'APARELHO');

-- CreateTable
CREATE TABLE "trade_ins" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "TradeInStatus" NOT NULL DEFAULT 'AVALIADA',
    "modelo" TEXT NOT NULL,
    "marca" TEXT,
    "armazenamento" TEXT,
    "cor" TEXT,
    "imei" TEXT NOT NULL,
    "imeiSituacao" "ImeiSituacao" NOT NULL DEFAULT 'NAO_CONSULTADO',
    "imeiCheckedAt" TIMESTAMP(3),
    "estado" TEXT,
    "defeitos" TEXT[],
    "observacoes" TEXT,
    "valorAvaliado" DECIMAL(12,2) NOT NULL,
    "productId" TEXT,
    "saidaNome" TEXT,
    "valorSaida" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerDocument" TEXT,
    "sellerId" TEXT NOT NULL,
    "unitId" TEXT,
    "preSaleId" TEXT,
    "saleId" TEXT,
    "estoqueProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_in_photos" (
    "id" TEXT NOT NULL,
    "tipo" "TradeInFotoTipo" NOT NULL DEFAULT 'APARELHO',
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeInId" TEXT NOT NULL,

    CONSTRAINT "trade_in_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trade_ins_code_key" ON "trade_ins"("code");

-- CreateIndex
CREATE UNIQUE INDEX "trade_ins_preSaleId_key" ON "trade_ins"("preSaleId");

-- CreateIndex
CREATE UNIQUE INDEX "trade_ins_saleId_key" ON "trade_ins"("saleId");

-- CreateIndex
CREATE INDEX "trade_ins_status_idx" ON "trade_ins"("status");

-- CreateIndex
CREATE INDEX "trade_ins_sellerId_idx" ON "trade_ins"("sellerId");

-- CreateIndex
CREATE INDEX "trade_ins_imei_idx" ON "trade_ins"("imei");

-- CreateIndex
CREATE INDEX "trade_ins_createdAt_idx" ON "trade_ins"("createdAt");

-- CreateIndex
CREATE INDEX "trade_in_photos_tradeInId_idx" ON "trade_in_photos"("tradeInId");

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_preSaleId_fkey" FOREIGN KEY ("preSaleId") REFERENCES "pre_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_ins" ADD CONSTRAINT "trade_ins_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_in_photos" ADD CONSTRAINT "trade_in_photos_tradeInId_fkey" FOREIGN KEY ("tradeInId") REFERENCES "trade_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

