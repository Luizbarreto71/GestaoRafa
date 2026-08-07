import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server/app';

/**
 * Ponto de entrada da API na Vercel.
 *
 * O `vercel.json` redireciona `/api/*` para cá; o Express recebe a URL
 * original (ex.: `/api/products`) e faz o roteamento normalmente.
 *
 * O app é criado uma única vez por instância e reaproveitado entre as
 * invocações, o que mantém a conexão do Prisma viva entre requisições.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  app(req as never, res as never);
}
