import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppError, rota, validar } from './core';
import { db, registrarLog } from './db';

/** Login, tokens e proteção das rotas. */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        nome: string;
        email: string;
        papel: 'ADMIN' | 'GERENTE' | 'VENDEDOR';
        admin: boolean;
        /** Unidade do Gerente/Vendedor. Administrador não tem — vê todas. */
        unidadeId?: string | null;
      };
    }
  }
}

// ------------------------------------------------------------------ Segredo

let segredoEmMemoria: string | null = null;

/**
 * Segredo usado para assinar os tokens.
 *
 * Se `JWT_SECRET` não estiver definida, o sistema gera uma sozinho na
 * primeira execução e guarda no banco — assim não há mais uma variável de
 * ambiente para você configurar, e todas as instâncias usam o mesmo valor.
 */
async function segredo(): Promise<string> {
  if (segredoEmMemoria) return segredoEmMemoria;

  if (process.env.JWT_SECRET) {
    segredoEmMemoria = process.env.JWT_SECRET;
    return segredoEmMemoria;
  }

  const salvo = await db.setting.findUnique({ where: { key: 'jwt_secret' } });
  if (salvo) {
    segredoEmMemoria = salvo.value;
    return salvo.value;
  }

  const novo = crypto.randomBytes(48).toString('base64');
  // Se duas instâncias criarem ao mesmo tempo, vale o que ficou gravado.
  await db.setting.upsert({
    where: { key: 'jwt_secret' },
    update: {},
    create: { key: 'jwt_secret', value: novo },
  });

  const definitivo = await db.setting.findUnique({ where: { key: 'jwt_secret' } });
  segredoEmMemoria = definitivo?.value ?? novo;
  return segredoEmMemoria;
}

const DURACAO = '7d';
const DURACAO_REFRESH = '30d';

async function gerarTokens(usuario: {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId?: string | null;
}) {
  const chave = await segredo();
  return {
    token: jwt.sign(
      {
        sub: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        role: usuario.role,
        unidadeId: usuario.unitId ?? null,
      },
      chave,
      { expiresIn: DURACAO },
    ),
    refreshToken: jwt.sign({ sub: usuario.id, tipo: 'refresh' }, chave, {
      expiresIn: DURACAO_REFRESH,
    }),
  };
}

const publico = (u: {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId?: string | null;
}) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  unitId: u.unitId ?? null,
});

// -------------------------------------------------------------- Middlewares

/** Exige um token válido. */
export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const cabecalho = req.headers.authorization;

  if (!cabecalho?.startsWith('Bearer ')) {
    next(new AppError('Token não informado', 401));
    return;
  }

  void (async () => {
    try {
      const dados = jwt.verify(cabecalho.slice(7).trim(), await segredo()) as {
        sub: string;
        nome: string;
        email: string;
        role: 'ADMIN' | 'GERENTE' | 'VENDEDOR';
        unidadeId?: string | null;
      };

      req.usuario = {
        id: dados.sub,
        nome: dados.nome,
        email: dados.email,
        papel: dados.role,
        admin: dados.role === 'ADMIN',
        unidadeId: dados.unidadeId ?? null,
      };
      next();
    } catch {
      next(new AppError('Token inválido ou expirado', 401));
    }
  })();
}

/** Exige que o usuário seja administrador. */
export function somenteAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.usuario) return next(new AppError('Não autorizado', 401));
  if (!req.usuario.admin) return next(new AppError('Apenas administradores podem fazer isso', 403));
  next();
}

/** Administrador e Gerente — usado nas movimentações de estoque. */
export function gerenteOuAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.usuario) return next(new AppError('Não autorizado', 401));
  if (req.usuario.papel === 'VENDEDOR') {
    return next(new AppError('Vendedor não pode fazer esta operação.', 403));
  }
  next();
}

// ------------------------------------------------------------------ Rotas

export const rotasAuth = Router();

const loginSchema = z.object({
  // O `.trim()` vem antes do `.email()`: espaço colado junto (ou vindo do
  // preenchimento automático do navegador) não pode reprovar o e-mail.
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  // Espaço no começo/fim da senha é sempre engano de cópia — some.
  password: z.string().trim().min(1, 'Informe a senha'),
});

rotasAuth.post(
  '/login',
  rota(async (req, res) => {
    const { email, password } = validar(loginSchema, req.body);

    const usuario = await db.user.findUnique({ where: { email } });

    // Mensagem igual para e-mail errado e senha errada, de propósito.
    if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
      throw new AppError('E-mail ou senha incorretos', 401);
    }
    if (!usuario.active) {
      throw new AppError('Usuário desativado. Procure o administrador.', 401);
    }

    await registrarLog({ acao: 'LOGIN', entidade: 'User', id: usuario.id, req, usuarioId: usuario.id });

    res.json({ ...(await gerarTokens(usuario)), user: publico(usuario) });
  }),
);

rotasAuth.post(
  '/refresh',
  rota(async (req, res) => {
    const { refreshToken } = validar(z.object({ refreshToken: z.string().min(10) }), req.body);

    let id: string;
    try {
      id = (jwt.verify(refreshToken, await segredo()) as { sub: string }).sub;
    } catch {
      throw new AppError('Sessão expirada, faça login novamente', 401);
    }

    const usuario = await db.user.findUnique({ where: { id } });
    if (!usuario?.active) throw new AppError('Usuário inválido', 401);

    res.json({ ...(await gerarTokens(usuario)), user: publico(usuario) });
  }),
);

rotasAuth.get(
  '/me',
  autenticar,
  rota(async (req, res) => {
    const usuario = await db.user.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) throw new AppError('Não autorizado', 401);
    res.json(publico(usuario));
  }),
);

const senhaSchema = z
  .object({
    currentPassword: z.string().trim().min(1, 'Informe a senha atual'),
    newPassword: z.string().trim().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
    confirmPassword: z.string().trim(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

rotasAuth.post(
  '/change-password',
  autenticar,
  rota(async (req, res) => {
    const { currentPassword, newPassword } = validar(senhaSchema, req.body);

    const usuario = await db.user.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) throw new AppError('Não autorizado', 401);

    if (!(await bcrypt.compare(currentPassword, usuario.password))) {
      throw new AppError('Senha atual incorreta');
    }

    await db.user.update({
      where: { id: usuario.id },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });

    await registrarLog({ acao: 'CHANGE_PASSWORD', entidade: 'User', id: usuario.id, req });
    res.json({ message: 'Senha alterada com sucesso' });
  }),
);
