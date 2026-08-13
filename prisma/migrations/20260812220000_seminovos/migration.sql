-- AlterTable
ALTER TABLE "products" ADD COLUMN     "seminovo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seminovoOrigem" TEXT,
ADD COLUMN     "tradeInAparelhoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_tradeInAparelhoId_key" ON "products"("tradeInAparelhoId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tradeInAparelhoId_fkey" FOREIGN KEY ("tradeInAparelhoId") REFERENCES "trade_in_aparelhos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Os aparelhos de vitrine que a loja já tem são seminovos: vieram usados,
-- só não passaram por esta aba porque ela não existia. Marcá-los agora
-- evita uma aba vazia num estoque cheio deles.
UPDATE "products" p
SET "seminovo" = true, "seminovoOrigem" = 'Cadastro anterior'
FROM "categories" c
WHERE p."categoryId" = c."id" AND c."slug" LIKE '%vitrine%' AND p."seminovo" = false;
