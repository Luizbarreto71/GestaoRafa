import type { Application } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Ponto de entrada da API na Vercel.
 *
 * O `vercel.json` redireciona `/api/*` para cá; o Express recebe a URL
 * original (ex.: `/api/products`) e faz o roteamento normalmente.
 *
 * A montagem é preguiçosa e protegida. E o diagnóstico de `/api/health`
 * mora aqui, fora do servidor — se o servidor não carregar, é justamente
 * quando mais precisamos saber o porquê.
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

const ambiente = () => ({
  node: process.version,
  plataforma: `${process.platform}-${process.arch}`,
  naVercel: Boolean(process.env.VERCEL),
  regiao: process.env.VERCEL_REGION ?? null,
  temDatabaseUrl: Boolean(process.env.DATABASE_URL),
});

function responderJson(res: ServerResponse, status: number, corpo: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo, null, 2));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const servidor = await obterApp();
  const ehDiagnostico = (req.url ?? '').startsWith('/api/health');

  // Servidor não carregou: só o diagnóstico tem o que dizer.
  if (!servidor) {
    responderJson(res, 503, {
      status: 'falha ao carregar',
      problema: 'O código do servidor não pôde ser carregado nesta função.',
      // É este texto que diz o motivo real — copie e mande junto ao pedir ajuda.
      detalhe: erroDeCarga,
      ambiente: ambiente(),
      comoResolver: [
        'Se falar em "@prisma/client did not initialize": refaça o deploy sem cache (Deployments → ⋯ → Redeploy → desmarque "Use existing Build Cache").',
        'Se falar em "Cannot find module": algum arquivo não foi empacotado junto com a função.',
        'Se falar em DATABASE_URL: adicione a variável em Settings → Environment Variables.',
      ],
    });
    return;
  }

  // Carregou, mas ainda assim vale confirmar o básico no diagnóstico.
  if (ehDiagnostico && !process.env.DATABASE_URL) {
    responderJson(res, 503, {
      status: 'sem configuração',
      problema: 'A variável DATABASE_URL não está definida nesta função.',
      comoResolver:
        'Vercel → Settings → Environment Variables → adicione DATABASE_URL (marcando Production) → Deployments → Redeploy.',
      ambiente: ambiente(),
    });
    return;
  }

  servidor(req as never, res as never);
}
