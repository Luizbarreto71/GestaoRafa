import { Prisma } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

/** Utilidades usadas por todas as rotas: erro, validação, paginação e datas. */

// ------------------------------------------------------------------- Erros

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/**
 * Palavras femininas usadas no 404.
 *
 * Lista à mão em vez de adivinhar pela terminação: "Foto" acaba em "o" e
 * "Unidade" em "e", e as duas são femininas. Como os nomes vêm todos do
 * código, o conjunto é fechado e a lista não sai do lugar.
 */
const FEMININAS = new Set([
  'Categoria',
  'Foto',
  'Pré-venda',
  'Retirada',
  'Troca',
  'Unidade',
  'Venda',
  'Transferência',
  'Movimentação',
]);

/**
 * Erro 404 com a concordância certa.
 *
 * "Unidade não encontrado" aparece para quem usa o sistema o dia inteiro, e
 * cada palavra torta desgasta a confiança no resto.
 */
export const naoEncontrado = (o = 'Registro') =>
  new AppError(`${o} não ${FEMININAS.has(o) ? 'encontrada' : 'encontrado'}`, 404);

/** Envolve rotas async para que erros caiam no tratador central. */
export function rota(
  handler: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (erro instanceof AppError) {
    res.status(erro.status).json({ error: erro.message });
    return;
  }

  if (erro instanceof ZodError) {
    res.status(422).json({
      error: 'Dados inválidos',
      details: erro.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === 'P2002') {
      const campo = (erro.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      res.status(409).json({ error: `Já existe um registro com este ${campo}` });
      return;
    }
    if (erro.code === 'P2025') {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }
    if (erro.code === 'P2003') {
      res.status(409).json({ error: 'Existem registros vinculados a este item' });
      return;
    }
  }

  // Erros de conexão têm causa conhecida e solução objetiva: vale explicar
  // em vez de devolver o genérico "erro interno".
  const texto = erro instanceof Error ? erro.message : '';
  if (/max clients reached|too many connections|EMAXCONN/i.test(texto)) {
    res.status(503).json({
      error:
        'O banco atingiu o limite de conexões. Troque a DATABASE_URL para a URL do ' +
        'Transaction pooler (porta 6543) nas variáveis da Vercel e refaça o deploy.',
    });
    return;
  }
  if (/Can't reach database server|ECONNREFUSED|ETIMEDOUT/i.test(texto)) {
    res.status(503).json({
      error: 'Sem conexão com o banco de dados no momento. Tente de novo em instantes.',
    });
    return;
  }

  console.error('[erro]', erro);
  res.status(500).json({
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'production'
      ? {}
      : { details: erro instanceof Error ? erro.message : String(erro) }),
  });
}

// --------------------------------------------------------------- Validação

/**
 * Descarta chaves vazias antes de validar.
 *
 * Um formulário que envia `?status=&categoryId=` está dizendo "sem filtro",
 * não "filtre por vazio" — sem isso a requisição é recusada por um campo
 * que o usuário nem preencheu.
 */
export const semVazios = (query: unknown): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries((query ?? {}) as Record<string, unknown>).filter(
      ([, valor]) => valor !== '' && valor !== null && valor !== undefined,
    ),
  );

/** Valida o corpo da requisição e devolve os dados já convertidos. */
export function validar<T extends ZodTypeAny>(schema: T, dados: unknown): ReturnType<T['parse']> {
  return schema.parse(dados);
}

// -------------------------------------------------------------- Paginação

export interface Pagina {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function paginacao(query: Record<string, unknown>, padrao = 20): Pagina {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || padrao));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginado<T>(data: T[], total: number, p: Pagina) {
  return {
    data,
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) },
  };
}

/** Monta o `orderBy` do Prisma validando a coluna contra uma lista permitida. */
export function ordenar(
  sortBy: unknown,
  sortOrder: unknown,
  permitidas: string[],
  padrao: Record<string, 'asc' | 'desc'>,
): Record<string, unknown> {
  const dir = sortOrder === 'asc' ? 'asc' : 'desc';
  if (typeof sortBy === 'string' && permitidas.includes(sortBy)) {
    if (sortBy.includes('.')) {
      const [relacao, campo] = sortBy.split('.');
      return { [relacao]: { [campo]: dir } };
    }
    return { [sortBy]: dir };
  }
  return padrao;
}

/** Busca "contém, ignorando maiúsculas" — usada em todos os filtros de texto. */
export const contem = (texto: string) => ({ contains: texto, mode: 'insensitive' as const });

// ------------------------------------------------------------------ Datas

export function inicioDoDia(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fimDoDia(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function somarDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}

/** Intervalo pronto para o Prisma; `undefined` quando não há filtro de data. */
export function intervalo(inicio?: Date, fim?: Date) {
  if (!inicio && !fim) return undefined;
  return { ...(inicio ? { gte: inicioDoDia(inicio) } : {}), ...(fim ? { lte: fimDoDia(fim) } : {}) };
}

export const dataBR = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export const dataHoraBR = (d: Date | string) =>
  new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/**
 * Data e hora curtas, para caber numa coluna de relatório.
 *
 * Segundo em relatório de venda é ruído: ocupa espaço e ninguém confere
 * venda por segundo.
 */
export const dataHoraCurta = (d: Date | string) =>
  new Date(d).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

// ------------------------------------------------------------ Serialização

/** Converte Decimal do Prisma em número, para o JSON não virar string. */
export function limpar<T>(valor: T): T {
  if (valor === null || valor === undefined) return valor;
  if (valor instanceof Prisma.Decimal) return valor.toNumber() as unknown as T;
  if (valor instanceof Date) return valor;
  if (Buffer.isBuffer(valor)) return undefined as unknown as T;
  if (Array.isArray(valor)) return valor.map(limpar) as unknown as T;

  if (typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = limpar(v);
    }
    return saida as T;
  }

  return valor;
}

export function numero(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

/**
 * Como cada forma de pagamento se chama na tela e no papel.
 *
 * Vive aqui porque três lugares precisam dela — fechamento, relatórios e
 * recibo — e uma cópia por arquivo é como um vira "Débito" e o outro
 * "Cartão de débito" sem ninguém perceber.
 */
export const PAGAMENTO_LABEL: Record<string, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferência',
  TROCA: 'Troca (aparelho)',
  OUTRO: 'Outro',
};
