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

/**
 * Motivo pelo qual o Prisma não subiu, quando é o caso.
 *
 * Criar o cliente pode falhar em produção — o caso clássico é o motor do
 * Prisma não ter sido empacotado junto com a função. Se isso acontecer no
 * carregamento do arquivo, a função morre sem mensagem. Guardando o erro,
 * `/api/health` consegue dizer exatamente o que houve.
 */
export let erroDoBanco: string | null = null;

// Reaproveita a conexão entre recarregamentos em dev e entre invocações da
// função serverless — abrir conexão nova a cada requisição estoura o limite
// do Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Ajusta a URL de conexão para o ambiente serverless.
 *
 * Por padrão o Prisma abre várias conexões por instância (proporcional aos
 * núcleos da máquina). Na Vercel isso multiplica: cada instância da função
 * segura o seu punhado, e o pooler do Supabase — que aceita 15 clientes em
 * modo sessão — estoura em poucos acessos, derrubando o sistema com
 * "max clients reached".
 *
 * Uma conexão por instância resolve. E no pooler de transação (porta 6543)
 * é preciso avisar o Prisma para não usar prepared statements.
 */
function prepararUrl(url: string): string {
  try {
    const endereco = new URL(url);

    if (!endereco.searchParams.has('connection_limit')) {
      endereco.searchParams.set('connection_limit', '1');
    }
    if (!endereco.searchParams.has('pool_timeout')) {
      endereco.searchParams.set('pool_timeout', '20');
    }
    if (endereco.port === '6543' && !endereco.searchParams.has('pgbouncer')) {
      endereco.searchParams.set('pgbouncer', 'true');
    }

    return endereco.toString();
  } catch {
    return url; // URL fora do padrão: usa como veio
  }
}

function criarCliente(): PrismaClient | null {
  const url = process.env.DATABASE_URL || 'postgresql://sem-configuracao/postgres';

  // Fora do serverless não há multiplicação de instâncias: mantemos o
  // comportamento normal do Prisma, que é mais rápido em desenvolvimento.
  const endereco = process.env.VERCEL ? prepararUrl(url) : url;

  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
      datasources: { db: { url: endereco } },
      // O padrão do Prisma é 5 segundos, contados da abertura da
      // transação. Com o banco na nuvem, cada consulta lá dentro é uma ida
      // e volta pela internet — uma venda de vários itens passava disso e
      // era desfeita no meio, com a caixa vendo só "não foi possível".
      transactionOptions: { timeout: 30_000, maxWait: 15_000 },
    });
  } catch (erro) {
    erroDoBanco = erro instanceof Error ? erro.message : String(erro);
    console.error('[banco] falha ao iniciar o Prisma:', erroDoBanco);
    return null;
  }
}

const cliente = globalForPrisma.prisma ?? criarCliente();

if (cliente && process.env.NODE_ENV !== 'production') globalForPrisma.prisma = cliente;

/**
 * Quando o Prisma não sobe, qualquer uso vira um erro explicado em vez de
 * um "undefined is not a function" perdido no meio da pilha.
 */
export const db: PrismaClient =
  cliente ??
  (new Proxy(
    {},
    {
      get() {
        throw new Error(
          `O banco de dados não pôde ser iniciado: ${erroDoBanco ?? 'motivo desconhecido'}`,
        );
      },
    },
  ) as PrismaClient);

export const bancoIniciado = cliente !== null;

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
