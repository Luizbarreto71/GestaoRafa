-- AlterTable
ALTER TABLE "trade_in_photos" ADD COLUMN     "aparelhoId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "foto" BYTEA,
ADD COLUMN     "fotoMimeType" TEXT;

-- CreateTable
CREATE TABLE "trade_in_aparelhos" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "marca" TEXT,
    "armazenamento" TEXT,
    "cor" TEXT,
    "imei" TEXT,
    "imeiSituacao" "ImeiSituacao" NOT NULL DEFAULT 'NAO_CONSULTADO',
    "imeiCheckedAt" TIMESTAMP(3),
    "estado" TEXT,
    "defeitos" TEXT[],
    "observacoes" TEXT,
    "valorAvaliado" DECIMAL(12,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "tradeInId" TEXT NOT NULL,

    CONSTRAINT "trade_in_aparelhos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trade_in_aparelhos_tradeInId_idx" ON "trade_in_aparelhos"("tradeInId");

-- CreateIndex
CREATE INDEX "trade_in_photos_aparelhoId_idx" ON "trade_in_photos"("aparelhoId");

-- AddForeignKey
ALTER TABLE "trade_in_aparelhos" ADD CONSTRAINT "trade_in_aparelhos_tradeInId_fkey" FOREIGN KEY ("tradeInId") REFERENCES "trade_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_in_photos" ADD CONSTRAINT "trade_in_photos_aparelhoId_fkey" FOREIGN KEY ("aparelhoId") REFERENCES "trade_in_aparelhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- As trocas que já existem viram uma troca com um aparelho só. Sem isto
-- elas apareceriam vazias na tela nova, como se ninguém tivesse deixado
-- nada — e são cinco negócios reais já fechados.
INSERT INTO "trade_in_aparelhos" (
  "id", "modelo", "marca", "armazenamento", "cor", "imei", "imeiSituacao",
  "imeiCheckedAt", "estado", "defeitos", "observacoes", "valorAvaliado", "ordem", "tradeInId"
)
SELECT
  gen_random_uuid()::text, t."modelo", t."marca", t."armazenamento", t."cor", t."imei",
  t."imeiSituacao", t."imeiCheckedAt", t."estado", t."defeitos", t."observacoes",
  t."valorAvaliado", 0, t."id"
FROM "trade_ins" t
WHERE NOT EXISTS (SELECT 1 FROM "trade_in_aparelhos" a WHERE a."tradeInId" = t."id");

-- As fotos passam a apontar para o aparelho recém-criado, menos as do
-- documento do cliente, que são da troca inteira.
UPDATE "trade_in_photos" p
SET "aparelhoId" = a."id"
FROM "trade_in_aparelhos" a
WHERE a."tradeInId" = p."tradeInId" AND p."aparelhoId" IS NULL AND p."tipo" <> 'DOCUMENTO';
