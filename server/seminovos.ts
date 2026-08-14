import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import { AppError, limpar, numero, rota, validar } from './core';
import { db, registrarLog } from './db';
import { movimentar } from './estoque';
import { paginacao, paginado } from './core';
import { exigir } from './permissoes';
import { unidadePermitida } from './unidades';

/**
 * Aparelhos usados que a loja recebeu.
 *
 * Não são um estoque à parte: cada seminovo é um produto normal, entra na
 * prateleira, aparece nos relatórios e é vendido como qualquer outro. A
 * marca no cadastro só serve para reuni-los nesta aba — que é onde se olha
 * o que entrou de usado e por quanto.
 */

export const rotasSeminovos = Router();
rotasSeminovos.use(autenticar, exigir('produtos.ver'));

type Cliente = Prisma.TransactionClient | typeof db;

/** A categoria onde os seminovos nascem, criada na primeira vez. */
async function categoriaDosSeminovos(cliente: Cliente): Promise<string> {
  const existente = await cliente.category.findFirst({
    where: { OR: [{ slug: 'seminovos' }, { name: { equals: 'Seminovos', mode: 'insensitive' } }] },
    select: { id: true },
  });
  if (existente) return existente.id;

  const nova = await cliente.category.create({
    data: { name: 'Seminovos', slug: 'seminovos', color: '#F59E0B' },
    select: { id: true },
  });
  return nova.id;
}

/** "iPhone 12 128GB" — o nome como ele vai aparecer na prateleira. */
const nomeDoAparelho = (modelo: string, armazenamento?: string | null): string =>
  [modelo.trim(), armazenamento?.trim()].filter(Boolean).join(' ');

/**
 * Cadastra no estoque os aparelhos de uma troca que a loja aceitou.
 *
 * Roda quando a troca vira venda: antes disso o aparelho ainda é do
 * cliente. Cada peça vira um produto com o que o vendedor já anotou —
 * modelo, capacidade, cor e IMEI —, e o que a loja pagou por ela vira o
 * custo. Sem isso o aparelho entrava na loja e sumia do controle até
 * alguém lembrar de cadastrá-lo à mão.
 */
export async function seminovosDaTroca(
  tradeInId: string,
  unidadeId: string,
  usuarioId: string | null,
  cliente: Cliente = db,
): Promise<number> {
  const troca = await cliente.tradeIn.findUnique({
    where: { id: tradeInId },
    include: { aparelhos: { include: { produto: { select: { id: true } } } } },
  });
  if (!troca) return 0;

  const categoriaId = await categoriaDosSeminovos(cliente);
  let criados = 0;

  for (const aparelho of troca.aparelhos) {
    // Já cadastrado: a venda pode ter sido corrigida, e o aparelho não
    // pode entrar duas vezes na prateleira.
    if (aparelho.produto) continue;

    const produto = await cliente.product.create({
      data: {
        name: nomeDoAparelho(aparelho.modelo, aparelho.armazenamento),
        brand: aparelho.marca ?? null,
        model: aparelho.modelo,
        color: aparelho.cor ?? null,
        capacity: aparelho.armazenamento ?? null,
        imei: aparelho.imei ?? null,
        categoryId: categoriaId,
        costPrice: aparelho.valorAvaliado,
        salePrice: new Prisma.Decimal(0),
        seminovo: true,
        seminovoOrigem: `Troca ${troca.code} · ${troca.customerName}`,
        tradeInAparelhoId: aparelho.id,
        notes: aparelho.observacoes ?? null,
      },
    });

    await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId,
      tipo: 'ENTRADA',
      motivo: 'COMPRA',
      quantidade: 1,
      custoUnitario: numero(aparelho.valorAvaliado),
      observacao: `Recebido na troca ${troca.code}`,
      usuarioId: usuarioId ?? undefined,
      tx: cliente as Prisma.TransactionClient,
    } as never);

    criados += 1;
  }

  return criados;
}

// ------------------------------------------------------------------ Listagem

const COM_ORIGEM = {
  category: { select: { id: true, name: true } },
  stock: { select: { unitId: true, quantity: true, unit: { select: { name: true } } } },
  tradeInAparelho: {
    select: {
      id: true,
      defeitos: true,
      estado: true,
      imeiSituacao: true,
      tradeIn: { select: { id: true, code: true, customerName: true, createdAt: true } },
    },
  },
} satisfies Prisma.ProductInclude;

rotasSeminovos.get(
  '/',
  rota(async (req, res) => {
    const q = validar(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        search: z.string().trim().optional(),
        unitId: z.string().uuid().optional(),
        /** De onde veio: da troca de um cliente ou de uma compra direta. */
        origem: z.enum(['troca', 'compra']).optional(),
        /** Só os que ainda estão na prateleira. */
        disponivel: z.enum(['true', 'false']).optional(),
      }),
      req.query,
    );

    const unidade = unidadePermitida(req.usuario, q.unitId);
    const p = paginacao(req.query as Record<string, unknown>, 30);

    const onde: Prisma.ProductWhereInput = {
      seminovo: true,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { imei: { contains: q.search } },
              { color: { contains: q.search, mode: 'insensitive' } },
              { seminovoOrigem: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.origem === 'troca' ? { tradeInAparelhoId: { not: null } } : {}),
      ...(q.origem === 'compra' ? { tradeInAparelhoId: null } : {}),
      ...(unidade || q.disponivel === 'true'
        ? {
            stock: {
              some: {
                ...(unidade ? { unitId: unidade } : {}),
                ...(q.disponivel === 'true' ? { quantity: { gt: 0 } } : {}),
              },
            },
          }
        : {}),
    };

    const [lista, total, emEstoque, investido] = await Promise.all([
      db.product.findMany({
        where: onde,
        include: COM_ORIGEM,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
      }),
      db.product.count({ where: onde }),
      db.stock.aggregate({ where: { product: { seminovo: true } }, _sum: { quantity: true } }),
      db.product.aggregate({ where: { seminovo: true }, _sum: { costPrice: true } }),
    ]);

    res.json({
      ...paginado(
        lista.map((s) => ({
          ...limpar(s),
          quantidade: s.stock.reduce((soma, l) => soma + l.quantity, 0),
          origem: s.tradeInAparelho ? 'troca' : 'compra',
        })),
        total,
        p,
      ),
      resumo: {
        pecas: emEstoque._sum.quantity ?? 0,
        investido: numero(investido._sum.costPrice ?? 0),
      },
    });
  }),
);

// -------------------------------------------------------- Compra sem troca

const compraSchema = z.object({
  modelo: z.string().trim().min(2, 'Informe o modelo do aparelho').max(120),
  marca: z.string().trim().max(60).optional().nullable(),
  armazenamento: z.string().trim().max(20).optional().nullable(),
  cor: z.string().trim().max(40).optional().nullable(),
  imei: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 15, 'O IMEI tem 15 números')
    .optional()
    .nullable(),
  /** Quanto a loja pagou por ele. */
  valorPago: z.coerce.number().min(0, 'Informe quanto a loja pagou'),
  /** Por quanto pretende vender. Pode ficar para depois. */
  salePrice: z.coerce.number().min(0).optional(),
  unitId: z.string().uuid('Escolha a unidade onde o aparelho ficou'),
  /** De quem foi comprado, para achar o dono se aparecer problema. */
  vendedor: z.string().trim().max(180).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

rotasSeminovos.post(
  '/',
  exigir('produtos.editar'),
  rota(async (req, res) => {
    const dados = validar(compraSchema, req.body);

    // O mesmo IMEI duas vezes é aparelho cadastrado em duplicidade — e
    // duplicidade em estoque de usado vira peça fantasma no balanço.
    if (dados.imei) {
      const repetido = await db.product.findFirst({
        where: { imei: dados.imei },
        select: { name: true },
      });
      if (repetido) {
        throw new AppError(`Esse IMEI já está cadastrado em "${repetido.name}".`);
      }
    }

    const unidade = await db.unit.findUnique({ where: { id: dados.unitId }, select: { name: true } });
    if (!unidade) throw new AppError('Unidade não encontrada', 404);

    const produto = await db.$transaction(async (tx) => {
      const criado = await tx.product.create({
        data: {
          name: nomeDoAparelho(dados.modelo, dados.armazenamento),
          brand: dados.marca ?? null,
          model: dados.modelo,
          color: dados.cor ?? null,
          capacity: dados.armazenamento ?? null,
          imei: dados.imei || null,
          categoryId: await categoriaDosSeminovos(tx),
          costPrice: new Prisma.Decimal(dados.valorPago),
          salePrice: new Prisma.Decimal(dados.salePrice ?? 0),
          seminovo: true,
          seminovoOrigem: dados.vendedor?.trim()
            ? `Comprado de ${dados.vendedor.trim()}`
            : 'Compra direta',
          notes: dados.observacoes ?? null,
        },
      });

      await movimentar({
        produtoId: criado.id,
        produtoNome: criado.name,
        unidadeId: dados.unitId,
        tipo: 'ENTRADA',
        motivo: 'COMPRA',
        quantidade: 1,
        custoUnitario: dados.valorPago,
        observacao: dados.vendedor?.trim() ? `Comprado de ${dados.vendedor.trim()}` : 'Compra de seminovo',
        usuarioId: req.usuario!.id,
        tx,
      } as never);

      return criado;
    });

    await registrarLog({
      acao: 'CRIAR_SEMINOVO',
      entidade: 'Product',
      id: produto.id,
      alteracoes: { nome: produto.name, pago: dados.valorPago },
      req,
    });

    res.status(201).json({
      ...limpar(produto),
      message: `${produto.name} cadastrado como seminovo na ${unidade.name}.`,
    });
  }),
);
