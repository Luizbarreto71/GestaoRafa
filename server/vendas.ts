import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar, somenteAdmin } from './auth';
import {
  AppError,
  contem,
  intervalo,
  limpar,
  naoEncontrado,
  ordenar,
  paginacao,
  paginado,
  rota,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { linhaDaPlanilha } from './movimentacoes';
import { enviarParaPlanilha } from './planilha';

/** Registro e cancelamento de vendas — é aqui que o estoque baixa. */

export const rotasVendas = Router();
rotasVendas.use(autenticar);

const COM_RELACOES = {
  product: { include: { category: true, supplier: true } },
  customer: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

const PAGAMENTOS = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'] as const;

const vendaSchema = z.object({
  productId: z.string().uuid('Selecione o produto'),
  customerName: z.string().trim().min(2, 'Informe o nome do cliente').max(180),
  customerPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => v || null),
  customerId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'A quantidade deve ser no mínimo 1'),
  unitPrice: z.coerce.number().min(0, 'Informe o valor vendido'),
  paymentMethod: z.enum(PAGAMENTOS, { errorMap: () => ({ message: 'Selecione a forma de pagamento' }) }),
  saleDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const filtrosSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAGAMENTOS).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosVenda = z.infer<typeof filtrosSchema>;

export function filtrarVendas(q: FiltrosVenda): Prisma.SaleWhereInput {
  const cond: Prisma.SaleWhereInput[] = [];

  if (q.search) {
    cond.push({
      OR: [
        { customerName: contem(q.search) },
        { customerPhone: contem(q.search) },
        { notes: contem(q.search) },
        { product: { name: contem(q.search) } },
        { product: { imei: contem(q.search) } },
        { product: { serialNumber: contem(q.search) } },
        { product: { model: contem(q.search) } },
        { product: { brand: contem(q.search) } },
      ],
    });
  }

  if (q.productId) cond.push({ productId: q.productId });
  if (q.categoryId) cond.push({ product: { categoryId: q.categoryId } });
  if (q.supplierId) cond.push({ product: { supplierId: q.supplierId } });
  if (q.paymentMethod) cond.push({ paymentMethod: q.paymentMethod });

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ saleDate: periodo });

  return cond.length ? { AND: cond } : {};
}

rotasVendas.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtrosSchema, req.query);
    const p = paginacao(q as Record<string, unknown>);
    const where = filtrarVendas(q);

    const [lista, total, somas] = await Promise.all([
      db.sale.findMany({
        where,
        include: COM_RELACOES,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(
          q.sortBy,
          q.sortOrder,
          ['saleDate', 'totalPrice', 'quantity', 'createdAt', 'customerName', 'product.name'],
          { saleDate: 'desc' },
        ) as never,
      }),
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalPrice: true, quantity: true } }),
    ]);

    res.json(
      limpar({
        ...paginado(lista, total, p),
        totals: { revenue: somas._sum.totalPrice ?? 0, items: somas._sum.quantity ?? 0 },
      }),
    );
  }),
);

rotasVendas.get(
  '/:id',
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!venda) throw naoEncontrado('Venda');
    res.json(limpar(venda));
  }),
);

/**
 * Registra a venda, baixa o estoque e cria a movimentação — tudo numa
 * transação só. A baixa usa `updateMany` com guarda de quantidade para que
 * duas vendas ao mesmo tempo não deixem o estoque negativo.
 */
rotasVendas.post(
  '/',
  rota(async (req, res) => {
    const dados = validar(vendaSchema, req.body);
    const usuario = req.usuario;

    const resultado = await db.$transaction(async (tx) => {
      const produto = await tx.product.findUnique({
        where: { id: dados.productId },
        include: { category: true, supplier: true },
      });
      if (!produto) throw naoEncontrado('Produto');

      if (produto.quantity < dados.quantity) {
        throw new AppError(
          `Estoque insuficiente para "${produto.name}". Disponível: ${produto.quantity}.`,
        );
      }

      const baixa = await tx.product.updateMany({
        where: { id: produto.id, quantity: { gte: dados.quantity } },
        data: { quantity: { decrement: dados.quantity } },
      });

      if (baixa.count === 0) {
        throw new AppError('O estoque mudou durante a operação. Tente novamente.', 409);
      }

      const restante = produto.quantity - dados.quantity;
      if (restante === 0) {
        await tx.product.update({ where: { id: produto.id }, data: { status: 'VENDIDO' } });
      }

      // Reaproveita o cliente pelo telefone; se não achar, cria.
      let clienteId = dados.customerId ?? null;
      if (!clienteId) {
        const existente = dados.customerPhone
          ? await tx.customer.findFirst({ where: { phone: dados.customerPhone } })
          : await tx.customer.findFirst({
              where: { name: { equals: dados.customerName, mode: 'insensitive' } },
            });

        clienteId =
          existente?.id ??
          (
            await tx.customer.create({
              data: { name: dados.customerName, phone: dados.customerPhone ?? null },
            })
          ).id;
      }

      const venda = await tx.sale.create({
        data: {
          productId: produto.id,
          customerId: clienteId,
          customerName: dados.customerName,
          customerPhone: dados.customerPhone ?? null,
          quantity: dados.quantity,
          unitPrice: new Prisma.Decimal(dados.unitPrice),
          totalPrice: new Prisma.Decimal(dados.unitPrice).mul(dados.quantity),
          // Guarda o custo do momento: o lucro histórico não muda depois.
          costAtSale: produto.costPrice,
          paymentMethod: dados.paymentMethod,
          saleDate: dados.saleDate ?? new Date(),
          notes: dados.notes ?? null,
          userId: usuario?.id ?? null,
        },
        include: COM_RELACOES,
      });

      await tx.movement.create({
        data: {
          type: 'SAIDA',
          quantity: dados.quantity,
          balanceAfter: restante,
          reason: `Venda para ${dados.customerName}`,
          productId: produto.id,
          productName: produto.name,
          saleId: venda.id,
          userId: usuario?.id ?? null,
        },
      });

      return { venda, produto, restante };
    });

    enviarParaPlanilha(
      linhaDaPlanilha(resultado.produto, 'SAIDA', dados.quantity, usuario?.nome, resultado.restante),
    );

    await registrarLog({ acao: 'CREATE', entidade: 'Sale', id: resultado.venda.id, req });
    res.status(201).json(limpar(resultado.venda));
  }),
);

/** Cancela a venda e devolve os itens ao estoque. */
rotasVendas.delete(
  '/:id',
  somenteAdmin,
  rota(async (req, res) => {
    const usuario = req.usuario;

    const resultado = await db.$transaction(async (tx) => {
      const venda = await tx.sale.findUnique({
        where: { id: req.params.id },
        include: { product: true },
      });
      if (!venda) throw naoEncontrado('Venda');

      const produto = await tx.product.update({
        where: { id: venda.productId },
        data: {
          quantity: { increment: venda.quantity },
          status: venda.product.status === 'VENDIDO' ? 'EM_ESTOQUE' : undefined,
        },
        include: { category: true, supplier: true },
      });

      await tx.movement.create({
        data: {
          type: 'ENTRADA',
          quantity: venda.quantity,
          balanceAfter: produto.quantity,
          reason: `Cancelamento de venda (${venda.customerName ?? 'cliente'})`,
          productId: produto.id,
          productName: produto.name,
          userId: usuario?.id ?? null,
        },
      });

      await tx.sale.delete({ where: { id: venda.id } });
      return { venda, produto };
    });

    enviarParaPlanilha(
      linhaDaPlanilha(
        resultado.produto,
        'ENTRADA',
        resultado.venda.quantity,
        usuario?.nome,
        resultado.produto.quantity,
      ),
    );

    await registrarLog({ acao: 'DELETE', entidade: 'Sale', id: req.params.id, req });
    res.json({ message: 'Venda cancelada e estoque devolvido' });
  }),
);
