import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import {
  AppError,
  limpar,
  naoEncontrado,
  paginacao,
  paginado,
  rota,
  semVazios,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { notificarPerfil } from './notificacoes';
import { exigir, podeFazer } from './permissoes';
import { proximoCodigo } from './vendas-service';
import { DEFEITOS, imeiValido } from '../shared/trocas';

export const rotasTrocas = Router();
rotasTrocas.use(autenticar);

const CHAVES_DEFEITO = DEFEITOS.map((d) => d.chave) as [string, ...string[]];

const COM_TUDO = {
  photos: { select: { id: true, tipo: true }, orderBy: { createdAt: 'asc' } as const },
  seller: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  preSale: { select: { id: true, code: true, status: true } },
  sale: { select: { id: true, code: true } },
} satisfies Prisma.TradeInInclude;

/** Fotos viram URLs; o binário nunca sai numa listagem. */
const paraJson = (t: Prisma.TradeInGetPayload<{ include: typeof COM_TUDO }>) => ({
  ...limpar(t),
  photos: t.photos.map((f) => ({ id: f.id, tipo: f.tipo, url: `/api/trocas/fotos/${f.id}` })),
  /** Quanto o cliente ainda precisa pagar. Negativo = a loja é que deve. */
  diferenca: Number(t.valorSaida) - Number(t.valorAvaliado),
});

const fotoSchema = z.object({
  tipo: z.enum(['ANATEL', 'DOCUMENTO', 'APARELHO']),
  /** data:image/jpeg;base64,… já reduzida pelo navegador. */
  data: z.string().max(4_000_000),
});

const trocaSchema = z.object({
  modelo: z.string().trim().min(2, 'Informe o modelo do aparelho').max(120),
  marca: z.string().trim().max(60).optional().nullable(),
  armazenamento: z.string().trim().max(20).optional().nullable(),
  cor: z.string().trim().max(40).optional().nullable(),

  /**
   * Opcional porque o balcão não para.
   *
   * Quando vem, é conferido de verdade: erro de digitação vira problema
   * depois que o cliente já foi embora.
   */
  imei: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || v.length === 15, 'O IMEI tem 15 números')
    .refine((v) => v === '' || imeiValido(v), 'Esse IMEI não passa na conferência — confira os números')
    .optional()
    .nullable(),
  imeiSituacao: z.enum(['NAO_CONSULTADO', 'REGULAR', 'IRREGULAR', 'BLOQUEADO']).default('NAO_CONSULTADO'),

  estado: z.string().trim().max(40).optional().nullable(),
  defeitos: z.array(z.enum(CHAVES_DEFEITO)).default([]),
  observacoes: z.string().trim().max(2000).optional().nullable(),

  valorAvaliado: z.coerce.number().min(0, 'Informe quanto vale o aparelho do cliente'),

  productId: z.string().uuid().optional().nullable(),
  saidaNome: z.string().trim().max(180).optional().nullable(),
  valorSaida: z.coerce.number().min(0).default(0),

  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().trim().min(2, 'Informe o nome do cliente').max(180),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerDocument: z.string().trim().max(30).optional().nullable(),

  unitId: z.string().uuid().optional().nullable(),
  photos: z.array(fotoSchema).max(10).optional(),
});

/** Vendedor enxerga só as próprias; caixa e admin enxergam todas. */
const podeVerTodas = (req: { usuario?: { papel: string } }) =>
  podeFazer(req.usuario?.papel, 'prevenda.verTodas');

function separarFotos(fotos: z.infer<typeof fotoSchema>[] | undefined) {
  return (fotos ?? []).flatMap((f) => {
    const base64 = f.data.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!base64) return [];
    return [{ tipo: f.tipo, mimeType: base64[1], data: Buffer.from(base64[2], 'base64') }];
  });
}

// ---------------------------------------------------------------- Listagem

rotasTrocas.get(
  '/',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const q = validar(
      z.object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
        status: z
          .string()
          .optional()
          .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
          .pipe(z.array(z.enum(['AVALIADA', 'ACEITA', 'RECUSADA'])).min(1).optional()),
        search: z.string().trim().optional(),
        /** Só as que ainda não foram amarradas a uma pré-venda. */
        livres: z.enum(['true', 'false']).optional(),
      }),
      semVazios(req.query),
    );

    const p = paginacao(q as Record<string, unknown>);

    const where: Prisma.TradeInWhereInput = {
      ...(podeVerTodas(req) ? {} : { sellerId: req.usuario!.id }),
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.livres === 'true' ? { preSaleId: null, saleId: null, status: 'AVALIADA' } : {}),
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: 'insensitive' } },
              { imei: { contains: q.search } },
              { modelo: { contains: q.search, mode: 'insensitive' } },
              { customerName: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [lista, total] = await Promise.all([
      db.tradeIn.findMany({ where, include: COM_TUDO, skip: p.skip, take: p.take, orderBy: { createdAt: 'desc' } }),
      db.tradeIn.count({ where }),
    ]);

    res.json(paginado(lista.map(paraJson), total, p));
  }),
);

rotasTrocas.get(
  '/:id',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id }, include: COM_TUDO });
    if (!troca) throw naoEncontrado('Troca');

    if (!podeVerTodas(req) && troca.sellerId !== req.usuario!.id) {
      throw new AppError('Esta troca é de outro vendedor', 403);
    }

    res.json(paraJson(troca));
  }),
);

/** Serve a imagem guardada no banco. O id nunca muda, então pode cachear. */
rotasTrocas.get(
  '/fotos/:id',
  rota(async (req, res) => {
    const foto = await db.tradeInPhoto.findUnique({ where: { id: req.params.id } });
    if (!foto) throw naoEncontrado('Foto');

    res.setHeader('Content-Type', foto.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(foto.data));
  }),
);

// ------------------------------------------------------------------ Criação

rotasTrocas.post(
  '/',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const dados = validar(trocaSchema, req.body);

    // O mesmo aparelho não entra duas vezes. Sem IMEI não há o que
    // comparar — a conferência fica para o cadastro no estoque.
    const repetido = dados.imei
      ? await db.tradeIn.findFirst({
          where: { imei: dados.imei, status: { not: 'RECUSADA' } },
          select: { code: true, createdAt: true },
        })
      : null;
    if (repetido) {
      throw new AppError(
        `Esse IMEI já foi recebido na troca ${repetido.code}. Se for outro aparelho, confira os números.`,
      );
    }

    if (dados.imeiSituacao === 'BLOQUEADO') {
      throw new AppError(
        'A Anatel aponta este aparelho como roubado, furtado ou bloqueado. Não é possível recebê-lo.',
      );
    }

    let saidaNome = dados.saidaNome ?? null;
    if (dados.productId) {
      const produto = await db.product.findUnique({ where: { id: dados.productId }, select: { name: true } });
      if (!produto) throw naoEncontrado('Produto');
      saidaNome = produto.name;
    }

    const troca = await db.tradeIn.create({
      data: {
        code: await proximoCodigo('troca', 'TR'),
        sellerId: req.usuario!.id,
        unitId: dados.unitId ?? req.usuario!.unidadeId ?? null,

        modelo: dados.modelo,
        marca: dados.marca ?? null,
        armazenamento: dados.armazenamento ?? null,
        cor: dados.cor ?? null,
        imei: dados.imei || null,
        imeiSituacao: dados.imeiSituacao,
        imeiCheckedAt: dados.imeiSituacao === 'NAO_CONSULTADO' ? null : new Date(),

        estado: dados.estado ?? null,
        defeitos: dados.defeitos,
        observacoes: dados.observacoes ?? null,

        valorAvaliado: new Prisma.Decimal(dados.valorAvaliado),
        productId: dados.productId ?? null,
        saidaNome,
        valorSaida: new Prisma.Decimal(dados.valorSaida),

        customerId: dados.customerId ?? null,
        customerName: dados.customerName,
        customerPhone: dados.customerPhone ?? null,
        customerDocument: dados.customerDocument ?? null,

        photos: { create: separarFotos(dados.photos) },
      },
      include: COM_TUDO,
    });

    await registrarLog({
      acao: 'CRIAR_TROCA',
      entidade: 'TradeIn',
      id: troca.id,
      alteracoes: { codigo: troca.code, imei: troca.imei, valor: dados.valorAvaliado },
      req,
    });

    res.status(201).json({
      ...paraJson(troca),
      message: `Troca ${troca.code} registrada — ${dados.modelo} avaliado em R$ ${dados.valorAvaliado.toFixed(2)}.`,
    });
  }),
);

// ------------------------------------------------------------ Ajustes

const situacaoSchema = z.object({
  imeiSituacao: z.enum(['NAO_CONSULTADO', 'REGULAR', 'IRREGULAR', 'BLOQUEADO']),
  /** Print da consulta, se veio junto. */
  foto: z.string().max(4_000_000).optional().nullable(),
});

/**
 * Registra o resultado da consulta da Anatel depois do cadastro.
 *
 * Existe porque nem sempre dá para consultar na hora — a fila anda, o
 * cliente tem pressa, e a consulta oficial pede "não sou um robô".
 */
rotasTrocas.post(
  '/:id/anatel',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const { imeiSituacao, foto } = validar(situacaoSchema, req.body);

    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado('Troca');
    if (!podeVerTodas(req) && troca.sellerId !== req.usuario!.id) {
      throw new AppError('Esta troca é de outro vendedor', 403);
    }

    const novas = separarFotos(foto ? [{ tipo: 'ANATEL', data: foto }] : []);

    const atualizada = await db.tradeIn.update({
      where: { id: troca.id },
      data: {
        imeiSituacao,
        imeiCheckedAt: imeiSituacao === 'NAO_CONSULTADO' ? null : new Date(),
        photos: novas.length ? { create: novas } : undefined,
      },
      include: COM_TUDO,
    });

    if (imeiSituacao === 'BLOQUEADO') {
      await notificarPerfil('ADMIN', {
        title: `IMEI bloqueado na troca ${troca.code}`,
        message: `${troca.modelo} · IMEI ${troca.imei} · cliente ${troca.customerName}`,
        link: '/trocas',
      });
    }

    await registrarLog({ acao: 'ANATEL_TROCA', entidade: 'TradeIn', id: troca.id, req });
    res.json(paraJson(atualizada));
  }),
);

/** Desiste da troca. O aparelho volta para o cliente. */
rotasTrocas.post(
  '/:id/recusar',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado('Troca');
    if (troca.status === 'ACEITA') throw new AppError('Esta troca já virou venda.');
    if (!podeVerTodas(req) && troca.sellerId !== req.usuario!.id) {
      throw new AppError('Esta troca é de outro vendedor', 403);
    }

    await db.tradeIn.update({
      where: { id: troca.id },
      data: { status: 'RECUSADA', preSaleId: null },
    });

    await registrarLog({ acao: 'RECUSAR_TROCA', entidade: 'TradeIn', id: troca.id, req });
    res.json({ message: `Troca ${troca.code} recusada — o aparelho volta para o cliente.` });
  }),
);

rotasTrocas.delete(
  '/:id',
  exigir('troca.criar'),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado('Troca');
    if (troca.status === 'ACEITA') throw new AppError('Esta troca já virou venda e faz parte do histórico.');
    if (!podeVerTodas(req) && troca.sellerId !== req.usuario!.id) {
      throw new AppError('Esta troca é de outro vendedor', 403);
    }

    await db.tradeIn.delete({ where: { id: troca.id } });
    await registrarLog({ acao: 'EXCLUIR_TROCA', entidade: 'TradeIn', id: troca.id, req });
    res.json({ message: `Troca ${troca.code} excluída.` });
  }),
);
