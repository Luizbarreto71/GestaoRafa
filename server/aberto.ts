import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import {
  AppError,
  contem,
  limpar,
  naoEncontrado,
  numero,
  paginacao,
  paginado,
  rota,
  semVazios,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { exigir } from './permissoes';
import { unidadePermitida } from './unidades';

/**
 * O que a loja tem a receber.
 *
 * Quando o caixa fecha uma venda com "valor em aberto", o cliente levou a
 * mercadoria e ficou devendo. A cobrança fica aqui até alguém dar baixa.
 */
export const rotasEmAberto = Router();
rotasEmAberto.use(autenticar);

const COM_A_VENDA = {
  sale: {
    select: {
      id: true,
      code: true,
      saleDate: true,
      customerName: true,
      customerPhone: true,
      customerDocument: true,
      unit: { select: { id: true, name: true } },
      seller: { select: { name: true } },
      sellerName: true,
      items: { select: { productName: true, quantity: true } },
    },
  },
} satisfies Prisma.SalePaymentInclude;

/** Dias corridos desde a venda — é o que diz se a cobrança está atrasada. */
const diasDesde = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

rotasEmAberto.get(
  '/',
  exigir('prevenda.verTodas'),
  rota(async (req, res) => {
    const q = validar(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(200).optional(),
        search: z.string().trim().optional(),
        unitId: z.string().uuid().optional(),
        /** "abertos" (padrão), "quitados" ou "todos". */
        situacao: z.enum(['abertos', 'quitados', 'todos']).default('abertos'),
      }),
      semVazios(req.query),
    );

    const p = paginacao(q as Record<string, unknown>);
    const unidade = unidadePermitida(req.usuario, q.unitId);

    const where: Prisma.SalePaymentWhereInput = {
      method: 'EM_ABERTO',
      ...(q.situacao === 'abertos' ? { settledAt: null } : {}),
      ...(q.situacao === 'quitados' ? { NOT: { settledAt: null } } : {}),
      sale: {
        // Venda cancelada não cobra ninguém.
        status: 'FINALIZADA',
        ...(unidade ? { unitId: unidade } : {}),
        ...(q.search
          ? {
              OR: [
                { customerName: contem(q.search) },
                { customerPhone: contem(q.search) },
                { code: contem(q.search) },
              ],
            }
          : {}),
      },
    };

    const [lista, total, emAberto] = await Promise.all([
      db.salePayment.findMany({
        where,
        include: COM_A_VENDA,
        skip: p.skip,
        take: p.take,
        // Mais antigo primeiro: é o que está esperando há mais tempo.
        orderBy: { sale: { saleDate: 'asc' } },
      }),
      db.salePayment.count({ where }),
      db.salePayment.aggregate({
        where: { method: 'EM_ABERTO', settledAt: null, sale: { status: 'FINALIZADA' } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json(
      limpar({
        ...paginado(
          lista.map((p) => ({
            ...p,
            dias: diasDesde(p.sale.saleDate),
            vendedor: p.sale.seller?.name ?? p.sale.sellerName ?? null,
            produtos: p.sale.items.map((i) => `${i.quantity}× ${i.productName}`).join(', '),
          })),
          total,
          p,
        ),
        resumo: {
          cobrancas: emAberto._count,
          total: numero(emAberto._sum.amount),
        },
      }),
    );
  }),
);

const baixaSchema = z.object({
  /** Como o cliente pagou a dívida. */
  method: z.enum(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OUTRO']),
});

/**
 * Dá baixa numa cobrança.
 *
 * O lançamento original não muda de forma: ele pertence ao dia da venda, e
 * mexer nele reescreveria o fechamento daquele caixa. A baixa é registrada
 * ao lado, com a data de hoje.
 */
rotasEmAberto.post(
  '/:id/receber',
  exigir('venda.finalizar'),
  rota(async (req, res) => {
    const { method } = validar(baixaSchema, req.body);

    const cobranca = await db.salePayment.findUnique({
      where: { id: req.params.id },
      include: { sale: { select: { code: true, customerName: true } } },
    });

    if (!cobranca || cobranca.method !== 'EM_ABERTO') throw naoEncontrado('Cobrança');
    if (cobranca.settledAt) throw new AppError('Esta cobrança já foi quitada.');

    await db.salePayment.update({
      where: { id: cobranca.id },
      data: {
        settledAt: new Date(),
        settledMethod: method,
        settledById: req.usuario?.id ?? null,
        // Agora o dinheiro entrou: o líquido deixa de ser zero.
        netAmount: cobranca.amount,
      },
    });

    await registrarLog({
      acao: 'RECEBER_EM_ABERTO',
      entidade: 'SalePayment',
      id: cobranca.id,
      alteracoes: { venda: cobranca.sale.code, valor: numero(cobranca.amount), forma: method },
      req,
    });

    res.json({
      message:
        `Recebido de ${cobranca.sale.customerName ?? 'cliente'}: ` +
        `R$ ${numero(cobranca.amount).toFixed(2)} da venda ${cobranca.sale.code}.`,
    });
  }),
);

/** Desfaz a baixa, para quando alguém marcou a cobrança errada. */
rotasEmAberto.post(
  '/:id/reabrir',
  exigir('venda.finalizar'),
  rota(async (req, res) => {
    const cobranca = await db.salePayment.findUnique({ where: { id: req.params.id } });
    if (!cobranca || cobranca.method !== 'EM_ABERTO') throw naoEncontrado('Cobrança');
    if (!cobranca.settledAt) throw new AppError('Esta cobrança já está em aberto.');

    await db.salePayment.update({
      where: { id: cobranca.id },
      data: {
        settledAt: null,
        settledMethod: null,
        settledById: null,
        netAmount: new Prisma.Decimal(0),
      },
    });

    await registrarLog({ acao: 'REABRIR_EM_ABERTO', entidade: 'SalePayment', id: cobranca.id, req });
    res.json({ message: 'Cobrança reaberta.' });
  }),
);
