import { MovementType, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import { contem, intervalo, limpar, numero, paginacao, paginado, rota, validar } from './core';
import { db } from './db';
import { enviarParaPlanilha } from './planilha';

/**
 * Toda mudança de estoque passa por aqui: é o único lugar que cria
 * movimentação, e é quem avisa a planilha do Google.
 */

export type ProdutoCompleto = Prisma.ProductGetPayload<{
  include: { category: true; supplier: true };
}>;

export const TIPO_LABEL: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE: 'Ajuste',
  EXCLUSAO: 'Exclusão',
};

export const STATUS_LABEL: Record<string, string> = {
  EM_ESTOQUE: 'Em estoque',
  RESERVADO: 'Reservado',
  VENDIDO: 'Vendido',
};

interface Movimentacao {
  tipo: MovementType;
  quantidade: number;
  motivo?: string | null;
  produto: ProdutoCompleto;
  saldo?: number;
  vendaId?: string | null;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  /** Client de dentro de uma transação; usa o global se não vier. */
  tx?: Prisma.TransactionClient;
}

export async function registrarMovimentacao(m: Movimentacao) {
  const cliente = m.tx ?? db;
  const saldo = m.saldo ?? m.produto.quantity;

  const registro = await cliente.movement.create({
    data: {
      type: m.tipo,
      quantity: m.quantidade,
      reason: m.motivo ?? null,
      balanceAfter: saldo,
      productId: m.produto.id,
      productName: m.produto.name,
      saleId: m.vendaId ?? null,
      userId: m.usuarioId ?? null,
    },
  });

  enviarParaPlanilha(linhaDaPlanilha(m.produto, m.tipo, m.quantidade, m.usuarioNome, saldo));

  return registro;
}

/** Monta a linha que vai para o Google Sheets. */
export function linhaDaPlanilha(
  produto: ProdutoCompleto,
  tipo: MovementType,
  quantidade: number,
  usuario?: string | null,
  saldo?: number,
) {
  const status = saldo === 0 && tipo === 'SAIDA' ? 'VENDIDO' : produto.status;
  return {
    data: new Date(),
    categoria: produto.category?.name ?? '—',
    produto: produto.name,
    marca: produto.brand ?? '',
    modelo: produto.model ?? '',
    quantidade,
    custo: numero(produto.costPrice),
    venda: numero(produto.salePrice),
    fornecedor: produto.supplier?.name ?? '',
    status: STATUS_LABEL[status] ?? status,
    tipo: TIPO_LABEL[tipo],
    usuario: usuario ?? '',
  };
}

// ------------------------------------------------------- Consultas de estoque

/**
 * Produtos no nível mínimo ou abaixo dele. Comparar duas colunas
 * (`quantity <= minQuantity`) não existe no Prisma, então vai em SQL.
 */
export async function idsComEstoqueBaixo(limite = 200): Promise<string[]> {
  const linhas = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "products"
    WHERE "quantity" > 0 AND "quantity" <= "minQuantity"
    ORDER BY "quantity" ASC
    LIMIT ${limite}
  `;
  return linhas.map((l) => l.id);
}

/** Valor total do estoque, a custo e a venda. */
export async function valorDoEstoque(): Promise<{ custo: number; venda: number }> {
  const [linha] = await db.$queryRaw<{ custo: string | null; venda: string | null }[]>`
    SELECT
      SUM("quantity" * "costPrice")::text AS custo,
      SUM("quantity" * "salePrice")::text AS venda
    FROM "products" WHERE "quantity" > 0
  `;
  return { custo: Number(linha?.custo ?? 0), venda: Number(linha?.venda ?? 0) };
}

// ------------------------------------------------------------------- Rotas

export const rotasMovimentacoes = Router();
rotasMovimentacoes.use(autenticar);

const filtros = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'EXCLUSAO']).optional(),
  productId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export function filtrarMovimentacoes(q: z.infer<typeof filtros>): Prisma.MovementWhereInput {
  const cond: Prisma.MovementWhereInput[] = [];

  if (q.search) {
    cond.push({
      OR: [
        { productName: contem(q.search) },
        { reason: contem(q.search) },
        { product: { model: contem(q.search) } },
      ],
    });
  }
  if (q.type) cond.push({ type: q.type });
  if (q.productId) cond.push({ productId: q.productId });
  if (q.userId) cond.push({ userId: q.userId });
  if (q.categoryId) cond.push({ product: { categoryId: q.categoryId } });

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ createdAt: periodo });

  return cond.length ? { AND: cond } : {};
}

rotasMovimentacoes.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtros, req.query);
    const p = paginacao(q as Record<string, unknown>);
    const where = filtrarMovimentacoes(q);

    const [lista, total, agrupado] = await Promise.all([
      db.movement.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: q.sortOrder === 'asc' ? 'asc' : 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, model: true, category: { select: { name: true } } } },
        },
      }),
      db.movement.count({ where }),
      db.movement.groupBy({ by: ['type'], where, _sum: { quantity: true }, _count: true }),
    ]);

    res.json(
      limpar({
        ...paginado(lista, total, p),
        summary: Object.fromEntries(
          agrupado.map((g) => [g.type, { count: g._count, quantity: g._sum.quantity ?? 0 }]),
        ),
      }),
    );
  }),
);
