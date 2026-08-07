import type { IncomingMessage, ServerResponse } from 'http';
import type { Application } from 'express';

/**
 * Ponto de entrada da API na Vercel.
 *
 * O `vercel.json` redireciona `/api/*` para cá; o Express recebe a URL
 * original (ex.: `/api/products`) e faz o roteamento normalmente.
 *
 * A montagem é preguiçosa e protegida: se algo falhar ao carregar o
 * servidor, respondemos um JSON explicando — em vez de deixar a função
 * morrer e a Vercel devolver um erro genérico que não diz nada.
 */
let app: Application | null = null;
let erroDeCarga: string | null = null;

async function obterApp(): Promise<Application | null> {
  if (app || erroDeCarga) return app;

  try {
    const { createApp } = await import('../server/app');
    app = createApp();
  } catch (erro) {
    erroDeCarga = erro instanceof Error ? (erro.stack ?? erro.message) : String(erro);
    console.error('[api] falha ao montar o servidor:', erroDeCarga);
  }

  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const servidor = await obterApp();

  if (!servidor) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error:
          'A API não conseguiu iniciar. Abra /api/health para ver o diagnóstico, ' +
          'ou confira os logs em Vercel → Deployments → Functions.',
        detalhe: erroDeCarga,
      }),
    );
    return;
  }

  servidor(req as never, res as never);
}
