-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "campos" JSONB;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lote" TEXT;

-- CreateIndex
CREATE INDEX "products_lote_idx" ON "products"("lote");
