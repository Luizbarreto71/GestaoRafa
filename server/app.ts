import compression from 'compression';
import express, { type Application } from 'express';
import helmet from 'helmet';
import { rotasAuth } from './auth';
import { rotasCategorias, rotasClientes, rotasFornecedores, rotasUsuarios } from './cadastros';
import { rota, tratarErros } from './core';
import { rotasDashboard } from './dashboard';
import { bancoConfigurado, db } from './db';
import { rotasMovimentacoes } from './movimentacoes';
import { rotasFotos, rotasProdutos } from './produtos';
import { rotasRelatorios } from './relatorios';
import { rotasSistema } from './sistema';
import { rotasVendas } from './vendas';

/**
 * Monta a API. Usado igual em dois lugares:
 * - desenvolvimento: dentro do servidor do Vite;
 * - produção: na função serverless da Vercel (`api/index.ts`).
 */
export function createApp(): Application {
  const app = express();

  // Necessário para pegar o IP real atrás do proxy da Vercel.
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(compression());

  /**
   * Leitura do corpo da requisição.
   *
   * Na Vercel o corpo já chega lido e convertido antes do Express ver a
   * requisição. Se o `express.json()` tentar ler de novo, ele fica esperando
   * dados que nunca vêm e a função só termina quando estoura o tempo limite
   * — foi o que derrubava o login em produção. Por isso só analisamos o
   * corpo quando ninguém analisou antes.
   */
  const lerJson = express.json({ limit: '12mb' }); // o limite acomoda as fotos
  const lerFormulario = express.urlencoded({ extended: true });

  app.use((req, res, next) => {
    if (req.body !== undefined) return next();
    lerJson(req, res, (erro) => (erro ? next(erro) : lerFormulario(req, res, next)));
  });

  app.get(
    '/api/health',
    rota(async (_req, res) => {
      if (!bancoConfigurado) {
        res.status(503).json({
          status: 'sem configuração',
          database: 'DATABASE_URL não definida',
          comoResolver:
            'Vercel → Settings → Environment Variables → adicione DATABASE_URL e faça o redeploy.',
        });
        return;
      }

      try {
        await db.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'conectado' });
      } catch (erro) {
        res.status(503).json({
          status: 'degradado',
          database: 'desconectado',
          error: (erro as Error).message,
        });
      }
    }),
  );

  // Sem banco não adianta seguir: responde algo legível em vez de quebrar.
  app.use('/api', (_req, res, next) => {
    if (bancoConfigurado) return next();
    res.status(503).json({
      error:
        'O sistema está sem conexão com o banco: falta a variável DATABASE_URL. ' +
        'Configure em Vercel → Settings → Environment Variables e refaça o deploy.',
    });
  });

  app.use('/api/auth', rotasAuth);
  app.use('/api/dashboard', rotasDashboard);
  app.use('/api/products', rotasProdutos);
  app.use('/api/fotos', rotasFotos);
  app.use('/api/sales', rotasVendas);
  app.use('/api/movements', rotasMovimentacoes);
  app.use('/api/categories', rotasCategorias);
  app.use('/api/suppliers', rotasFornecedores);
  app.use('/api/customers', rotasClientes);
  app.use('/api/users', rotasUsuarios);
  app.use('/api/reports', rotasRelatorios);
  app.use('/api/settings', rotasSistema);

  app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  app.use(tratarErros);

  return app;
}
