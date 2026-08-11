import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar, gerenteOuAdmin, somenteAdmin } from './auth';
import {
  AppError,
  contem,
  intervalo,
  limpar,
  naoEncontrado,
  paginacao,
  paginado,
  rota,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { cancelarTransferencia, movimentar, transferir } from './estoque';
import { exigirAcessoNaUnidade, unidadePermitida } from './unidades';

/** Entrada, saída, transferência e o histórico de tudo isso. */

export const rotasMovimentacoes = Router();
rotasMovimentacoes.use(autenticar);

const MOTIVOS = [
  'COMPRA',
  'VENDA',
  'DEFEITO',
  'DEVOLUCAO_FORNECEDOR',
  'PERDA',
  'USO_INTERNO',
  'AJUSTE',
  'OUTRO',
] as const;

// ------------------------------------------------------------------ Entrada

const entradaSchema = z.object({
  productId: z.string().uuid('Selecione o produto'),
  unitId: z.string().uuid('Selecione a unidade'),
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser no mínimo 1'),
  supplierId: z.string().uuid().optional().nullable(),
  costPrice: z.coerce.number().min(0).optional(),
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  reason: z.enum(MOTIVOS).default('COMPRA'),
});

rotasMovimentacoes.post(
  '/entrada',
  gerenteOuAdmin,
  rota(async (req, res) => {
    const dados = validar(entradaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);

    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado('Produto');

    // Entrada pode atualizar o custo e o fornecedor do produto: é a compra
    // mais recente que passa a valer.
    if (dados.costPrice !== undefined || dados.supplierId) {
      await db.product.update({
        where: { id: produto.id },
        data: {
          ...(dados.costPrice !== undefined ? { costPrice: dados.costPrice } : {}),
          ...(dados.supplierId ? { supplierId: dados.supplierId } : {}),
        },
      });
    }

    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: 'ENTRADA',
      motivo: dados.reason,
      quantidade: dados.quantity,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({ acao: 'ENTRADA', entidade: 'Stock', id: produto.id, req });
    res.status(201).json({ ...resultado, message: `Entrada de ${dados.quantity} un. registrada.` });
  }),
);

// -------------------------------------------------------------------- Saída

const saidaSchema = z.object({
  productId: z.string().uuid('Selecione o produto'),
  unitId: z.string().uuid('Selecione a unidade'),
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser no mínimo 1'),
  reason: z.enum(MOTIVOS, { errorMap: () => ({ message: 'Selecione o motivo' }) }),
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

rotasMovimentacoes.post(
  '/saida',
  gerenteOuAdmin,
  rota(async (req, res) => {
    const dados = validar(saidaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);

    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado('Produto');

    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: 'SAIDA',
      motivo: dados.reason,
      quantidade: dados.quantity,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({ acao: 'SAIDA', entidade: 'Stock', id: produto.id, req });
    res.status(201).json({ ...resultado, message: `Saída de ${dados.quantity} un. registrada.` });
  }),
);

// ------------------------------------------------------------- Transferência

const transferenciaSchema = z.object({
  productId: z.string().uuid('Selecione o produto'),
  originUnitId: z.string().uuid('Selecione a unidade de origem'),
  destinationUnitId: z.string().uuid('Selecione a unidade de destino'),
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser no mínimo 1'),
  date: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

rotasMovimentacoes.post(
  '/transferencia',
  gerenteOuAdmin,
  rota(async (req, res) => {
    const dados = validar(transferenciaSchema, req.body);
    // Quem não é admin só transfere a partir da própria unidade.
    exigirAcessoNaUnidade(req.usuario, dados.originUnitId);

    const r = await transferir({
      produtoId: dados.productId,
      origemId: dados.originUnitId,
      destinoId: dados.destinationUnitId,
      quantidade: dados.quantity,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({
      acao: 'TRANSFERENCIA',
      entidade: 'StockTransfer',
      id: r.transferencia.id,
      req,
    });

    res.status(201).json(
      limpar({
        transfer: r.transferencia,
        message:
          `${dados.quantity} un. de ${r.produto.name} transferidas da ${r.origem.name} para a ${r.destino.name}. ` +
          `${r.origem.name}: ${r.saida.antes} → ${r.saida.depois} · ${r.destino.name}: ${r.entrada.antes} → ${r.entrada.depois}`,
      }),
    );
  }),
);

const filtroTransferencias = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(['PENDENTE', 'EM_TRANSITO', 'RECEBIDA', 'CANCELADA']).optional(),
  unitId: z.string().uuid().optional(),
});

rotasMovimentacoes.get(
  '/transferencias',
  rota(async (req, res) => {
    const q = validar(filtroTransferencias, req.query);
    const p = paginacao(q as Record<string, unknown>);
    const unidade = unidadePermitida(req.usuario, q.unitId);

    const where: Prisma.StockTransferWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      // Aparece para quem enviou e para quem recebeu.
      ...(unidade
        ? { OR: [{ originUnitId: unidade }, { destinationUnitId: unidade }] }
        : {}),
    };

    const [lista, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, model: true } },
          originUnit: { select: { id: true, name: true } },
          destinationUnit: { select: { id: true, name: true } },
        },
      }),
      db.stockTransfer.count({ where }),
    ]);

    res.json(limpar(paginado(lista, total, p)));
  }),
);

/** Cancelar devolve o estoque criando novas movimentações — nada é apagado. */
rotasMovimentacoes.post(
  '/transferencias/:id/cancelar',
  somenteAdmin,
  rota(async (req, res) => {
    const t = await cancelarTransferencia(req.params.id, req.usuario);
    await registrarLog({ acao: 'CANCEL', entidade: 'StockTransfer', id: t.id, req });
    res.json({ message: 'Transferência cancelada e estoque devolvido à origem.' });
  }),
);

// ---------------------------------------------------------------- Histórico

const filtros = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  type: z.enum(['ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE']).optional(),
  reason: z.enum(MOTIVOS).optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosMovimento = z.infer<typeof filtros>;

export function filtrarMovimentacoes(
  q: FiltrosMovimento,
  unidade?: string,
): Prisma.StockMovementWhereInput {
  const cond: Prisma.StockMovementWhereInput[] = [];

  if (q.search) {
    cond.push({
      OR: [
        { productName: contem(q.search) },
        { notes: contem(q.search) },
        { product: { model: contem(q.search) } },
      ],
    });
  }

  if (q.type) cond.push({ type: q.type });
  if (q.reason) cond.push({ reason: q.reason });
  if (q.productId) cond.push({ productId: q.productId });
  if (q.userId) cond.push({ userId: q.userId });
  if (q.categoryId) cond.push({ product: { categoryId: q.categoryId } });
  if (unidade) cond.push({ unitId: unidade });

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ createdAt: periodo });

  return cond.length ? { AND: cond } : {};
}

rotasMovimentacoes.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtros, req.query);
    const p = paginacao(q as Record<string, unknown>);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = filtrarMovimentacoes(q, unidade);

    const [lista, total, agrupado] = await Promise.all([
      db.stockMovement.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: q.sortOrder === 'asc' ? 'asc' : 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          product: {
            select: { id: true, name: true, model: true, category: { select: { name: true } } },
          },
        },
      }),
      db.stockMovement.count({ where }),
      db.stockMovement.groupBy({ by: ['type'], where, _sum: { quantity: true }, _count: true }),
    ]);

    // Nomes das unidades de origem/destino, para o histórico não ficar com ids.
    const unidades = await db.unit.findMany({ select: { id: true, name: true } });
    const nome = (id?: string | null) => unidades.find((u) => u.id === id)?.name ?? null;

    res.json(
      limpar({
        ...paginado(
          lista.map((m) => ({
            ...m,
            originUnitName: nome(m.originUnitId),
            destinationUnitName: nome(m.destinationUnitId),
          })),
          total,
          p,
        ),
        summary: Object.fromEntries(
          agrupado.map((g) => [g.type, { count: g._count, quantity: g._sum.quantity ?? 0 }]),
        ),
      }),
    );
  }),
);

// ------------------------------------------------------------------ Ajuste

const ajusteSchema = z.object({
  productId: z.string().uuid(),
  unitId: z.string().uuid(),
  /** Saldo que o estoque deve passar a ter naquela unidade. */
  newQuantity: z.coerce.number().int().min(0, 'O saldo não pode ser negativo'),
  notes: z.string().trim().min(3, 'Explique o motivo da correção').max(1000),
});

/**
 * Corrige o saldo de uma unidade lançando a diferença como movimentação.
 * É assim que se conserta um erro: nunca editando o passado.
 */
rotasMovimentacoes.post(
  '/ajuste',
  gerenteOuAdmin,
  rota(async (req, res) => {
    const dados = validar(ajusteSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);

    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado('Produto');

    const atual = await db.stock.findUnique({
      where: { productId_unitId: { productId: dados.productId, unitId: dados.unitId } },
    });
    const saldoAtual = atual?.quantity ?? 0;
    const diferenca = dados.newQuantity - saldoAtual;

    if (diferenca === 0) {
      throw new AppError(`O saldo já é ${saldoAtual}. Nada a corrigir.`);
    }

    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: 'AJUSTE',
      motivo: 'AJUSTE',
      sentido: diferenca > 0 ? 'entra' : 'sai',
      quantidade: Math.abs(diferenca),
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({ acao: 'AJUSTE', entidade: 'Stock', id: produto.id, req });
    res.json({ ...resultado, message: `Saldo corrigido de ${saldoAtual} para ${dados.newQuantity}.` });
  }),
);
