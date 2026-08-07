import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import type { Request } from 'express';

// Em produção as variáveis vêm da Vercel; local, do arquivo .env.
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Falta a variável DATABASE_URL. Copie o .env.example para .env e cole a URL do Supabase.',
  );
}

// Reaproveita a conexão entre recarregamentos em dev e entre invocações da
// função serverless — abrir conexão nova a cada requisição estoura o limite
// do Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// ------------------------------------------------------------------ Auditoria

interface Log {
  acao: string;
  entidade: string;
  id?: string | null;
  alteracoes?: unknown;
  req?: Request;
  usuarioId?: string | null;
}

/**
 * Grava uma ação no histórico. Nunca lança: registrar log não pode derrubar
 * a operação que o usuário pediu.
 *
 * Fica aqui (e não junto das rotas) porque quase todo módulo usa — e este
 * arquivo não importa nenhum outro, o que evita import circular.
 */
export async function registrarLog({ acao, entidade, id, alteracoes, req, usuarioId }: Log): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: acao,
        entity: entidade,
        entityId: id ?? null,
        changes: alteracoes ? (JSON.parse(JSON.stringify(alteracoes)) as object) : undefined,
        ip: req?.ip ?? null,
        userId: usuarioId ?? req?.usuario?.id ?? null,
      },
    });
  } catch (erro) {
    console.error('[auditoria]', (erro as Error).message);
  }
}
