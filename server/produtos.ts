import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar, somenteAdmin } from './auth';
import { contem, limpar, naoEncontrado, ordenar, paginacao, paginado, rota, validar } from './core';
import { db, registrarLog } from './db';
import { idsComEstoqueBaixo, registrarMovimentacao } from './movimentacoes';

/** Cadastro, busca, edição, ajuste de estoque e exclusão de produtos. */

export const rotasProdutos = Router();
rotasProdutos.use(autenticar);

const COM_RELACOES = {
  category: true,
  supplier: true,
  photos: { select: { id: true }, orderBy: { createdAt: 'asc' } as const },
} satisfies Prisma.ProductInclude;

type ProdutoCru = Prisma.ProductGetPayload<{ include: typeof COM_RELACOES }>;

/** As fotos viram URLs; a imagem em si é servida por `/api/fotos/:id`. */
function formatar<T extends ProdutoCru>(produto: T) {
  return limpar({ ...produto, photos: produto.photos.map((f) => `/api/fotos/${f.id}`) });
}

const ORDENAVEIS = [
  'name',
  'brand',
  'model',
  'quantity',
  'costPrice',
  'salePrice',
  'status',
  'entryDate',
  'createdAt',
  'category.name',
  'supplier.name',
];

// ------------------------------------------------------------------ Schemas

const texto = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => v || null);

const dinheiro = z.coerce.number().min(0, 'O valor não pode ser negativo').max(99_999_999);

/**
 * Cada foto chega como uma URL já existente (`/api/fotos/xxx`) ou como uma
 * imagem nova em `data:image/...;base64,...` — o navegador reduz o tamanho
 * antes de enviar.
 */
const foto = z.string().max(4_000_000);

const produtoSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do produto').max(180),
  categoryId: z.string().uuid('Selecione uma categoria'),
  supplierId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  brand: texto,
  model: texto,
  color: texto,
  capacity: texto,
  lote: texto,
  quantity: z.coerce.number().int().min(0, 'A quantidade não pode ser negativa').default(0),
  minQuantity: z.coerce.number().int().min(0).default(1),
  costPrice: dinheiro.default(0),
  salePrice: dinheiro.default(0),
  imei: texto,
  serialNumber: texto,
  barcode: texto,
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['EM_ESTOQUE', 'RESERVADO', 'VENDIDO']).default('EM_ESTOQUE'),
  entryDate: z.coerce.date().optional(),
  photos: z.array(foto).max(8).optional(),
});

const alterarSchema = produtoSchema.partial().extend({ reason: z.string().trim().max(200).optional() });

const filtrosSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.enum(['EM_ESTOQUE', 'RESERVADO', 'VENDIDO']).optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosProduto = z.infer<typeof filtrosSchema>;

export async function filtrarProdutos(q: FiltrosProduto): Promise<Prisma.ProductWhereInput> {
  const cond: Prisma.ProductWhereInput[] = [];

  if (q.search) {
    cond.push({
      OR: [
        { name: contem(q.search) },
        { brand: contem(q.search) },
        { model: contem(q.search) },
        { imei: contem(q.search) },
        { serialNumber: contem(q.search) },
        { lote: contem(q.search) },
        { barcode: contem(q.search) },
        { color: contem(q.search) },
        { supplier: { name: contem(q.search) } },
        { category: { name: contem(q.search) } },
      ],
    });
  }

  if (q.categoryId) cond.push({ categoryId: q.categoryId });
  if (q.supplierId) cond.push({ supplierId: q.supplierId });
  if (q.status) cond.push({ status: q.status });
  if (q.brand) cond.push({ brand: contem(q.brand) });
  if (q.model) cond.push({ model: contem(q.model) });
  if (q.lowStock === 'true') cond.push({ id: { in: await idsComEstoqueBaixo(500) } });

  return cond.length ? { AND: cond } : {};
}

// -------------------------------------------------------------------- Fotos

/** Separa fotos novas (base64) das que já existem. */
function separarFotos(fotos: string[]) {
  const manter: string[] = [];
  const novas: { data: Buffer; mimeType: string }[] = [];

  for (const item of fotos) {
    const base64 = item.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);

    if (base64) {
      novas.push({ mimeType: base64[1], data: Buffer.from(base64[2], 'base64') });
      continue;
    }

    const id = item.match(/\/api\/fotos\/([0-9a-f-]{36})$/i);
    if (id) manter.push(id[1]);
  }

  return { manter, novas };
}

// ------------------------------------------------------------------- Rotas

/** Busca instantânea do topo da tela. */
rotasProdutos.get(
  '/search',
  rota(async (req, res) => {
    const termo = String(req.query.q ?? '').trim();
    if (termo.length < 2) {
      res.json({ products: [], sales: [], customers: [] });
      return;
    }

    const t = contem(termo);

    const [produtos, vendas, clientes] = await Promise.all([
      db.product.findMany({
        where: {
          OR: [
            { name: t },
            { brand: t },
            { model: t },
            { imei: t },
            { serialNumber: t },
            { lote: t },
            { barcode: t },
            { supplier: { name: t } },
          ],
        },
        include: COM_RELACOES,
        take: 8,
        orderBy: { updatedAt: 'desc' },
      }),
      db.sale.findMany({
        where: { OR: [{ customerName: t }, { customerPhone: t }, { product: { name: t } }] },
        include: { product: { select: { name: true } } },
        take: 5,
        orderBy: { saleDate: 'desc' },
      }),
      db.customer.findMany({
        where: { OR: [{ name: t }, { phone: t }] },
        take: 5,
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      products: produtos.map(formatar),
      sales: limpar(vendas),
      customers: limpar(clientes),
    });
  }),
);

/** Marcas e modelos existentes, para alimentar os filtros. */
rotasProdutos.get(
  '/filters',
  rota(async (_req, res) => {
    const [marcas, modelos] = await Promise.all([
      db.product.findMany({
        where: { brand: { not: null } },
        distinct: ['brand'],
        select: { brand: true },
        orderBy: { brand: 'asc' },
      }),
      db.product.findMany({
        where: { model: { not: null } },
        distinct: ['model'],
        select: { model: true },
        orderBy: { model: 'asc' },
      }),
    ]);

    res.json({
      brands: marcas.map((m) => m.brand).filter(Boolean),
      models: modelos.map((m) => m.model).filter(Boolean),
    });
  }),
);

rotasProdutos.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtrosSchema, req.query);
    const p = paginacao(q as Record<string, unknown>);
    const where = await filtrarProdutos(q);

    const [lista, total] = await Promise.all([
      db.product.findMany({
        where,
        include: COM_RELACOES,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(q.sortBy, q.sortOrder, ORDENAVEIS, { createdAt: 'desc' }) as never,
      }),
      db.product.count({ where }),
    ]);

    res.json(paginado(lista.map(formatar), total, p));
  }),
);

rotasProdutos.get(
  '/:id',
  rota(async (req, res) => {
    const produto = await db.product.findUnique({
      where: { id: req.params.id },
      include: {
        ...COM_RELACOES,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true } } },
        },
        sales: { orderBy: { saleDate: 'desc' }, take: 10 },
      },
    });

    if (!produto) throw naoEncontrado('Produto');
    res.json(formatar(produto));
  }),
);

rotasProdutos.post(
  '/',
  rota(async (req, res) => {
    const { photos, ...dados } = validar(produtoSchema, req.body);
    const { novas } = separarFotos(photos ?? []);

    const produto = await db.product.create({
      data: {
        ...dados,
        supplierId: dados.supplierId || null,
        photos: novas.length ? { create: novas } : undefined,
      },
      include: COM_RELACOES,
    });

    if (produto.quantity > 0) {
      await registrarMovimentacao({
        tipo: 'ENTRADA',
        quantidade: produto.quantity,
        saldo: produto.quantity,
        motivo: 'Cadastro de produto',
        produto,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
      });
    }

    await registrarLog({ acao: 'CREATE', entidade: 'Product', id: produto.id, req });
    res.status(201).json(formatar(produto));
  }),
);

rotasProdutos.put(
  '/:id',
  rota(async (req, res) => {
    const { photos, reason, ...dados } = validar(alterarSchema, req.body);

    const atual = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!atual) throw naoEncontrado('Produto');

    const produto = await db.$transaction(async (tx) => {
      // `photos` presente = lista completa e definitiva das fotos.
      if (photos) {
        const { manter, novas } = separarFotos(photos);

        await tx.productPhoto.deleteMany({
          where: { productId: atual.id, id: { notIn: manter.length ? manter : ['-'] } },
        });

        if (novas.length) {
          await tx.productPhoto.createMany({
            data: novas.map((f) => ({ ...f, productId: atual.id })),
          });
        }
      }

      return tx.product.update({
        where: { id: atual.id },
        data: {
          ...dados,
          supplierId: dados.supplierId === undefined ? undefined : dados.supplierId || null,
        },
        include: COM_RELACOES,
      });
    });

    const diferenca = produto.quantity - atual.quantity;

    await registrarMovimentacao({
      tipo: diferenca > 0 ? 'ENTRADA' : diferenca < 0 ? 'SAIDA' : 'AJUSTE',
      quantidade: Math.abs(diferenca),
      saldo: produto.quantity,
      motivo: reason ?? (diferenca ? 'Alteração manual do produto' : 'Alteração de cadastro'),
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({ acao: 'UPDATE', entidade: 'Product', id: produto.id, req });
    res.json(formatar(produto));
  }),
);

/** Entrada ou baixa avulsa, sempre com motivo. */
rotasProdutos.patch(
  '/:id/stock',
  rota(async (req, res) => {
    const { quantity, reason } = validar(
      z.object({
        quantity: z.coerce.number().int().refine((v) => v !== 0, 'Informe uma quantidade diferente de zero'),
        reason: z.string().trim().min(3, 'Informe o motivo do ajuste').max(200),
      }),
      req.body,
    );

    const atual = await db.product.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado('Produto');

    const novaQuantidade = Math.max(0, atual.quantity + quantity);

    const produto = await db.product.update({
      where: { id: atual.id },
      data: { quantity: novaQuantidade },
      include: COM_RELACOES,
    });

    await registrarMovimentacao({
      tipo: quantity > 0 ? 'ENTRADA' : 'SAIDA',
      quantidade: Math.abs(quantity),
      saldo: novaQuantidade,
      motivo: reason,
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({
      acao: 'ADJUST_STOCK',
      entidade: 'Product',
      id: produto.id,
      alteracoes: { de: atual.quantity, para: novaQuantidade, motivo: reason },
      req,
    });

    res.json(formatar(produto));
  }),
);

rotasProdutos.delete(
  '/:id',
  somenteAdmin,
  rota(async (req, res) => {
    const produto = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!produto) throw naoEncontrado('Produto');

    // A movimentação vem antes: guarda o histórico mesmo sem o produto.
    await registrarMovimentacao({
      tipo: 'EXCLUSAO',
      quantidade: produto.quantity,
      saldo: 0,
      motivo: (req.query.reason as string) || 'Produto excluído do sistema',
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    // Com vendas registradas, arquiva em vez de excluir: o histórico
    // financeiro precisa continuar batendo.
    const vendas = await db.sale.count({ where: { productId: produto.id } });
    if (vendas > 0) {
      await db.product.update({
        where: { id: produto.id },
        data: { quantity: 0, status: 'VENDIDO' },
      });
      await registrarLog({ acao: 'ARCHIVE', entidade: 'Product', id: produto.id, req });
      res.json({
        message: 'Produto possui vendas registradas: estoque zerado e arquivado como vendido.',
        archived: true,
      });
      return;
    }

    // As fotos saem junto (onDelete: Cascade).
    await db.product.delete({ where: { id: produto.id } });
    await registrarLog({ acao: 'DELETE', entidade: 'Product', id: produto.id, req });

    res.json({ message: 'Produto excluído com sucesso', archived: false });
  }),
);

// ------------------------------------------------------- Entrega das imagens

export const rotasFotos = Router();

/** Serve a imagem guardada no banco. O id nunca muda, então pode cachear. */
rotasFotos.get(
  '/:id',
  rota(async (req, res) => {
    const foto = await db.productPhoto.findUnique({ where: { id: req.params.id } });
    if (!foto) throw naoEncontrado('Foto');

    res.setHeader('Content-Type', foto.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(foto.data));
  }),
);
