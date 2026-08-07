import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import type { Request } from 'express';

// Em produção as variáveis vêm da Vercel; local, do arquivo .env.
dotenv.config();

/**
 * Sem DATABASE_URL o sistema não funciona — mas derrubar o processo aqui
 * faria a Vercel devolver só "FUNCTION_INVOCATION_FAILED", que não ajuda
 * ninguém a descobrir o que houve. Em vez disso seguimos de pé e o `app.ts`
 * responde explicando o que falta configurar.
 */
export const bancoConfigurado = Boolean(process.env.DATABASE_URL);

if (!bancoConfigurado) {
  console.error(
    '[banco] DATABASE_URL não está definida. ' +
      'Local: copie .env.example para .env. ' +
      'Na Vercel: Settings → Environment Variables.',
  );
}

// Reaproveita a conexão entre recarregamentos em dev e entre invocações da
// função serverless — abrir conexão nova a cada requisição estoura o limite
// do Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    datasources: {
      // Endereço inválido de propósito quando falta configuração: a conexão
      // falha de forma controlada, sem quebrar a criação do cliente.
      db: { url: process.env.DATABASE_URL || 'postgresql://sem-configuracao/postgres' },
    },
  });

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
