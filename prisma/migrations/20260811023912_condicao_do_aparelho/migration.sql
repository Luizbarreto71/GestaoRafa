-- AlterTable
ALTER TABLE "products" ADD COLUMN     "condicao" TEXT;

-- CreateIndex
CREATE INDEX "products_condicao_idx" ON "products"("condicao");
