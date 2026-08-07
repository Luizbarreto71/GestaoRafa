import compression from 'compression';
import express, { type Application } from 'express';
import helmet from 'helmet';
import { rotasAuth } from './auth';
import { rotasCategorias, rotasClientes, rotasFornecedores, rotasUsuarios } from './cadastros';
import { rota, tratarErros } from './core';
import { rotasDashboard } from './dashboard';
import { db } from './db';
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
  // O limite acomoda as fotos, que chegam junto com o produto.
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get(
    '/api/health',
    rota(async (_req, res) => {
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
