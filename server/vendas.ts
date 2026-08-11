import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import {
  AppError,
  contem,
  intervalo,
  limpar,
  naoEncontrado,
  numero,
  ordenar,
  paginacao,
  paginado,
  rota,
  semVazios,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { movimentar } from './estoque';
import { exigir } from './permissoes';
import { unidadePermitida } from './unidades';
import { registrarVenda } from './vendas-service';

/** Vendas concluídas: consulta, PDV direto e cancelamento. */

export const rotasVendas = Router();
rotasVendas.use(autenticar);

const PAGAMENTOS = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OUTRO'] as const;

const COM_TUDO = {
  items: { include: { product: { select: { id: true, name: true, model: true, category: true } } } },
  customer: true,
  unit: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  cashier: { select: { id: true, name: true } },
  preSale: { select: { id: true, code: true } },
} satisfies Prisma.SaleInclude;

const filtrosSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAGAMENTOS).optional(),
  sellerId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosVenda = z.infer<typeof filtrosSchema>;

export function filtrarVendas(q: FiltrosVenda, unidadeId?: string): Prisma.SaleWhereInput {
  const cond: Prisma.SaleWhereInput[] = [{ status: 'FINALIZADA' }];

  if (q.search) {
    cond.push({
      OR: [
        { code: contem(q.search) },
        { customerName: contem(q.search) },
        { customerPhone: contem(q.search) },
        { customerDocument: contem(q.search) },
        { items: { some: { productName: contem(q.search) } } },
        { items: { some: { imei: contem(q.search) } } },
        { items: { some: { serialNumber: contem(q.search) } } },
        { items: { some: { product: { name: contem(q.search) } } } },
      ],
    });
  }

  if (q.productId) cond.push({ items: { some: { productId: q.productId } } });
  if (q.categoryId) cond.push({ items: { some: { product: { categoryId: q.categoryId } } } });
  if (q.paymentMethod) cond.push({ paymentMethod: q.paymentMethod });
  if (q.sellerId) cond.push({ sellerId: q.sellerId });
  if (q.cashierId) cond.push({ cashierId: q.cashierId });
  if (unidadeId) cond.push({ unitId: unidadeId });

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ saleDate: periodo });

  return { AND: cond };
}

rotasVendas.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtrosSchema, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const p = paginacao(q as Record<string, unknown>);
    const where = filtrarVendas(q, unidade);

    const [lista, total, somas, itens] = await Promise.all([
      db.sale.findMany({
        where,
        include: COM_TUDO,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(q.sortBy, q.sortOrder, ['saleDate', 'totalAmount', 'code', 'createdAt'], {
          saleDate: 'desc',
        }) as never,
      }),
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalAmount: true, costAmount: true } }),
      db.saleItem.aggregate({ where: { sale: where }, _sum: { quantity: true } }),
    ]);

    res.json(
      limpar({
        ...paginado(lista, total, p),
        totals: {
          revenue: somas._sum.totalAmount ?? 0,
          profit: numero(somas._sum.totalAmount) - numero(somas._sum.costAmount),
          items: itens._sum.quantity ?? 0,
        },
      }),
    );
  }),
);

rotasVendas.get(
  '/:id',
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({ where: { id: req.params.id }, include: COM_TUDO });
    if (!venda) throw naoEncontrado('Venda');
    res.json(limpar(venda));
  }),
);

// ------------------------------------------------------------- PDV direto

const vendaSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Selecione o produto'),
        quantity: z.coerce.number().int().min(1, 'Quantidade mínima: 1'),
        unitPrice: z.coerce.number().min(0, 'Informe o valor'),
        imei: z.string().trim().max(40).optional().nullable(),
        serialNumber: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1, 'Inclua ao menos um produto'),
  unitId: z.string().uuid('Informe de qual unidade o produto saiu'),
  paymentMethod: z.enum(PAGAMENTOS),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  /**
   * Opcional na venda de balcão.
   *
   * No caixa a fila anda, e exigir nome e CPF de quem paga R$ 60 num cabo
   * atrasa todo mundo. A pré-venda continua pedindo: lá o caixa precisa
   * saber de quem é o pedido.
   */
  customerName: z.string().trim().max(180).optional().nullable(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerDocument: z.string().trim().max(30).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  /** Vendedor que atendeu, para a comissão. Vazio = o próprio caixa. */
  sellerId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  saleDate: z.coerce.date().optional(),
});

/** Venda feita direto no balcão, sem passar por pré-venda. */
rotasVendas.post(
  '/',
  exigir('pdv'),
  rota(async (req, res) => {
    const dados = validar(vendaSchema, req.body);

    const venda = await registrarVenda({
      itens: dados.items,
      unitId: dados.unitId,
      paymentMethod: dados.paymentMethod as never,
      installments: dados.installments,
      customerName: dados.customerName,
      customerPhone: dados.customerPhone,
      customerDocument: dados.customerDocument,
      customerId: dados.customerId,
      notes: dados.notes,
      sellerId: dados.sellerId ?? req.usuario!.id,
      cashierId: req.usuario!.id,
      cashierName: req.usuario!.nome,
      saleDate: dados.saleDate,
    });

    await registrarLog({
      acao: 'CRIAR_VENDA',
      entidade: 'Sale',
      id: venda.id,
      alteracoes: {
        venda: venda.code,
        unidade: venda.unit.name,
        pagamento: dados.paymentMethod,
        total: numero(venda.totalAmount),
      },
      req,
    });

    res.status(201).json(limpar(venda));
  }),
);

/**
 * Cancela a venda e devolve tudo ao estoque.
 *
 * A venda não é apagada: vira CANCELADA e as devoluções entram como
 * movimentação. Assim o histórico continua contando o que aconteceu.
 */
rotasVendas.delete(
  '/:id',
  exigir('venda.cancelar'),
  rota(async (req, res) => {
    const motivo = String(req.query.reason ?? '').trim();

    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, unit: { select: { name: true } } },
    });
    if (!venda) throw naoEncontrado('Venda');
    if (venda.status === 'CANCELADA') throw new AppError('Esta venda já foi cancelada.');

    for (const item of venda.items) {
      await movimentar({
        produtoId: item.productId,
        produtoNome: item.productName ?? 'Produto',
        unidadeId: venda.unitId,
        tipo: 'ENTRADA',
        motivo: 'CANCELAMENTO',
        quantidade: item.quantity,
        observacao: `Cancelamento da venda ${venda.code}${motivo ? ` · ${motivo}` : ''}`,
        vendaId: venda.id,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
      });
    }

    await db.sale.update({ where: { id: venda.id }, data: { status: 'CANCELADA' } });

    await registrarLog({
      acao: 'CANCELAR_VENDA',
      entidade: 'Sale',
      id: venda.id,
      alteracoes: { venda: venda.code, motivo },
      req,
    });

    res.json({
      message: `Venda ${venda.code} cancelada. ${venda.items.length} item(ns) devolvidos ao estoque da ${venda.unit.name}.`,
    });
  }),
);
