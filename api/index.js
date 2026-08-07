// GERADO por 'npm run build:api' a partir de server/vercel.ts — não edite à mão.

// server/app.ts
import compression from "compression";
import express from "express";
import helmet from "helmet";

// server/auth.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

// server/core.ts
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
var AppError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
var naoEncontrado = (o = "Registro") => new AppError(`${o} n\xE3o encontrado`, 404);
function rota(handler2) {
  return (req, res, next) => {
    handler2(req, res).catch(next);
  };
}
function tratarErros(erro, _req, res, _next) {
  if (erro instanceof AppError) {
    res.status(erro.status).json({ error: erro.message });
    return;
  }
  if (erro instanceof ZodError) {
    res.status(422).json({
      error: "Dados inv\xE1lidos",
      details: erro.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    });
    return;
  }
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2002") {
      const campo = erro.meta?.target?.join(", ") ?? "campo";
      res.status(409).json({ error: `J\xE1 existe um registro com este ${campo}` });
      return;
    }
    if (erro.code === "P2025") {
      res.status(404).json({ error: "Registro n\xE3o encontrado" });
      return;
    }
    if (erro.code === "P2003") {
      res.status(409).json({ error: "Existem registros vinculados a este item" });
      return;
    }
  }
  const texto3 = erro instanceof Error ? erro.message : "";
  if (/max clients reached|too many connections|EMAXCONN/i.test(texto3)) {
    res.status(503).json({
      error: "O banco atingiu o limite de conex\xF5es. Troque a DATABASE_URL para a URL do Transaction pooler (porta 6543) nas vari\xE1veis da Vercel e refa\xE7a o deploy."
    });
    return;
  }
  if (/Can't reach database server|ECONNREFUSED|ETIMEDOUT/i.test(texto3)) {
    res.status(503).json({
      error: "Sem conex\xE3o com o banco de dados no momento. Tente de novo em instantes."
    });
    return;
  }
  console.error("[erro]", erro);
  res.status(500).json({
    error: "Erro interno do servidor",
    ...process.env.NODE_ENV === "production" ? {} : { details: erro instanceof Error ? erro.message : String(erro) }
  });
}
function validar(schema, dados) {
  return schema.parse(dados);
}
function paginacao(query, padrao = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || padrao));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
function paginado(data, total, p) {
  return {
    data,
    meta: { page: p.page, pageSize: p.pageSize, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) }
  };
}
function ordenar(sortBy, sortOrder, permitidas, padrao) {
  const dir = sortOrder === "asc" ? "asc" : "desc";
  if (typeof sortBy === "string" && permitidas.includes(sortBy)) {
    if (sortBy.includes(".")) {
      const [relacao, campo] = sortBy.split(".");
      return { [relacao]: { [campo]: dir } };
    }
    return { [sortBy]: dir };
  }
  return padrao;
}
var contem = (texto3) => ({ contains: texto3, mode: "insensitive" });
function inicioDoDia(d = /* @__PURE__ */ new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fimDoDia(d = /* @__PURE__ */ new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function somarDias(d, dias) {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}
function intervalo(inicio, fim) {
  if (!inicio && !fim) return void 0;
  return { ...inicio ? { gte: inicioDoDia(inicio) } : {}, ...fim ? { lte: fimDoDia(fim) } : {} };
}
var dataBR = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
var dataHoraBR = (d) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
function limpar(valor) {
  if (valor === null || valor === void 0) return valor;
  if (valor instanceof Prisma.Decimal) return valor.toNumber();
  if (valor instanceof Date) return valor;
  if (Buffer.isBuffer(valor)) return void 0;
  if (Array.isArray(valor)) return valor.map(limpar);
  if (typeof valor === "object") {
    const saida = {};
    for (const [chave, v] of Object.entries(valor)) {
      saida[chave] = limpar(v);
    }
    return saida;
  }
  return valor;
}
function numero(v) {
  if (v === null || v === void 0) return 0;
  return typeof v === "number" ? v : v.toNumber();
}

// server/db.ts
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();
var bancoConfigurado = Boolean(process.env.DATABASE_URL);
if (!bancoConfigurado) {
  console.error(
    "[banco] DATABASE_URL n\xE3o est\xE1 definida. Local: copie .env.example para .env. Na Vercel: Settings \u2192 Environment Variables."
  );
}
var erroDoBanco = null;
var globalForPrisma = globalThis;
function prepararUrl(url) {
  try {
    const endereco = new URL(url);
    if (!endereco.searchParams.has("connection_limit")) {
      endereco.searchParams.set("connection_limit", "1");
    }
    if (!endereco.searchParams.has("pool_timeout")) {
      endereco.searchParams.set("pool_timeout", "20");
    }
    if (endereco.port === "6543" && !endereco.searchParams.has("pgbouncer")) {
      endereco.searchParams.set("pgbouncer", "true");
    }
    return endereco.toString();
  } catch {
    return url;
  }
}
function criarCliente() {
  const url = process.env.DATABASE_URL || "postgresql://sem-configuracao/postgres";
  const endereco = process.env.VERCEL ? prepararUrl(url) : url;
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
      datasources: { db: { url: endereco } }
    });
  } catch (erro) {
    erroDoBanco = erro instanceof Error ? erro.message : String(erro);
    console.error("[banco] falha ao iniciar o Prisma:", erroDoBanco);
    return null;
  }
}
var cliente = globalForPrisma.prisma ?? criarCliente();
if (cliente && process.env.NODE_ENV !== "production") globalForPrisma.prisma = cliente;
var db = cliente ?? new Proxy(
  {},
  {
    get() {
      throw new Error(
        `O banco de dados n\xE3o p\xF4de ser iniciado: ${erroDoBanco ?? "motivo desconhecido"}`
      );
    }
  }
);
var bancoIniciado = cliente !== null;
async function registrarLog({ acao, entidade, id, alteracoes, req, usuarioId }) {
  try {
    await db.auditLog.create({
      data: {
        action: acao,
        entity: entidade,
        entityId: id ?? null,
        changes: alteracoes ? JSON.parse(JSON.stringify(alteracoes)) : void 0,
        ip: req?.ip ?? null,
        userId: usuarioId ?? req?.usuario?.id ?? null
      }
    });
  } catch (erro) {
    console.error("[auditoria]", erro.message);
  }
}

// server/auth.ts
var segredoEmMemoria = null;
async function segredo() {
  if (segredoEmMemoria) return segredoEmMemoria;
  if (process.env.JWT_SECRET) {
    segredoEmMemoria = process.env.JWT_SECRET;
    return segredoEmMemoria;
  }
  const salvo = await db.setting.findUnique({ where: { key: "jwt_secret" } });
  if (salvo) {
    segredoEmMemoria = salvo.value;
    return salvo.value;
  }
  const novo = crypto.randomBytes(48).toString("base64");
  await db.setting.upsert({
    where: { key: "jwt_secret" },
    update: {},
    create: { key: "jwt_secret", value: novo }
  });
  const definitivo = await db.setting.findUnique({ where: { key: "jwt_secret" } });
  segredoEmMemoria = definitivo?.value ?? novo;
  return segredoEmMemoria;
}
var DURACAO = "7d";
var DURACAO_REFRESH = "30d";
async function gerarTokens(usuario) {
  const chave = await segredo();
  return {
    token: jwt.sign(
      { sub: usuario.id, nome: usuario.name, email: usuario.email, role: usuario.role },
      chave,
      { expiresIn: DURACAO }
    ),
    refreshToken: jwt.sign({ sub: usuario.id, tipo: "refresh" }, chave, {
      expiresIn: DURACAO_REFRESH
    })
  };
}
var publico = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role
});
function autenticar(req, _res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith("Bearer ")) {
    next(new AppError("Token n\xE3o informado", 401));
    return;
  }
  void (async () => {
    try {
      const dados = jwt.verify(cabecalho.slice(7).trim(), await segredo());
      req.usuario = {
        id: dados.sub,
        nome: dados.nome,
        email: dados.email,
        admin: dados.role === "ADMIN"
      };
      next();
    } catch {
      next(new AppError("Token inv\xE1lido ou expirado", 401));
    }
  })();
}
function somenteAdmin(req, _res, next) {
  if (!req.usuario) return next(new AppError("N\xE3o autorizado", 401));
  if (!req.usuario.admin) return next(new AppError("Apenas administradores podem fazer isso", 403));
  next();
}
var rotasAuth = Router();
var loginSchema = z.object({
  // O `.trim()` vem antes do `.email()`: espaço colado junto (ou vindo do
  // preenchimento automático do navegador) não pode reprovar o e-mail.
  email: z.string().trim().toLowerCase().email("E-mail inv\xE1lido"),
  // Espaço no começo/fim da senha é sempre engano de cópia — some.
  password: z.string().trim().min(1, "Informe a senha")
});
rotasAuth.post(
  "/login",
  rota(async (req, res) => {
    const { email: email2, password } = validar(loginSchema, req.body);
    const usuario = await db.user.findUnique({ where: { email: email2 } });
    if (!usuario || !await bcrypt.compare(password, usuario.password)) {
      throw new AppError("E-mail ou senha incorretos", 401);
    }
    if (!usuario.active) {
      throw new AppError("Usu\xE1rio desativado. Procure o administrador.", 401);
    }
    await registrarLog({ acao: "LOGIN", entidade: "User", id: usuario.id, req, usuarioId: usuario.id });
    res.json({ ...await gerarTokens(usuario), user: publico(usuario) });
  })
);
rotasAuth.post(
  "/refresh",
  rota(async (req, res) => {
    const { refreshToken } = validar(z.object({ refreshToken: z.string().min(10) }), req.body);
    let id;
    try {
      id = jwt.verify(refreshToken, await segredo()).sub;
    } catch {
      throw new AppError("Sess\xE3o expirada, fa\xE7a login novamente", 401);
    }
    const usuario = await db.user.findUnique({ where: { id } });
    if (!usuario?.active) throw new AppError("Usu\xE1rio inv\xE1lido", 401);
    res.json({ ...await gerarTokens(usuario), user: publico(usuario) });
  })
);
rotasAuth.get(
  "/me",
  autenticar,
  rota(async (req, res) => {
    const usuario = await db.user.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) throw new AppError("N\xE3o autorizado", 401);
    res.json(publico(usuario));
  })
);
var senhaSchema = z.object({
  currentPassword: z.string().trim().min(1, "Informe a senha atual"),
  newPassword: z.string().trim().min(6, "A nova senha deve ter ao menos 6 caracteres"),
  confirmPassword: z.string().trim()
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "As senhas n\xE3o conferem",
  path: ["confirmPassword"]
});
rotasAuth.post(
  "/change-password",
  autenticar,
  rota(async (req, res) => {
    const { currentPassword, newPassword } = validar(senhaSchema, req.body);
    const usuario = await db.user.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) throw new AppError("N\xE3o autorizado", 401);
    if (!await bcrypt.compare(currentPassword, usuario.password)) {
      throw new AppError("Senha atual incorreta");
    }
    await db.user.update({
      where: { id: usuario.id },
      data: { password: await bcrypt.hash(newPassword, 10) }
    });
    await registrarLog({ acao: "CHANGE_PASSWORD", entidade: "User", id: usuario.id, req });
    res.json({ message: "Senha alterada com sucesso" });
  })
);

// server/cadastros.ts
import bcrypt2 from "bcryptjs";
import { Router as Router2 } from "express";
import { z as z2 } from "zod";

// shared/campos.ts
var CATALOGO = {
  nome: {
    rotulo: "Nome do produto",
    tipo: "texto",
    coluna: "name",
    essencial: true,
    ajuda: "\xC9 o que aparece na lista, na venda e nos relat\xF3rios",
    exemplo: "iPhone 15 Pro Max"
  },
  marca: { rotulo: "Marca", tipo: "texto", coluna: "brand", exemplo: "Apple" },
  modelo: { rotulo: "Modelo", tipo: "texto", coluna: "model", exemplo: "15 Pro Max" },
  cor: { rotulo: "Cor", tipo: "texto", coluna: "color", exemplo: "Tit\xE2nio" },
  capacidade: { rotulo: "Capacidade", tipo: "texto", coluna: "capacity", exemplo: "256GB" },
  lote: { rotulo: "Lote", tipo: "texto", coluna: "lote", exemplo: "AB1234" },
  imei: { rotulo: "IMEI", tipo: "texto", coluna: "imei", exemplo: "356938035643809" },
  serie: { rotulo: "N\xFAmero de s\xE9rie", tipo: "texto", coluna: "serialNumber", exemplo: "SN-000123" },
  codigo: { rotulo: "C\xF3digo de barras", tipo: "codigo-barras", coluna: "barcode" },
  quantidade: {
    rotulo: "Quantidade",
    tipo: "inteiro",
    coluna: "quantity",
    essencial: true
  },
  minimo: {
    rotulo: "Estoque m\xEDnimo",
    tipo: "inteiro",
    coluna: "minQuantity",
    ajuda: "Abaixo disso o produto entra no alerta"
  },
  custo: { rotulo: "Pre\xE7o de custo", tipo: "dinheiro", coluna: "costPrice", essencial: true },
  venda: { rotulo: "Pre\xE7o de venda", tipo: "dinheiro", coluna: "salePrice", essencial: true },
  fornecedor: { rotulo: "Fornecedor", tipo: "fornecedor", coluna: "supplierId" },
  status: { rotulo: "Status", tipo: "status", coluna: "status" },
  entrada: { rotulo: "Data de entrada", tipo: "data", coluna: "entryDate" },
  fotos: { rotulo: "Fotos do produto", tipo: "fotos", coluna: "photos" },
  observacoes: { rotulo: "Observa\xE7\xF5es", tipo: "texto-longo", coluna: "notes" }
};
var CAMPOS = CATALOGO;
var TODAS_AS_CHAVES = Object.keys(CATALOGO);
var ehChaveValida = (v) => v in CAMPOS;
var PADROES = {
  celulares: [
    { campo: "nome" },
    { campo: "marca" },
    { campo: "modelo" },
    { campo: "cor" },
    { campo: "capacidade" },
    { campo: "imei" },
    { campo: "quantidade" },
    { campo: "custo" },
    { campo: "venda" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  // Vendido por caixa: some marca, modelo, cor, capacidade e IMEI.
  tg: [
    { campo: "nome", rotulo: "Nome / dosagem" },
    { campo: "lote", rotulo: "Lote da caixa" },
    { campo: "quantidade", rotulo: "Quantidade de caixas" },
    { campo: "custo", rotulo: "Pre\xE7o de compra" },
    { campo: "venda", rotulo: "Pre\xE7o de venda" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  jbl: [
    { campo: "nome" },
    { campo: "modelo" },
    { campo: "cor" },
    { campo: "serie" },
    { campo: "quantidade" },
    { campo: "custo" },
    { campo: "venda" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  notebooks: [
    { campo: "nome" },
    { campo: "marca" },
    { campo: "modelo" },
    { campo: "cor" },
    { campo: "capacidade", rotulo: "Configura\xE7\xE3o (RAM / SSD)" },
    { campo: "serie" },
    { campo: "quantidade" },
    { campo: "custo" },
    { campo: "venda" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  "video-games": [
    { campo: "nome" },
    { campo: "marca" },
    { campo: "modelo" },
    { campo: "cor" },
    { campo: "capacidade" },
    { campo: "serie" },
    { campo: "quantidade" },
    { campo: "custo" },
    { campo: "venda" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ]
};
var PADRAO_GENERICO = [
  { campo: "nome" },
  { campo: "marca" },
  { campo: "modelo" },
  { campo: "quantidade" },
  { campo: "custo" },
  { campo: "venda" },
  { campo: "fornecedor" },
  { campo: "fotos" },
  { campo: "observacoes" }
];
function normalizarCampos(bruto, slug) {
  const padrao = slug && PADROES[slug] || PADRAO_GENERICO;
  const lista = Array.isArray(bruto) ? bruto.map((item) => {
    if (typeof item === "string") return ehChaveValida(item) ? { campo: item } : null;
    if (item && typeof item === "object") {
      const { campo, rotulo, obrigatorio } = item;
      if (typeof campo === "string" && ehChaveValida(campo)) {
        return {
          campo,
          ...typeof rotulo === "string" && rotulo.trim() ? { rotulo: rotulo.trim() } : {},
          ...obrigatorio === true ? { obrigatorio: true } : {}
        };
      }
    }
    return null;
  }).filter((c) => c !== null) : padrao;
  const escolhidos = lista.length ? lista : padrao;
  const presentes = new Set(escolhidos.map((c) => c.campo));
  const faltando = TODAS_AS_CHAVES.filter((k) => CAMPOS[k].essencial && !presentes.has(k)).map(
    (campo) => ({ campo })
  );
  return [...escolhidos, ...faltando];
}
var camposParaJson = (campos2) => JSON.parse(JSON.stringify(campos2));

// server/cadastros.ts
var texto = z2.string().trim().max(200).optional().nullable().transform((v) => v || null);
var email = z2.string().trim().email("E-mail inv\xE1lido").or(z2.literal("")).optional().nullable().transform((v) => v || null);
var buscaSimples = z2.object({
  page: z2.coerce.number().int().min(1).optional(),
  pageSize: z2.coerce.number().int().min(1).max(200).optional(),
  search: z2.string().trim().optional(),
  all: z2.enum(["true", "false"]).optional()
});
var rotasCategorias = Router2();
rotasCategorias.use(autenticar);
var apelido = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
var categoriaSchema = z2.object({
  name: z2.string().trim().min(2, "Informe o nome da categoria").max(80),
  color: z2.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB").optional().nullable(),
  /**
   * Campos do formulário desta categoria. Chega da tela de Configurações;
   * `normalizarCampos` descarta o que não existir e repõe os essenciais.
   */
  campos: z2.array(
    z2.object({
      campo: z2.string(),
      rotulo: z2.string().trim().max(60).optional(),
      obrigatorio: z2.boolean().optional()
    })
  ).optional()
});
rotasCategorias.get(
  "/",
  rota(async (_req, res) => {
    const categorias = await db.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } }
    });
    res.json(
      limpar(categorias.map((c) => ({ ...c, campos: normalizarCampos(c.campos, c.slug) })))
    );
  })
);
rotasCategorias.post(
  "/",
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(categoriaSchema, req.body);
    const slug = apelido(dados.name);
    const categoria = await db.category.create({
      data: {
        ...dados,
        slug,
        campos: camposParaJson(normalizarCampos(dados.campos ?? PADROES[slug] ?? PADRAO_GENERICO, slug))
      }
    });
    await registrarLog({ acao: "CREATE", entidade: "Category", id: categoria.id, req });
    res.status(201).json(limpar(categoria));
  })
);
rotasCategorias.put(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(categoriaSchema.partial(), req.body);
    const atual = await db.category.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado("Categoria");
    const categoria = await db.category.update({
      where: { id: req.params.id },
      data: {
        ...dados,
        ...dados.name ? { slug: apelido(dados.name) } : {},
        ...dados.campos ? { campos: camposParaJson(normalizarCampos(dados.campos, atual.slug)) } : {}
      }
    });
    await registrarLog({ acao: "UPDATE", entidade: "Category", id: categoria.id, req });
    res.json(limpar(categoria));
  })
);
rotasCategorias.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const usados = await db.product.count({ where: { categoryId: req.params.id } });
    if (usados > 0) {
      throw new AppError(
        `Esta categoria tem ${usados} produto(s). Mova-os para outra categoria antes de excluir.`,
        409
      );
    }
    await db.category.delete({ where: { id: req.params.id } });
    await registrarLog({ acao: "DELETE", entidade: "Category", id: req.params.id, req });
    res.json({ message: "Categoria exclu\xEDda com sucesso" });
  })
);
var rotasFornecedores = Router2();
rotasFornecedores.use(autenticar);
var fornecedorSchema = z2.object({
  name: z2.string().trim().min(2, "Informe o nome do fornecedor").max(180),
  phone: texto,
  email,
  document: texto,
  address: texto,
  notes: texto,
  active: z2.boolean().optional()
});
rotasFornecedores.get(
  "/",
  rota(async (req, res) => {
    const q = validar(buscaSimples, req.query);
    const where = q.search ? { OR: [{ name: contem(q.search) }, { phone: contem(q.search) }, { email: contem(q.search) }] } : {};
    if (q.all === "true") {
      const lista2 = await db.supplier.findMany({ where, orderBy: { name: "asc" } });
      res.json(
        limpar({ data: lista2, meta: { page: 1, pageSize: lista2.length, total: lista2.length, totalPages: 1 } })
      );
      return;
    }
    const p = paginacao(q);
    const [lista, total] = await Promise.all([
      db.supplier.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } }
      }),
      db.supplier.count({ where })
    ]);
    res.json(limpar(paginado(lista, total, p)));
  })
);
rotasFornecedores.post(
  "/",
  rota(async (req, res) => {
    const fornecedor = await db.supplier.create({ data: validar(fornecedorSchema, req.body) });
    await registrarLog({ acao: "CREATE", entidade: "Supplier", id: fornecedor.id, req });
    res.status(201).json(limpar(fornecedor));
  })
);
rotasFornecedores.put(
  "/:id",
  rota(async (req, res) => {
    const fornecedor = await db.supplier.update({
      where: { id: req.params.id },
      data: validar(fornecedorSchema.partial(), req.body)
    });
    await registrarLog({ acao: "UPDATE", entidade: "Supplier", id: fornecedor.id, req });
    res.json(limpar(fornecedor));
  })
);
rotasFornecedores.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const vinculados = await db.product.count({ where: { supplierId: req.params.id } });
    if (vinculados > 0) {
      await db.supplier.update({ where: { id: req.params.id }, data: { active: false } });
      await registrarLog({ acao: "DEACTIVATE", entidade: "Supplier", id: req.params.id, req });
      res.json({
        message: `Fornecedor tem ${vinculados} produto(s) e foi desativado em vez de exclu\xEDdo.`,
        deactivated: true
      });
      return;
    }
    await db.supplier.delete({ where: { id: req.params.id } });
    await registrarLog({ acao: "DELETE", entidade: "Supplier", id: req.params.id, req });
    res.json({ message: "Fornecedor exclu\xEDdo com sucesso", deactivated: false });
  })
);
var rotasClientes = Router2();
rotasClientes.use(autenticar);
var clienteSchema = z2.object({
  name: z2.string().trim().min(2, "Informe o nome do cliente").max(180),
  phone: texto,
  email,
  document: texto,
  notes: texto
});
rotasClientes.get(
  "/",
  rota(async (req, res) => {
    const q = validar(buscaSimples, req.query);
    const p = paginacao(q);
    const where = q.search ? { OR: [{ name: contem(q.search) }, { phone: contem(q.search) }, { email: contem(q.search) }] } : {};
    const [lista, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { sales: true } } }
      }),
      db.customer.count({ where })
    ]);
    res.json(limpar(paginado(lista, total, p)));
  })
);
rotasClientes.get(
  "/:id",
  rota(async (req, res) => {
    const cliente3 = await db.customer.findUnique({
      where: { id: req.params.id },
      include: {
        sales: {
          orderBy: { saleDate: "desc" },
          take: 20,
          include: { product: { select: { name: true, model: true } } }
        }
      }
    });
    if (!cliente3) throw naoEncontrado("Cliente");
    res.json(limpar(cliente3));
  })
);
rotasClientes.post(
  "/",
  rota(async (req, res) => {
    const cliente3 = await db.customer.create({ data: validar(clienteSchema, req.body) });
    await registrarLog({ acao: "CREATE", entidade: "Customer", id: cliente3.id, req });
    res.status(201).json(limpar(cliente3));
  })
);
rotasClientes.put(
  "/:id",
  rota(async (req, res) => {
    const cliente3 = await db.customer.update({
      where: { id: req.params.id },
      data: validar(clienteSchema.partial(), req.body)
    });
    await registrarLog({ acao: "UPDATE", entidade: "Customer", id: cliente3.id, req });
    res.json(limpar(cliente3));
  })
);
rotasClientes.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    await db.customer.delete({ where: { id: req.params.id } });
    await registrarLog({ acao: "DELETE", entidade: "Customer", id: req.params.id, req });
    res.json({ message: "Cliente exclu\xEDdo com sucesso" });
  })
);
var rotasUsuarios = Router2();
rotasUsuarios.use(autenticar, somenteAdmin);
var campos = { id: true, name: true, email: true, role: true, active: true, createdAt: true };
var usuarioSchema = z2.object({
  name: z2.string().trim().min(2, "Informe o nome").max(120),
  email: z2.string().trim().toLowerCase().email("E-mail inv\xE1lido"),
  password: z2.string().trim().min(6, "A senha deve ter ao menos 6 caracteres"),
  role: z2.enum(["ADMIN", "OPERADOR"]).default("OPERADOR"),
  active: z2.boolean().default(true)
});
var alterarUsuarioSchema = usuarioSchema.partial().extend({
  password: z2.string().trim().min(6, "A senha deve ter ao menos 6 caracteres").or(z2.literal("")).optional()
});
async function garantirOutroAdmin() {
  const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
  if (admins <= 1) throw new AppError("\xC9 necess\xE1rio manter ao menos um administrador ativo", 409);
}
rotasUsuarios.get(
  "/",
  rota(async (req, res) => {
    const p = paginacao(req.query, 50);
    const [lista, total] = await Promise.all([
      db.user.findMany({ select: campos, skip: p.skip, take: p.take, orderBy: { createdAt: "asc" } }),
      db.user.count()
    ]);
    res.json(paginado(lista, total, p));
  })
);
rotasUsuarios.get(
  "/logs/activity",
  rota(async (req, res) => {
    const p = paginacao(req.query, 30);
    const [lista, total] = await Promise.all([
      db.auditLog.findMany({
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } }
      }),
      db.auditLog.count()
    ]);
    res.json(limpar(paginado(lista, total, p)));
  })
);
rotasUsuarios.post(
  "/",
  rota(async (req, res) => {
    const dados = validar(usuarioSchema, req.body);
    const usuario = await db.user.create({
      data: { ...dados, password: await bcrypt2.hash(dados.password, 10) },
      select: campos
    });
    await registrarLog({ acao: "CREATE", entidade: "User", id: usuario.id, req });
    res.status(201).json(usuario);
  })
);
rotasUsuarios.put(
  "/:id",
  rota(async (req, res) => {
    const dados = validar(alterarUsuarioSchema, req.body);
    const alvo = await db.user.findUnique({ where: { id: req.params.id } });
    if (!alvo) throw naoEncontrado("Usu\xE1rio");
    if (alvo.role === "ADMIN" && (dados.role === "OPERADOR" || dados.active === false)) {
      await garantirOutroAdmin();
    }
    const usuario = await db.user.update({
      where: { id: req.params.id },
      data: { ...dados, password: dados.password ? await bcrypt2.hash(dados.password, 10) : void 0 },
      select: campos
    });
    await registrarLog({ acao: "UPDATE", entidade: "User", id: usuario.id, req });
    res.json(usuario);
  })
);
rotasUsuarios.delete(
  "/:id",
  rota(async (req, res) => {
    if (req.params.id === req.usuario?.id) {
      throw new AppError("Voc\xEA n\xE3o pode excluir o pr\xF3prio usu\xE1rio");
    }
    const alvo = await db.user.findUnique({ where: { id: req.params.id } });
    if (!alvo) throw naoEncontrado("Usu\xE1rio");
    if (alvo.role === "ADMIN") await garantirOutroAdmin();
    await db.user.delete({ where: { id: req.params.id } });
    await registrarLog({ acao: "DELETE", entidade: "User", id: req.params.id, req });
    res.json({ message: "Usu\xE1rio exclu\xEDdo com sucesso" });
  })
);

// server/dashboard.ts
import { Router as Router4 } from "express";

// server/movimentacoes.ts
import { Router as Router3 } from "express";
import { z as z3 } from "zod";

// server/planilha.ts
var CABECALHO = [
  "Data",
  "Categoria",
  "Produto",
  "Marca",
  "Modelo",
  "Quantidade",
  "Pre\xE7o de Custo",
  "Pre\xE7o de Venda",
  "Fornecedor",
  "Status",
  "Tipo da Movimenta\xE7\xE3o",
  "Usu\xE1rio"
];
var conf = () => ({
  ativo: process.env.GOOGLE_SHEETS_ENABLED === "true",
  planilha: process.env.GOOGLE_SHEETS_ID ?? "",
  aba: process.env.GOOGLE_SHEETS_TAB ?? "Movimentacoes",
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  chave: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n")
});
function planilhaConfigurada() {
  const c = conf();
  return Boolean(c.ativo && c.planilha && c.email && c.chave);
}
var statusPlanilha = () => {
  const c = conf();
  return {
    enabled: c.ativo,
    configured: planilhaConfigurada(),
    sheetName: c.aba
  };
};
var cliente2 = null;
var cabecalhoOk = false;
async function conectar() {
  if (!planilhaConfigurada()) return null;
  if (cliente2) return cliente2;
  const c = conf();
  const { google } = await import("googleapis");
  cliente2 = google.sheets({
    version: "v4",
    auth: new google.auth.JWT({
      email: c.email,
      key: c.chave,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    })
  });
  return cliente2;
}
var valores = (l) => [
  new Date(l.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  l.categoria,
  l.produto,
  l.marca ?? "",
  l.modelo ?? "",
  l.quantidade,
  Number(l.custo ?? 0).toFixed(2),
  Number(l.venda ?? 0).toFixed(2),
  l.fornecedor ?? "",
  l.status,
  l.tipo,
  l.usuario ?? ""
];
async function prepararAba(sheets) {
  if (cabecalhoOk) return;
  const c = conf();
  const info = await sheets.spreadsheets.get({ spreadsheetId: c.planilha });
  const existe = info.data.sheets?.some((s) => s.properties?.title === c.aba);
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: c.planilha,
      requestBody: { requests: [{ addSheet: { properties: { title: c.aba } } }] }
    });
  }
  const atual = await sheets.spreadsheets.values.get({
    spreadsheetId: c.planilha,
    range: `${c.aba}!A1:L1`
  });
  if (!atual.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: c.planilha,
      range: `${c.aba}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [CABECALHO] }
    });
  }
  cabecalhoOk = true;
}
function enviarParaPlanilha(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [linhas];
  if (!lista.length) return;
  void (async () => {
    const sheets = await conectar();
    if (!sheets) return;
    const c = conf();
    try {
      await prepararAba(sheets);
      await sheets.spreadsheets.values.append({
        spreadsheetId: c.planilha,
        range: `${c.aba}!A:L`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: lista.map(valores) }
      });
    } catch (erro) {
      console.error("[planilha] falha ao sincronizar:", erro.message);
    }
  })();
}
async function reescreverPlanilha(linhas) {
  const sheets = await conectar();
  if (!sheets) throw new Error("Integra\xE7\xE3o com Google Sheets n\xE3o configurada");
  const c = conf();
  await prepararAba(sheets);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: c.planilha,
    range: `${c.aba}!A2:L`
  });
  if (linhas.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: c.planilha,
      range: `${c.aba}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: linhas.map(valores) }
    });
  }
  return linhas.length;
}

// server/movimentacoes.ts
var TIPO_LABEL = {
  ENTRADA: "Entrada",
  SAIDA: "Sa\xEDda",
  AJUSTE: "Ajuste",
  EXCLUSAO: "Exclus\xE3o"
};
var STATUS_LABEL = {
  EM_ESTOQUE: "Em estoque",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido"
};
async function registrarMovimentacao(m) {
  const cliente3 = m.tx ?? db;
  const saldo = m.saldo ?? m.produto.quantity;
  const registro = await cliente3.movement.create({
    data: {
      type: m.tipo,
      quantity: m.quantidade,
      reason: m.motivo ?? null,
      balanceAfter: saldo,
      productId: m.produto.id,
      productName: m.produto.name,
      saleId: m.vendaId ?? null,
      userId: m.usuarioId ?? null
    }
  });
  enviarParaPlanilha(linhaDaPlanilha(m.produto, m.tipo, m.quantidade, m.usuarioNome, saldo));
  return registro;
}
function linhaDaPlanilha(produto, tipo, quantidade, usuario, saldo) {
  const status = saldo === 0 && tipo === "SAIDA" ? "VENDIDO" : produto.status;
  return {
    data: /* @__PURE__ */ new Date(),
    categoria: produto.category?.name ?? "\u2014",
    produto: produto.name,
    marca: produto.brand ?? "",
    modelo: produto.model ?? "",
    quantidade,
    custo: numero(produto.costPrice),
    venda: numero(produto.salePrice),
    fornecedor: produto.supplier?.name ?? "",
    status: STATUS_LABEL[status] ?? status,
    tipo: TIPO_LABEL[tipo],
    usuario: usuario ?? ""
  };
}
async function idsComEstoqueBaixo(limite = 200) {
  const linhas = await db.$queryRaw`
    SELECT "id" FROM "products"
    WHERE "quantity" > 0 AND "quantity" <= "minQuantity"
    ORDER BY "quantity" ASC
    LIMIT ${limite}
  `;
  return linhas.map((l) => l.id);
}
async function valorDoEstoque() {
  const [linha] = await db.$queryRaw`
    SELECT
      SUM("quantity" * "costPrice")::text AS custo,
      SUM("quantity" * "salePrice")::text AS venda
    FROM "products" WHERE "quantity" > 0
  `;
  return { custo: Number(linha?.custo ?? 0), venda: Number(linha?.venda ?? 0) };
}
var rotasMovimentacoes = Router3();
rotasMovimentacoes.use(autenticar);
var filtros = z3.object({
  page: z3.coerce.number().int().min(1).optional(),
  pageSize: z3.coerce.number().int().min(1).max(200).optional(),
  search: z3.string().trim().optional(),
  type: z3.enum(["ENTRADA", "SAIDA", "AJUSTE", "EXCLUSAO"]).optional(),
  productId: z3.string().uuid().optional(),
  userId: z3.string().uuid().optional(),
  categoryId: z3.string().uuid().optional(),
  startDate: z3.coerce.date().optional(),
  endDate: z3.coerce.date().optional(),
  sortOrder: z3.enum(["asc", "desc"]).optional()
});
function filtrarMovimentacoes(q) {
  const cond = [];
  if (q.search) {
    cond.push({
      OR: [
        { productName: contem(q.search) },
        { reason: contem(q.search) },
        { product: { model: contem(q.search) } }
      ]
    });
  }
  if (q.type) cond.push({ type: q.type });
  if (q.productId) cond.push({ productId: q.productId });
  if (q.userId) cond.push({ userId: q.userId });
  if (q.categoryId) cond.push({ product: { categoryId: q.categoryId } });
  const periodo2 = intervalo(q.startDate, q.endDate);
  if (periodo2) cond.push({ createdAt: periodo2 });
  return cond.length ? { AND: cond } : {};
}
rotasMovimentacoes.get(
  "/",
  rota(async (req, res) => {
    const q = validar(filtros, req.query);
    const p = paginacao(q);
    const where = filtrarMovimentacoes(q);
    const [lista, total, agrupado] = await Promise.all([
      db.movement.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: q.sortOrder === "asc" ? "asc" : "desc" },
        include: {
          user: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, model: true, category: { select: { name: true } } } }
        }
      }),
      db.movement.count({ where }),
      db.movement.groupBy({ by: ["type"], where, _sum: { quantity: true }, _count: true })
    ]);
    res.json(
      limpar({
        ...paginado(lista, total, p),
        summary: Object.fromEntries(
          agrupado.map((g) => [g.type, { count: g._count, quantity: g._sum.quantity ?? 0 }])
        )
      })
    );
  })
);

// server/dashboard.ts
var rotasDashboard = Router4();
rotasDashboard.use(autenticar);
rotasDashboard.get(
  "/",
  rota(async (req, res) => {
    const dias = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const hoje = /* @__PURE__ */ new Date();
    const inicioHoje = inicioDoDia(hoje);
    const fimHoje = fimDoDia(hoje);
    const inicioGrafico = inicioDoDia(somarDias(hoje, -(dias - 1)));
    const inicioDoMes = inicioDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const idsBaixos = await idsComEstoqueBaixo(10);
    const [
      totalProdutos,
      somaEstoque,
      vendidosHoje,
      faturamentoHoje,
      estoqueBaixo,
      semEstoque,
      ultimasVendas,
      vendasDoPeriodo,
      movimentosDoPeriodo,
      porCategoria,
      categorias,
      mes,
      valor
    ] = await Promise.all([
      db.product.count(),
      db.product.aggregate({ _sum: { quantity: true } }),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje } },
        _sum: { quantity: true },
        _count: true
      }),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje } },
        _sum: { totalPrice: true, costAtSale: true }
      }),
      db.product.findMany({
        where: { id: { in: idsBaixos } },
        include: { category: true, photos: { select: { id: true }, take: 1 } },
        orderBy: { quantity: "asc" }
      }),
      db.product.count({ where: { quantity: 0 } }),
      db.sale.findMany({
        orderBy: { saleDate: "desc" },
        take: 8,
        include: {
          product: { select: { name: true, model: true, category: { select: { name: true } } } },
          user: { select: { name: true } }
        }
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioGrafico, lte: fimHoje } },
        select: { saleDate: true, totalPrice: true, quantity: true }
      }),
      db.movement.findMany({
        where: { createdAt: { gte: inicioGrafico, lte: fimHoje } },
        select: { createdAt: true, type: true, quantity: true }
      }),
      db.product.groupBy({ by: ["categoryId"], _sum: { quantity: true }, _count: true }),
      db.category.findMany(),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioDoMes } },
        _sum: { totalPrice: true, costAtSale: true, quantity: true }
      }),
      valorDoEstoque()
    ]);
    const dia = (d) => inicioDoDia(d).toISOString().slice(0, 10);
    const baldes = /* @__PURE__ */ new Map();
    for (let i = 0; i < dias; i += 1) {
      const chave = dia(somarDias(inicioGrafico, i));
      baldes.set(chave, { date: chave, vendas: 0, faturamento: 0, entradas: 0, saidas: 0 });
    }
    for (const venda of vendasDoPeriodo) {
      const balde = baldes.get(dia(venda.saleDate));
      if (!balde) continue;
      balde.vendas += venda.quantity;
      balde.faturamento += numero(venda.totalPrice);
    }
    for (const mov of movimentosDoPeriodo) {
      const balde = baldes.get(dia(mov.createdAt));
      if (!balde) continue;
      if (mov.type === "ENTRADA") balde.entradas += mov.quantity;
      if (mov.type === "SAIDA") balde.saidas += mov.quantity;
    }
    const receitaHoje = numero(faturamentoHoje._sum.totalPrice);
    const custoHoje = numero(faturamentoHoje._sum.costAtSale);
    const receitaMes = numero(mes._sum.totalPrice);
    res.json(
      limpar({
        cards: {
          totalProducts: totalProdutos,
          itemsInStock: somaEstoque._sum.quantity ?? 0,
          soldToday: vendidosHoje._sum.quantity ?? 0,
          salesCountToday: vendidosHoje._count,
          revenueToday: receitaHoje,
          profitToday: receitaHoje - custoHoje,
          stockValueCost: valor.custo,
          stockValueSale: valor.venda,
          lowStockCount: estoqueBaixo.length,
          outOfStockCount: semEstoque,
          revenueMonth: receitaMes,
          profitMonth: receitaMes - numero(mes._sum.costAtSale),
          itemsSoldMonth: mes._sum.quantity ?? 0
        },
        chart: Array.from(baldes.values()),
        categories: porCategoria.map((linha) => {
          const categoria = categorias.find((c) => c.id === linha.categoryId);
          return {
            categoryId: linha.categoryId,
            name: categoria?.name ?? "Sem categoria",
            color: categoria?.color ?? "#64748B",
            products: linha._count,
            quantity: linha._sum.quantity ?? 0
          };
        }),
        lowStockProducts: estoqueBaixo.map((p) => ({
          ...p,
          photos: p.photos.map((f) => `/api/fotos/${f.id}`)
        })),
        latestSales: ultimasVendas
      })
    );
  })
);
rotasDashboard.get(
  "/alerts",
  rota(async (_req, res) => {
    const idsBaixos = await idsComEstoqueBaixo(20);
    const [estoqueBaixo, semEstoque, vendasHoje, valor] = await Promise.all([
      db.product.findMany({
        where: { id: { in: idsBaixos } },
        select: { id: true, name: true, quantity: true, minQuantity: true, model: true },
        orderBy: { quantity: "asc" }
      }),
      db.product.findMany({
        where: { quantity: 0 },
        select: { id: true, name: true, model: true },
        take: 20
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioDoDia(), lte: fimDoDia() } },
        select: {
          id: true,
          customerName: true,
          totalPrice: true,
          quantity: true,
          saleDate: true,
          product: { select: { name: true } }
        },
        orderBy: { saleDate: "desc" }
      }),
      valorDoEstoque()
    ]);
    res.json(
      limpar({
        lowStock: estoqueBaixo,
        outOfStock: semEstoque,
        soldToday: vendasHoje,
        soldTodayCount: vendasHoje.reduce((s, v) => s + v.quantity, 0),
        revenueToday: vendasHoje.reduce((s, v) => s + numero(v.totalPrice), 0),
        stockValue: valor.venda,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      })
    );
  })
);

// server/produtos.ts
import { Router as Router5 } from "express";
import { z as z4 } from "zod";
var rotasProdutos = Router5();
rotasProdutos.use(autenticar);
var COM_RELACOES = {
  category: true,
  supplier: true,
  photos: { select: { id: true }, orderBy: { createdAt: "asc" } }
};
function formatar(produto) {
  return limpar({ ...produto, photos: produto.photos.map((f) => `/api/fotos/${f.id}`) });
}
var ORDENAVEIS = [
  "name",
  "brand",
  "model",
  "quantity",
  "costPrice",
  "salePrice",
  "status",
  "entryDate",
  "createdAt",
  "category.name",
  "supplier.name"
];
var texto2 = z4.string().trim().max(500).optional().nullable().transform((v) => v || null);
var dinheiro = z4.coerce.number().min(0, "O valor n\xE3o pode ser negativo").max(99999999);
var foto = z4.string().max(4e6);
var produtoSchema = z4.object({
  name: z4.string().trim().min(2, "Informe o nome do produto").max(180),
  categoryId: z4.string().uuid("Selecione uma categoria"),
  supplierId: z4.string().uuid().optional().nullable().or(z4.literal("").transform(() => null)),
  brand: texto2,
  model: texto2,
  color: texto2,
  capacity: texto2,
  lote: texto2,
  quantity: z4.coerce.number().int().min(0, "A quantidade n\xE3o pode ser negativa").default(0),
  minQuantity: z4.coerce.number().int().min(0).default(1),
  costPrice: dinheiro.default(0),
  salePrice: dinheiro.default(0),
  imei: texto2,
  serialNumber: texto2,
  barcode: texto2,
  notes: z4.string().trim().max(2e3).optional().nullable(),
  status: z4.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).default("EM_ESTOQUE"),
  entryDate: z4.coerce.date().optional(),
  photos: z4.array(foto).max(8).optional()
});
var alterarSchema = produtoSchema.partial().extend({ reason: z4.string().trim().max(200).optional() });
var filtrosSchema = z4.object({
  page: z4.coerce.number().int().min(1).optional(),
  pageSize: z4.coerce.number().int().min(1).max(200).optional(),
  search: z4.string().trim().optional(),
  categoryId: z4.string().uuid().optional(),
  supplierId: z4.string().uuid().optional(),
  status: z4.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).optional(),
  brand: z4.string().trim().optional(),
  model: z4.string().trim().optional(),
  lowStock: z4.enum(["true", "false"]).optional(),
  sortBy: z4.string().optional(),
  sortOrder: z4.enum(["asc", "desc"]).optional()
});
async function filtrarProdutos(q) {
  const cond = [];
  if (q.search) {
    cond.push({
      OR: [
        { name: contem(q.search) },
        { brand: contem(q.search) },
        { model: contem(q.search) },
        { imei: contem(q.search) },
        { serialNumber: contem(q.search) },
        { lote: contem(q.search) },
        { barcode: contem(q.search) },
        { color: contem(q.search) },
        { supplier: { name: contem(q.search) } },
        { category: { name: contem(q.search) } }
      ]
    });
  }
  if (q.categoryId) cond.push({ categoryId: q.categoryId });
  if (q.supplierId) cond.push({ supplierId: q.supplierId });
  if (q.status) cond.push({ status: q.status });
  if (q.brand) cond.push({ brand: contem(q.brand) });
  if (q.model) cond.push({ model: contem(q.model) });
  if (q.lowStock === "true") cond.push({ id: { in: await idsComEstoqueBaixo(500) } });
  return cond.length ? { AND: cond } : {};
}
function separarFotos(fotos) {
  const manter = [];
  const novas = [];
  for (const item of fotos) {
    const base64 = item.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (base64) {
      novas.push({ mimeType: base64[1], data: Buffer.from(base64[2], "base64") });
      continue;
    }
    const id = item.match(/\/api\/fotos\/([0-9a-f-]{36})$/i);
    if (id) manter.push(id[1]);
  }
  return { manter, novas };
}
rotasProdutos.get(
  "/search",
  rota(async (req, res) => {
    const termo = String(req.query.q ?? "").trim();
    if (termo.length < 2) {
      res.json({ products: [], sales: [], customers: [] });
      return;
    }
    const t = contem(termo);
    const [produtos, vendas, clientes] = await Promise.all([
      db.product.findMany({
        where: {
          OR: [
            { name: t },
            { brand: t },
            { model: t },
            { imei: t },
            { serialNumber: t },
            { lote: t },
            { barcode: t },
            { supplier: { name: t } }
          ]
        },
        include: COM_RELACOES,
        take: 8,
        orderBy: { updatedAt: "desc" }
      }),
      db.sale.findMany({
        where: { OR: [{ customerName: t }, { customerPhone: t }, { product: { name: t } }] },
        include: { product: { select: { name: true } } },
        take: 5,
        orderBy: { saleDate: "desc" }
      }),
      db.customer.findMany({
        where: { OR: [{ name: t }, { phone: t }] },
        take: 5,
        orderBy: { name: "asc" }
      })
    ]);
    res.json({
      products: produtos.map(formatar),
      sales: limpar(vendas),
      customers: limpar(clientes)
    });
  })
);
rotasProdutos.get(
  "/filters",
  rota(async (_req, res) => {
    const [marcas, modelos] = await Promise.all([
      db.product.findMany({
        where: { brand: { not: null } },
        distinct: ["brand"],
        select: { brand: true },
        orderBy: { brand: "asc" }
      }),
      db.product.findMany({
        where: { model: { not: null } },
        distinct: ["model"],
        select: { model: true },
        orderBy: { model: "asc" }
      })
    ]);
    res.json({
      brands: marcas.map((m) => m.brand).filter(Boolean),
      models: modelos.map((m) => m.model).filter(Boolean)
    });
  })
);
rotasProdutos.get(
  "/",
  rota(async (req, res) => {
    const q = validar(filtrosSchema, req.query);
    const p = paginacao(q);
    const where = await filtrarProdutos(q);
    const [lista, total] = await Promise.all([
      db.product.findMany({
        where,
        include: COM_RELACOES,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(q.sortBy, q.sortOrder, ORDENAVEIS, { createdAt: "desc" })
      }),
      db.product.count({ where })
    ]);
    res.json(paginado(lista.map(formatar), total, p));
  })
);
rotasProdutos.get(
  "/:id",
  rota(async (req, res) => {
    const produto = await db.product.findUnique({
      where: { id: req.params.id },
      include: {
        ...COM_RELACOES,
        movements: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true } } }
        },
        sales: { orderBy: { saleDate: "desc" }, take: 10 }
      }
    });
    if (!produto) throw naoEncontrado("Produto");
    res.json(formatar(produto));
  })
);
rotasProdutos.post(
  "/",
  rota(async (req, res) => {
    const { photos, ...dados } = validar(produtoSchema, req.body);
    const { novas } = separarFotos(photos ?? []);
    const produto = await db.product.create({
      data: {
        ...dados,
        supplierId: dados.supplierId || null,
        photos: novas.length ? { create: novas } : void 0
      },
      include: COM_RELACOES
    });
    if (produto.quantity > 0) {
      await registrarMovimentacao({
        tipo: "ENTRADA",
        quantidade: produto.quantity,
        saldo: produto.quantity,
        motivo: "Cadastro de produto",
        produto,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome
      });
    }
    await registrarLog({ acao: "CREATE", entidade: "Product", id: produto.id, req });
    res.status(201).json(formatar(produto));
  })
);
rotasProdutos.put(
  "/:id",
  rota(async (req, res) => {
    const { photos, reason, ...dados } = validar(alterarSchema, req.body);
    const atual = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!atual) throw naoEncontrado("Produto");
    const produto = await db.$transaction(async (tx) => {
      if (photos) {
        const { manter, novas } = separarFotos(photos);
        await tx.productPhoto.deleteMany({
          where: { productId: atual.id, id: { notIn: manter.length ? manter : ["-"] } }
        });
        if (novas.length) {
          await tx.productPhoto.createMany({
            data: novas.map((f) => ({ ...f, productId: atual.id }))
          });
        }
      }
      return tx.product.update({
        where: { id: atual.id },
        data: {
          ...dados,
          supplierId: dados.supplierId === void 0 ? void 0 : dados.supplierId || null
        },
        include: COM_RELACOES
      });
    });
    const diferenca = produto.quantity - atual.quantity;
    await registrarMovimentacao({
      tipo: diferenca > 0 ? "ENTRADA" : diferenca < 0 ? "SAIDA" : "AJUSTE",
      quantidade: Math.abs(diferenca),
      saldo: produto.quantity,
      motivo: reason ?? (diferenca ? "Altera\xE7\xE3o manual do produto" : "Altera\xE7\xE3o de cadastro"),
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({ acao: "UPDATE", entidade: "Product", id: produto.id, req });
    res.json(formatar(produto));
  })
);
rotasProdutos.patch(
  "/:id/stock",
  rota(async (req, res) => {
    const { quantity, reason } = validar(
      z4.object({
        quantity: z4.coerce.number().int().refine((v) => v !== 0, "Informe uma quantidade diferente de zero"),
        reason: z4.string().trim().min(3, "Informe o motivo do ajuste").max(200)
      }),
      req.body
    );
    const atual = await db.product.findUnique({ where: { id: req.params.id } });
    if (!atual) throw naoEncontrado("Produto");
    const novaQuantidade = Math.max(0, atual.quantity + quantity);
    const produto = await db.product.update({
      where: { id: atual.id },
      data: { quantity: novaQuantidade },
      include: COM_RELACOES
    });
    await registrarMovimentacao({
      tipo: quantity > 0 ? "ENTRADA" : "SAIDA",
      quantidade: Math.abs(quantity),
      saldo: novaQuantidade,
      motivo: reason,
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({
      acao: "ADJUST_STOCK",
      entidade: "Product",
      id: produto.id,
      alteracoes: { de: atual.quantity, para: novaQuantidade, motivo: reason },
      req
    });
    res.json(formatar(produto));
  })
);
rotasProdutos.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const produto = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!produto) throw naoEncontrado("Produto");
    await registrarMovimentacao({
      tipo: "EXCLUSAO",
      quantidade: produto.quantity,
      saldo: 0,
      motivo: req.query.reason || "Produto exclu\xEDdo do sistema",
      produto,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    const vendas = await db.sale.count({ where: { productId: produto.id } });
    if (vendas > 0) {
      await db.product.update({
        where: { id: produto.id },
        data: { quantity: 0, status: "VENDIDO" }
      });
      await registrarLog({ acao: "ARCHIVE", entidade: "Product", id: produto.id, req });
      res.json({
        message: "Produto possui vendas registradas: estoque zerado e arquivado como vendido.",
        archived: true
      });
      return;
    }
    await db.product.delete({ where: { id: produto.id } });
    await registrarLog({ acao: "DELETE", entidade: "Product", id: produto.id, req });
    res.json({ message: "Produto exclu\xEDdo com sucesso", archived: false });
  })
);
var rotasFotos = Router5();
rotasFotos.get(
  "/:id",
  rota(async (req, res) => {
    const foto2 = await db.productPhoto.findUnique({ where: { id: req.params.id } });
    if (!foto2) throw naoEncontrado("Foto");
    res.setHeader("Content-Type", foto2.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(foto2.data));
  })
);

// server/relatorios.ts
import { Router as Router6 } from "express";
import { z as z5 } from "zod";

// server/exportar.ts
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
var AZUL = "#0F172A";
var valorDaCelula = (c, linha) => {
  const bruto = linha[c.key];
  if (c.format) return c.format(bruto);
  if (bruto === null || bruto === void 0) return "";
  if (bruto instanceof Date) return bruto.toLocaleDateString("pt-BR");
  return typeof bruto === "number" ? bruto : String(bruto);
};
function nomeDoArquivo(titulo, ext) {
  const data = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const apelido2 = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${apelido2}-${data}.${ext}`;
}
function enviarCsv(res, r) {
  const escapar = (v) => {
    const texto3 = String(v ?? "");
    return /[";\n]/.test(texto3) ? `"${texto3.replace(/"/g, '""')}"` : texto3;
  };
  const linhas = [r.columns.map((c) => escapar(c.header)).join(";")];
  for (const linha of r.rows) {
    linhas.push(r.columns.map((c) => escapar(valorDaCelula(c, linha))).join(";"));
  }
  if (r.summary?.length) {
    linhas.push("");
    r.summary.forEach((s) => linhas.push(`${escapar(s.label)};${escapar(s.value)}`));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeDoArquivo(r.title, "csv")}"`);
  res.send(`\uFEFF${linhas.join("\n")}`);
}
async function enviarExcel(res, r) {
  const planilha = new ExcelJS.Workbook();
  planilha.creator = "Controle Rafa Multimarcas";
  planilha.created = /* @__PURE__ */ new Date();
  const aba = planilha.addWorksheet(r.title.slice(0, 30) || "Relat\xF3rio", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  aba.columns = r.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(14, c.header.length + 4)
  }));
  aba.getRow(1).eachCell((celula) => {
    celula.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    celula.alignment = { vertical: "middle", horizontal: "center" };
  });
  aba.getRow(1).height = 22;
  for (const linha of r.rows) {
    aba.addRow(Object.fromEntries(r.columns.map((c) => [c.key, valorDaCelula(c, linha)])));
  }
  aba.eachRow((linha, indice) => {
    if (indice === 1) return;
    linha.eachCell((celula) => {
      celula.alignment = { vertical: "middle" };
      if (indice % 2 === 0) {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      }
    });
  });
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: r.columns.length } };
  if (r.summary?.length) {
    aba.addRow([]);
    r.summary.forEach((s) => {
      aba.addRow([s.label, s.value]).getCell(1).font = { bold: true };
    });
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeDoArquivo(r.title, "xlsx")}"`);
  await planilha.xlsx.write(res);
  res.end();
}
function enviarPdf(res, r) {
  const doc = new PDFDocument({ margin: 32, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeDoArquivo(r.title, "pdf")}"`);
  doc.pipe(res);
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x0 = doc.page.margins.left;
  doc.rect(0, 0, doc.page.width, 62).fill(AZUL);
  doc.fillColor("#FFFFFF").fontSize(17).font("Helvetica-Bold").text("Rafa Multimarcas", x0, 16);
  doc.fontSize(10).font("Helvetica").text(r.title, x0, 38);
  doc.fontSize(8).text(`Gerado em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")}`, x0, 38, {
    width: largura,
    align: "right"
  });
  doc.fillColor(AZUL).y = 78;
  if (r.subtitle) {
    doc.fontSize(9).fillColor("#475569").text(r.subtitle, x0, doc.y);
    doc.moveDown(0.5);
  }
  const peso = r.columns.reduce((s, c) => s + (c.width ?? 16), 0);
  const larguras = r.columns.map((c) => (c.width ?? 16) / peso * largura);
  const cabecalho = () => {
    const y = doc.y;
    doc.rect(x0, y, largura, 20).fill("#E2E8F0");
    doc.fillColor(AZUL).fontSize(8).font("Helvetica-Bold");
    let x = x0;
    r.columns.forEach((c, i) => {
      doc.text(c.header.toUpperCase(), x + 4, y + 6, {
        width: larguras[i] - 8,
        align: c.align ?? "left",
        lineBreak: false
      });
      x += larguras[i];
    });
    doc.y = y + 20;
  };
  cabecalho();
  doc.font("Helvetica").fontSize(8);
  r.rows.forEach((linha, indice) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      cabecalho();
      doc.font("Helvetica").fontSize(8);
    }
    const y = doc.y;
    if (indice % 2 === 1) doc.rect(x0, y, largura, 16).fill("#F8FAFC");
    doc.fillColor("#1E293B");
    let x = x0;
    r.columns.forEach((c, i) => {
      doc.text(String(valorDaCelula(c, linha) ?? ""), x + 4, y + 4, {
        width: larguras[i] - 8,
        align: c.align ?? "left",
        lineBreak: false,
        ellipsis: true
      });
      x += larguras[i];
    });
    doc.y = y + 16;
  });
  if (r.summary?.length) {
    doc.moveDown(1);
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(AZUL).text("Resumo", x0, doc.y);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    r.summary.forEach((s) => {
      doc.text(`${s.label}: ${s.value}`, x0, doc.y);
      doc.moveDown(0.2);
    });
  }
  doc.end();
}
async function exportar(res, formato, r) {
  if (formato === "pdf") return enviarPdf(res, r);
  if (formato === "csv") return enviarCsv(res, r);
  if (formato === "xlsx" || formato === "excel") return enviarExcel(res, r);
  res.json(r);
}
var reais = (v) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
var decimal = (v) => Number(v ?? 0).toFixed(2).replace(".", ",");

// server/relatorios.ts
var rotasRelatorios = Router6();
rotasRelatorios.use(autenticar);
var base = z5.object({
  format: z5.enum(["json", "pdf", "xlsx", "csv"]).default("json"),
  startDate: z5.coerce.date().optional(),
  endDate: z5.coerce.date().optional(),
  categoryId: z5.string().uuid().optional(),
  supplierId: z5.string().uuid().optional(),
  status: z5.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).optional(),
  paymentMethod: z5.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA"]).optional()
});
var PAGAMENTO_LABEL = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  DEBITO: "D\xE9bito",
  CREDITO: "Cr\xE9dito",
  TRANSFERENCIA: "Transfer\xEAncia"
};
var periodo = (q) => {
  if (!q.startDate && !q.endDate) return "Per\xEDodo: todos os registros";
  return `Per\xEDodo: ${q.startDate ? dataBR(q.startDate) : "in\xEDcio"} at\xE9 ${q.endDate ? dataBR(q.endDate) : "hoje"}`;
};
var money = (header, key, width = 12) => ({
  header,
  key,
  width,
  align: "right",
  format: decimal
});
var qtd = (header, key, width = 8) => ({
  header,
  key,
  width,
  align: "right"
});
rotasRelatorios.get(
  "/stock",
  rota(async (req, res) => {
    const q = validar(base, req.query);
    const entrada = intervalo(q.startDate, q.endDate);
    const produtos = await db.product.findMany({
      where: {
        ...q.categoryId ? { categoryId: q.categoryId } : {},
        ...q.supplierId ? { supplierId: q.supplierId } : {},
        ...q.status ? { status: q.status } : {},
        ...entrada ? { entryDate: entrada } : {}
      },
      include: { category: true, supplier: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }]
    });
    const linhas = produtos.map((p) => ({
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? "\u2014",
      model: p.model ?? "\u2014",
      lote: p.lote ?? "\u2014",
      quantity: p.quantity,
      costPrice: numero(p.costPrice),
      salePrice: numero(p.salePrice),
      totalCost: numero(p.costPrice) * p.quantity,
      totalSale: numero(p.salePrice) * p.quantity,
      supplier: p.supplier?.name ?? "\u2014",
      status: STATUS_LABEL[p.status] ?? p.status,
      entryDate: dataBR(p.entryDate)
    }));
    const custo = linhas.reduce((s, l) => s + l.totalCost, 0);
    const venda = linhas.reduce((s, l) => s + l.totalSale, 0);
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Estoque",
      subtitle: periodo(q),
      columns: [
        { header: "Produto", key: "name", width: 26 },
        { header: "Categoria", key: "category", width: 14 },
        { header: "Marca", key: "brand", width: 12 },
        { header: "Modelo", key: "model", width: 14 },
        { header: "Lote", key: "lote", width: 12 },
        qtd("Qtd", "quantity", 6),
        money("Custo", "costPrice", 11),
        money("Venda", "salePrice", 11),
        money("Total custo", "totalCost"),
        money("Total venda", "totalSale"),
        { header: "Fornecedor", key: "supplier", width: 18 },
        { header: "Status", key: "status", width: 12 },
        { header: "Entrada", key: "entryDate", width: 11 }
      ],
      rows: linhas,
      summary: [
        { label: "Produtos listados", value: String(linhas.length) },
        { label: "Itens em estoque", value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: "Valor total (custo)", value: reais(custo) },
        { label: "Valor total (venda)", value: reais(venda) },
        { label: "Lucro potencial", value: reais(venda - custo) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/sales",
  rota(async (req, res) => {
    const q = validar(base, req.query);
    const quando = intervalo(q.startDate, q.endDate);
    const vendas = await db.sale.findMany({
      where: {
        ...quando ? { saleDate: quando } : {},
        ...q.paymentMethod ? { paymentMethod: q.paymentMethod } : {},
        ...q.categoryId ? { product: { categoryId: q.categoryId } } : {},
        ...q.supplierId ? { product: { supplierId: q.supplierId } } : {}
      },
      include: { product: { include: { category: true } }, user: { select: { name: true } } },
      orderBy: { saleDate: "desc" }
    });
    const linhas = vendas.map((v) => {
      const total = numero(v.totalPrice);
      return {
        date: dataHoraBR(v.saleDate),
        customer: v.customerName ?? "\u2014",
        phone: v.customerPhone ?? "\u2014",
        product: v.product.name,
        category: v.product.category.name,
        quantity: v.quantity,
        unitPrice: numero(v.unitPrice),
        total,
        profit: total - numero(v.costAtSale) * v.quantity,
        payment: PAGAMENTO_LABEL[v.paymentMethod] ?? v.paymentMethod,
        user: v.user?.name ?? "\u2014"
      };
    });
    const faturamento = linhas.reduce((s, l) => s + l.total, 0);
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Vendas",
      subtitle: periodo(q),
      columns: [
        { header: "Data", key: "date", width: 14 },
        { header: "Cliente", key: "customer", width: 20 },
        { header: "Telefone", key: "phone", width: 13 },
        { header: "Produto", key: "product", width: 24 },
        { header: "Categoria", key: "category", width: 13 },
        qtd("Qtd", "quantity", 6),
        money("Valor unit.", "unitPrice", 11),
        money("Total", "total", 11),
        money("Lucro", "profit", 11),
        { header: "Pagamento", key: "payment", width: 13 },
        { header: "Vendedor", key: "user", width: 14 }
      ],
      rows: linhas,
      summary: [
        { label: "Vendas realizadas", value: String(linhas.length) },
        { label: "Itens vendidos", value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: "Faturamento", value: reais(faturamento) },
        { label: "Lucro bruto", value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: "Ticket m\xE9dio", value: reais(linhas.length ? faturamento / linhas.length : 0) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/by-category",
  rota(async (req, res) => {
    const q = validar(base, req.query);
    const quando = intervalo(q.startDate, q.endDate);
    const [categorias, vendas] = await Promise.all([
      db.category.findMany({
        include: { products: { select: { quantity: true, costPrice: true, salePrice: true } } },
        orderBy: { name: "asc" }
      }),
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { categoryId: true } }
        }
      })
    ]);
    const linhas = categorias.map((c) => {
      const daCategoria = vendas.filter((v) => v.product.categoryId === c.id);
      const faturamento = daCategoria.reduce((s, v) => s + numero(v.totalPrice), 0);
      const custo = daCategoria.reduce((s, v) => s + numero(v.costAtSale) * v.quantity, 0);
      return {
        category: c.name,
        products: c.products.length,
        stockQty: c.products.reduce((s, p) => s + p.quantity, 0),
        stockCost: c.products.reduce((s, p) => s + numero(p.costPrice) * p.quantity, 0),
        stockSale: c.products.reduce((s, p) => s + numero(p.salePrice) * p.quantity, 0),
        soldQty: daCategoria.reduce((s, v) => s + v.quantity, 0),
        revenue: faturamento,
        profit: faturamento - custo
      };
    });
    await exportar(res, q.format, {
      title: "Relat\xF3rio por Categoria",
      subtitle: periodo(q),
      columns: [
        { header: "Categoria", key: "category", width: 22 },
        qtd("Produtos", "products", 10),
        qtd("Em estoque", "stockQty", 10),
        money("Estoque (custo)", "stockCost", 14),
        money("Estoque (venda)", "stockSale", 14),
        qtd("Vendidos", "soldQty", 10),
        money("Faturamento", "revenue", 14),
        money("Lucro", "profit", 13)
      ],
      rows: linhas,
      summary: [
        { label: "Faturamento total", value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) },
        { label: "Lucro total", value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: "Valor em estoque (custo)", value: reais(linhas.reduce((s, l) => s + l.stockCost, 0)) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/by-supplier",
  rota(async (req, res) => {
    const q = validar(base, req.query);
    const quando = intervalo(q.startDate, q.endDate);
    const [fornecedores, vendas] = await Promise.all([
      db.supplier.findMany({
        include: { products: { select: { quantity: true, costPrice: true } } },
        orderBy: { name: "asc" }
      }),
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { supplierId: true } }
        }
      })
    ]);
    const linhas = fornecedores.map((f) => {
      const doFornecedor = vendas.filter((v) => v.product.supplierId === f.id);
      const faturamento = doFornecedor.reduce((s, v) => s + numero(v.totalPrice), 0);
      const custo = doFornecedor.reduce((s, v) => s + numero(v.costAtSale) * v.quantity, 0);
      return {
        supplier: f.name,
        active: f.active ? "Sim" : "N\xE3o",
        products: f.products.length,
        stockQty: f.products.reduce((s, p) => s + p.quantity, 0),
        invested: f.products.reduce((s, p) => s + numero(p.costPrice) * p.quantity, 0),
        soldQty: doFornecedor.reduce((s, v) => s + v.quantity, 0),
        revenue: faturamento,
        profit: faturamento - custo
      };
    });
    await exportar(res, q.format, {
      title: "Relat\xF3rio por Fornecedor",
      subtitle: periodo(q),
      columns: [
        { header: "Fornecedor", key: "supplier", width: 24 },
        { header: "Ativo", key: "active", width: 8, align: "center" },
        qtd("Produtos", "products", 10),
        qtd("Em estoque", "stockQty", 11),
        money("Investido", "invested", 14),
        qtd("Vendidos", "soldQty", 10),
        money("Faturamento", "revenue", 14),
        money("Lucro", "profit", 13)
      ],
      rows: linhas,
      summary: [
        { label: "Fornecedores", value: String(linhas.length) },
        { label: "Total investido", value: reais(linhas.reduce((s, l) => s + l.invested, 0)) },
        { label: "Faturamento", value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/by-period",
  rota(async (req, res) => {
    const q = validar(base.extend({ groupBy: z5.enum(["day", "month"]).default("day") }), req.query);
    const quando = intervalo(q.startDate, q.endDate);
    const [vendas, movimentos] = await Promise.all([
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: { saleDate: true, quantity: true, totalPrice: true, costAtSale: true },
        orderBy: { saleDate: "asc" }
      }),
      db.movement.findMany({
        where: quando ? { createdAt: quando } : {},
        select: { createdAt: true, type: true, quantity: true }
      })
    ]);
    const chave = (d) => q.groupBy === "month" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : d.toISOString().slice(0, 10);
    const mapa = /* @__PURE__ */ new Map();
    const balde = (k) => {
      if (!mapa.has(k)) {
        mapa.set(k, { period: k, sales: 0, quantity: 0, revenue: 0, profit: 0, entries: 0, exits: 0 });
      }
      return mapa.get(k);
    };
    for (const v of vendas) {
      const b = balde(chave(v.saleDate));
      b.sales += 1;
      b.quantity += v.quantity;
      b.revenue += numero(v.totalPrice);
      b.profit += numero(v.totalPrice) - numero(v.costAtSale) * v.quantity;
    }
    for (const m of movimentos) {
      const b = balde(chave(m.createdAt));
      if (m.type === "ENTRADA") b.entries += m.quantity;
      if (m.type === "SAIDA") b.exits += m.quantity;
    }
    const linhas = Array.from(mapa.values()).sort((a, b) => a.period.localeCompare(b.period)).map((l) => ({
      ...l,
      periodLabel: q.groupBy === "month" ? l.period.split("-").reverse().join("/") : dataBR(/* @__PURE__ */ new Date(`${l.period}T12:00:00`))
    }));
    await exportar(res, q.format, {
      title: "Relat\xF3rio por Per\xEDodo",
      subtitle: periodo(q),
      columns: [
        { header: q.groupBy === "month" ? "M\xEAs" : "Dia", key: "periodLabel", width: 12 },
        qtd("Vendas", "sales", 9),
        qtd("Itens", "quantity", 9),
        money("Faturamento", "revenue", 14),
        money("Lucro", "profit", 13),
        qtd("Entradas", "entries", 10),
        qtd("Sa\xEDdas", "exits", 10)
      ],
      rows: linhas,
      summary: [
        { label: "Faturamento total", value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) },
        { label: "Lucro total", value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: "Itens vendidos", value: String(linhas.reduce((s, l) => s + l.quantity, 0)) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/movements",
  rota(async (req, res) => {
    const q = validar(
      base.extend({ type: z5.enum(["ENTRADA", "SAIDA", "AJUSTE", "EXCLUSAO"]).optional() }),
      req.query
    );
    const quando = intervalo(q.startDate, q.endDate);
    const movimentos = await db.movement.findMany({
      where: {
        ...quando ? { createdAt: quando } : {},
        ...q.type ? { type: q.type } : {},
        ...q.categoryId ? { product: { categoryId: q.categoryId } } : {}
      },
      include: {
        user: { select: { name: true } },
        product: { select: { model: true, category: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    const linhas = movimentos.map((m) => ({
      date: dataHoraBR(m.createdAt),
      type: TIPO_LABEL[m.type] ?? m.type,
      product: m.productName ?? "\u2014",
      category: m.product?.category.name ?? "\u2014",
      model: m.product?.model ?? "\u2014",
      quantity: m.quantity,
      balance: m.balanceAfter ?? "\u2014",
      reason: m.reason ?? "\u2014",
      user: m.user?.name ?? "\u2014"
    }));
    const somaPor = (tipo) => movimentos.filter((m) => m.type === tipo).reduce((s, m) => s + m.quantity, 0);
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Movimenta\xE7\xF5es",
      subtitle: periodo(q),
      columns: [
        { header: "Data", key: "date", width: 15 },
        { header: "Tipo", key: "type", width: 10 },
        { header: "Produto", key: "product", width: 24 },
        { header: "Categoria", key: "category", width: 13 },
        { header: "Modelo", key: "model", width: 13 },
        qtd("Qtd", "quantity", 6),
        qtd("Saldo", "balance", 7),
        { header: "Motivo", key: "reason", width: 24 },
        { header: "Usu\xE1rio", key: "user", width: 14 }
      ],
      rows: linhas,
      summary: [
        { label: "Movimenta\xE7\xF5es", value: String(linhas.length) },
        { label: "Entradas", value: String(somaPor("ENTRADA")) },
        { label: "Sa\xEDdas", value: String(somaPor("SAIDA")) }
      ]
    });
  })
);

// server/sistema.ts
import ExcelJS2 from "exceljs";
import { Router as Router7 } from "express";
import multer from "multer";
import { Readable } from "stream";
var rotasSistema = Router7();
rotasSistema.use(autenticar);
rotasSistema.get(
  "/sheets/status",
  rota(async (_req, res) => {
    res.json(statusPlanilha());
  })
);
rotasSistema.post(
  "/sheets/sync",
  somenteAdmin,
  rota(async (req, res) => {
    if (!planilhaConfigurada()) {
      throw new AppError("Integra\xE7\xE3o com Google Sheets n\xE3o configurada. Preencha as vari\xE1veis GOOGLE_* no .env.");
    }
    const movimentos = await db.movement.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { name: true } },
        product: { include: { category: true, supplier: true } }
      }
    });
    const total = await reescreverPlanilha(
      movimentos.map((m) => ({
        data: m.createdAt,
        categoria: m.product?.category.name ?? "\u2014",
        produto: m.productName ?? m.product?.name ?? "\u2014",
        marca: m.product?.brand ?? "",
        modelo: m.product?.model ?? "",
        quantidade: m.quantity,
        custo: numero(m.product?.costPrice),
        venda: numero(m.product?.salePrice),
        fornecedor: m.product?.supplier?.name ?? "",
        status: m.product ? STATUS_LABEL[m.product.status] ?? m.product.status : "Exclu\xEDdo",
        tipo: TIPO_LABEL[m.type],
        usuario: m.user?.name ?? ""
      }))
    );
    await registrarLog({ acao: "SHEETS_SYNC", entidade: "Setting", req });
    res.json({ message: `${total} movimenta\xE7\xE3o(\xF5es) sincronizadas com a planilha.`, synced: total });
  })
);
rotasSistema.get(
  "/backup",
  somenteAdmin,
  rota(async (req, res) => {
    const [categorias, fornecedores, clientes, produtos, vendas, movimentos, usuarios] = await Promise.all([
      db.category.findMany(),
      db.supplier.findMany(),
      db.customer.findMany(),
      // As imagens ficam de fora: o backup viraria centenas de megabytes.
      db.product.findMany(),
      db.sale.findMany(),
      db.movement.findMany(),
      db.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } })
    ]);
    const backup = limpar({
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      system: "Controle Rafa Multimarcas",
      counts: {
        categories: categorias.length,
        suppliers: fornecedores.length,
        customers: clientes.length,
        products: produtos.length,
        sales: vendas.length,
        movements: movimentos.length,
        users: usuarios.length
      },
      data: {
        categories: categorias,
        suppliers: fornecedores,
        customers: clientes,
        products: produtos,
        sales: vendas,
        movements: movimentos,
        users: usuarios
      }
    });
    await registrarLog({ acao: "BACKUP", entidade: "Setting", req });
    const carimbo = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="backup-rafa-${carimbo}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  })
);
var CABECALHOS = [
  "Categoria",
  "Nome",
  "Marca",
  "Modelo",
  "Cor",
  "Capacidade",
  "Quantidade",
  "Pre\xE7o de Custo",
  "Pre\xE7o de Venda",
  "Fornecedor",
  "IMEI",
  "N\xFAmero de S\xE9rie",
  "Lote",
  "Observa\xE7\xF5es"
];
var DE_PARA = {
  categoria: "category",
  nome: "name",
  produto: "name",
  marca: "brand",
  modelo: "model",
  cor: "color",
  capacidade: "capacity",
  quantidade: "quantity",
  qtd: "quantity",
  "preco de custo": "costPrice",
  "pre\xE7o de custo": "costPrice",
  custo: "costPrice",
  "preco de venda": "salePrice",
  "pre\xE7o de venda": "salePrice",
  venda: "salePrice",
  fornecedor: "supplier",
  imei: "imei",
  "numero de serie": "serialNumber",
  "n\xFAmero de s\xE9rie": "serialNumber",
  serie: "serialNumber",
  lote: "lote",
  "lote da caixa": "lote",
  "codigo de barras": "barcode",
  "c\xF3digo de barras": "barcode",
  observacoes: "notes",
  observa\u00E7\u00F5es: "notes",
  obs: "notes"
};
var semAcento = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
function paraNumero(v) {
  if (v === null || v === void 0 || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function textoDaCelula(celula) {
  const v = celula.value;
  if (v === null || v === void 0) return "";
  if (typeof v === "object" && "text" in v) return String(v.text ?? "").trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}
var planilhaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, arquivo, cb) => {
    if (!/\.(xlsx|xls|csv)$/i.test(arquivo.originalname)) {
      return cb(new AppError("Envie um arquivo .xlsx, .xls ou .csv"));
    }
    cb(null, true);
  }
});
rotasSistema.get(
  "/import/template",
  rota(async (_req, res) => {
    const arquivo = new ExcelJS2.Workbook();
    const aba = arquivo.addWorksheet("Produtos");
    aba.columns = CABECALHOS.map((h) => ({ header: h, key: h, width: 20 }));
    aba.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    aba.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    aba.addRow([
      "Celulares",
      "iPhone 13",
      "Apple",
      "13",
      "Meia-noite",
      "128GB",
      2,
      3200,
      4199,
      "Distribuidora Tech SP",
      "356938035643809",
      "",
      "",
      "Exemplo \u2014 apague esta linha"
    ]);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modelo-importacao-produtos.xlsx"');
    await arquivo.xlsx.write(res);
    res.end();
  })
);
rotasSistema.post(
  "/import/products",
  somenteAdmin,
  planilhaUpload.single("file"),
  rota(async (req, res) => {
    if (!req.file) throw new AppError('Envie a planilha no campo "file"');
    const arquivo = new ExcelJS2.Workbook();
    if (req.file.originalname.toLowerCase().endsWith(".csv")) {
      await arquivo.csv.read(Readable.from(req.file.buffer.toString("utf8")));
    } else {
      await arquivo.xlsx.load(req.file.buffer);
    }
    const aba = arquivo.worksheets[0];
    if (!aba) throw new AppError("A planilha est\xE1 vazia");
    const colunas = /* @__PURE__ */ new Map();
    aba.getRow(1).eachCell((celula, indice) => {
      const campo = DE_PARA[textoDaCelula(celula).toLowerCase().replace(/\s+/g, " ")];
      if (campo) colunas.set(indice, campo);
    });
    if (![...colunas.values()].includes("name")) {
      throw new AppError('N\xE3o encontrei a coluna "Nome". Baixe o modelo e mantenha os cabe\xE7alhos.');
    }
    const [categorias, fornecedores] = await Promise.all([
      db.category.findMany(),
      db.supplier.findMany()
    ]);
    const porCategoria = new Map(categorias.map((c) => [semAcento(c.name), c]));
    categorias.forEach((c) => porCategoria.set(semAcento(c.slug), c));
    const porFornecedor = new Map(fornecedores.map((f) => [semAcento(f.name), f]));
    const erros = [];
    let importados = 0;
    let processadas = 0;
    for (let n = 2; n <= aba.rowCount; n += 1) {
      const linha = aba.getRow(n);
      const dados = {};
      colunas.forEach((campo, indice) => {
        dados[campo] = textoDaCelula(linha.getCell(indice));
      });
      if (!dados.name) continue;
      processadas += 1;
      const categoria = porCategoria.get(semAcento(dados.category ?? ""));
      if (!categoria) {
        erros.push({
          row: n,
          message: `Categoria "${dados.category || "(vazia)"}" n\xE3o encontrada. Use: ${categorias.map((c) => c.name).join(", ")}`
        });
        continue;
      }
      let fornecedorId = null;
      if (dados.supplier) {
        const chave = semAcento(dados.supplier);
        let fornecedor = porFornecedor.get(chave);
        if (!fornecedor) {
          fornecedor = await db.supplier.create({ data: { name: dados.supplier.trim() } });
          porFornecedor.set(chave, fornecedor);
        }
        fornecedorId = fornecedor.id;
      }
      const quantidade = Math.max(0, Math.trunc(paraNumero(dados.quantity)));
      try {
        const produto = await db.product.create({
          data: {
            name: dados.name,
            brand: dados.brand || null,
            model: dados.model || null,
            color: dados.color || null,
            capacity: dados.capacity || null,
            quantity: quantidade,
            costPrice: paraNumero(dados.costPrice),
            salePrice: paraNumero(dados.salePrice),
            imei: dados.imei || null,
            serialNumber: dados.serialNumber || null,
            lote: dados.lote || null,
            barcode: dados.barcode || null,
            notes: dados.notes || null,
            categoryId: categoria.id,
            supplierId: fornecedorId
          },
          include: { category: true, supplier: true }
        });
        if (quantidade > 0) {
          await db.movement.create({
            data: {
              type: "ENTRADA",
              quantity: quantidade,
              balanceAfter: quantidade,
              reason: "Importa\xE7\xE3o de planilha",
              productId: produto.id,
              productName: produto.name,
              userId: req.usuario?.id ?? null
            }
          });
          enviarParaPlanilha(
            linhaDaPlanilha(produto, "ENTRADA", quantidade, req.usuario?.nome, quantidade)
          );
        }
        importados += 1;
      } catch (erro) {
        erros.push({ row: n, message: erro.message });
      }
    }
    await registrarLog({
      acao: "IMPORT",
      entidade: "Product",
      alteracoes: { importados, erros: erros.length },
      req
    });
    res.json({
      processed: processadas,
      imported: importados,
      errors: erros,
      message: `${importados} produto(s) importados com sucesso.`
    });
  })
);

// server/vendas.ts
import { Prisma as Prisma2 } from "@prisma/client";
import { Router as Router8 } from "express";
import { z as z6 } from "zod";
var rotasVendas = Router8();
rotasVendas.use(autenticar);
var COM_RELACOES2 = {
  product: { include: { category: true, supplier: true } },
  customer: true,
  user: { select: { id: true, name: true } }
};
var PAGAMENTOS = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA"];
var vendaSchema = z6.object({
  productId: z6.string().uuid("Selecione o produto"),
  customerName: z6.string().trim().min(2, "Informe o nome do cliente").max(180),
  customerPhone: z6.string().trim().max(30).optional().nullable().transform((v) => v || null),
  customerId: z6.string().uuid().optional().nullable(),
  quantity: z6.coerce.number().int().min(1, "A quantidade deve ser no m\xEDnimo 1"),
  unitPrice: z6.coerce.number().min(0, "Informe o valor vendido"),
  paymentMethod: z6.enum(PAGAMENTOS, { errorMap: () => ({ message: "Selecione a forma de pagamento" }) }),
  saleDate: z6.coerce.date().optional(),
  notes: z6.string().trim().max(1e3).optional().nullable()
});
var filtrosSchema2 = z6.object({
  page: z6.coerce.number().int().min(1).optional(),
  pageSize: z6.coerce.number().int().min(1).max(200).optional(),
  search: z6.string().trim().optional(),
  productId: z6.string().uuid().optional(),
  categoryId: z6.string().uuid().optional(),
  supplierId: z6.string().uuid().optional(),
  paymentMethod: z6.enum(PAGAMENTOS).optional(),
  startDate: z6.coerce.date().optional(),
  endDate: z6.coerce.date().optional(),
  sortBy: z6.string().optional(),
  sortOrder: z6.enum(["asc", "desc"]).optional()
});
function filtrarVendas(q) {
  const cond = [];
  if (q.search) {
    cond.push({
      OR: [
        { customerName: contem(q.search) },
        { customerPhone: contem(q.search) },
        { notes: contem(q.search) },
        { product: { name: contem(q.search) } },
        { product: { imei: contem(q.search) } },
        { product: { serialNumber: contem(q.search) } },
        { product: { model: contem(q.search) } },
        { product: { brand: contem(q.search) } }
      ]
    });
  }
  if (q.productId) cond.push({ productId: q.productId });
  if (q.categoryId) cond.push({ product: { categoryId: q.categoryId } });
  if (q.supplierId) cond.push({ product: { supplierId: q.supplierId } });
  if (q.paymentMethod) cond.push({ paymentMethod: q.paymentMethod });
  const periodo2 = intervalo(q.startDate, q.endDate);
  if (periodo2) cond.push({ saleDate: periodo2 });
  return cond.length ? { AND: cond } : {};
}
rotasVendas.get(
  "/",
  rota(async (req, res) => {
    const q = validar(filtrosSchema2, req.query);
    const p = paginacao(q);
    const where = filtrarVendas(q);
    const [lista, total, somas] = await Promise.all([
      db.sale.findMany({
        where,
        include: COM_RELACOES2,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(
          q.sortBy,
          q.sortOrder,
          ["saleDate", "totalPrice", "quantity", "createdAt", "customerName", "product.name"],
          { saleDate: "desc" }
        )
      }),
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalPrice: true, quantity: true } })
    ]);
    res.json(
      limpar({
        ...paginado(lista, total, p),
        totals: { revenue: somas._sum.totalPrice ?? 0, items: somas._sum.quantity ?? 0 }
      })
    );
  })
);
rotasVendas.get(
  "/:id",
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({ where: { id: req.params.id }, include: COM_RELACOES2 });
    if (!venda) throw naoEncontrado("Venda");
    res.json(limpar(venda));
  })
);
rotasVendas.post(
  "/",
  rota(async (req, res) => {
    const dados = validar(vendaSchema, req.body);
    const usuario = req.usuario;
    const resultado = await db.$transaction(async (tx) => {
      const produto = await tx.product.findUnique({
        where: { id: dados.productId },
        include: { category: true, supplier: true }
      });
      if (!produto) throw naoEncontrado("Produto");
      if (produto.quantity < dados.quantity) {
        throw new AppError(
          `Estoque insuficiente para "${produto.name}". Dispon\xEDvel: ${produto.quantity}.`
        );
      }
      const baixa = await tx.product.updateMany({
        where: { id: produto.id, quantity: { gte: dados.quantity } },
        data: { quantity: { decrement: dados.quantity } }
      });
      if (baixa.count === 0) {
        throw new AppError("O estoque mudou durante a opera\xE7\xE3o. Tente novamente.", 409);
      }
      const restante = produto.quantity - dados.quantity;
      if (restante === 0) {
        await tx.product.update({ where: { id: produto.id }, data: { status: "VENDIDO" } });
      }
      let clienteId = dados.customerId ?? null;
      if (!clienteId) {
        const existente = dados.customerPhone ? await tx.customer.findFirst({ where: { phone: dados.customerPhone } }) : await tx.customer.findFirst({
          where: { name: { equals: dados.customerName, mode: "insensitive" } }
        });
        clienteId = existente?.id ?? (await tx.customer.create({
          data: { name: dados.customerName, phone: dados.customerPhone ?? null }
        })).id;
      }
      const venda = await tx.sale.create({
        data: {
          productId: produto.id,
          customerId: clienteId,
          customerName: dados.customerName,
          customerPhone: dados.customerPhone ?? null,
          quantity: dados.quantity,
          unitPrice: new Prisma2.Decimal(dados.unitPrice),
          totalPrice: new Prisma2.Decimal(dados.unitPrice).mul(dados.quantity),
          // Guarda o custo do momento: o lucro histórico não muda depois.
          costAtSale: produto.costPrice,
          paymentMethod: dados.paymentMethod,
          saleDate: dados.saleDate ?? /* @__PURE__ */ new Date(),
          notes: dados.notes ?? null,
          userId: usuario?.id ?? null
        },
        include: COM_RELACOES2
      });
      await tx.movement.create({
        data: {
          type: "SAIDA",
          quantity: dados.quantity,
          balanceAfter: restante,
          reason: `Venda para ${dados.customerName}`,
          productId: produto.id,
          productName: produto.name,
          saleId: venda.id,
          userId: usuario?.id ?? null
        }
      });
      return { venda, produto, restante };
    });
    enviarParaPlanilha(
      linhaDaPlanilha(resultado.produto, "SAIDA", dados.quantity, usuario?.nome, resultado.restante)
    );
    await registrarLog({ acao: "CREATE", entidade: "Sale", id: resultado.venda.id, req });
    res.status(201).json(limpar(resultado.venda));
  })
);
rotasVendas.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const usuario = req.usuario;
    const resultado = await db.$transaction(async (tx) => {
      const venda = await tx.sale.findUnique({
        where: { id: req.params.id },
        include: { product: true }
      });
      if (!venda) throw naoEncontrado("Venda");
      const produto = await tx.product.update({
        where: { id: venda.productId },
        data: {
          quantity: { increment: venda.quantity },
          status: venda.product.status === "VENDIDO" ? "EM_ESTOQUE" : void 0
        },
        include: { category: true, supplier: true }
      });
      await tx.movement.create({
        data: {
          type: "ENTRADA",
          quantity: venda.quantity,
          balanceAfter: produto.quantity,
          reason: `Cancelamento de venda (${venda.customerName ?? "cliente"})`,
          productId: produto.id,
          productName: produto.name,
          userId: usuario?.id ?? null
        }
      });
      await tx.sale.delete({ where: { id: venda.id } });
      return { venda, produto };
    });
    enviarParaPlanilha(
      linhaDaPlanilha(
        resultado.produto,
        "ENTRADA",
        resultado.venda.quantity,
        usuario?.nome,
        resultado.produto.quantity
      )
    );
    await registrarLog({ acao: "DELETE", entidade: "Sale", id: req.params.id, req });
    res.json({ message: "Venda cancelada e estoque devolvido" });
  })
);

// server/app.ts
function createApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app2.use(compression());
  const lerJson = express.json({ limit: "12mb" });
  const lerFormulario = express.urlencoded({ extended: true });
  app2.use((req, res, next) => {
    if (req.body !== void 0) return next();
    lerJson(req, res, (erro) => erro ? next(erro) : lerFormulario(req, res, next));
  });
  app2.get(
    "/api/health",
    rota(async (_req, res) => {
      const ambiente2 = {
        node: process.version,
        plataforma: `${process.platform}-${process.arch}`,
        producao: process.env.NODE_ENV === "production",
        naVercel: Boolean(process.env.VERCEL)
      };
      if (!bancoConfigurado) {
        res.status(503).json({
          status: "sem configura\xE7\xE3o",
          problema: "A vari\xE1vel DATABASE_URL n\xE3o est\xE1 definida.",
          comoResolver: "Vercel \u2192 Settings \u2192 Environment Variables \u2192 adicione DATABASE_URL, depois Deployments \u2192 Redeploy.",
          ambiente: ambiente2
        });
        return;
      }
      if (!bancoIniciado) {
        res.status(503).json({
          status: "falha ao iniciar",
          problema: "O cliente do banco (Prisma) n\xE3o p\xF4de ser criado.",
          detalhe: erroDoBanco,
          comoResolver: 'Costuma ser o motor do Prisma faltando no pacote da fun\xE7\xE3o. Refa\xE7a o deploy sem cache: Deployments \u2192 \u22EF \u2192 Redeploy \u2192 desmarque "Use existing Build Cache".',
          ambiente: ambiente2
        });
        return;
      }
      try {
        await db.$queryRaw`SELECT 1`;
        const [produtos, usuarios] = await Promise.all([db.product.count(), db.user.count()]);
        res.json({ status: "ok", database: "conectado", produtos, usuarios, ambiente: ambiente2 });
      } catch (erro) {
        res.status(503).json({
          status: "degradado",
          problema: "Conectou o cliente, mas a consulta ao banco falhou.",
          detalhe: erro.message,
          comoResolver: "Confira a DATABASE_URL: use a URL do Session pooler (porta 5432) e codifique caracteres especiais da senha (@ vira %40, # vira %23).",
          ambiente: ambiente2
        });
      }
    })
  );
  app2.use("/api", (_req, res, next) => {
    if (bancoConfigurado) return next();
    res.status(503).json({
      error: "O sistema est\xE1 sem conex\xE3o com o banco: falta a vari\xE1vel DATABASE_URL. Configure em Vercel \u2192 Settings \u2192 Environment Variables e refa\xE7a o deploy."
    });
  });
  app2.use("/api/auth", rotasAuth);
  app2.use("/api/dashboard", rotasDashboard);
  app2.use("/api/products", rotasProdutos);
  app2.use("/api/fotos", rotasFotos);
  app2.use("/api/sales", rotasVendas);
  app2.use("/api/movements", rotasMovimentacoes);
  app2.use("/api/categories", rotasCategorias);
  app2.use("/api/suppliers", rotasFornecedores);
  app2.use("/api/customers", rotasClientes);
  app2.use("/api/users", rotasUsuarios);
  app2.use("/api/reports", rotasRelatorios);
  app2.use("/api/settings", rotasSistema);
  app2.use((req, res) => {
    res.status(404).json({ error: `Rota n\xE3o encontrada: ${req.method} ${req.originalUrl}` });
  });
  app2.use(tratarErros);
  return app2;
}

// server/vercel.ts
var app = null;
var erroDeCarga = null;
function obterApp() {
  if (app || erroDeCarga) return app;
  try {
    app = createApp();
  } catch (erro) {
    erroDeCarga = erro instanceof Error ? erro.stack ?? erro.message : String(erro);
    console.error("[api] falha ao montar o servidor:", erroDeCarga);
  }
  return app;
}
var ambiente = () => ({
  node: process.version,
  plataforma: `${process.platform}-${process.arch}`,
  naVercel: Boolean(process.env.VERCEL),
  regiao: process.env.VERCEL_REGION ?? null,
  temDatabaseUrl: Boolean(process.env.DATABASE_URL)
});
function responderJson(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo, null, 2));
}
function handler(req, res) {
  const servidor = obterApp();
  if (!servidor) {
    responderJson(res, 503, {
      status: "falha ao carregar",
      problema: "O servidor n\xE3o p\xF4de ser montado nesta fun\xE7\xE3o.",
      // É este texto que diz o motivo real.
      detalhe: erroDeCarga,
      ambiente: ambiente()
    });
    return;
  }
  if ((req.url ?? "").startsWith("/api/health") && !process.env.DATABASE_URL) {
    responderJson(res, 503, {
      status: "sem configura\xE7\xE3o",
      problema: "A vari\xE1vel DATABASE_URL n\xE3o est\xE1 definida nesta fun\xE7\xE3o.",
      comoResolver: "Vercel \u2192 Settings \u2192 Environment Variables \u2192 adicione DATABASE_URL (marque Production) \u2192 Deployments \u2192 Redeploy.",
      ambiente: ambiente()
    });
    return;
  }
  servidor(req, res);
}
export {
  handler as default
};
