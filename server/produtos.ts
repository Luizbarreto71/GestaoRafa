import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar, somenteAdmin } from './auth';
import { AppError, contem, limpar, naoEncontrado, ordenar, paginacao, paginado, rota, validar, semVazios } from './core';
import { db, registrarLog } from './db';
import { exigir } from './permissoes';
import { comAsFilhas, estoqueBaixo, movimentar, saldosDoProduto } from './estoque';
import { exigirAcessoNaUnidade, unidadePermitida } from './unidades';

/** Cadastro, busca, edição, ajuste de estoque e exclusão de produtos. */

export const rotasProdutos = Router();
rotasProdutos.use(autenticar, exigir('produtos.ver'));

const COM_RELACOES = {
  category: true,
  supplier: true,
  photos: { select: { id: true }, orderBy: { createdAt: 'asc' } as const },
  stock: { include: { unit: { select: { id: true, name: true, type: true } } } },
} satisfies Prisma.ProductInclude;

type ProdutoCru = Prisma.ProductGetPayload<{ include: typeof COM_RELACOES }>;

/**
 * Formata o produto para o frontend:
 * - fotos viram URLs (`/api/fotos/:id`);
 * - o estoque vira uma lista por unidade + o total.
 *
 * `quantity` continua existindo por comodidade das telas, mas agora é a
 * soma das unidades — ou o saldo de uma unidade só, quando há filtro.
 */
function formatar<T extends ProdutoCru>(produto: T, unidadeId?: string) {
  const porUnidade = produto.stock.map((linha) => ({
    unitId: linha.unitId,
    unitName: linha.unit.name,
    quantity: linha.quantity,
  }));

  const total = porUnidade.reduce((soma, u) => soma + u.quantity, 0);
  const daUnidade = unidadeId
    ? (porUnidade.find((u) => u.unitId === unidadeId)?.quantity ?? 0)
    : total;

  return limpar({
    ...produto,
    photos: produto.photos.map((f) => `/api/fotos/${f.id}`),
    stock: porUnidade,
    totalQuantity: total,
    quantity: daUnidade,
  });
}

const ORDENAVEIS = [
  'name',
  'brand',
  'model',
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
  condicao: texto,
  quantity: z.coerce.number().int().min(0, 'A quantidade não pode ser negativa').default(0),
  /** Onde o estoque inicial entra. */
  unitId: z.string().uuid().optional().nullable(),
  minQuantity: z.coerce.number().int().min(0).default(1),
  costPrice: dinheiro.default(0),
  salePrice: dinheiro.default(0),
  wholesalePrice: dinheiro.optional().nullable(),
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
  condicao: z.string().trim().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  unitId: z.string().uuid().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosProduto = z.infer<typeof filtrosSchema>;

export async function filtrarProdutos(
  q: FiltrosProduto,
  unidadeId?: string,
): Promise<Prisma.ProductWhereInput> {
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
        { condicao: contem(q.search) },
        { barcode: contem(q.search) },
        { color: contem(q.search) },
        { supplier: { name: contem(q.search) } },
        { category: { name: contem(q.search) } },
      ],
    });
  }

  // Escolher a mãe traz as filhas junto: quem pede "Celulares" quer todos
  // os celulares, não os poucos que ficaram fora das subcategorias.
  if (q.categoryId) cond.push({ categoryId: { in: await comAsFilhas(q.categoryId) } });
  if (q.supplierId) cond.push({ supplierId: q.supplierId });
  if (q.status) cond.push({ status: q.status });
  if (q.brand) cond.push({ brand: contem(q.brand) });
  if (q.model) cond.push({ model: contem(q.model) });
  // "__sem__" vem da aba "Sem condição" do estoque: é o único jeito de
  // pedir "os que ninguém classificou" sem inventar um valor de condição.
  if (q.condicao === '__sem__') cond.push({ OR: [{ condicao: null }, { condicao: '' }] });
  else if (q.condicao) cond.push({ condicao: q.condicao });
  if (q.lowStock === 'true') {
    const baixos = await estoqueBaixo(unidadeId, 500);
    cond.push({ id: { in: baixos.map((b) => b.productId) } });
  }

  // Quem só enxerga uma unidade não deve ver produtos que não existem lá.
  if (unidadeId) cond.push({ stock: { some: { unitId: unidadeId } } });

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
        where: { OR: [{ customerName: t }, { customerPhone: t }, { items: { some: { productName: t } } }] },
        include: { items: { select: { productName: true } } },
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
      products: produtos.map((produto) => formatar(produto)),
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
    const q = validar(filtrosSchema, semVazios(req.query));
    const p = paginacao(q as Record<string, unknown>);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = await filtrarProdutos(q, unidade);

    // "quantity" não é mais coluna do produto: ordenar por ela seria ordenar
    // por algo que não existe. Nesse caso caímos no nome.
    const ordem = q.sortBy === 'quantity' ? 'name' : q.sortBy;

    // Contagem por condição para as abas do estoque.
    //
    // Ignora o filtro de condição de propósito: a aba precisa dizer quantos
    // existem em cada uma, e não quantos existem na que já está aberta.
    const { condicao: _naFrente, ...semCondicao } = q;
    const wherePorCondicao = await filtrarProdutos(semCondicao as typeof q, unidade);

    const [lista, total, condicoes] = await Promise.all([
      db.product.findMany({
        where,
        include: COM_RELACOES,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(ordem, q.sortOrder, ORDENAVEIS, { createdAt: 'desc' }) as never,
      }),
      db.product.count({ where }),
      db.product.groupBy({ by: ['condicao'], where: wherePorCondicao, _count: true }),
    ]);

    res.json({
      ...paginado(lista.map((produto) => formatar(produto, unidade)), total, p),
      condicoes: condicoes.map((c) => ({ condicao: c.condicao, produtos: c._count })),
    });
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
          include: { user: { select: { name: true } }, unit: { select: { name: true } } },
        },
        // Últimas vendas deste produto, vindas dos itens.
        saleItems: {
          orderBy: { sale: { saleDate: 'desc' } },
          take: 10,
          include: {
            sale: {
              select: {
                code: true,
                saleDate: true,
                customerName: true,
                unit: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!produto) throw naoEncontrado('Produto');

    // Saldos por unidade, incluindo as que ainda não têm linha de estoque.
    const porUnidade = await saldosDoProduto(produto.id);

    // Transferências ainda não recebidas: o produto saiu da origem mas não
    // chegou ao destino. Fica visível para ninguém achar que sumiu.
    const emTransito = await db.stockTransfer.aggregate({
      where: { productId: produto.id, status: { in: ['PENDENTE', 'EM_TRANSITO'] } },
      _sum: { quantity: true },
    });

    const disponivel = porUnidade.reduce((soma, u) => soma + u.quantity, 0);
    const transito = emTransito._sum.quantity ?? 0;

    res.json({
      ...formatar(produto),
      stock: porUnidade,
      inTransit: transito,
      totalAvailable: disponivel,
      totalPhysical: disponivel + transito,
    });
  }),
);

rotasProdutos.post(
  '/',
  exigir('produtos.editar'),
  rota(async (req, res) => {
    const { photos, quantity, unitId, ...dados } = validar(produtoSchema, req.body);
    const { novas } = separarFotos(photos ?? []);

    // A quantidade informada no cadastro entra como estoque de uma unidade.
    // Sem unidade não dá para saber onde o produto está, então usamos a do
    // usuário e, no caso do administrador, a Matriz.
    let unidadeDestino = unitId ?? req.usuario?.unidadeId ?? null;
    if (!unidadeDestino) {
      const matriz = await db.unit.findFirst({
        where: { active: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      unidadeDestino = matriz?.id ?? null;
    }

    if (quantity > 0 && !unidadeDestino) {
      throw new AppError('Cadastre uma unidade antes de lançar estoque.');
    }

    // Confere a unidade ANTES de criar o produto. Sem isto, um destino
    // inválido criava o produto e só depois estourava ao lançar o estoque,
    // deixando um cadastro solto e uma mensagem que não explica nada.
    if (unidadeDestino) {
      const destino = await db.unit.findUnique({ where: { id: unidadeDestino } });
      if (!destino) throw naoEncontrado('Unidade');
      if (!destino.active) throw new AppError(`A unidade ${destino.name} está desativada.`);
      exigirAcessoNaUnidade(req.usuario, unidadeDestino);
    }

    const produto = await db.product.create({
      data: {
        ...dados,
        supplierId: dados.supplierId || null,
        photos: novas.length ? { create: novas } : undefined,
      },
      include: COM_RELACOES,
    });

    if (quantity > 0 && unidadeDestino) {
      await movimentar({
        produtoId: produto.id,
        produtoNome: produto.name,
        unidadeId: unidadeDestino,
        tipo: 'ENTRADA',
        motivo: 'CADASTRO',
        quantidade: quantity,
        observacao: 'Estoque inicial do cadastro',
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
      });
    }

    await registrarLog({ acao: 'CREATE', entidade: 'Product', id: produto.id, req });

    const completo = await db.product.findUnique({
      where: { id: produto.id },
      include: COM_RELACOES,
    });
    res.status(201).json(formatar(completo!));
  }),
);

rotasProdutos.put(
  '/:id',
  exigir('produtos.editar'),
  rota(async (req, res) => {
    // `quantity` é ignorada de propósito: mexer no estoque é papel da tela
    // de Movimentação, que registra unidade, motivo e responsável.
    const { photos, reason, quantity: _ignorada, unitId: _tambem, ...dados } = validar(
      alterarSchema,
      req.body,
    );

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

    await registrarLog({
      acao: 'UPDATE',
      entidade: 'Product',
      id: produto.id,
      alteracoes: { motivo: reason },
      req,
    });
    res.json(formatar(produto));
  }),
);

/** Entrada ou baixa avulsa numa unidade, sempre com motivo. */
rotasProdutos.patch(
  '/:id/stock',
  exigir('estoque.movimentar'),
  rota(async (req, res) => {
    const { quantity, reason, unitId } = validar(
      z.object({
        quantity: z.coerce.number().int().refine((v) => v !== 0, 'Informe uma quantidade diferente de zero'),
        reason: z.string().trim().min(3, 'Informe o motivo do ajuste').max(200),
        unitId: z.string().uuid('Selecione a unidade').optional(),
      }),
      req.body,
    );

    const unidade = unitId ?? req.usuario?.unidadeId;
    if (!unidade) throw new AppError('Selecione a unidade onde o estoque será ajustado.');

    const produto = await db.product.findUnique({ where: { id: req.params.id } });
    if (!produto) throw naoEncontrado('Produto');

    await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: unidade,
      tipo: quantity > 0 ? 'ENTRADA' : 'SAIDA',
      motivo: 'AJUSTE',
      quantidade: Math.abs(quantity),
      observacao: reason,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome,
    });

    await registrarLog({ acao: 'ADJUST_STOCK', entidade: 'Product', id: produto.id, req });

    const completo = await db.product.findUnique({ where: { id: produto.id }, include: COM_RELACOES });
    res.json(formatar(completo!));
  }),
);

rotasProdutos.delete(
  '/:id',
  somenteAdmin,
  rota(async (req, res) => {
    const produto = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!produto) throw naoEncontrado('Produto');

    const motivo = (req.query.reason as string) || 'Produto excluído do sistema';

    // Zera o estoque de cada unidade com uma saída registrada — assim o
    // histórico mostra de onde o produto saiu, e não só que ele sumiu.
    for (const linha of produto.stock) {
      if (linha.quantity <= 0) continue;
      await movimentar({
        produtoId: produto.id,
        produtoNome: produto.name,
        unidadeId: linha.unitId,
        tipo: 'SAIDA',
        motivo: 'EXCLUSAO',
        quantidade: linha.quantity,
        observacao: motivo,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
      });
    }

    // Com vendas registradas, arquiva em vez de excluir: o histórico
    // financeiro precisa continuar batendo.
    const vendas = await db.saleItem.count({ where: { productId: produto.id } });
    if (vendas > 0) {
      await db.product.update({ where: { id: produto.id }, data: { status: 'VENDIDO' } });
      await registrarLog({ acao: 'ARCHIVE', entidade: 'Product', id: produto.id, req });
      res.json({
        message: 'Produto possui vendas registradas: estoque zerado e arquivado como vendido.',
        archived: true,
      });
      return;
    }

    // As fotos e as linhas de estoque saem junto (onDelete: Cascade).
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
