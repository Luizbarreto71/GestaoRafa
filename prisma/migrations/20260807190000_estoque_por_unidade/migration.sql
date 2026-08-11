-- Estoque por unidade (Matriz e Sede)
--
-- A quantidade sai do produto e passa a viver na tabela "stock", uma linha
-- por unidade. Escrita à mão porque a migração automática apagaria dados:
-- aqui o estoque atual, o histórico de movimentações e as vendas antigas
-- são preservados — tudo atribuído à Matriz, que era a única unidade que
-- existia antes.

-- ---------------------------------------------------------------------------
-- 1) Tipos novos. O MovementType nasce com nome temporário porque o antigo
--    ainda está em uso pela tabela "movements", que só sai no fim.
-- ---------------------------------------------------------------------------
CREATE TYPE "MovementReason" AS ENUM (
  'COMPRA', 'CADASTRO', 'VENDA', 'DEFEITO', 'DEVOLUCAO_FORNECEDOR', 'PERDA',
  'USO_INTERNO', 'AJUSTE', 'TRANSFERENCIA', 'CANCELAMENTO', 'EXCLUSAO', 'OUTRO'
);

CREATE TYPE "TransferStatus" AS ENUM ('PENDENTE', 'EM_TRANSITO', 'RECEBIDA', 'CANCELADA');

CREATE TYPE "MovementType_novo" AS ENUM ('ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE');

-- ---------------------------------------------------------------------------
-- 2) As unidades. Precisam existir antes de qualquer coisa apontar para elas.
-- ---------------------------------------------------------------------------
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FILIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

INSERT INTO "units" ("id", "name", "type", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'Matriz', 'MATRIZ', CURRENT_TIMESTAMP),
  ('22222222-2222-4222-8222-222222222222', 'Sede',   'FILIAL', CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- 3) Perfis: OPERADOR vira VENDEDOR e entra o GERENTE.
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING ("role"::TEXT);
UPDATE "users" SET "role" = 'VENDEDOR' WHERE "role" = 'OPERADOR';

DROP TYPE "UserRole";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GERENTE', 'VENDEDOR');

ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VENDEDOR';

ALTER TABLE "users" ADD COLUMN "unitId" TEXT;
CREATE INDEX "users_unitId_idx" ON "users"("unitId");
ALTER TABLE "users" ADD CONSTRAINT "users_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4) Vendas antigas passam a constar como feitas na Matriz.
-- ---------------------------------------------------------------------------
ALTER TABLE "sales" ADD COLUMN "unitId" TEXT;
UPDATE "sales" SET "unitId" = '11111111-1111-4111-8111-111111111111';
ALTER TABLE "sales" ALTER COLUMN "unitId" SET NOT NULL;
CREATE INDEX "sales_unitId_idx" ON "sales"("unitId");
ALTER TABLE "sales" ADD CONSTRAINT "sales_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5) Saldo por unidade. O estoque que estava no produto vem para cá.
-- ---------------------------------------------------------------------------
CREATE TABLE "stock" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_unitId_idx" ON "stock"("unitId");
CREATE UNIQUE INDEX "stock_productId_unitId_key" ON "stock"("productId", "unitId");
ALTER TABLE "stock" ADD CONSTRAINT "stock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock" ADD CONSTRAINT "stock_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "stock" ("id", "productId", "unitId", "quantity", "updatedAt")
SELECT gen_random_uuid(), p."id", '11111111-1111-4111-8111-111111111111', p."quantity", CURRENT_TIMESTAMP
FROM "products" p
WHERE p."quantity" > 0;

-- ---------------------------------------------------------------------------
-- 6) Transferências entre unidades.
-- ---------------------------------------------------------------------------
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'RECEBIDA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "productId" TEXT NOT NULL,
    "originUnitId" TEXT NOT NULL,
    "destinationUnitId" TEXT NOT NULL,
    "requestedById" TEXT,
    "receivedById" TEXT,
    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_transfers_createdAt_idx" ON "stock_transfers"("createdAt");
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers"("status");
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_originUnitId_fkey"
  FOREIGN KEY ("originUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destinationUnitId_fkey"
  FOREIGN KEY ("destinationUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7) Histórico de movimentações, agora com unidade, saldo antes/depois,
--    origem, destino e motivo.
-- ---------------------------------------------------------------------------
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" "MovementType_novo" NOT NULL,
    "reason" "MovementReason" NOT NULL DEFAULT 'OUTRO',
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER,
    "newQuantity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT,
    "productName" TEXT,
    "unitId" TEXT,
    "originUnitId" TEXT,
    "destinationUnitId" TEXT,
    "referenceId" TEXT,
    "saleId" TEXT,
    "transferId" TEXT,
    "userId" TEXT,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");
CREATE INDEX "stock_movements_unitId_idx" ON "stock_movements"("unitId");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O histórico antigo é copiado, não descartado: movimentação apagada é
-- auditoria perdida. O antigo tipo EXCLUSAO vira um AJUSTE com motivo próprio.
INSERT INTO "stock_movements" (
  "id", "type", "reason", "quantity", "previousQuantity", "newQuantity",
  "notes", "createdAt", "productId", "productName", "unitId", "saleId", "userId"
)
SELECT
  m."id",
  CASE m."type"::TEXT
    WHEN 'ENTRADA' THEN 'ENTRADA'::"MovementType_novo"
    WHEN 'SAIDA'   THEN 'SAIDA'::"MovementType_novo"
    ELSE 'AJUSTE'::"MovementType_novo"
  END,
  CASE
    WHEN m."type"::TEXT = 'EXCLUSAO' THEN 'EXCLUSAO'::"MovementReason"
    WHEN m."saleId" IS NOT NULL      THEN 'VENDA'::"MovementReason"
    ELSE 'OUTRO'::"MovementReason"
  END,
  m."quantity",
  NULL,
  m."balanceAfter",
  m."reason",
  m."createdAt",
  m."productId",
  m."productName",
  '11111111-1111-4111-8111-111111111111',
  m."saleId",
  m."userId"
FROM "movements" m;

-- ---------------------------------------------------------------------------
-- 8) Com os dados já copiados, o que sobrou pode sair.
-- ---------------------------------------------------------------------------
DROP TABLE "movements";
DROP TYPE "MovementType";
ALTER TYPE "MovementType_novo" RENAME TO "MovementType";

ALTER TABLE "products" DROP COLUMN "quantity";
