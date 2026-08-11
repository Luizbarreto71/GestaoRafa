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
import { movimentar } from './estoque';
import { exigirAcessoNaUnidade, unidadePermitida } from './unidades';

/** Registro e cancelamento de vendas — é aqui que o estoque baixa. */

export const rotasVendas = Router();
rotasVendas.use(autenticar);

const COM_RELACOES = {
  product: { include: { category: true, supplier: true } },
  customer: true,
  user: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

const PAGAMENTOS = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'] as const;

const vendaSchema = z.object({
  productId: z.string().uuid('Selecione o produto'),
  /** Obrigatória: é o que diz de qual loja o produto saiu. */
  unitId: z.string().uuid('Selecione a unidade da venda'),
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
  unitId: z.string().uuid().optional(),
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
  if (q.unitId) cond.push({ unitId: q.unitId });

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ saleDate: periodo });

  return cond.length ? { AND: cond } : {};
}

rotasVendas.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtrosSchema, req.query);
    const p = paginacao(q as Record<string, unknown>);
    // Quem não é administrador só vê as vendas da própria unidade.
    const where = filtrarVendas({ ...q, unitId: unidadePermitida(req.usuario, q.unitId) });

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

    // Vendedor e Gerente só vendem da própria unidade.
    exigirAcessoNaUnidade(usuario, dados.unitId);

    const resultado = await db.$transaction(async (tx) => {
      const produto = await tx.product.findUnique({ where: { id: dados.productId } });
      if (!produto) throw naoEncontrado('Produto');

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
          unitId: dados.unitId,
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

      // A baixa acontece aqui: se faltar estoque na unidade, a transação
      // inteira é desfeita e a venda não existe.
      const baixa = await movimentar({
        produtoId: produto.id,
        produtoNome: produto.name,
        unidadeId: dados.unitId,
        tipo: 'SAIDA',
        motivo: 'VENDA',
        quantidade: dados.quantity,
        observacao: `Venda para ${dados.customerName}`,
        vendaId: venda.id,
        usuarioId: usuario?.id,
        usuarioNome: usuario?.nome,
        tx,
      });

      // Sem saldo em nenhuma unidade, o produto passa a constar como vendido.
      const restante = await tx.stock.aggregate({
        where: { productId: produto.id },
        _sum: { quantity: true },
      });
      if ((restante._sum.quantity ?? 0) === 0) {
        await tx.product.update({ where: { id: produto.id }, data: { status: 'VENDIDO' } });
      }

      return { venda, baixa };
    });

    await registrarLog({ acao: 'CREATE', entidade: 'Sale', id: resultado.venda.id, req });
    res.status(201).json(limpar(resultado.venda));
  }),
);

/** Cancela a venda e devolve os itens à unidade de onde saíram. */
rotasVendas.delete(
  '/:id',
  somenteAdmin,
  rota(async (req, res) => {
    const usuario = req.usuario;

    await db.$transaction(async (tx) => {
      const venda = await tx.sale.findUnique({
        where: { id: req.params.id },
        include: { product: true, unit: true },
      });
      if (!venda) throw naoEncontrado('Venda');

      await movimentar({
        produtoId: venda.productId,
        produtoNome: venda.product.name,
        unidadeId: venda.unitId,
        tipo: 'ENTRADA',
        motivo: 'CANCELAMENTO',
        quantidade: venda.quantity,
        observacao: `Cancelamento de venda (${venda.customerName ?? 'cliente'}) — voltou para a ${venda.unit.name}`,
        usuarioId: usuario?.id,
        usuarioNome: usuario?.nome,
        tx,
      });

      // O produto volta a ficar disponível.
      if (venda.product.status === 'VENDIDO') {
        await tx.product.update({ where: { id: venda.productId }, data: { status: 'EM_ESTOQUE' } });
      }

      await tx.sale.delete({ where: { id: venda.id } });
    });

    await registrarLog({ acao: 'DELETE', entidade: 'Sale', id: req.params.id, req });
    res.json({ message: 'Venda cancelada e estoque devolvido à unidade de origem.' });
  }),
);
