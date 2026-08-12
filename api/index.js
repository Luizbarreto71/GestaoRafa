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
var FEMININAS = /* @__PURE__ */ new Set([
  "Categoria",
  "Foto",
  "Pr\xE9-venda",
  "Retirada",
  "Troca",
  "Unidade",
  "Venda",
  "Transfer\xEAncia",
  "Movimenta\xE7\xE3o"
]);
var naoEncontrado = (o = "Registro") => new AppError(`${o} n\xE3o ${FEMININAS.has(o) ? "encontrada" : "encontrado"}`, 404);
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
var semVazios = (query) => Object.fromEntries(
  Object.entries(query ?? {}).filter(
    ([, valor]) => valor !== "" && valor !== null && valor !== void 0
  )
);
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
var FUSO_DA_LOJA = "America/Sao_Paulo";
function deslocamentoDaLoja(instante) {
  const comoUtc = new Date(instante.toLocaleString("en-US", { timeZone: "UTC" }));
  const comoLoja = new Date(instante.toLocaleString("en-US", { timeZone: FUSO_DA_LOJA }));
  return (comoUtc.getTime() - comoLoja.getTime()) / 6e4;
}
function diaDoCalendario(d) {
  const ehMeiaNoiteUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  if (ehMeiaNoiteUtc) return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
  const naLoja = new Date(d.toLocaleString("en-US", { timeZone: FUSO_DA_LOJA }));
  return [naLoja.getFullYear(), naLoja.getMonth(), naLoja.getDate()];
}
function inicioDoDia(d = /* @__PURE__ */ new Date()) {
  const [ano, mes, dia] = diaDoCalendario(d);
  const provisorio = new Date(Date.UTC(ano, mes, dia, 0, 0, 0, 0));
  return new Date(provisorio.getTime() + deslocamentoDaLoja(provisorio) * 6e4);
}
function fimDoDia(d = /* @__PURE__ */ new Date()) {
  const [ano, mes, dia] = diaDoCalendario(d);
  const provisorio = new Date(Date.UTC(ano, mes, dia, 23, 59, 59, 999));
  return new Date(provisorio.getTime() + deslocamentoDaLoja(provisorio) * 6e4);
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
var dataHoraCurta = (d) => new Date(d).toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
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
var PAGAMENTO_LABEL = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  DEBITO: "D\xE9bito",
  CREDITO: "Cr\xE9dito",
  TRANSFERENCIA: "Transfer\xEAncia",
  TROCA: "Troca (aparelho)",
  EM_ABERTO: "Valor em aberto",
  OUTRO: "Outro"
};

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
      datasources: { db: { url: endereco } },
      // O padrão do Prisma é 5 segundos, contados da abertura da
      // transação. Com o banco na nuvem, cada consulta lá dentro é uma ida
      // e volta pela internet — uma venda de vários itens passava disso e
      // era desfeita no meio, com a caixa vendo só "não foi possível".
      transactionOptions: { timeout: 3e4, maxWait: 15e3 }
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
      {
        sub: usuario.id,
        nome: usuario.name,
        email: usuario.email,
        role: usuario.role,
        unidadeId: usuario.unitId ?? null
      },
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
  role: u.role,
  unitId: u.unitId ?? null
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
        papel: dados.role,
        admin: dados.role === "ADMIN",
        unidadeId: dados.unidadeId ?? null
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

// shared/cores.ts
var PALETA_DE_CATEGORIAS = [
  "#3B82F6",
  // azul
  "#22C55E",
  // verde
  "#F97316",
  // laranja
  "#8B5CF6",
  // roxo
  "#EAB308",
  // âmbar
  "#EC4899",
  // rosa
  "#14B8A6",
  // turquesa
  "#06B6D4",
  // ciano
  "#6366F1",
  // índigo
  "#EF4444",
  // vermelho
  "#84CC16",
  // limão
  "#A855F7"
  // violeta
];
function proximaCor(jaUsadas) {
  const usadas = new Set(jaUsadas.filter(Boolean).map((c) => c.toUpperCase()));
  const livre = PALETA_DE_CATEGORIAS.find((c) => !usadas.has(c));
  return livre ?? PALETA_DE_CATEGORIAS[usadas.size % PALETA_DE_CATEGORIAS.length];
}

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
  /**
   * Estado do aparelho.
   *
   * Não aparece mais no formulário: virou subcategoria ("Celulares ›
   * Vitrine"). A definição fica porque a coluna do banco segue preenchida
   * nos produtos antigos, e os rótulos ainda servem para lê-los.
   */
  condicao: {
    rotulo: "Condi\xE7\xE3o",
    tipo: "selecao",
    coluna: "condicao",
    opcoes: ["Lacrado", "Xiaomi Lacrado", "Vitrine", "Seminovo"],
    ajuda: "Substitu\xEDda pelas subcategorias"
  },
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
  custo: {
    rotulo: "Custo m\xE9dio",
    tipo: "dinheiro",
    coluna: "costPrice",
    ajuda: "No cadastro \xE9 o custo inicial; depois cada entrada recalcula"
  },
  venda: {
    rotulo: "Pre\xE7o de venda (varejo)",
    tipo: "dinheiro",
    coluna: "salePrice",
    ajuda: "Opcional \u2014 se ficar vazio, vale o pre\xE7o de atacado"
  },
  /**
   * O preço de referência da loja. É o único obrigatório: sem ele não dá
   * para saber quanto vale o estoque nem sugerir valor na venda.
   */
  atacado: {
    rotulo: "Pre\xE7o de atacado",
    tipo: "dinheiro",
    coluna: "wholesalePrice",
    essencial: true
  },
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
    { campo: "atacado" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  // Vendido por caixa: some marca, modelo, cor, capacidade e IMEI. A
  // chave acompanha o apelido da categoria — o produto é o mesmo.
  gopro: [
    { campo: "nome", rotulo: "Nome / dosagem" },
    { campo: "lote", rotulo: "Lote da caixa" },
    { campo: "quantidade", rotulo: "Quantidade de caixas" },
    { campo: "custo", rotulo: "Pre\xE7o de compra" },
    { campo: "venda", rotulo: "Pre\xE7o de venda" },
    { campo: "atacado" },
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
    { campo: "atacado" },
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
    { campo: "atacado" },
    { campo: "fornecedor" },
    { campo: "fotos" },
    { campo: "observacoes" }
  ],
  tvs: [
    { campo: "nome" },
    { campo: "marca" },
    { campo: "modelo" },
    { campo: "capacidade", rotulo: "Tamanho (polegadas)" },
    { campo: "serie" },
    { campo: "quantidade" },
    { campo: "custo" },
    { campo: "venda" },
    { campo: "atacado" },
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
    { campo: "atacado" },
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
var APOSENTADOS = /* @__PURE__ */ new Set(["condicao"]);
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
  const escolhidos = (lista.length ? lista : padrao).filter((c) => !APOSENTADOS.has(c.campo));
  const presentes = new Set(escolhidos.map((c) => c.campo));
  const faltando = TODAS_AS_CHAVES.filter(
    (k) => CAMPOS[k].essencial && !presentes.has(k) && !APOSENTADOS.has(k)
  ).map((campo) => ({ campo }));
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
async function conferirMae(parentId) {
  if (!parentId) return;
  const mae = await db.category.findUnique({ where: { id: parentId } });
  if (!mae) throw naoEncontrado("Categoria");
  if (mae.parentId) {
    throw new AppError(`${mae.name} j\xE1 \xE9 uma subcategoria. S\xF3 h\xE1 um n\xEDvel de subcategoria.`);
  }
}
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
  ).optional(),
  /** Categoria mãe. Vazio = categoria principal. */
  parentId: z2.string().uuid().optional().nullable(),
  ordem: z2.coerce.number().int().min(0).max(999).optional()
});
rotasCategorias.get(
  "/",
  rota(async (_req, res) => {
    const categorias = await db.category.findMany({
      orderBy: [{ ordem: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } }, parent: { select: { id: true, name: true } } }
    });
    const m\u00E3es = categorias.filter((c) => !c.parentId);
    const emOrdem = m\u00E3es.flatMap((mae) => [
      mae,
      ...categorias.filter((c) => c.parentId === mae.id)
    ]);
    const soltas = categorias.filter((c) => !emOrdem.includes(c));
    res.json(
      limpar(
        [...emOrdem, ...soltas].map((c) => {
          const mae = c.parentId ? categorias.find((x) => x.id === c.parentId) : null;
          return {
            ...c,
            // A subcategoria herda o formulário da mãe quando não tem o seu.
            campos: normalizarCampos(c.campos ?? mae?.campos ?? null, mae?.slug ?? c.slug),
            /** "Celulares › Vitrine" — é assim que aparece na tela. */
            caminho: mae ? `${mae.name} \u203A ${c.name}` : c.name,
            ehSubcategoria: Boolean(c.parentId)
          };
        })
      )
    );
  })
);
rotasCategorias.post(
  "/",
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(categoriaSchema, req.body);
    await conferirMae(dados.parentId);
    const slug = apelido(dados.name);
    const cor = dados.color ?? proximaCor((await db.category.findMany({ select: { color: true } })).map((c) => c.color));
    const categoria = await db.category.create({
      data: {
        ...dados,
        slug,
        color: cor,
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
    if (dados.parentId !== void 0) {
      if (dados.parentId === req.params.id) {
        throw new AppError("Uma categoria n\xE3o pode ser subcategoria dela mesma.");
      }
      await conferirMae(dados.parentId);
      const temFilhas = await db.category.count({ where: { parentId: req.params.id } });
      if (dados.parentId && temFilhas > 0) {
        throw new AppError(
          `Esta categoria tem ${temFilhas} subcategoria(s). Mova-as antes de torn\xE1-la subcategoria.`
        );
      }
    }
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
    const filhas = await db.category.count({ where: { parentId: req.params.id } });
    if (filhas > 0) {
      throw new AppError(
        `Esta categoria tem ${filhas} subcategoria(s). Exclua ou mova as subcategorias primeiro.`,
        409
      );
    }
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
    const q = validar(buscaSimples, semVazios(req.query));
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
    const q = validar(buscaSimples, semVazios(req.query));
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
          include: { items: { select: { productName: true, quantity: true } } }
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
var campos = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  unitId: true,
  unit: { select: { id: true, name: true } }
};
var usuarioSchema = z2.object({
  name: z2.string().trim().min(2, "Informe o nome").max(120),
  email: z2.string().trim().toLowerCase().email("E-mail inv\xE1lido"),
  password: z2.string().trim().min(6, "A senha deve ter ao menos 6 caracteres"),
  role: z2.enum(["ADMIN", "GERENTE", "CAIXA", "VENDEDOR"]).default("VENDEDOR"),
  /** Gerente e Vendedor precisam de unidade; Administrador vê todas. */
  unitId: z2.string().uuid().optional().nullable(),
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
    if (alvo.role === "ADMIN" && (dados.role !== void 0 && dados.role !== "ADMIN" || dados.active === false)) {
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

// server/permissoes.ts
var TODAS = [
  "dashboard",
  "produtos.ver",
  "produtos.editar",
  "estoque.ver",
  "estoque.tela",
  "estoque.movimentar",
  "estoque.transferir",
  "retirada.aprovar",
  "prevenda.criar",
  "troca.criar",
  "prevenda.verTodas",
  "pdv",
  "venda.finalizar",
  "venda.cancelar",
  "caixa.fechar",
  "caixa.verTodos",
  "relatorios",
  "financeiro",
  "usuarios",
  "configuracoes"
];
var PERMISSOES = {
  ADMIN: TODAS,
  // Toca no estoque da sua unidade, mas não mexe em usuários nem no caixa.
  GERENTE: [
    "dashboard",
    "produtos.ver",
    "produtos.editar",
    "estoque.ver",
    "estoque.tela",
    "estoque.movimentar",
    "estoque.transferir",
    "prevenda.criar",
    "prevenda.verTodas",
    "troca.criar",
    "relatorios"
  ],
  // Recebe, confere e finaliza. Não cadastra nem altera preço.
  CAIXA: [
    "produtos.ver",
    "prevenda.verTodas",
    "troca.criar",
    "pdv",
    "venda.finalizar",
    "venda.cancelar",
    "caixa.fechar"
  ],
  // Só monta a intenção de venda. Nunca baixa estoque.
  VENDEDOR: [
    "produtos.ver",
    "estoque.ver",
    "estoque.tela",
    "prevenda.criar",
    "troca.criar"
  ]
};
var podeFazer = (perfil, permissao) => Boolean(perfil && PERMISSOES[perfil]?.includes(permissao));
function exigir(permissao) {
  return (req, _res, next) => {
    if (!req.usuario) return next(new AppError("N\xE3o autorizado", 401));
    if (!podeFazer(req.usuario.papel, permissao)) {
      return next(new AppError("Voc\xEA n\xE3o tem permiss\xE3o para esta a\xE7\xE3o", 403));
    }
    next();
  };
}

// server/estoque.ts
import { Prisma as Prisma2 } from "@prisma/client";

// server/planilha.ts
var CABECALHO = [
  "Data",
  "Hora",
  "Produto",
  "Categoria",
  "Unidade",
  "Tipo de movimenta\xE7\xE3o",
  "Quantidade",
  "Estoque anterior",
  "Estoque posterior",
  "Origem",
  "Destino",
  "Usu\xE1rio respons\xE1vel",
  "Motivo",
  "Observa\xE7\xE3o",
  "ID da movimenta\xE7\xE3o"
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
var valores = (l) => {
  const quando = new Date(l.data);
  const emSP = (opcoes) => quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opcoes });
  return [
    emSP({ day: "2-digit", month: "2-digit", year: "numeric" }),
    emSP({ hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    l.produto,
    l.categoria,
    l.unidade,
    l.tipo,
    l.quantidade,
    l.estoqueAnterior,
    l.estoquePosterior,
    l.origem ?? "",
    l.destino ?? "",
    l.usuario ?? "",
    l.motivo ?? "",
    l.observacao ?? "",
    l.movimentoId
  ];
};
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
    range: `${c.aba}!A1:O1`
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
        range: `${c.aba}!A:O`,
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
    range: `${c.aba}!A2:O`
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

// server/estoque.ts
var MOTIVO_LABEL = {
  COMPRA: "Compra",
  CADASTRO: "Cadastro de produto",
  VENDA: "Venda",
  DEFEITO: "Produto com defeito",
  DEVOLUCAO_FORNECEDOR: "Devolu\xE7\xE3o ao fornecedor",
  PERDA: "Perda",
  USO_INTERNO: "Uso interno",
  AJUSTE: "Ajuste de estoque",
  TRANSFERENCIA: "Transfer\xEAncia",
  RETIRADA: "Retirada para a loja",
  CANCELAMENTO: "Cancelamento",
  EXCLUSAO: "Exclus\xE3o",
  OUTRO: "Outro"
};
var TIPO_LABEL = {
  ENTRADA: "Entrada",
  SAIDA: "Sa\xEDda",
  TRANSFERENCIA: "Transfer\xEAncia",
  AJUSTE: "Ajuste"
};
var STATUS_PRODUTO_LABEL = {
  EM_ESTOQUE: "Em estoque",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido"
};
async function saldo(produtoId, unidadeId, tx) {
  const linha = await (tx ?? db).stock.findUnique({
    where: { productId_unitId: { productId: produtoId, unitId: unidadeId } },
    select: { quantity: true }
  });
  return linha?.quantity ?? 0;
}
async function reservado(produtoId, unidadeId, tx) {
  const soma = await (tx ?? db).stockWithdrawal.aggregate({
    where: { productId: produtoId, unitId: unidadeId, status: "PENDENTE" },
    _sum: { quantity: true }
  });
  return soma._sum.quantity ?? 0;
}
async function disponivel(produtoId, unidadeId, tx) {
  const [total, reserva] = await Promise.all([
    saldo(produtoId, unidadeId, tx),
    reservado(produtoId, unidadeId, tx)
  ]);
  return Math.max(0, total - reserva);
}
async function comAsFilhas(categoryId) {
  const filhas = await db.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
  return [categoryId, ...filhas.map((f) => f.id)];
}
async function saldoTotal(produtoId, tx) {
  const soma = await (tx ?? db).stock.aggregate({
    where: { productId: produtoId },
    _sum: { quantity: true }
  });
  return soma._sum.quantity ?? 0;
}
async function saldosDoProduto(produtoId) {
  const [unidades, linhas, retiradas] = await Promise.all([
    db.unit.findMany({ where: { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    db.stock.findMany({ where: { productId: produtoId } }),
    db.stockWithdrawal.groupBy({
      by: ["unitId"],
      where: { productId: produtoId, status: "PENDENTE" },
      _sum: { quantity: true }
    })
  ]);
  return unidades.map((unidade) => {
    const quantidade = linhas.find((l) => l.unitId === unidade.id)?.quantity ?? 0;
    const reserva = retiradas.find((r) => r.unitId === unidade.id)?._sum.quantity ?? 0;
    return {
      unitId: unidade.id,
      unitName: unidade.name,
      quantity: quantidade,
      reserved: reserva,
      available: Math.max(0, quantidade - reserva)
    };
  });
}
async function movimentar(m) {
  const cliente3 = m.tx ?? db;
  if (m.quantidade <= 0) {
    throw new AppError("A quantidade precisa ser maior que zero.");
  }
  const entra = m.sentido ? m.sentido === "entra" : m.tipo === "ENTRADA";
  if (!m.sentido && m.tipo !== "ENTRADA" && m.tipo !== "SAIDA") {
    throw new AppError(`Movimenta\xE7\xE3o do tipo ${m.tipo} precisa informar o sentido.`, 500);
  }
  const soma = entra ? m.quantidade : -m.quantidade;
  const antes = await saldo(m.produtoId, m.unidadeId, cliente3);
  if (soma < 0) {
    const reserva = m.ignorarReserva ? 0 : await reservado(m.produtoId, m.unidadeId, cliente3);
    const livre = antes - reserva;
    if (livre < m.quantidade) {
      const unidade = await cliente3.unit.findUnique({ where: { id: m.unidadeId } });
      const nome = unidade?.name ?? "unidade";
      throw new AppError(
        reserva > 0 ? `Estoque insuficiente na ${nome}. Dispon\xEDvel: ${Math.max(0, livre)} unidade(s) \u2014 ${reserva} est\xE3o reservadas para retiradas pendentes.` : `Estoque insuficiente na ${nome}. Estoque dispon\xEDvel: ${antes} unidade(s).`
      );
    }
  }
  let depois;
  if (soma > 0) {
    const linha = await cliente3.stock.upsert({
      where: { productId_unitId: { productId: m.produtoId, unitId: m.unidadeId } },
      update: { quantity: { increment: soma } },
      create: { productId: m.produtoId, unitId: m.unidadeId, quantity: soma }
    });
    depois = linha.quantity;
  } else {
    const alterou = await cliente3.stock.updateMany({
      where: { productId: m.produtoId, unitId: m.unidadeId, quantity: { gte: m.quantidade } },
      data: { quantity: { decrement: m.quantidade } }
    });
    if (alterou.count === 0) {
      throw new AppError("O estoque mudou durante a opera\xE7\xE3o. Confira o saldo e tente de novo.", 409);
    }
    depois = antes - m.quantidade;
  }
  const registro = await cliente3.stockMovement.create({
    data: {
      type: m.tipo,
      reason: m.motivo,
      quantity: m.quantidade,
      previousQuantity: antes,
      newQuantity: depois,
      unitCost: m.custoUnitario != null ? new Prisma2.Decimal(m.custoUnitario) : null,
      notes: m.observacao ?? null,
      productId: m.produtoId,
      productName: m.produtoNome,
      unitId: m.unidadeId,
      originUnitId: m.origemId ?? null,
      destinationUnitId: m.destinoId ?? null,
      referenceId: m.referenciaId ?? m.vendaId ?? m.transferenciaId ?? null,
      saleId: m.vendaId ?? null,
      transferId: m.transferenciaId ?? null,
      withdrawalId: m.withdrawalId ?? null,
      userId: m.usuarioId ?? null
    }
  });
  if (!m.semPlanilha) {
    void enviarLinha(registro.id, m, antes, depois, entra);
  }
  return { antes, depois, id: registro.id };
}
async function enviarLinha(movimentoId, m, antes, depois, entra) {
  try {
    const [produto, unidade, origem, destino] = await Promise.all([
      db.product.findUnique({
        where: { id: m.produtoId },
        include: { category: true, supplier: true }
      }),
      db.unit.findUnique({ where: { id: m.unidadeId } }),
      m.origemId ? db.unit.findUnique({ where: { id: m.origemId } }) : null,
      m.destinoId ? db.unit.findUnique({ where: { id: m.destinoId } }) : null
    ]);
    enviarParaPlanilha({
      data: /* @__PURE__ */ new Date(),
      produto: m.produtoNome,
      categoria: produto?.category?.name ?? "\u2014",
      unidade: unidade?.name ?? "\u2014",
      tipo: TIPO_LABEL[m.tipo],
      quantidade: entra ? m.quantidade : -m.quantidade,
      estoqueAnterior: antes,
      estoquePosterior: depois,
      origem: origem?.name ?? "",
      destino: destino?.name ?? "",
      usuario: m.usuarioNome ?? "",
      motivo: MOTIVO_LABEL[m.motivo],
      observacao: m.observacao ?? "",
      movimentoId
    });
  } catch (erro) {
    console.error("[planilha] n\xE3o consegui montar a linha:", erro.message);
  }
}
async function transferir(t) {
  if (t.origemId === t.destinoId) {
    throw new AppError("A unidade de origem e a de destino precisam ser diferentes.");
  }
  return db.$transaction(async (tx) => {
    const [produto, origem, destino] = await Promise.all([
      tx.product.findUnique({ where: { id: t.produtoId } }),
      tx.unit.findUnique({ where: { id: t.origemId } }),
      tx.unit.findUnique({ where: { id: t.destinoId } })
    ]);
    if (!produto) throw new AppError("Produto n\xE3o encontrado", 404);
    if (!origem || !destino) throw new AppError("Unidade n\xE3o encontrada", 404);
    const transferencia = await tx.stockTransfer.create({
      data: {
        productId: produto.id,
        originUnitId: origem.id,
        destinationUnitId: destino.id,
        quantity: t.quantidade,
        status: "RECEBIDA",
        receivedAt: /* @__PURE__ */ new Date(),
        requestedById: t.usuarioId ?? null,
        receivedById: t.usuarioId ?? null,
        notes: t.observacao ?? null
      }
    });
    const comum = {
      produtoId: produto.id,
      produtoNome: produto.name,
      tipo: "TRANSFERENCIA",
      motivo: "TRANSFERENCIA",
      quantidade: t.quantidade,
      origemId: origem.id,
      destinoId: destino.id,
      transferenciaId: transferencia.id,
      usuarioId: t.usuarioId,
      usuarioNome: t.usuarioNome,
      tx
    };
    const saida = await movimentar({
      ...comum,
      sentido: "sai",
      unidadeId: origem.id,
      observacao: `Transfer\xEAncia para ${destino.name}${t.observacao ? ` \u2014 ${t.observacao}` : ""}`
    });
    const entrada = await movimentar({
      ...comum,
      sentido: "entra",
      unidadeId: destino.id,
      observacao: `Transfer\xEAncia da ${origem.name}${t.observacao ? ` \u2014 ${t.observacao}` : ""}`
    });
    return { transferencia, origem, destino, produto, saida, entrada };
  });
}
async function cancelarTransferencia(transferenciaId, usuario) {
  return db.$transaction(async (tx) => {
    const t = await tx.stockTransfer.findUnique({
      where: { id: transferenciaId },
      include: { product: true, originUnit: true, destinationUnit: true }
    });
    if (!t) throw new AppError("Transfer\xEAncia n\xE3o encontrada", 404);
    if (t.status === "CANCELADA") throw new AppError("Esta transfer\xEAncia j\xE1 foi cancelada.");
    const comum = {
      produtoId: t.productId,
      produtoNome: t.product.name,
      quantidade: t.quantity,
      motivo: "CANCELAMENTO",
      transferenciaId: t.id,
      usuarioId: usuario?.id,
      usuarioNome: usuario?.nome,
      tx
    };
    await movimentar({
      ...comum,
      unidadeId: t.destinationUnitId,
      tipo: "SAIDA",
      observacao: `Cancelamento da transfer\xEAncia para ${t.destinationUnit.name}`
    });
    await movimentar({
      ...comum,
      unidadeId: t.originUnitId,
      tipo: "ENTRADA",
      observacao: `Devolu\xE7\xE3o por cancelamento \u2014 voltou para ${t.originUnit.name}`
    });
    return tx.stockTransfer.update({
      where: { id: t.id },
      data: { status: "CANCELADA" }
    });
  });
}
async function estoqueBaixo(unidadeId, limite = 50) {
  const linhas = await db.$queryRaw`
    SELECT s."productId", s."unitId", s."quantity", p."minQuantity"
    FROM "stock" s
    JOIN "products" p ON p."id" = s."productId"
    WHERE s."quantity" > 0
      AND s."quantity" <= p."minQuantity"
      ${unidadeId ? Prisma2.sql`AND s."unitId" = ${unidadeId}` : Prisma2.empty}
    ORDER BY s."quantity" ASC
    LIMIT ${limite}
  `;
  return linhas;
}
async function valorDoEstoque(unidadeId) {
  const [linha] = await db.$queryRaw`
    SELECT
      SUM(s."quantity" * p."costPrice")::text AS custo,
      -- O varejo é opcional: sem ele, o valor de referência é o atacado.
      SUM(s."quantity" * COALESCE(NULLIF(p."salePrice", 0), p."wholesalePrice", 0))::text AS venda
    FROM "stock" s
    JOIN "products" p ON p."id" = s."productId"
    WHERE s."quantity" > 0
      ${unidadeId ? Prisma2.sql`AND s."unitId" = ${unidadeId}` : Prisma2.empty}
  `;
  return { custo: Number(linha?.custo ?? 0), venda: Number(linha?.venda ?? 0) };
}
async function totalEmEstoque(unidadeId) {
  const soma = await db.stock.aggregate({
    where: unidadeId ? { unitId: unidadeId } : void 0,
    _sum: { quantity: true }
  });
  return soma._sum.quantity ?? 0;
}

// server/unidades.ts
import { Router as Router3 } from "express";
import { z as z3 } from "zod";
var rotasUnidades = Router3();
rotasUnidades.use(autenticar);
var unidadeSchema = z3.object({
  name: z3.string().trim().min(2, "Informe o nome da unidade").max(80),
  type: z3.enum(["MATRIZ", "FILIAL"]).default("FILIAL"),
  active: z3.boolean().optional()
});
function unidadePermitida(usuario, pedida) {
  if (!usuario) return void 0;
  if (usuario.admin) return pedida || void 0;
  return usuario.unidadeId ?? "00000000-0000-0000-0000-000000000000";
}
function exigirAcessoNaUnidade(usuario, unidadeId) {
  if (!usuario) throw new AppError("N\xE3o autorizado", 401);
  if (usuario.admin) return;
  if (usuario.unidadeId !== unidadeId) {
    throw new AppError("Voc\xEA s\xF3 pode movimentar o estoque da sua unidade.", 403);
  }
}
rotasUnidades.get(
  "/",
  rota(async (req, res) => {
    const unidades = await db.unit.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: { _count: { select: { stock: true, sales: true } } }
    });
    const visiveis = req.usuario?.admin ? unidades : unidades.filter((u) => u.id === req.usuario?.unidadeId);
    res.json(limpar(visiveis));
  })
);
rotasUnidades.post(
  "/",
  somenteAdmin,
  rota(async (req, res) => {
    const unidade = await db.unit.create({ data: validar(unidadeSchema, req.body) });
    await registrarLog({ acao: "CREATE", entidade: "Unit", id: unidade.id, req });
    res.status(201).json(limpar(unidade));
  })
);
rotasUnidades.put(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const unidade = await db.unit.update({
      where: { id: req.params.id },
      data: validar(unidadeSchema.partial(), req.body)
    });
    await registrarLog({ acao: "UPDATE", entidade: "Unit", id: unidade.id, req });
    res.json(limpar(unidade));
  })
);
rotasUnidades.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const unidade = await db.unit.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { stock: true, sales: true, movements: true } } }
    });
    if (!unidade) throw naoEncontrado("Unidade");
    const temHistorico = unidade._count.stock > 0 || unidade._count.sales > 0 || unidade._count.movements > 0;
    if (temHistorico) {
      await db.unit.update({ where: { id: unidade.id }, data: { active: false } });
      await registrarLog({ acao: "DEACTIVATE", entidade: "Unit", id: unidade.id, req });
      res.json({
        message: `A ${unidade.name} tem movimenta\xE7\xF5es registradas e foi desativada em vez de exclu\xEDda.`,
        deactivated: true
      });
      return;
    }
    await db.unit.delete({ where: { id: unidade.id } });
    await registrarLog({ acao: "DELETE", entidade: "Unit", id: unidade.id, req });
    res.json({ message: "Unidade exclu\xEDda com sucesso", deactivated: false });
  })
);

// server/dashboard.ts
var rotasDashboard = Router4();
rotasDashboard.use(autenticar, exigir("dashboard"));
rotasDashboard.get(
  "/",
  rota(async (req, res) => {
    const dias = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const unidade = unidadePermitida(req.usuario, req.query.unitId);
    const naUnidade = unidade ? { unitId: unidade } : {};
    const escolhida = req.query.date ? new Date(String(req.query.date)) : null;
    const hoje = escolhida && !Number.isNaN(escolhida.getTime()) ? escolhida : /* @__PURE__ */ new Date();
    const inicioHoje = inicioDoDia(hoje);
    const fimHoje = fimDoDia(hoje);
    const inicioGrafico = inicioDoDia(somarDias(hoje, -(dias - 1)));
    const inicioDoMes = inicioDoDia(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)));
    const baixos = await estoqueBaixo(unidade, 10);
    const [
      totalProdutos,
      itensEmEstoque,
      vendidosHoje,
      itensHoje,
      faturamentoHoje,
      produtosBaixos,
      semEstoque,
      ultimasVendas,
      vendasDoPeriodo,
      movimentosDoPeriodo,
      linhasDeEstoque,
      categorias,
      mes,
      itensMes,
      valor
    ] = await Promise.all([
      db.product.count(),
      totalEmEstoque(unidade),
      // Venda cancelada não é faturamento: o dinheiro voltou e a peça
      // também. Sem este filtro o painel discordava do relatório.
      db.sale.aggregate({
        where: { status: "FINALIZADA", saleDate: { gte: inicioHoje, lte: fimHoje }, ...naUnidade },
        _count: true
      }),
      // Itens vendidos vêm da tabela de itens: uma venda pode ter vários.
      db.saleItem.aggregate({
        where: {
          sale: { status: "FINALIZADA", saleDate: { gte: inicioHoje, lte: fimHoje }, ...naUnidade }
        },
        _sum: { quantity: true }
      }),
      db.sale.aggregate({
        where: { status: "FINALIZADA", saleDate: { gte: inicioHoje, lte: fimHoje }, ...naUnidade },
        _sum: { totalAmount: true, costAmount: true }
      }),
      db.product.findMany({
        where: { id: { in: baixos.map((b) => b.productId) } },
        include: {
          category: true,
          photos: { select: { id: true }, take: 1 },
          stock: { include: { unit: { select: { name: true } } } }
        }
      }),
      db.stock.count({ where: { quantity: 0, ...naUnidade } }),
      db.sale.findMany({
        where: naUnidade,
        orderBy: { saleDate: "desc" },
        take: 8,
        include: {
          items: { select: { productName: true, quantity: true } },
          seller: { select: { name: true } },
          cashier: { select: { name: true } },
          unit: { select: { name: true } }
        }
      }),
      db.sale.findMany({
        where: { status: "FINALIZADA", saleDate: { gte: inicioGrafico, lte: fimHoje }, ...naUnidade },
        select: { saleDate: true, totalAmount: true, items: { select: { quantity: true } } }
      }),
      db.stockMovement.findMany({
        where: { createdAt: { gte: inicioGrafico, lte: fimHoje }, ...naUnidade },
        select: { createdAt: true, type: true, quantity: true }
      }),
      db.stock.findMany({
        where: naUnidade,
        select: { quantity: true, product: { select: { categoryId: true } } }
      }),
      db.category.findMany(),
      db.sale.aggregate({
        where: { status: "FINALIZADA", saleDate: { gte: inicioDoMes }, ...naUnidade },
        _sum: { totalAmount: true, costAmount: true }
      }),
      db.saleItem.aggregate({
        where: { sale: { status: "FINALIZADA", saleDate: { gte: inicioDoMes }, ...naUnidade } },
        _sum: { quantity: true }
      }),
      valorDoEstoque(unidade)
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
      balde.vendas += venda.items.reduce((n, i) => n + i.quantity, 0);
      balde.faturamento += numero(venda.totalAmount);
    }
    for (const mov of movimentosDoPeriodo) {
      const balde = baldes.get(dia(mov.createdAt));
      if (!balde) continue;
      if (mov.type === "ENTRADA") balde.entradas += mov.quantity;
      if (mov.type === "SAIDA") balde.saidas += mov.quantity;
    }
    const porCategoria = /* @__PURE__ */ new Map();
    for (const linha of linhasDeEstoque) {
      const id = linha.product.categoryId;
      const atual = porCategoria.get(id) ?? { quantidade: 0, produtos: 0 };
      atual.quantidade += linha.quantity;
      atual.produtos += 1;
      porCategoria.set(id, atual);
    }
    const receitaHoje = numero(faturamentoHoje._sum?.totalAmount);
    const receitaMes = numero(mes._sum?.totalAmount);
    res.json(
      limpar({
        unitId: unidade ?? null,
        /** O dia que os cartões estão somando, no formato do filtro. */
        date: inicioHoje.toLocaleDateString("en-CA", { timeZone: FUSO_DA_LOJA }),
        cards: {
          totalProducts: totalProdutos,
          itemsInStock: itensEmEstoque,
          soldToday: itensHoje._sum.quantity ?? 0,
          salesCountToday: vendidosHoje._count,
          revenueToday: receitaHoje,
          profitToday: receitaHoje - numero(faturamentoHoje._sum?.costAmount),
          stockValueCost: valor.custo,
          stockValueSale: valor.venda,
          lowStockCount: baixos.length,
          outOfStockCount: semEstoque,
          revenueMonth: receitaMes,
          profitMonth: receitaMes - numero(mes._sum?.costAmount),
          itemsSoldMonth: itensMes._sum.quantity ?? 0,
          entradas: movimentosDoPeriodo.filter((m) => m.type === "ENTRADA").reduce((s, m) => s + m.quantity, 0),
          saidas: movimentosDoPeriodo.filter((m) => m.type === "SAIDA").reduce((s, m) => s + m.quantity, 0)
        },
        chart: Array.from(baldes.values()),
        categories: Array.from(porCategoria.entries()).map(([id, dados]) => {
          const categoria = categorias.find((c) => c.id === id);
          return {
            categoryId: id,
            name: categoria?.name ?? "Sem categoria",
            color: categoria?.color ?? "#64748B",
            products: dados.produtos,
            quantity: dados.quantidade
          };
        }),
        lowStockProducts: produtosBaixos.map((p) => {
          const linha = baixos.find((b) => b.productId === p.id);
          return {
            ...p,
            photos: p.photos.map((f) => `/api/fotos/${f.id}`),
            quantity: linha?.quantity ?? 0,
            unitName: p.stock.find((s) => s.unitId === linha?.unitId)?.unit.name ?? null
          };
        }),
        latestSales: ultimasVendas
      })
    );
  })
);
rotasDashboard.get(
  "/alerts",
  rota(async (req, res) => {
    const unidade = unidadePermitida(req.usuario, req.query.unitId);
    const naUnidade = unidade ? { unitId: unidade } : {};
    const baixos = await estoqueBaixo(unidade, 20);
    const [produtos, zerados, vendasHoje, valor] = await Promise.all([
      db.product.findMany({
        where: { id: { in: baixos.map((b) => b.productId) } },
        select: { id: true, name: true, minQuantity: true, model: true }
      }),
      db.stock.findMany({
        where: { quantity: 0, ...naUnidade },
        select: { product: { select: { id: true, name: true, model: true } }, unit: { select: { name: true } } },
        take: 20
      }),
      db.sale.findMany({
        where: { status: "FINALIZADA", saleDate: { gte: inicioDoDia(), lte: fimDoDia() }, ...naUnidade },
        select: {
          id: true,
          code: true,
          customerName: true,
          totalAmount: true,
          saleDate: true,
          items: { select: { productName: true, quantity: true } },
          unit: { select: { name: true } }
        },
        orderBy: { saleDate: "desc" }
      }),
      valorDoEstoque(unidade)
    ]);
    const unidades = await db.unit.findMany({ select: { id: true, name: true } });
    res.json(
      limpar({
        lowStock: baixos.map((b) => {
          const produto = produtos.find((p) => p.id === b.productId);
          return {
            id: b.productId,
            name: produto?.name ?? "\u2014",
            model: produto?.model ?? null,
            quantity: b.quantity,
            minQuantity: b.minQuantity,
            unitName: unidades.find((u) => u.id === b.unitId)?.name ?? null
          };
        }),
        outOfStock: zerados.map((z14) => ({ ...z14.product, unitName: z14.unit.name })),
        soldToday: vendasHoje,
        soldTodayCount: vendasHoje.reduce((s, v) => s + v.items.reduce((n, i) => n + i.quantity, 0), 0),
        revenueToday: vendasHoje.reduce((s, v) => s + numero(v.totalAmount), 0),
        stockValue: valor.venda,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      })
    );
  })
);

// server/movimentacoes.ts
import { Router as Router5 } from "express";
import { z as z4 } from "zod";

// shared/custo.ts
function custoMedio(saldoAtual, custoMedioAtual, quantidadeNova, custoDaNota) {
  if (saldoAtual <= 0) return arredondar(custoDaNota);
  if (quantidadeNova <= 0) return arredondar(custoMedioAtual);
  const total = saldoAtual * custoMedioAtual + quantidadeNova * custoDaNota;
  return arredondar(total / (saldoAtual + quantidadeNova));
}
var arredondar = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// server/movimentacoes.ts
var rotasMovimentacoes = Router5();
rotasMovimentacoes.use(autenticar, exigir("estoque.ver"));
var MOTIVOS = [
  "COMPRA",
  "VENDA",
  "DEFEITO",
  "DEVOLUCAO_FORNECEDOR",
  "PERDA",
  "USO_INTERNO",
  "AJUSTE",
  "OUTRO"
];
var entradaSchema = z4.object({
  productId: z4.string().uuid("Selecione o produto"),
  unitId: z4.string().uuid("Selecione a unidade"),
  quantity: z4.coerce.number().int().min(1, "A quantidade deve ser no m\xEDnimo 1"),
  supplierId: z4.string().uuid().optional().nullable(),
  /** Valor unitário pago nesta nota. Alimenta o custo médio. */
  costPrice: z4.coerce.number().min(0).optional(),
  date: z4.coerce.date().optional(),
  notes: z4.string().trim().max(1e3).optional().nullable(),
  reason: z4.enum(MOTIVOS).default("COMPRA")
});
rotasMovimentacoes.post(
  "/entrada",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const dados = validar(entradaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);
    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado("Produto");
    const saldoAntes = await saldoTotal(produto.id);
    const medioAntes = numero(produto.costPrice);
    const medioDepois = dados.costPrice !== void 0 ? custoMedio(saldoAntes, medioAntes, dados.quantity, dados.costPrice) : medioAntes;
    if (dados.costPrice !== void 0 || dados.supplierId) {
      await db.product.update({
        where: { id: produto.id },
        data: {
          ...dados.costPrice !== void 0 ? {
            costPrice: medioDepois,
            lastPurchaseCost: dados.costPrice,
            lastPurchaseAt: dados.date ?? /* @__PURE__ */ new Date()
          } : {},
          ...dados.supplierId ? { supplierId: dados.supplierId } : {}
        }
      });
    }
    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: "ENTRADA",
      motivo: dados.reason,
      quantidade: dados.quantity,
      custoUnitario: dados.costPrice,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    if (dados.costPrice !== void 0) {
      await db.stockMovement.update({
        where: { id: resultado.id },
        data: { averageCostAfter: medioDepois }
      });
    }
    await registrarLog({
      acao: "ENTRADA",
      entidade: "Stock",
      id: produto.id,
      alteracoes: dados.costPrice !== void 0 ? { quantidade: dados.quantity, nota: dados.costPrice, medioAntes, medioDepois } : { quantidade: dados.quantity },
      req
    });
    res.status(201).json({
      ...resultado,
      custoMedio: medioDepois,
      custoMedioAnterior: medioAntes,
      ultimaCompra: dados.costPrice ?? null,
      message: `Entrada de ${dados.quantity} un. registrada.` + (dados.costPrice !== void 0 && medioDepois !== medioAntes ? ` Custo m\xE9dio: R$ ${medioAntes.toFixed(2)} \u2192 R$ ${medioDepois.toFixed(2)}.` : "")
    });
  })
);
var saidaSchema = z4.object({
  productId: z4.string().uuid("Selecione o produto"),
  unitId: z4.string().uuid("Selecione a unidade"),
  quantity: z4.coerce.number().int().min(1, "A quantidade deve ser no m\xEDnimo 1"),
  reason: z4.enum(MOTIVOS, { errorMap: () => ({ message: "Selecione o motivo" }) }),
  date: z4.coerce.date().optional(),
  notes: z4.string().trim().max(1e3).optional().nullable()
});
rotasMovimentacoes.post(
  "/saida",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const dados = validar(saidaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);
    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado("Produto");
    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: "SAIDA",
      motivo: dados.reason,
      quantidade: dados.quantity,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({ acao: "SAIDA", entidade: "Stock", id: produto.id, req });
    res.status(201).json({ ...resultado, message: `Sa\xEDda de ${dados.quantity} un. registrada.` });
  })
);
var transferenciaSchema = z4.object({
  productId: z4.string().uuid("Selecione o produto"),
  originUnitId: z4.string().uuid("Selecione a unidade de origem"),
  destinationUnitId: z4.string().uuid("Selecione a unidade de destino"),
  quantity: z4.coerce.number().int().min(1, "A quantidade deve ser no m\xEDnimo 1"),
  date: z4.coerce.date().optional(),
  notes: z4.string().trim().max(1e3).optional().nullable()
});
rotasMovimentacoes.post(
  "/transferencia",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const dados = validar(transferenciaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.originUnitId);
    const r = await transferir({
      produtoId: dados.productId,
      origemId: dados.originUnitId,
      destinoId: dados.destinationUnitId,
      quantidade: dados.quantity,
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({
      acao: "TRANSFERENCIA",
      entidade: "StockTransfer",
      id: r.transferencia.id,
      req
    });
    res.status(201).json(
      limpar({
        transfer: r.transferencia,
        message: `${dados.quantity} un. de ${r.produto.name} transferidas da ${r.origem.name} para a ${r.destino.name}. ${r.origem.name}: ${r.saida.antes} \u2192 ${r.saida.depois} \xB7 ${r.destino.name}: ${r.entrada.antes} \u2192 ${r.entrada.depois}`
      })
    );
  })
);
var filtroTransferencias = z4.object({
  page: z4.coerce.number().int().min(1).optional(),
  pageSize: z4.coerce.number().int().min(1).max(200).optional(),
  status: z4.enum(["PENDENTE", "EM_TRANSITO", "RECEBIDA", "CANCELADA"]).optional(),
  unitId: z4.string().uuid().optional()
});
rotasMovimentacoes.get(
  "/transferencias",
  rota(async (req, res) => {
    const q = validar(filtroTransferencias, semVazios(req.query));
    const p = paginacao(q);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = {
      ...q.status ? { status: q.status } : {},
      // Aparece para quem enviou e para quem recebeu.
      ...unidade ? { OR: [{ originUnitId: unidade }, { destinationUnitId: unidade }] } : {}
    };
    const [lista, total] = await Promise.all([
      db.stockTransfer.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, model: true } },
          originUnit: { select: { id: true, name: true } },
          destinationUnit: { select: { id: true, name: true } }
        }
      }),
      db.stockTransfer.count({ where })
    ]);
    res.json(limpar(paginado(lista, total, p)));
  })
);
rotasMovimentacoes.post(
  "/transferencias/:id/cancelar",
  somenteAdmin,
  rota(async (req, res) => {
    const t = await cancelarTransferencia(req.params.id, req.usuario);
    await registrarLog({ acao: "CANCEL", entidade: "StockTransfer", id: t.id, req });
    res.json({ message: "Transfer\xEAncia cancelada e estoque devolvido \xE0 origem." });
  })
);
var retiradaSchema = z4.object({
  productId: z4.string().uuid("Selecione o produto"),
  unitId: z4.string().uuid("Selecione a unidade"),
  quantity: z4.coerce.number().int().min(1, "A quantidade deve ser no m\xEDnimo 1"),
  notes: z4.string().trim().max(1e3).optional().nullable()
});
rotasMovimentacoes.post(
  "/retirada",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const dados = validar(retiradaSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);
    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado("Produto");
    const livre = await disponivel(dados.productId, dados.unitId);
    if (livre < dados.quantity) {
      const unidade = await db.unit.findUnique({ where: { id: dados.unitId } });
      throw new AppError(
        `S\xF3 h\xE1 ${livre} unidade(s) livres na ${unidade?.name ?? "unidade"} \u2014 o restante j\xE1 est\xE1 em outra retirada pendente.`
      );
    }
    const retirada = await db.stockWithdrawal.create({
      data: {
        productId: produto.id,
        unitId: dados.unitId,
        quantity: dados.quantity,
        notes: dados.notes ?? null,
        requestedById: req.usuario?.id ?? null
      },
      include: { unit: { select: { name: true } } }
    });
    await registrarLog({ acao: "RETIRADA", entidade: "StockWithdrawal", id: retirada.id, req });
    res.status(201).json(
      limpar({
        withdrawal: retirada,
        message: `${dados.quantity} un. de ${produto.name} reservadas para a loja. O estoque s\xF3 ser\xE1 baixado quando voc\xEA aprovar.`
      })
    );
  })
);
var filtroRetiradas = z4.object({
  page: z4.coerce.number().int().min(1).optional(),
  pageSize: z4.coerce.number().int().min(1).max(200).optional(),
  status: z4.enum(["PENDENTE", "APROVADA", "CANCELADA"]).optional(),
  unitId: z4.string().uuid().optional()
});
rotasMovimentacoes.get(
  "/retiradas",
  rota(async (req, res) => {
    const q = validar(filtroRetiradas, semVazios(req.query));
    const p = paginacao(q);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = {
      ...q.status ? { status: q.status } : {},
      ...unidade ? { unitId: unidade } : {}
    };
    const [lista, total] = await Promise.all([
      db.stockWithdrawal.findMany({
        where,
        skip: p.skip,
        take: p.take,
        // Pendentes primeiro: são as que pedem ação.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          product: { select: { id: true, name: true, model: true } },
          unit: { select: { id: true, name: true } }
        }
      }),
      db.stockWithdrawal.count({ where })
    ]);
    res.json(limpar(paginado(lista, total, p)));
  })
);
var aprovarSchema = z4.object({
  /** Quanto realmente saiu. O resto continua no estoque. */
  soldQuantity: z4.coerce.number().int().min(0, "Informe quantas sa\xEDram"),
  notes: z4.string().trim().max(1e3).optional().nullable()
});
rotasMovimentacoes.post(
  "/retiradas/:id/aprovar",
  exigir("retirada.aprovar"),
  rota(async (req, res) => {
    const { soldQuantity, notes } = validar(aprovarSchema, req.body);
    const resultado = await db.$transaction(async (tx) => {
      const retirada = await tx.stockWithdrawal.findUnique({
        where: { id: req.params.id },
        include: { product: true, unit: true }
      });
      if (!retirada) throw naoEncontrado("Retirada");
      if (retirada.status !== "PENDENTE") {
        throw new AppError("Esta retirada j\xE1 foi fechada.");
      }
      if (soldQuantity > retirada.quantity) {
        throw new AppError(
          `Voc\xEA retirou ${retirada.quantity} un. \u2014 n\xE3o \xE9 poss\xEDvel informar ${soldQuantity} vendidas.`
        );
      }
      exigirAcessoNaUnidade(req.usuario, retirada.unitId);
      const devolvidas = retirada.quantity - soldQuantity;
      await tx.stockWithdrawal.update({
        where: { id: retirada.id },
        data: {
          status: "APROVADA",
          soldQuantity,
          returnedQuantity: devolvidas,
          approvedAt: /* @__PURE__ */ new Date(),
          approvedById: req.usuario?.id ?? null,
          notes: notes ?? retirada.notes
        }
      });
      let saldo2 = null;
      if (soldQuantity > 0) {
        saldo2 = await movimentar({
          produtoId: retirada.productId,
          produtoNome: retirada.product.name,
          unidadeId: retirada.unitId,
          tipo: "SAIDA",
          motivo: "RETIRADA",
          quantidade: soldQuantity,
          observacao: `Retirada para a loja aprovada \u2014 ${soldQuantity} de ${retirada.quantity} sa\xEDram` + (devolvidas ? `, ${devolvidas} voltaram ao estoque` : ""),
          withdrawalId: retirada.id,
          referenciaId: retirada.id,
          usuarioId: req.usuario?.id,
          usuarioNome: req.usuario?.nome,
          tx
        });
      }
      return { retirada, soldQuantity, devolvidas, saldo: saldo2 };
    });
    await registrarLog({ acao: "APROVAR_RETIRADA", entidade: "StockWithdrawal", id: req.params.id, req });
    res.json({
      message: resultado.soldQuantity === 0 ? `Nenhuma unidade saiu \u2014 as ${resultado.retirada.quantity} voltaram ao estoque.` : `${resultado.soldQuantity} un. baixadas do estoque` + (resultado.devolvidas ? ` \xB7 ${resultado.devolvidas} voltaram` : "") + (resultado.saldo ? ` \xB7 saldo: ${resultado.saldo.antes} \u2192 ${resultado.saldo.depois}` : "")
    });
  })
);
var recusaSchema = z4.object({
  motivo: z4.string().trim().max(1e3).optional().nullable()
});
rotasMovimentacoes.post(
  "/retiradas/:id/cancelar",
  exigir("retirada.aprovar"),
  rota(async (req, res) => {
    const retirada = await db.stockWithdrawal.findUnique({ where: { id: req.params.id } });
    if (!retirada) throw naoEncontrado("Retirada");
    if (retirada.status !== "PENDENTE") throw new AppError("Esta retirada j\xE1 foi fechada.");
    exigirAcessoNaUnidade(req.usuario, retirada.unitId);
    const { motivo } = validar(recusaSchema, req.body ?? {});
    await db.stockWithdrawal.update({
      where: { id: retirada.id },
      data: {
        status: "CANCELADA",
        soldQuantity: 0,
        returnedQuantity: retirada.quantity,
        approvedAt: /* @__PURE__ */ new Date(),
        approvedById: req.usuario?.id ?? null,
        notes: motivo ?? retirada.notes
      }
    });
    await registrarLog({ acao: "CANCELAR_RETIRADA", entidade: "StockWithdrawal", id: retirada.id, req });
    res.json({ message: `Retirada recusada \u2014 as ${retirada.quantity} un. seguem no estoque.` });
  })
);
var filtros = z4.object({
  page: z4.coerce.number().int().min(1).optional(),
  pageSize: z4.coerce.number().int().min(1).max(200).optional(),
  search: z4.string().trim().optional(),
  type: z4.enum(["ENTRADA", "SAIDA", "TRANSFERENCIA", "AJUSTE"]).optional(),
  reason: z4.enum(MOTIVOS).optional(),
  productId: z4.string().uuid().optional(),
  categoryId: z4.string().uuid().optional(),
  unitId: z4.string().uuid().optional(),
  userId: z4.string().uuid().optional(),
  startDate: z4.coerce.date().optional(),
  endDate: z4.coerce.date().optional(),
  sortOrder: z4.enum(["asc", "desc"]).optional()
});
async function filtrarMovimentacoes(q, unidade) {
  const cond = [];
  if (q.search) {
    cond.push({
      OR: [
        { productName: contem(q.search) },
        { notes: contem(q.search) },
        { product: { model: contem(q.search) } }
      ]
    });
  }
  if (q.type) cond.push({ type: q.type });
  if (q.reason) cond.push({ reason: q.reason });
  if (q.productId) cond.push({ productId: q.productId });
  if (q.userId) cond.push({ userId: q.userId });
  if (q.categoryId) cond.push({ product: { categoryId: { in: await comAsFilhas(q.categoryId) } } });
  if (unidade) cond.push({ unitId: unidade });
  const periodo2 = intervalo(q.startDate, q.endDate);
  if (periodo2) cond.push({ createdAt: periodo2 });
  return cond.length ? { AND: cond } : {};
}
rotasMovimentacoes.get(
  "/",
  rota(async (req, res) => {
    const q = validar(filtros, semVazios(req.query));
    const p = paginacao(q);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = await filtrarMovimentacoes(q, unidade);
    const [lista, total, agrupado] = await Promise.all([
      db.stockMovement.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: q.sortOrder === "asc" ? "asc" : "desc" },
        include: {
          user: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          product: {
            select: { id: true, name: true, model: true, category: { select: { name: true } } }
          }
        }
      }),
      db.stockMovement.count({ where }),
      db.stockMovement.groupBy({ by: ["type"], where, _sum: { quantity: true }, _count: true })
    ]);
    const unidades = await db.unit.findMany({ select: { id: true, name: true } });
    const nome = (id) => unidades.find((u) => u.id === id)?.name ?? null;
    res.json(
      limpar({
        ...paginado(
          lista.map((m) => ({
            ...m,
            originUnitName: nome(m.originUnitId),
            destinationUnitName: nome(m.destinationUnitId)
          })),
          total,
          p
        ),
        summary: Object.fromEntries(
          agrupado.map((g) => [g.type, { count: g._count, quantity: g._sum.quantity ?? 0 }])
        )
      })
    );
  })
);
var ajusteSchema = z4.object({
  productId: z4.string().uuid(),
  unitId: z4.string().uuid(),
  /** Saldo que o estoque deve passar a ter naquela unidade. */
  newQuantity: z4.coerce.number().int().min(0, "O saldo n\xE3o pode ser negativo"),
  notes: z4.string().trim().min(3, "Explique o motivo da corre\xE7\xE3o").max(1e3)
});
rotasMovimentacoes.post(
  "/ajuste",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const dados = validar(ajusteSchema, req.body);
    exigirAcessoNaUnidade(req.usuario, dados.unitId);
    const produto = await db.product.findUnique({ where: { id: dados.productId } });
    if (!produto) throw naoEncontrado("Produto");
    const atual = await db.stock.findUnique({
      where: { productId_unitId: { productId: dados.productId, unitId: dados.unitId } }
    });
    const saldoAtual = atual?.quantity ?? 0;
    const diferenca = dados.newQuantity - saldoAtual;
    if (diferenca === 0) {
      throw new AppError(`O saldo j\xE1 \xE9 ${saldoAtual}. Nada a corrigir.`);
    }
    const resultado = await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: dados.unitId,
      tipo: "AJUSTE",
      motivo: "AJUSTE",
      sentido: diferenca > 0 ? "entra" : "sai",
      quantidade: Math.abs(diferenca),
      observacao: dados.notes,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({ acao: "AJUSTE", entidade: "Stock", id: produto.id, req });
    res.json({ ...resultado, message: `Saldo corrigido de ${saldoAtual} para ${dados.newQuantity}.` });
  })
);

// server/produtos.ts
import { Router as Router6 } from "express";
import { z as z5 } from "zod";
var rotasProdutos = Router6();
rotasProdutos.use(autenticar, exigir("produtos.ver"));
var COM_RELACOES = {
  category: true,
  supplier: true,
  photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
  stock: { include: { unit: { select: { id: true, name: true, type: true } } } }
};
function formatar(produto, unidadeId) {
  const porUnidade = produto.stock.map((linha) => ({
    unitId: linha.unitId,
    unitName: linha.unit.name,
    quantity: linha.quantity
  }));
  const total = porUnidade.reduce((soma, u) => soma + u.quantity, 0);
  const daUnidade = unidadeId ? porUnidade.find((u) => u.unitId === unidadeId)?.quantity ?? 0 : total;
  return limpar({
    ...produto,
    photos: produto.photos.map((f) => `/api/fotos/${f.id}`),
    stock: porUnidade,
    totalQuantity: total,
    quantity: daUnidade
  });
}
var ORDENAVEIS = [
  "name",
  "brand",
  "model",
  "costPrice",
  "salePrice",
  "status",
  "entryDate",
  "createdAt",
  "category.name",
  "supplier.name"
];
var texto2 = z5.string().trim().max(500).optional().nullable().transform((v) => v || null);
var dinheiro = z5.coerce.number().min(0, "O valor n\xE3o pode ser negativo").max(99999999);
var foto = z5.string().max(4e6);
var produtoSchema = z5.object({
  name: z5.string().trim().min(2, "Informe o nome do produto").max(180),
  categoryId: z5.string().uuid("Selecione uma categoria"),
  supplierId: z5.string().uuid().optional().nullable().or(z5.literal("").transform(() => null)),
  brand: texto2,
  model: texto2,
  color: texto2,
  capacity: texto2,
  lote: texto2,
  condicao: texto2,
  quantity: z5.coerce.number().int().min(0, "A quantidade n\xE3o pode ser negativa").default(0),
  /** Onde o estoque inicial entra. */
  unitId: z5.string().uuid().optional().nullable(),
  minQuantity: z5.coerce.number().int().min(0).default(1),
  costPrice: dinheiro.default(0),
  salePrice: dinheiro.default(0),
  wholesalePrice: dinheiro.optional().nullable(),
  imei: texto2,
  serialNumber: texto2,
  barcode: texto2,
  notes: z5.string().trim().max(2e3).optional().nullable(),
  status: z5.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).default("EM_ESTOQUE"),
  entryDate: z5.coerce.date().optional(),
  photos: z5.array(foto).max(8).optional()
});
var alterarSchema = produtoSchema.partial().extend({ reason: z5.string().trim().max(200).optional() });
var filtrosSchema = z5.object({
  page: z5.coerce.number().int().min(1).optional(),
  pageSize: z5.coerce.number().int().min(1).max(200).optional(),
  search: z5.string().trim().optional(),
  categoryId: z5.string().uuid().optional(),
  supplierId: z5.string().uuid().optional(),
  status: z5.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).optional(),
  brand: z5.string().trim().optional(),
  model: z5.string().trim().optional(),
  condicao: z5.string().trim().optional(),
  lowStock: z5.enum(["true", "false"]).optional(),
  unitId: z5.string().uuid().optional(),
  sortBy: z5.string().optional(),
  sortOrder: z5.enum(["asc", "desc"]).optional()
});
async function filtrarProdutos(q, unidadeId) {
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
        { condicao: contem(q.search) },
        { barcode: contem(q.search) },
        { color: contem(q.search) },
        { supplier: { name: contem(q.search) } },
        { category: { name: contem(q.search) } }
      ]
    });
  }
  if (q.categoryId) cond.push({ categoryId: { in: await comAsFilhas(q.categoryId) } });
  if (q.supplierId) cond.push({ supplierId: q.supplierId });
  if (q.status) cond.push({ status: q.status });
  if (q.brand) cond.push({ brand: contem(q.brand) });
  if (q.model) cond.push({ model: contem(q.model) });
  if (q.condicao === "__sem__") cond.push({ OR: [{ condicao: null }, { condicao: "" }] });
  else if (q.condicao) cond.push({ condicao: q.condicao });
  if (q.lowStock === "true") {
    const baixos = await estoqueBaixo(unidadeId, 500);
    cond.push({ id: { in: baixos.map((b) => b.productId) } });
  }
  if (unidadeId) cond.push({ stock: { some: { unitId: unidadeId } } });
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
        where: { OR: [{ customerName: t }, { customerPhone: t }, { items: { some: { productName: t } } }] },
        include: { items: { select: { productName: true } } },
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
      products: produtos.map((produto) => formatar(produto)),
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
    const q = validar(filtrosSchema, semVazios(req.query));
    const p = paginacao(q);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = await filtrarProdutos(q, unidade);
    const ordem = q.sortBy === "quantity" ? "name" : q.sortBy;
    const { condicao: _naFrente, ...semCondicao } = q;
    const wherePorCondicao = await filtrarProdutos(semCondicao, unidade);
    const [lista, total, condicoes] = await Promise.all([
      db.product.findMany({
        where,
        include: COM_RELACOES,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(ordem, q.sortOrder, ORDENAVEIS, { createdAt: "desc" })
      }),
      db.product.count({ where }),
      db.product.groupBy({ by: ["condicao"], where: wherePorCondicao, _count: true })
    ]);
    res.json({
      ...paginado(lista.map((produto) => formatar(produto, unidade)), total, p),
      condicoes: condicoes.map((c) => ({ condicao: c.condicao, produtos: c._count }))
    });
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
          include: { user: { select: { name: true } }, unit: { select: { name: true } } }
        },
        // Últimas vendas deste produto, vindas dos itens.
        saleItems: {
          orderBy: { sale: { saleDate: "desc" } },
          take: 10,
          include: {
            sale: {
              select: {
                code: true,
                saleDate: true,
                customerName: true,
                unit: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    if (!produto) throw naoEncontrado("Produto");
    const porUnidade = await saldosDoProduto(produto.id);
    const emTransito = await db.stockTransfer.aggregate({
      where: { productId: produto.id, status: { in: ["PENDENTE", "EM_TRANSITO"] } },
      _sum: { quantity: true }
    });
    const disponivel2 = porUnidade.reduce((soma, u) => soma + u.quantity, 0);
    const transito = emTransito._sum.quantity ?? 0;
    res.json({
      ...formatar(produto),
      stock: porUnidade,
      inTransit: transito,
      totalAvailable: disponivel2,
      totalPhysical: disponivel2 + transito
    });
  })
);
rotasProdutos.post(
  "/",
  exigir("produtos.editar"),
  rota(async (req, res) => {
    const { photos, quantity, unitId, ...dados } = validar(produtoSchema, req.body);
    const { novas } = separarFotos(photos ?? []);
    let unidadeDestino = unitId ?? req.usuario?.unidadeId ?? null;
    if (!unidadeDestino) {
      const matriz = await db.unit.findFirst({
        where: { active: true },
        orderBy: [{ type: "asc" }, { name: "asc" }]
      });
      unidadeDestino = matriz?.id ?? null;
    }
    if (quantity > 0 && !unidadeDestino) {
      throw new AppError("Cadastre uma unidade antes de lan\xE7ar estoque.");
    }
    if (unidadeDestino) {
      const destino = await db.unit.findUnique({ where: { id: unidadeDestino } });
      if (!destino) throw naoEncontrado("Unidade");
      if (!destino.active) throw new AppError(`A unidade ${destino.name} est\xE1 desativada.`);
      exigirAcessoNaUnidade(req.usuario, unidadeDestino);
    }
    const produto = await db.product.create({
      data: {
        ...dados,
        supplierId: dados.supplierId || null,
        photos: novas.length ? { create: novas } : void 0
      },
      include: COM_RELACOES
    });
    if (quantity > 0 && unidadeDestino) {
      await movimentar({
        produtoId: produto.id,
        produtoNome: produto.name,
        unidadeId: unidadeDestino,
        tipo: "ENTRADA",
        motivo: "CADASTRO",
        quantidade: quantity,
        observacao: "Estoque inicial do cadastro",
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome
      });
    }
    await registrarLog({ acao: "CREATE", entidade: "Product", id: produto.id, req });
    const completo = await db.product.findUnique({
      where: { id: produto.id },
      include: COM_RELACOES
    });
    res.status(201).json(formatar(completo));
  })
);
rotasProdutos.put(
  "/:id",
  exigir("produtos.editar"),
  rota(async (req, res) => {
    const { photos, reason, quantity: _ignorada, unitId: _tambem, ...dados } = validar(
      alterarSchema,
      req.body
    );
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
    await registrarLog({
      acao: "UPDATE",
      entidade: "Product",
      id: produto.id,
      alteracoes: { motivo: reason },
      req
    });
    res.json(formatar(produto));
  })
);
rotasProdutos.patch(
  "/:id/stock",
  exigir("estoque.movimentar"),
  rota(async (req, res) => {
    const { quantity, reason, unitId } = validar(
      z5.object({
        quantity: z5.coerce.number().int().refine((v) => v !== 0, "Informe uma quantidade diferente de zero"),
        reason: z5.string().trim().min(3, "Informe o motivo do ajuste").max(200),
        unitId: z5.string().uuid("Selecione a unidade").optional()
      }),
      req.body
    );
    const unidade = unitId ?? req.usuario?.unidadeId;
    if (!unidade) throw new AppError("Selecione a unidade onde o estoque ser\xE1 ajustado.");
    const produto = await db.product.findUnique({ where: { id: req.params.id } });
    if (!produto) throw naoEncontrado("Produto");
    await movimentar({
      produtoId: produto.id,
      produtoNome: produto.name,
      unidadeId: unidade,
      tipo: quantity > 0 ? "ENTRADA" : "SAIDA",
      motivo: "AJUSTE",
      quantidade: Math.abs(quantity),
      observacao: reason,
      usuarioId: req.usuario?.id,
      usuarioNome: req.usuario?.nome
    });
    await registrarLog({ acao: "ADJUST_STOCK", entidade: "Product", id: produto.id, req });
    const completo = await db.product.findUnique({ where: { id: produto.id }, include: COM_RELACOES });
    res.json(formatar(completo));
  })
);
rotasProdutos.delete(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const produto = await db.product.findUnique({ where: { id: req.params.id }, include: COM_RELACOES });
    if (!produto) throw naoEncontrado("Produto");
    const motivo = req.query.reason || "Produto exclu\xEDdo do sistema";
    for (const linha of produto.stock) {
      if (linha.quantity <= 0) continue;
      await movimentar({
        produtoId: produto.id,
        produtoNome: produto.name,
        unidadeId: linha.unitId,
        tipo: "SAIDA",
        motivo: "EXCLUSAO",
        quantidade: linha.quantity,
        observacao: motivo,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome
      });
    }
    const vendas = await db.saleItem.count({ where: { productId: produto.id } });
    if (vendas > 0) {
      await db.product.update({ where: { id: produto.id }, data: { status: "VENDIDO" } });
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
var rotasFotos = Router6();
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
import { Router as Router8 } from "express";
import { z as z7 } from "zod";

// server/exportar.ts
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
function agrupar(r) {
  if (!r.group) return [{ titulo: "", linhas: r.rows }];
  const mapa = /* @__PURE__ */ new Map();
  for (const linha of r.rows) {
    const chave = String(linha[r.group.key] ?? "\u2014") || "\u2014";
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(linha);
  }
  const ordem = r.group.order ?? [];
  return [...mapa.entries()].sort(([a], [b]) => {
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b, "pt-BR");
  }).map(([titulo, linhas]) => ({ titulo, linhas }));
}
var somarBloco = (linhas, chaves) => Object.fromEntries(
  chaves.map((k) => [k, linhas.reduce((s, l) => s + (Number(l[k]) || 0), 0)])
);
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
  for (const bloco of agrupar(r)) {
    if (bloco.titulo) {
      linhas.push("");
      linhas.push(escapar(`${bloco.titulo.toUpperCase()} (${bloco.linhas.length})`));
    }
    for (const linha of bloco.linhas) {
      linhas.push(r.columns.map((c) => escapar(valorDaCelula(c, linha))).join(";"));
    }
    if (bloco.titulo && r.group?.totals?.length) {
      const somas = somarBloco(bloco.linhas, r.group.totals);
      linhas.push(
        r.columns.map(
          (c, i) => r.group.totals.includes(c.key) ? escapar(String(c.format ? c.format(somas[c.key]) : somas[c.key])) : i === 0 ? escapar(`Total ${bloco.titulo}`) : ""
        ).join(";")
      );
    }
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
  const titulos = [];
  const subtotais = [];
  for (const bloco of agrupar(r)) {
    if (bloco.titulo) {
      const linha = aba.addRow({
        [r.columns[0].key]: `${bloco.titulo.toUpperCase()} \u2014 ${bloco.linhas.length} item(ns)`
      });
      titulos.push(linha.number);
    }
    for (const linha of bloco.linhas) {
      aba.addRow(Object.fromEntries(r.columns.map((c) => [c.key, valorDaCelula(c, linha)])));
    }
    if (bloco.titulo && r.group?.totals?.length) {
      const somas = somarBloco(bloco.linhas, r.group.totals);
      const linha = aba.addRow(
        Object.fromEntries(
          r.columns.map((c, i) => [
            c.key,
            r.group.totals.includes(c.key) ? c.format ? c.format(somas[c.key]) : somas[c.key] : i === 0 ? `Total ${bloco.titulo}` : ""
          ])
        )
      );
      subtotais.push(linha.number);
    }
  }
  aba.eachRow((linha, indice) => {
    if (indice === 1) return;
    if (titulos.includes(indice)) {
      linha.eachCell((celula) => {
        celula.font = { bold: true, color: { argb: "FFFFFFFF" } };
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      });
      return;
    }
    if (subtotais.includes(indice)) {
      linha.eachCell((celula) => {
        celula.font = { bold: true };
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      });
      return;
    }
    linha.eachCell((celula) => {
      celula.alignment = { vertical: "middle" };
      if (indice % 2 === 0) {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      }
    });
  });
  if (!r.group) {
    aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: r.columns.length } };
  }
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
var PADDING = 5;
var ALTURA_MINIMA = 17;
function enviarPdf(res, entrada) {
  const r = entrada.group ? { ...entrada, columns: entrada.columns.filter((c) => c.key !== entrada.group.key) } : entrada;
  const doc = new PDFDocument({
    margin: 30,
    size: "A4",
    layout: "landscape",
    // Necessário para numerar "página X de Y": o total só se sabe no fim.
    bufferPages: true
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${nomeDoArquivo(r.title, "pdf")}"`);
  doc.pipe(res);
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x0 = doc.page.margins.left;
  const rodapeY = doc.page.height - doc.page.margins.bottom - 14;
  const larguras = (() => {
    const cabecalhos = r.columns.map((c) => c.header.toUpperCase());
    const largoNoCabecalho = (t) => {
      doc.font("Helvetica-Bold").fontSize(7.5);
      return doc.widthOfString(t);
    };
    const largoNaLinha = (t) => {
      doc.font("Helvetica").fontSize(8);
      return doc.widthOfString(t);
    };
    const celulas = r.columns.map((c) => r.rows.map((linha) => String(valorDaCelula(c, linha) ?? "")));
    const piso = r.columns.map((_, i) => {
      const doTitulo = cabecalhos[i].split(/\s+/).reduce((m, w) => Math.max(m, largoNoCabecalho(w)), 0);
      const daLinha = celulas[i].flatMap((t) => t.split(/\s+/)).reduce((m, w) => Math.max(m, largoNaLinha(w)), 0);
      return Math.max(doTitulo, daLinha) + PADDING * 2 + 1;
    });
    const ideal = r.columns.map((_, i) => {
      const maior = Math.max(
        largoNoCabecalho(cabecalhos[i]),
        ...celulas[i].map(largoNaLinha),
        0
      );
      return Math.min(Math.max(maior + PADDING * 2 + 1, piso[i]), largura * 0.22);
    });
    const somaPiso = piso.reduce((a, b) => a + b, 0);
    const somaIdeal = ideal.reduce((a, b) => a + b, 0);
    if (somaIdeal <= largura) {
      return ideal.map((v) => v / somaIdeal * largura);
    }
    if (somaPiso <= largura) {
      const folga = largura - somaPiso;
      const fome = ideal.map((v, i) => Math.max(0, v - piso[i]));
      const somaFome = fome.reduce((a, b) => a + b, 0) || 1;
      return piso.map((v, i) => v + fome[i] / somaFome * folga);
    }
    return piso.map((v) => v / somaPiso * largura);
  })();
  const marca = () => {
    doc.rect(0, 0, doc.page.width, 66).fill(AZUL);
    doc.fillColor("#FFFFFF").fontSize(17).font("Helvetica-Bold").text("Rafa Multimarcas", x0, 16);
    doc.fontSize(10).font("Helvetica").text(r.title, x0, 39);
    doc.fontSize(8).fillColor("#CBD5E1").text(`Gerado em ${dataHora()}`, x0, 40, {
      width: largura,
      align: "right"
    });
    doc.fillColor(AZUL);
  };
  const alturaDoTexto = (texto3, i) => doc.heightOfString(texto3, { width: larguras[i] - PADDING * 2, align: r.columns[i].align ?? "left" });
  const faixaDeTitulos = () => {
    doc.font("Helvetica-Bold").fontSize(7.5);
    const titulos = r.columns.map((c) => c.header.toUpperCase());
    const altura = Math.max(
      18,
      ...titulos.map((t, i) => alturaDoTexto(t, i) + PADDING * 2)
    );
    const y = doc.y;
    doc.rect(x0, y, largura, altura).fill("#E2E8F0");
    doc.fillColor(AZUL);
    let x = x0;
    titulos.forEach((t, i) => {
      doc.text(t, x + PADDING, y + PADDING, {
        width: larguras[i] - PADDING * 2,
        align: r.columns[i].align ?? "left"
      });
      x += larguras[i];
    });
    doc.y = y + altura;
  };
  const abrirPagina = (primeira) => {
    if (!primeira) doc.addPage();
    marca();
    doc.y = 80;
    if (r.subtitle) {
      doc.fontSize(9).font("Helvetica").fillColor("#475569").text(r.subtitle, x0, doc.y, { width: largura });
      doc.y += 6;
    }
    faixaDeTitulos();
  };
  const blocos = agrupar(r);
  abrirPagina(true);
  const desenharLinha = (linha, indice) => {
    doc.font("Helvetica").fontSize(8);
    const textos = r.columns.map((c) => String(valorDaCelula(c, linha) ?? ""));
    const altura = Math.max(
      ALTURA_MINIMA,
      ...textos.map((t, i) => alturaDoTexto(t, i) + PADDING * 2)
    );
    if (doc.y + altura > rodapeY - 10) {
      abrirPagina(false);
      doc.font("Helvetica").fontSize(8);
    }
    const y = doc.y;
    if (indice % 2 === 1) doc.rect(x0, y, largura, altura).fill("#F8FAFC");
    doc.fillColor("#1E293B");
    let x = x0;
    textos.forEach((t, i) => {
      doc.text(t, x + PADDING, y + PADDING, {
        width: larguras[i] - PADDING * 2,
        align: r.columns[i].align ?? "left"
      });
      x += larguras[i];
    });
    doc.moveTo(x0, y + altura).lineTo(x0 + largura, y + altura).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
    doc.y = y + altura;
  };
  for (const bloco of blocos) {
    if (bloco.titulo) {
      if (doc.y + 46 > rodapeY - 10) abrirPagina(false);
      doc.y += 8;
      const y = doc.y;
      doc.rect(x0, y, largura, 20).fill(AZUL);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(bloco.titulo.toUpperCase(), x0 + PADDING, y + 6, { lineBreak: false });
      doc.font("Helvetica").fontSize(8).text(`${bloco.linhas.length} ${bloco.linhas.length === 1 ? "item" : "itens"}`, x0, y + 6, {
        width: largura - PADDING,
        align: "right",
        lineBreak: false
      });
      doc.y = y + 20;
    }
    bloco.linhas.forEach(desenharLinha);
    if (bloco.titulo && r.group?.totals?.length) {
      const somas = somarBloco(bloco.linhas, r.group.totals);
      if (doc.y + 18 > rodapeY - 10) abrirPagina(false);
      const y = doc.y;
      doc.rect(x0, y, largura, 18).fill("#E2E8F0");
      doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(8);
      const primeiroTotal = r.columns.findIndex((c) => r.group.totals.includes(c.key));
      const larguraDoRotulo = larguras.slice(0, primeiroTotal === -1 ? larguras.length : primeiroTotal).reduce((a, b) => a + b, 0);
      doc.text(`Total \xB7 ${bloco.titulo}`, x0 + PADDING, y + 5, {
        width: Math.max(60, larguraDoRotulo - PADDING * 2),
        lineBreak: false,
        ellipsis: true
      });
      let x = x0;
      r.columns.forEach((c, i) => {
        if (r.group.totals.includes(c.key)) {
          doc.text(String(c.format ? c.format(somas[c.key]) : somas[c.key]), x + PADDING, y + 5, {
            width: larguras[i] - PADDING * 2,
            align: c.align ?? "right",
            lineBreak: false,
            ellipsis: true
          });
        }
        x += larguras[i];
      });
      doc.y = y + 18;
    }
  }
  if (r.summary?.length) {
    const alturaResumo = 26 + Math.ceil(r.summary.length / 3) * 16;
    if (doc.y + alturaResumo > rodapeY - 10) abrirPagina(false);
    doc.y += 12;
    const y = doc.y;
    doc.rect(x0, y, largura, alturaResumo).fill("#F1F5F9");
    doc.fillColor(AZUL).font("Helvetica-Bold").fontSize(9).text("Resumo", x0 + PADDING, y + 7);
    const colunas = 3;
    const larguraItem = (largura - PADDING * 2) / colunas;
    r.summary.forEach((item, i) => {
      const cx = x0 + PADDING + i % colunas * larguraItem;
      const cy = y + 24 + Math.floor(i / colunas) * 16;
      doc.font("Helvetica").fontSize(8).fillColor("#64748B").text(`${item.label}: `, cx, cy, {
        width: larguraItem - 6,
        continued: true
      });
      doc.font("Helvetica-Bold").fillColor(AZUL).text(item.value);
    });
    doc.y = y + alturaResumo;
  }
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i += 1) {
    doc.switchToPage(paginas.start + i);
    doc.font("Helvetica").fontSize(7.5).fillColor("#94A3B8").text(`${r.title} \xB7 p\xE1gina ${i + 1} de ${paginas.count}`, x0, rodapeY, {
      width: largura,
      align: "center",
      lineBreak: false
    });
  }
  doc.flushPages();
  doc.end();
}
var dataHora = () => (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
async function exportar(res, formato, r) {
  if (formato === "pdf") return enviarPdf(res, r);
  if (formato === "csv") return enviarCsv(res, r);
  if (formato === "xlsx" || formato === "excel") return enviarExcel(res, r);
  res.json(r);
}
var reais = (v) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
var decimal = (v) => Number(v ?? 0).toFixed(2).replace(".", ",");

// shared/ordenar.ts
var CAPACIDADE = /(\d+)\s*(GB|TB)\b|\b\d+\s*\/\s*(\d+)\b/i;
function capacidadeEmGB(nome, campo) {
  const alvo = campo?.trim() || nome;
  const achou = alvo.match(CAPACIDADE);
  if (!achou) return 0;
  if (achou[3]) return Number(achou[3]);
  const valor = Number(achou[1]);
  return achou[2]?.toUpperCase() === "TB" ? valor * 1024 : valor;
}
var emGigas = (nome) => nome.replace(/(\d+)\s*TB\b/gi, (_, n) => `${Number(n) * 1024}GB`);
function compararNatural(a, b) {
  const limpar2 = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const pa = limpar2(a).match(/\d+|\D+/g) ?? [];
  const pb = limpar2(b).match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i];
    const y = pb[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else {
      if (x < y) return -1;
      if (x > y) return 1;
    }
  }
  return 0;
}
function compararProdutos(a, b) {
  const porNome = compararNatural(emGigas(a.name), emGigas(b.name));
  if (porNome !== 0) return porNome;
  return capacidadeEmGB(a.name, a.capacity) - capacidadeEmGB(b.name, b.capacity);
}

// shared/lista-atacado.ts
var EMOJI_PADRAO = "\u{1F4E6}";
var POR_NOME = [
  { procura: /fone|headphone|airpod|earbud|buds/i, emoji: "\u{1F3A7}" },
  { procura: /watch|rel[oó]gio|smartwatch/i, emoji: "\u231A" },
  { procura: /jbl|boombox|partybox|partbox|caixa de som|som\b/i, emoji: "\u{1F509}" },
  { procura: /note ?book|macbook|laptop/i, emoji: "\u{1F4BB}" },
  { procura: /v[ií]deo ?game|playstation|xbox|nintendo|console/i, emoji: "\u{1F3AE}" },
  { procura: /\btvs?\b|televis/i, emoji: "\u{1F4FA}" },
  { procura: /celular|iphone|smartphone|xiaomi|redmi|poco|realme|samsung|motorola|aparelho/i, emoji: "\u{1F4F1}" }
];
function emojiSugerido(nomeDaCategoria) {
  const achou = POR_NOME.find((r) => r.procura.test(nomeDaCategoria));
  return achou?.emoji ?? EMOJI_PADRAO;
}
var RISCO_TOPO = "\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014";
var RISCO_CATEGORIA = "\u2014\u2014\u2013\u2014\u2014\u2013\u2014\u2014\u2013\u2014\u2014\u2013";
var CORES = [
  "PRETO",
  "PRETA",
  "BRANCO",
  "BRANCA",
  "AZUL",
  "VERDE",
  "VERMELHO",
  "VERMELHA",
  "ROXO",
  "ROXA",
  "ROSA",
  "AMARELO",
  "AMARELA",
  "LARANJA",
  "DOURADO",
  "DOURADA",
  "PRATA",
  "PRATEADO",
  "CINZA",
  "GRAFITE",
  "TITANIO",
  "BEGE",
  "LILAS",
  "CIANO",
  "MARROM",
  "CORAL",
  "MIDNIGHT",
  "STARLIGHT",
  "ESCURO",
  "CLARO",
  "FOSCO"
];
var semAcento = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
function nomeParaLista(bruto) {
  let nome = bruto.trim().replace(/\s+/g, " ");
  nome = nome.replace(/(\d+)\s*(gb|tb)\b/gi, (_, n, u) => `${n}${u.toUpperCase()}`);
  const partes = nome.split(" ");
  while (partes.length > 1 && CORES.includes(semAcento(partes[partes.length - 1]))) {
    partes.pop();
  }
  return partes.join(" ");
}
function familiaDoProduto(nome) {
  const partes = nomeParaLista(nome).split(" ").filter((t) => !/^\d+(GB|TB)$/i.test(t) && !/^\d+\s*\/\s*\d+$/.test(t));
  if (partes.length >= 3 && /^\d+$/.test(partes[partes.length - 1])) partes.pop();
  return semAcento(partes.join(" "));
}
function precoDaLista(valor) {
  const numero3 = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `R$ ${numero3}`;
}
function saudacao(hora) {
  if (hora < 12) return "BOM DIA";
  if (hora < 18) return "BOA TARDE";
  return "BOA NOITE";
}

// server/lista-atacado.ts
function agoraNaLoja(momento) {
  const data = momento.toLocaleDateString("pt-BR", {
    timeZone: FUSO_DA_LOJA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const hora = Number(
    momento.toLocaleString("pt-BR", { timeZone: FUSO_DA_LOJA, hour: "2-digit", hour12: false })
  );
  return { data, hora: Number.isFinite(hora) ? hora : 12 };
}
function montarListaDeAtacado(produtos, emojis, momento = /* @__PURE__ */ new Date()) {
  const { data, hora } = agoraNaLoja(momento);
  const partes = [RISCO_TOPO, `\u{1F4C5} ${saudacao(hora)} - ${data} \u{1F4C5}`, RISCO_TOPO, ""];
  const categorias = /* @__PURE__ */ new Map();
  for (const p of produtos) {
    const bloco = categorias.get(p.categoriaId);
    if (bloco) bloco.itens.push(p);
    else categorias.set(p.categoriaId, { nome: p.categoriaNome, ordem: p.categoriaOrdem, itens: [p] });
  }
  const ordenadas = [...categorias.entries()].sort(
    ([, a], [, b]) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  let totalDeLinhas = 0;
  let juntados = 0;
  for (const [categoriaId, bloco] of ordenadas) {
    const emoji = emojis[categoriaId]?.trim() || emojiSugerido(bloco.nome);
    partes.push(RISCO_CATEGORIA, `${emoji} ${bloco.nome}`, RISCO_CATEGORIA, "");
    const linhas = [];
    for (const p of [...bloco.itens].sort(compararProdutos)) {
      const nome = nomeParaLista(p.name);
      const repetida = linhas.some((l) => l.nome === nome && l.preco === p.atacado);
      if (repetida) {
        juntados += 1;
        continue;
      }
      linhas.push({ nome, preco: p.atacado, familia: familiaDoProduto(p.name) });
    }
    linhas.forEach((linha, i) => {
      if (i > 0 && linha.familia !== linhas[i - 1].familia) partes.push("");
      partes.push(`${emoji} - ${linha.nome} - ${precoDaLista(linha.preco)};`);
    });
    partes.push("");
    totalDeLinhas += linhas.length;
  }
  while (partes.length && partes[partes.length - 1] === "") partes.pop();
  return {
    texto: partes.join("\n"),
    resumo: { linhas: totalDeLinhas, categorias: ordenadas.length, juntados }
  };
}

// server/sistema.ts
import bcrypt3 from "bcryptjs";
import ExcelJS2 from "exceljs";
import { Router as Router7 } from "express";
import multer from "multer";
import { Readable } from "stream";
import { z as z6 } from "zod";

// shared/taxas.ts
var TAXAS_PADRAO = [
  { parcelas: 1, padrao: 5.5, elo: 6.5 },
  { parcelas: 2, padrao: 6, elo: 7 },
  { parcelas: 3, padrao: 6.5, elo: 7.5 },
  { parcelas: 4, padrao: 7, elo: 8 },
  { parcelas: 5, padrao: 7.5, elo: 8.5 },
  { parcelas: 6, padrao: 7.5, elo: 8.5 },
  { parcelas: 7, padrao: 8, elo: 9 },
  { parcelas: 8, padrao: 8.5, elo: 9.5 },
  { parcelas: 9, padrao: 9, elo: 10 },
  { parcelas: 10, padrao: 9.5, elo: 10.5 },
  { parcelas: 11, padrao: 10, elo: 11 },
  { parcelas: 12, padrao: 10.5, elo: 11.5 },
  { parcelas: 13, padrao: 14, elo: null },
  { parcelas: 14, padrao: 14.5, elo: null },
  { parcelas: 15, padrao: 15, elo: null },
  { parcelas: 16, padrao: 15.5, elo: null },
  { parcelas: 17, padrao: 16, elo: null },
  { parcelas: 18, padrao: 16.5, elo: null }
];
function taxaDe(tabela, parcelas, bandeira) {
  const linha = tabela.find((t) => t.parcelas === parcelas);
  if (!linha) return null;
  return bandeira === "elo" ? linha.elo ?? linha.padrao : linha.padrao;
}
function normalizarTaxas(bruto) {
  if (!Array.isArray(bruto)) return TAXAS_PADRAO;
  const limpas = bruto.map((linha) => {
    if (!linha || typeof linha !== "object") return null;
    const { parcelas, padrao, elo } = linha;
    const p = Number(parcelas);
    const t = Number(padrao);
    if (!Number.isInteger(p) || p < 1 || p > 24) return null;
    if (!Number.isFinite(t) || t < 0 || t >= 100) return null;
    const e = elo === null || elo === void 0 || elo === "" ? null : Number(elo);
    return {
      parcelas: p,
      padrao: t,
      elo: e !== null && Number.isFinite(e) && e >= 0 && e < 100 ? e : null
    };
  }).filter((l) => l !== null).sort((a, b) => a.parcelas - b.parcelas);
  return limpas.length ? limpas : TAXAS_PADRAO;
}

// shared/loja.ts
var LOJA_PADRAO = {
  nome: "Rafa Multimarcas",
  documento: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  telefone: "",
  email: "",
  rodape: ""
};
function normalizarLoja(bruto) {
  if (!bruto || typeof bruto !== "object") return LOJA_PADRAO;
  const dado = bruto;
  const texto3 = (chave) => typeof dado[chave] === "string" ? dado[chave].trim() : LOJA_PADRAO[chave];
  return {
    nome: texto3("nome") || LOJA_PADRAO.nome,
    documento: texto3("documento"),
    endereco: texto3("endereco"),
    bairro: texto3("bairro"),
    cidade: texto3("cidade"),
    uf: texto3("uf").toUpperCase().slice(0, 2),
    cep: texto3("cep"),
    telefone: texto3("telefone"),
    email: texto3("email"),
    rodape: texto3("rodape")
  };
}
var linhaDeEndereco = (l) => [l.endereco, l.bairro].filter(Boolean).join(" - ");
var linhaDeCidade = (l) => [[l.cidade, l.uf].filter(Boolean).join("/"), l.cep && `CEP: ${l.cep}`].filter(Boolean).join(" - ");

// server/sistema.ts
var rotasSistema = Router7();
var LEITURA_LIBERADA = /* @__PURE__ */ new Set([
  "/taxas-cartao",
  "/loja",
  "/unidade-de-venda",
  "/contas-pix",
  "/chave-de-acesso",
  "/emojis-categoria"
]);
rotasSistema.use(autenticar, (req, res, next) => {
  if (req.method === "GET" && LEITURA_LIBERADA.has(req.path)) return next();
  return exigir("configuracoes")(req, res, next);
});
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
    const [movimentos, unidades] = await Promise.all([
      db.stockMovement.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { name: true } },
          unit: { select: { name: true } },
          product: { include: { category: true } }
        }
      }),
      db.unit.findMany({ select: { id: true, name: true } })
    ]);
    const nome = (id) => unidades.find((u) => u.id === id)?.name ?? "";
    const total = await reescreverPlanilha(
      movimentos.map((m) => ({
        data: m.createdAt,
        produto: m.productName ?? m.product?.name ?? "\u2014",
        categoria: m.product?.category.name ?? "\u2014",
        unidade: m.unit?.name ?? "\u2014",
        tipo: TIPO_LABEL[m.type],
        quantidade: m.type === "ENTRADA" ? m.quantity : -m.quantity,
        estoqueAnterior: m.previousQuantity ?? 0,
        estoquePosterior: m.newQuantity ?? 0,
        origem: nome(m.originUnitId),
        destino: nome(m.destinationUnitId),
        usuario: m.user?.name ?? "",
        motivo: MOTIVO_LABEL[m.reason],
        observacao: m.notes ?? "",
        movimentoId: m.id
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
      db.stockMovement.findMany(),
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
  "Pre\xE7o de Atacado",
  "Fornecedor",
  "IMEI",
  "N\xFAmero de S\xE9rie",
  "Lote",
  "Condi\xE7\xE3o",
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
  atacado: "wholesalePrice",
  "preco de atacado": "wholesalePrice",
  "pre\xE7o de atacado": "wholesalePrice",
  fornecedor: "supplier",
  imei: "imei",
  "numero de serie": "serialNumber",
  "n\xFAmero de s\xE9rie": "serialNumber",
  serie: "serialNumber",
  lote: "lote",
  "condicao": "condicao",
  "condi\xE7\xE3o": "condicao",
  estado: "condicao",
  "lote da caixa": "lote",
  "codigo de barras": "barcode",
  "c\xF3digo de barras": "barcode",
  observacoes: "notes",
  observa\u00E7\u00F5es: "notes",
  obs: "notes"
};
var semAcento2 = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
      3950,
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
    const porCategoria = new Map(categorias.map((c) => [semAcento2(c.name), c]));
    categorias.forEach((c) => porCategoria.set(semAcento2(c.slug), c));
    const porFornecedor = new Map(fornecedores.map((f) => [semAcento2(f.name), f]));
    const unidadeDaImportacao = req.usuario?.unidadeId ?? (await db.unit.findFirst({ where: { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }))?.id ?? null;
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
      const categoria = porCategoria.get(semAcento2(dados.category ?? ""));
      if (!categoria) {
        erros.push({
          row: n,
          message: `Categoria "${dados.category || "(vazia)"}" n\xE3o encontrada. Use: ${categorias.map((c) => c.name).join(", ")}`
        });
        continue;
      }
      let fornecedorId = null;
      if (dados.supplier) {
        const chave = semAcento2(dados.supplier);
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
            costPrice: paraNumero(dados.costPrice),
            salePrice: paraNumero(dados.salePrice),
            wholesalePrice: dados.wholesalePrice ? paraNumero(dados.wholesalePrice) : null,
            imei: dados.imei || null,
            serialNumber: dados.serialNumber || null,
            lote: dados.lote || null,
            condicao: dados.condicao || null,
            barcode: dados.barcode || null,
            notes: dados.notes || null,
            categoryId: categoria.id,
            supplierId: fornecedorId
          }
        });
        if (quantidade > 0 && unidadeDaImportacao) {
          await movimentar({
            produtoId: produto.id,
            produtoNome: produto.name,
            unidadeId: unidadeDaImportacao,
            tipo: "ENTRADA",
            motivo: "CADASTRO",
            quantidade,
            observacao: "Importa\xE7\xE3o de planilha",
            usuarioId: req.usuario?.id,
            usuarioNome: req.usuario?.nome
          });
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
var CHAVE_TAXAS = "taxas_cartao";
async function taxasDoCartao() {
  const guardado = await db.setting.findUnique({ where: { key: CHAVE_TAXAS } });
  if (!guardado) return TAXAS_PADRAO;
  try {
    return normalizarTaxas(JSON.parse(guardado.value));
  } catch {
    return TAXAS_PADRAO;
  }
}
rotasSistema.get(
  "/taxas-cartao",
  rota(async (_req, res) => {
    res.json({ taxas: await taxasDoCartao(), padrao: TAXAS_PADRAO });
  })
);
rotasSistema.put(
  "/taxas-cartao",
  somenteAdmin,
  rota(async (req, res) => {
    const { taxas } = validar(
      z6.object({
        taxas: z6.array(
          z6.object({
            parcelas: z6.coerce.number().int().min(1).max(24),
            padrao: z6.coerce.number().min(0).max(99.99),
            elo: z6.coerce.number().min(0).max(99.99).optional().nullable()
          })
        ).min(1, "Informe ao menos uma linha").max(24)
      }),
      req.body
    );
    const limpas = normalizarTaxas(taxas);
    await db.setting.upsert({
      where: { key: CHAVE_TAXAS },
      update: { value: JSON.stringify(limpas) },
      create: { key: CHAVE_TAXAS, value: JSON.stringify(limpas) }
    });
    await registrarLog({ acao: "TAXAS_CARTAO", entidade: "Setting", id: CHAVE_TAXAS, req });
    res.json({ taxas: limpas, message: `${limpas.length} faixa(s) de parcelamento salvas.` });
  })
);
var CHAVE_LOJA = "dados_da_loja";
async function lojaSalva() {
  const guardado = await db.setting.findUnique({ where: { key: CHAVE_LOJA } });
  if (!guardado) return LOJA_PADRAO;
  try {
    return normalizarLoja(JSON.parse(guardado.value));
  } catch {
    return LOJA_PADRAO;
  }
}
rotasSistema.get(
  "/loja",
  rota(async (_req, res) => {
    res.json(await lojaSalva());
  })
);
rotasSistema.put(
  "/loja",
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(
      z6.object({
        nome: z6.string().trim().min(2, "Informe o nome da loja").max(120),
        documento: z6.string().trim().max(30).optional(),
        endereco: z6.string().trim().max(160).optional(),
        bairro: z6.string().trim().max(80).optional(),
        cidade: z6.string().trim().max(80).optional(),
        uf: z6.string().trim().max(2).optional(),
        cep: z6.string().trim().max(12).optional(),
        telefone: z6.string().trim().max(40).optional(),
        email: z6.string().trim().max(120).optional(),
        rodape: z6.string().trim().max(300).optional()
      }),
      req.body
    );
    const loja = normalizarLoja(dados);
    await db.setting.upsert({
      where: { key: CHAVE_LOJA },
      update: { value: JSON.stringify(loja) },
      create: { key: CHAVE_LOJA, value: JSON.stringify(loja) }
    });
    await registrarLog({ acao: "DADOS_DA_LOJA", entidade: "Setting", id: CHAVE_LOJA, req });
    res.json({ ...loja, message: "Dados da loja salvos. J\xE1 valem no pr\xF3ximo comprovante." });
  })
);
var CHAVE_UNIDADE = "unidade_de_venda";
async function unidadeDeVenda() {
  const guardado = await db.setting.findUnique({ where: { key: CHAVE_UNIDADE } });
  if (guardado) {
    const escolhida = await db.unit.findUnique({ where: { id: guardado.value } });
    if (escolhida?.active) return escolhida;
  }
  return db.unit.findFirst({ where: { active: true }, orderBy: [{ type: "asc" }, { name: "asc" }] });
}
rotasSistema.get(
  "/unidade-de-venda",
  rota(async (_req, res) => {
    const unidade = await unidadeDeVenda();
    res.json({ unitId: unidade?.id ?? null, name: unidade?.name ?? null });
  })
);
rotasSistema.put(
  "/unidade-de-venda",
  somenteAdmin,
  rota(async (req, res) => {
    const { unitId } = validar(z6.object({ unitId: z6.string().uuid() }), req.body);
    const unidade = await db.unit.findUnique({ where: { id: unitId } });
    if (!unidade) throw new AppError("Unidade n\xE3o encontrada", 404);
    if (!unidade.active) throw new AppError(`A unidade ${unidade.name} est\xE1 desativada.`);
    await db.setting.upsert({
      where: { key: CHAVE_UNIDADE },
      update: { value: unitId },
      create: { key: CHAVE_UNIDADE, value: unitId }
    });
    await registrarLog({ acao: "UNIDADE_DE_VENDA", entidade: "Setting", id: CHAVE_UNIDADE, req });
    res.json({ unitId, name: unidade.name, message: `As vendas passam a sair da ${unidade.name}.` });
  })
);
var CHAVE_PIX = "contas_pix";
async function contasDePix() {
  const guardado = await db.setting.findUnique({ where: { key: CHAVE_PIX } });
  if (!guardado) return [];
  try {
    const lista = JSON.parse(guardado.value);
    return Array.isArray(lista) ? lista.filter((c) => typeof c === "string" && c.trim()) : [];
  } catch {
    return [];
  }
}
rotasSistema.get(
  "/contas-pix",
  rota(async (_req, res) => {
    res.json({ contas: await contasDePix() });
  })
);
rotasSistema.put(
  "/contas-pix",
  somenteAdmin,
  rota(async (req, res) => {
    const { contas } = validar(
      z6.object({ contas: z6.array(z6.string().trim().min(1).max(60)).max(12) }),
      req.body
    );
    const limpas = [...new Set(contas.map((c) => c.trim()).filter(Boolean))];
    await db.setting.upsert({
      where: { key: CHAVE_PIX },
      update: { value: JSON.stringify(limpas) },
      create: { key: CHAVE_PIX, value: JSON.stringify(limpas) }
    });
    await registrarLog({ acao: "CONTAS_PIX", entidade: "Setting", id: CHAVE_PIX, req });
    res.json({ contas: limpas, message: `${limpas.length} conta(s) de Pix salvas.` });
  })
);
var CHAVE_ACESSO = "chave_de_acesso";
async function conferirChaveDeAcesso(chave) {
  if (!chave?.trim()) return false;
  const guardada = await db.setting.findUnique({ where: { key: CHAVE_ACESSO } });
  if (!guardada) return false;
  return bcrypt3.compare(chave.trim(), guardada.value);
}
async function temChaveDeAcesso() {
  return Boolean(await db.setting.findUnique({ where: { key: CHAVE_ACESSO } }));
}
rotasSistema.get(
  "/chave-de-acesso",
  rota(async (_req, res) => {
    res.json({ definida: await temChaveDeAcesso() });
  })
);
rotasSistema.put(
  "/chave-de-acesso",
  somenteAdmin,
  rota(async (req, res) => {
    const { chave } = validar(
      z6.object({
        chave: z6.string().trim().min(4, "A chave precisa de ao menos 4 caracteres").max(60)
      }),
      req.body
    );
    await db.setting.upsert({
      where: { key: CHAVE_ACESSO },
      update: { value: await bcrypt3.hash(chave, 10) },
      create: { key: CHAVE_ACESSO, value: await bcrypt3.hash(chave, 10) }
    });
    await registrarLog({ acao: "CHAVE_DE_ACESSO", entidade: "Setting", id: CHAVE_ACESSO, req });
    res.json({ definida: true, message: "Chave de acesso salva." });
  })
);
rotasSistema.delete(
  "/chave-de-acesso",
  somenteAdmin,
  rota(async (req, res) => {
    await db.setting.deleteMany({ where: { key: CHAVE_ACESSO } });
    await registrarLog({ acao: "CHAVE_DE_ACESSO_REMOVIDA", entidade: "Setting", id: CHAVE_ACESSO, req });
    res.json({ definida: false, message: "Chave removida. Vender abaixo do atacado fica bloqueado." });
  })
);
var CHAVE_EMOJIS = "emojis_categoria";
async function emojisDeCategoria() {
  const guardado = await db.setting.findUnique({ where: { key: CHAVE_EMOJIS } });
  if (!guardado) return {};
  try {
    const mapa = JSON.parse(guardado.value);
    if (!mapa || typeof mapa !== "object") return {};
    return Object.fromEntries(
      Object.entries(mapa).filter(
        ([, v]) => typeof v === "string" && v.trim()
      )
    );
  } catch {
    return {};
  }
}
rotasSistema.get(
  "/emojis-categoria",
  rota(async (_req, res) => {
    res.json({ emojis: await emojisDeCategoria() });
  })
);
rotasSistema.put(
  "/emojis-categoria",
  somenteAdmin,
  rota(async (req, res) => {
    const { emojis } = validar(
      z6.object({
        // Curto de propósito: aqui cabe um emoji, não um rótulo. Dois ou
        // três símbolos ainda passam — há emoji que ocupa vários caracteres.
        emojis: z6.record(z6.string().uuid(), z6.string().trim().max(8))
      }),
      req.body
    );
    const limpos = Object.fromEntries(Object.entries(emojis).filter(([, v]) => v.trim()));
    await db.setting.upsert({
      where: { key: CHAVE_EMOJIS },
      update: { value: JSON.stringify(limpos) },
      create: { key: CHAVE_EMOJIS, value: JSON.stringify(limpos) }
    });
    await registrarLog({ acao: "EMOJIS_CATEGORIA", entidade: "Setting", id: CHAVE_EMOJIS, req });
    res.json({ emojis: limpos, message: "Emojis da lista salvos." });
  })
);

// server/relatorios.ts
var rotasRelatorios = Router8();
rotasRelatorios.use(autenticar, exigir("relatorios"));
var base = z7.object({
  format: z7.enum(["json", "pdf", "xlsx", "csv"]).default("json"),
  startDate: z7.coerce.date().optional(),
  endDate: z7.coerce.date().optional(),
  categoryId: z7.string().uuid().optional(),
  supplierId: z7.string().uuid().optional(),
  status: z7.enum(["EM_ESTOQUE", "RESERVADO", "VENDIDO"]).optional(),
  paymentMethod: z7.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA"]).optional(),
  unitId: z7.string().uuid().optional()
});
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
var precoDeVenda = (p) => numero(p.salePrice) || numero(p.wholesalePrice);
var qtd = (header, key, width = 8) => ({
  header,
  key,
  width,
  align: "right"
});
rotasRelatorios.get(
  "/stock",
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const entrada = intervalo(q.startDate, q.endDate);
    const linhasDeEstoque = await db.stock.findMany({
      where: {
        // Zerado não é estoque. A linha continua no banco depois que a
        // última peça sai, e listá-la faz o relatório da Hermes mostrar
        // mercadoria que só existe em outra unidade.
        quantity: { gt: 0 },
        ...unidade ? { unitId: unidade } : {},
        product: {
          ...q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {},
          ...q.supplierId ? { supplierId: q.supplierId } : {},
          ...q.status ? { status: q.status } : {},
          ...entrada ? { entryDate: entrada } : {}
        }
      },
      include: {
        unit: { select: { name: true } },
        product: { include: { category: true, supplier: true } }
      },
      // A ordem final é feita em memória: "menor para o maior" depende de
      // ler os números dentro do nome, e isso o banco não sabe fazer.
      orderBy: [{ unit: { name: "asc" } }, { product: { name: "asc" } }]
    });
    linhasDeEstoque.sort((a, b) => {
      const porProduto = compararProdutos(a.product, b.product);
      return porProduto !== 0 ? porProduto : a.unit.name.localeCompare(b.unit.name, "pt-BR");
    });
    const agrupadas = /* @__PURE__ */ new Map();
    for (const linha of linhasDeEstoque) {
      const chave = linha.productId;
      const atual = agrupadas.get(chave);
      if (atual) atual.quantity += linha.quantity;
      else agrupadas.set(chave, { product: linha.product, quantity: linha.quantity });
    }
    const linhas = [...agrupadas.values()].map(({ product: p, quantity }) => ({
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? "\u2014",
      quantity,
      costPrice: numero(p.costPrice),
      salePrice: numero(p.salePrice),
      wholesalePrice: p.wholesalePrice != null ? numero(p.wholesalePrice) : null,
      totalCost: numero(p.costPrice) * quantity,
      totalSale: precoDeVenda(p) * quantity,
      supplier: p.supplier?.name ?? "\u2014",
      status: STATUS_PRODUTO_LABEL[p.status] ?? p.status,
      entryDate: dataBR(p.entryDate)
    }));
    const custo = linhas.reduce((s, l) => s + l.totalCost, 0);
    const venda = linhas.reduce((s, l) => s + l.totalSale, 0);
    const nomeDaUnidade = unidade ? (await db.unit.findUnique({ where: { id: unidade }, select: { name: true } }))?.name ?? null : null;
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Estoque",
      // A unidade sai do rodapé de cada linha e vai para o cabeçalho: ela é
      // a mesma no relatório inteiro.
      subtitle: `${nomeDaUnidade ?? "Todas as unidades"} \xB7 ${periodo(q)}`,
      // Separado por condição: lacrado e vitrine são mercadorias
      // diferentes, com preço diferente, e misturá-las esconde o que a
      // loja tem de cada uma.
      // Separado por categoria — que agora carrega a condição:
      // "Celulares › Vitrine" é um bloco, "Celulares › Lacrado" é outro.
      group: { key: "category", totals: ["quantity", "totalCost", "totalSale"] },
      columns: [
        { header: "Produto", key: "name", width: 26 },
        { header: "Categoria", key: "category", width: 14 },
        { header: "Marca", key: "brand", width: 12 },
        qtd("Qtd", "quantity", 7),
        money("Custo", "costPrice", 10),
        money("Venda", "salePrice", 10),
        {
          header: "Atacado",
          key: "wholesalePrice",
          width: 10,
          align: "right",
          format: (v) => v == null ? "\u2014" : decimal(v)
        },
        money("Total custo", "totalCost", 12),
        money("Total venda", "totalSale", 12),
        { header: "Fornecedor", key: "supplier", width: 16 },
        { header: "Status", key: "status", width: 11 }
      ],
      rows: linhas,
      summary: [
        { label: "Linhas listadas", value: String(linhas.length) },
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
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);
    const itens = await db.saleItem.findMany({
      where: {
        sale: {
          status: "FINALIZADA",
          ...quando ? { saleDate: quando } : {},
          ...q.paymentMethod ? { paymentMethod: q.paymentMethod } : {},
          ...unidade ? { unitId: unidade } : {}
        },
        ...q.categoryId ? { product: { categoryId: { in: await comAsFilhas(q.categoryId) } } } : {},
        ...q.supplierId ? { product: { supplierId: q.supplierId } } : {}
      },
      include: {
        product: { include: { category: true } },
        sale: {
          include: {
            seller: { select: { name: true } },
            cashier: { select: { name: true } },
            unit: { select: { name: true } },
            payments: { orderBy: { amount: "desc" } }
          }
        }
      },
      orderBy: { sale: { saleDate: "desc" } }
    });
    itens.sort((a, b) => {
      const porProduto = compararProdutos(
        { name: a.productName ?? a.product.name, capacity: a.product.capacity },
        { name: b.productName ?? b.product.name, capacity: b.product.capacity }
      );
      return porProduto !== 0 ? porProduto : b.sale.saleDate.getTime() - a.sale.saleDate.getTime();
    });
    const linhas = itens.map((i) => {
      const total = numero(i.unitPrice) * i.quantity;
      return {
        code: i.sale.code,
        date: dataHoraCurta(i.sale.saleDate),
        unit: i.sale.unit.name,
        customer: i.sale.customerName ?? "\u2014",
        phone: i.sale.customerPhone ?? "\u2014",
        product: i.productName ?? i.product.name,
        category: i.product.category.name,
        imei: i.imei ?? i.serialNumber ?? "\u2014",
        quantity: i.quantity,
        unitPrice: numero(i.unitPrice),
        total,
        profit: total - numero(i.costPrice) * i.quantity,
        // Todas as formas, não só a principal: uma venda paga metade no
        // cartão e metade em aparelho mostraria só o cartão, e a troca
        // sumiria justamente de onde se confere o dinheiro.
        payment: i.sale.payments.length > 1 ? i.sale.payments.map((p) => `${PAGAMENTO_LABEL[p.method] ?? p.method} ${reais(numero(p.amount))}`).join(" + ") : PAGAMENTO_LABEL[i.sale.paymentMethod] ?? i.sale.paymentMethod,
        installments: i.sale.installments,
        seller: i.sale.seller?.name ?? i.sale.sellerName ?? "\u2014",
        cashier: i.sale.cashier?.name ?? "\u2014"
      };
    });
    const faturamento = linhas.reduce((s, l) => s + l.total, 0);
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Vendas",
      subtitle: periodo(q),
      group: { key: "category", totals: ["quantity", "total", "profit"] },
      columns: [
        // Larguras conferidas com dados reais: nome de aparelho e pagamento
        // dividido são os que estouram, e é neles que sobra espaço aqui.
        { header: "Venda", key: "code", width: 11 },
        { header: "Data", key: "date", width: 13 },
        { header: "Unidade", key: "unit", width: 10 },
        { header: "Cliente", key: "customer", width: 15 },
        { header: "Produto", key: "product", width: 26 },
        { header: "Categoria", key: "category", width: 11 },
        { header: "IMEI / s\xE9rie", key: "imei", width: 14 },
        qtd("Qtd", "quantity", 5),
        money("Unit.", "unitPrice", 11),
        money("Total", "total", 11),
        money("Lucro", "profit", 10),
        { header: "Pagamento", key: "payment", width: 26 },
        { header: "Vendedor", key: "seller", width: 13 },
        { header: "Caixa", key: "cashier", width: 11 }
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
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);
    const [categorias, linhasDeEstoque, vendas] = await Promise.all([
      db.category.findMany({ orderBy: { name: "asc" } }),
      db.stock.findMany({
        where: unidade ? { unitId: unidade } : {},
        select: {
          quantity: true,
          product: { select: { categoryId: true, costPrice: true, salePrice: true, wholesalePrice: true } }
        }
      }),
      db.saleItem.findMany({
        where: {
          sale: {
            status: "FINALIZADA",
            ...quando ? { saleDate: quando } : {},
            ...unidade ? { unitId: unidade } : {}
          }
        },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          product: { select: { categoryId: true, supplierId: true } }
        }
      })
    ]);
    const linhas = categorias.map((c) => {
      const doEstoque = linhasDeEstoque.filter((l) => l.product.categoryId === c.id);
      const daCategoria = vendas.filter((v) => v.product.categoryId === c.id);
      const faturamento = daCategoria.reduce((s, v) => s + numero(v.unitPrice) * v.quantity, 0);
      const custo = daCategoria.reduce((s, v) => s + numero(v.costPrice) * v.quantity, 0);
      return {
        category: c.name,
        products: doEstoque.length,
        stockQty: doEstoque.reduce((s, l) => s + l.quantity, 0),
        stockCost: doEstoque.reduce((s, l) => s + numero(l.product.costPrice) * l.quantity, 0),
        stockSale: doEstoque.reduce((s, l) => s + precoDeVenda(l.product) * l.quantity, 0),
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
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);
    const [fornecedores, linhasDeEstoque, vendas] = await Promise.all([
      db.supplier.findMany({ orderBy: { name: "asc" } }),
      db.stock.findMany({
        where: unidade ? { unitId: unidade } : {},
        select: { quantity: true, product: { select: { supplierId: true, costPrice: true } } }
      }),
      db.saleItem.findMany({
        where: {
          sale: {
            status: "FINALIZADA",
            ...quando ? { saleDate: quando } : {},
            ...unidade ? { unitId: unidade } : {}
          }
        },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          product: { select: { categoryId: true, supplierId: true } }
        }
      })
    ]);
    const linhas = fornecedores.map((f) => {
      const doEstoque = linhasDeEstoque.filter((l) => l.product.supplierId === f.id);
      const doFornecedor = vendas.filter((v) => v.product.supplierId === f.id);
      const faturamento = doFornecedor.reduce((s, v) => s + numero(v.unitPrice) * v.quantity, 0);
      const custo = doFornecedor.reduce((s, v) => s + numero(v.costPrice) * v.quantity, 0);
      return {
        supplier: f.name,
        active: f.active ? "Sim" : "N\xE3o",
        products: doEstoque.length,
        stockQty: doEstoque.reduce((s, l) => s + l.quantity, 0),
        invested: doEstoque.reduce((s, l) => s + numero(l.product.costPrice) * l.quantity, 0),
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
    const q = validar(base.extend({ groupBy: z7.enum(["day", "month"]).default("day") }), req.query);
    const quando = intervalo(q.startDate, q.endDate);
    const [vendas, movimentos] = await Promise.all([
      db.saleItem.findMany({
        where: { sale: { status: "FINALIZADA", ...quando ? { saleDate: quando } : {} } },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          sale: { select: { saleDate: true } }
        }
      }),
      db.stockMovement.findMany({
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
      const b = balde(chave(v.sale.saleDate));
      const total = numero(v.unitPrice) * v.quantity;
      b.quantity += v.quantity;
      b.revenue += total;
      b.profit += total - numero(v.costPrice) * v.quantity;
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
      base.extend({ type: z7.enum(["ENTRADA", "SAIDA", "TRANSFERENCIA", "AJUSTE"]).optional() }),
      req.query
    );
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);
    const movimentos = await db.stockMovement.findMany({
      where: {
        ...quando ? { createdAt: quando } : {},
        ...q.type ? { type: q.type } : {},
        ...unidade ? { unitId: unidade } : {},
        ...q.categoryId ? { product: { categoryId: { in: await comAsFilhas(q.categoryId) } } } : {}
      },
      include: {
        user: { select: { name: true } },
        unit: { select: { name: true } },
        product: { select: { model: true, category: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    const unidades = await db.unit.findMany({ select: { id: true, name: true } });
    const nome = (id) => unidades.find((u) => u.id === id)?.name ?? "\u2014";
    const linhas = movimentos.map((m) => ({
      date: dataHoraCurta(m.createdAt),
      unit: m.unit?.name ?? "\u2014",
      type: TIPO_LABEL[m.type] ?? m.type,
      reason: MOTIVO_LABEL[m.reason] ?? m.reason,
      product: m.productName ?? "\u2014",
      category: m.product?.category.name ?? "\u2014",
      quantity: m.type === "ENTRADA" ? m.quantity : -m.quantity,
      previous: m.previousQuantity ?? "\u2014",
      balance: m.newQuantity ?? "\u2014",
      origin: m.originUnitId ? nome(m.originUnitId) : "\u2014",
      destination: m.destinationUnitId ? nome(m.destinationUnitId) : "\u2014",
      user: m.user?.name ?? "\u2014",
      notes: m.notes ?? "\u2014"
    }));
    const somaPor = (tipo) => movimentos.filter((m) => m.type === tipo).reduce((s, m) => s + m.quantity, 0);
    await exportar(res, q.format, {
      title: "Relat\xF3rio de Movimenta\xE7\xF5es",
      subtitle: periodo(q),
      columns: [
        { header: "Data", key: "date", width: 15 },
        { header: "Unidade", key: "unit", width: 11 },
        { header: "Tipo", key: "type", width: 11 },
        { header: "Motivo", key: "reason", width: 15 },
        { header: "Produto", key: "product", width: 22 },
        { header: "Categoria", key: "category", width: 12 },
        qtd("Qtd", "quantity", 6),
        qtd("Antes", "previous", 7),
        qtd("Depois", "balance", 7),
        { header: "Origem", key: "origin", width: 11 },
        { header: "Destino", key: "destination", width: 11 },
        { header: "Usu\xE1rio", key: "user", width: 13 }
      ],
      rows: linhas,
      summary: [
        { label: "Movimenta\xE7\xF5es", value: String(linhas.length) },
        { label: "Entradas", value: String(somaPor("ENTRADA")) },
        { label: "Sa\xEDdas", value: String(somaPor("SAIDA")) },
        { label: "Transfer\xEAncias", value: String(somaPor("TRANSFERENCIA")) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/price-list",
  exigir("financeiro"),
  rota(async (req, res) => {
    const q = validar(
      base.extend({
        /** Quanto somar ao preço de compra. */
        markup: z7.coerce.number().min(0).max(999999).default(100),
        /** Mostrar o custo — só para conferência interna. */
        incluirCusto: z7.enum(["true", "false"]).default("false"),
        /** Deixar de fora o que está sem estoque. */
        somenteComEstoque: z7.enum(["true", "false"]).default("true")
      }),
      semVazios(req.query)
    );
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const mostrarCusto = q.incluirCusto === "true";
    const produtos = await db.product.findMany({
      where: {
        ...q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {},
        ...q.supplierId ? { supplierId: q.supplierId } : {},
        ...q.somenteComEstoque === "true" ? { stock: { some: { quantity: { gt: 0 }, ...unidade ? { unitId: unidade } : {} } } } : {}
      },
      include: {
        category: true,
        stock: unidade ? { where: { unitId: unidade } } : true
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }]
    });
    produtos.sort(
      (a, b) => a.category.name.localeCompare(b.category.name, "pt-BR") || compararProdutos(a, b)
    );
    const linhas = produtos.map((p) => {
      const custo = numero(p.costPrice);
      const emEstoque = p.stock.reduce((soma, l) => soma + l.quantity, 0);
      return {
        category: p.category.name,
        name: p.name,
        detalhe: [p.brand, p.model].filter(Boolean).join(" ") || "\u2014",
        categoria: p.category.name,
        capacidade: p.capacity ?? "\u2014",
        quantity: emEstoque,
        custo,
        // É este o número que o vendedor usa.
        preco: custo + q.markup
      };
    });
    const colunas = [
      { header: "Categoria", key: "category", width: 14 },
      { header: "Produto", key: "name", width: 26 },
      { header: "Marca / modelo", key: "detalhe", width: 16 },
      { header: "Categoria", key: "categoria", width: 16 },
      { header: "Capacidade", key: "capacidade", width: 12 },
      qtd("Estoque", "quantity", 8),
      ...mostrarCusto ? [money("Custo", "custo", 11)] : [],
      money("PRE\xC7O DE VENDA", "preco", 14)
    ];
    await exportar(res, q.format, {
      title: "Tabela de Pre\xE7os",
      subtitle: `Pre\xE7o = custo + ${reais(q.markup)}` + (unidade ? ` \xB7 estoque da unidade selecionada` : "") + (mostrarCusto ? " \xB7 CONT\xC9M O CUSTO \u2014 uso interno" : " \xB7 n\xE3o mostra o pre\xE7o de compra"),
      columns: colunas,
      rows: linhas,
      summary: [
        { label: "Produtos na lista", value: String(linhas.length) },
        { label: "Pe\xE7as em estoque", value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: "Acr\xE9scimo aplicado", value: reais(q.markup) }
      ]
    });
  })
);
rotasRelatorios.get(
  "/whatsapp-list",
  rota(async (req, res) => {
    const q = validar(
      z7.object({
        categoryId: z7.string().uuid().optional(),
        unitId: z7.string().uuid().optional(),
        /** Sem estoque some da lista — é o padrão: não se oferece o que acabou. */
        somenteDisponiveis: z7.enum(["true", "false"]).default("true")
      }),
      semVazios(req.query)
    );
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const somenteDisponiveis = q.somenteDisponiveis === "true";
    const produtos = await db.product.findMany({
      where: {
        ...q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {},
        // Sem preço de atacado o produto não é de atacado: mandar o preço
        // de varejo para o grupo seria oferecer a mercadoria errada.
        wholesalePrice: { not: null },
        // Vendido e reservado já têm dono.
        status: "EM_ESTOQUE",
        ...somenteDisponiveis ? { stock: { some: { quantity: { gt: 0 }, ...unidade ? { unitId: unidade } : {} } } } : unidade ? { stock: { some: { unitId: unidade } } } : {}
      },
      include: { category: { select: { id: true, name: true, ordem: true } } }
    });
    const { texto: texto3, resumo } = montarListaDeAtacado(
      produtos.map((p) => ({
        name: p.name,
        capacity: p.capacity,
        atacado: numero(p.wholesalePrice),
        categoriaId: p.category.id,
        categoriaNome: p.category.name,
        categoriaOrdem: p.category.ordem
      })),
      await emojisDeCategoria()
    );
    res.json({ texto: texto3, resumo });
  })
);
rotasRelatorios.get(
  "/by-payment",
  exigir("relatorios"),
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);
    const pagamentos = await db.salePayment.findMany({
      where: {
        sale: {
          status: "FINALIZADA",
          ...quando ? { saleDate: quando } : {},
          ...unidade ? { unitId: unidade } : {}
        }
      },
      select: {
        method: true,
        amount: true,
        installments: true,
        saleId: true,
        feePercent: true,
        netAmount: true,
        settledAt: true,
        destino: true
      }
    });
    const tabela = await taxasDoCartao();
    const liquidoDe = (p) => {
      if (p.netAmount != null) return numero(p.netAmount);
      if (p.method === "EM_ABERTO") return p.settledAt ? numero(p.amount) : 0;
      if (p.method !== "CREDITO") return numero(p.amount);
      const taxa = taxaDe(tabela, p.installments, "padrao");
      return taxa != null ? numero(p.amount) * (1 - taxa / 100) : numero(p.amount);
    };
    const total = pagamentos.reduce((s, p) => s + numero(p.amount), 0);
    const chaves = [
      ...new Set(
        pagamentos.map((p) => p.method === "PIX" && p.destino ? `PIX::${p.destino}` : p.method)
      )
    ];
    const ordem = Object.keys(PAGAMENTO_LABEL);
    chaves.sort((a, b) => ordem.indexOf(a.split("::")[0]) - ordem.indexOf(b.split("::")[0]));
    const linhas = chaves.map((chave) => {
      const [forma, conta] = chave.split("::");
      const daForma = pagamentos.filter(
        (p) => p.method === forma && (conta ? p.destino === conta : !(forma === "PIX" && p.destino))
      );
      const soma = daForma.reduce((s, p) => s + numero(p.amount), 0);
      const vendas = new Set(daForma.map((p) => p.saleId)).size;
      const parceladas = daForma.filter((p) => p.installments > 1);
      const liquido = daForma.reduce((s, p) => s + liquidoDe(p), 0);
      const taxa = daForma.reduce(
        (s, p) => s + (p.method === "CREDITO" ? numero(p.amount) - liquidoDe(p) : 0),
        0
      );
      const aReceber = daForma.reduce(
        (s, p) => s + (p.method === "EM_ABERTO" && !p.settledAt ? numero(p.amount) : 0),
        0
      );
      return {
        payment: conta ?? PAGAMENTO_LABEL[forma],
        sales: vendas,
        lancamentos: daForma.length,
        total: soma,
        taxa,
        aReceber,
        liquido,
        share: total > 0 ? soma / total * 100 : 0,
        ticket: vendas > 0 ? soma / vendas : 0,
        parcelado: parceladas.length ? `${parceladas.length} em at\xE9 ${Math.max(...parceladas.map((p) => p.installments))}x` : "\u2014"
      };
    }).filter((l) => l.lancamentos > 0);
    const emDinheiro = linhas.filter((l) => l.payment !== PAGAMENTO_LABEL.TROCA);
    await exportar(res, q.format, {
      title: "Vendas por Forma de Pagamento",
      subtitle: periodo(q),
      columns: [
        { header: "Forma de pagamento", key: "payment", width: 22 },
        qtd("Vendas", "sales", 10),
        qtd("Lan\xE7amentos", "lancamentos", 12),
        money("Total", "total", 15),
        money("Taxa da maquininha", "taxa", 14),
        money("A receber", "aReceber", 13),
        money("Na conta", "liquido", 14),
        { header: "% do total", key: "share", width: 10, align: "right", format: (v) => `${Number(v).toFixed(1)}%` },
        money("Ticket m\xE9dio", "ticket", 13),
        { header: "Parcelados", key: "parcelado", width: 13 }
      ],
      rows: linhas,
      summary: [
        { label: "Formas usadas", value: String(linhas.length) },
        { label: "Vendido em dinheiro", value: reais(emDinheiro.reduce((s, l) => s + l.total, 0)) },
        { label: "Taxa da maquininha", value: reais(linhas.reduce((s, l) => s + l.taxa, 0)) },
        { label: "Ainda a receber", value: reais(linhas.reduce((s, l) => s + l.aReceber, 0)) },
        { label: "J\xE1 est\xE1 na conta", value: reais(emDinheiro.reduce((s, l) => s + l.liquido, 0)) },
        { label: "Movimentado", value: reais(total) }
      ]
    });
  })
);

// server/caixa.ts
import { Router as Router10 } from "express";
import { z as z9 } from "zod";

// server/vendas-service.ts
import { Prisma as Prisma3 } from "@prisma/client";

// server/notificacoes.ts
import { Router as Router9 } from "express";
import { z as z8 } from "zod";
async function notificar(aviso) {
  try {
    await db.notification.create({ data: aviso });
  } catch (erro) {
    console.error("[notifica\xE7\xE3o]", erro.message);
  }
}
async function notificarPerfil(papel, aviso) {
  try {
    const pessoas = await db.user.findMany({
      where: { role: papel, active: true },
      select: { id: true }
    });
    if (!pessoas.length) return;
    await db.notification.createMany({
      data: pessoas.map((p) => ({ ...aviso, userId: p.id }))
    });
  } catch (erro) {
    console.error("[notifica\xE7\xE3o]", erro.message);
  }
}
var rotasNotificacoes = Router9();
rotasNotificacoes.use(autenticar);
rotasNotificacoes.get(
  "/",
  rota(async (req, res) => {
    const q = validar(
      z8.object({
        page: z8.coerce.number().int().min(1).optional(),
        pageSize: z8.coerce.number().int().min(1).max(100).optional(),
        naoLidas: z8.enum(["true", "false"]).optional()
      }),
      semVazios(req.query)
    );
    const p = paginacao(q, 20);
    const where = {
      userId: req.usuario.id,
      ...q.naoLidas === "true" ? { read: false } : {}
    };
    const [lista, total, naoLidas] = await Promise.all([
      db.notification.findMany({ where, skip: p.skip, take: p.take, orderBy: { createdAt: "desc" } }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: req.usuario.id, read: false } })
    ]);
    res.json(limpar({ ...paginado(lista, total, p), unread: naoLidas }));
  })
);
rotasNotificacoes.post(
  "/ler",
  rota(async (req, res) => {
    const { id } = validar(z8.object({ id: z8.string().uuid().optional() }), req.body ?? {});
    await db.notification.updateMany({
      where: { userId: req.usuario.id, ...id ? { id } : { read: false } },
      data: { read: true }
    });
    res.json({ message: "Avisos marcados como lidos" });
  })
);

// server/vendas-service.ts
function taxaDaLinha(tabela, metodo, parcelas, informada) {
  if (metodo !== "CREDITO") return null;
  const taxa = informada ?? taxaDe(tabela, parcelas, "padrao");
  return taxa != null ? new Prisma3.Decimal(taxa) : null;
}
function liquidoDaLinha(tabela, metodo, valor, parcelas, informada) {
  if (metodo === "EM_ABERTO") return new Prisma3.Decimal(0);
  const taxa = taxaDaLinha(tabela, metodo, parcelas, informada);
  return new Prisma3.Decimal(taxa ? valor * (1 - Number(taxa) / 100) : valor);
}
async function proximoCodigo(nome, prefixo, tx) {
  const cliente3 = tx ?? db;
  const contador = await cliente3.sequence.upsert({
    where: { name: nome },
    update: { value: { increment: 1 } },
    create: { name: nome, value: 1 }
  });
  return `${prefixo}-${String(contador.value).padStart(6, "0")}`;
}
async function conferirIdentificadores(itens, tx) {
  const cliente3 = tx ?? db;
  const identificadores = itens.flatMap(
    (i) => [i.imei?.trim(), i.serialNumber?.trim()].filter((v) => Boolean(v))
  );
  if (!identificadores.length) return;
  const jaVendido = await cliente3.saleItem.findFirst({
    where: {
      sale: { status: "FINALIZADA" },
      OR: [{ imei: { in: identificadores } }, { serialNumber: { in: identificadores } }]
    },
    include: { sale: { select: { code: true, saleDate: true } } }
  });
  if (jaVendido) {
    const qual = jaVendido.imei ?? jaVendido.serialNumber;
    throw new AppError(
      `Este produto j\xE1 foi vendido ou est\xE1 sendo finalizado em outra venda (${qual} \u2014 venda ${jaVendido.sale.code}).`,
      409
    );
  }
}
async function registrarVenda(dados) {
  if (!dados.itens.length) throw new AppError("Inclua ao menos um produto na venda");
  if (dados.pagamentos?.some((p) => p.method === "EM_ABERTO")) {
    if (!dados.customerName?.trim()) {
      throw new AppError("Para deixar valor em aberto, informe o nome de quem vai pagar.");
    }
    if (!dados.customerPhone?.trim()) {
      throw new AppError("Para deixar valor em aberto, informe o telefone de quem vai pagar.");
    }
  }
  const [unidade, tabela, turno, vendedorCadastrado] = await Promise.all([
    db.unit.findUnique({ where: { id: dados.unitId } }),
    taxasDoCartao(),
    dados.cashierId ? db.cashRegister.findFirst({
      where: { cashierId: dados.cashierId, status: "ABERTO" },
      orderBy: { openedAt: "desc" }
    }) : null,
    !dados.sellerName?.trim() && dados.sellerId ? db.user.findUnique({ where: { id: dados.sellerId }, select: { name: true } }) : null
  ]);
  if (!unidade) throw naoEncontrado("Unidade");
  const resultado = await db.$transaction(async (tx) => {
    await conferirIdentificadores(dados.itens, tx);
    const achados = await tx.product.findMany({
      where: { id: { in: [...new Set(dados.itens.map((i) => i.productId))] } }
    });
    const produtos = new Map(achados.map((p) => [p.id, p]));
    if (dados.itens.some((i) => !produtos.has(i.productId))) throw naoEncontrado("Produto");
    const saldos = new Map(
      await Promise.all(
        [...produtos.keys()].map(
          async (id) => [id, await disponivel(id, dados.unitId, tx)]
        )
      )
    );
    const pedido = /* @__PURE__ */ new Map();
    for (const item of dados.itens) {
      pedido.set(item.productId, (pedido.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, quantidade] of pedido) {
      const livre = saldos.get(productId) ?? 0;
      if (livre < quantidade) {
        throw new AppError(
          `Estoque insuficiente na ${unidade.name} para "${produtos.get(productId).name}". Dispon\xEDvel: ${livre} unidade(s).`
        );
      }
    }
    const nome = dados.customerName?.trim() || null;
    const vendedorNome = dados.sellerName?.trim() || vendedorCadastrado?.name || null;
    let clienteId = dados.customerId ?? null;
    if (!clienteId && (nome || dados.customerPhone || dados.customerDocument)) {
      const existente = (dados.customerPhone ? await tx.customer.findFirst({ where: { phone: dados.customerPhone } }) : null) ?? (dados.customerDocument ? await tx.customer.findFirst({ where: { document: dados.customerDocument } }) : null) ?? (nome ? await tx.customer.findFirst({ where: { name: { equals: nome, mode: "insensitive" } } }) : null);
      clienteId = existente?.id ?? // Sem nome não há ficha a criar: a tabela exige um.
      (nome ? (await tx.customer.create({
        data: {
          name: nome,
          phone: dados.customerPhone ?? null,
          document: dados.customerDocument ?? null
        }
      })).id : null);
    }
    const itensComCusto = dados.itens.map((item) => {
      const produto = produtos.get(item.productId);
      return {
        ...item,
        productName: produto.name,
        costPrice: new Prisma3.Decimal(produto.costPrice)
      };
    });
    const somaDosItens = itensComCusto.reduce(
      (soma, i) => soma.add(new Prisma3.Decimal(i.unitPrice).mul(i.quantity)),
      new Prisma3.Decimal(0)
    );
    const acrescimo = new Prisma3.Decimal(dados.acrescimo ?? 0);
    const total = somaDosItens.add(acrescimo);
    const custo = itensComCusto.reduce(
      (soma, i) => soma.add(i.costPrice.mul(i.quantity)),
      new Prisma3.Decimal(0)
    );
    const daTroca = new Prisma3.Decimal(dados.trocaNova?.valorAvaliado ?? dados.trocaValor ?? 0);
    const aReceber = total.minus(daTroca);
    const emDinheiro = dados.pagamentos?.length ? dados.pagamentos.map((p) => ({
      method: p.method,
      // Duas casas antes de virar Decimal. Um valor como 318.59999999999997
      // — que aparece sozinho ao dividir por porcentagem — some na soma
      // do JavaScript, mas sobrevive na soma exata do banco e travaria a
      // venda dizendo que dois valores iguais são diferentes.
      amount: new Prisma3.Decimal(p.amount.toFixed(2)),
      installments: p.installments ?? 1,
      notes: null,
      /** Em qual conta caiu — o Pix da loja tem mais de uma. */
      destino: p.destino?.trim() || null,
      // O que a maquininha desconta fica gravado com a venda: a taxa
      // muda com o tempo, e o relatório de amanhã não pode recalcular
      // o passado com o preço de hoje.
      feePercent: taxaDaLinha(tabela, p.method, p.installments ?? 1, p.feePercent),
      netAmount: liquidoDaLinha(tabela, p.method, p.amount, p.installments ?? 1, p.feePercent)
    })) : aReceber.greaterThan(0) ? [
      {
        method: dados.paymentMethod,
        amount: aReceber,
        installments: dados.installments ?? 1,
        notes: null,
        destino: null,
        feePercent: taxaDaLinha(tabela, dados.paymentMethod, dados.installments ?? 1, null),
        netAmount: liquidoDaLinha(
          tabela,
          dados.paymentMethod,
          Number(aReceber),
          dados.installments ?? 1,
          null
        )
      }
    ] : [];
    const somaEmDinheiro = emDinheiro.reduce((s, p) => s.add(p.amount), new Prisma3.Decimal(0));
    if (somaEmDinheiro.minus(aReceber).abs().greaterThan("0.005")) {
      throw new AppError(
        `As formas de pagamento somam R$ ${somaEmDinheiro.toFixed(2)}, mas o cliente tem a pagar R$ ${aReceber.toFixed(2)}.`
      );
    }
    const rateio = daTroca.greaterThan(0) ? [
      ...emDinheiro,
      {
        method: "TROCA",
        amount: daTroca,
        installments: 1,
        notes: null,
        destino: null,
        feePercent: null,
        netAmount: daTroca
      }
    ] : emDinheiro;
    const formaPrincipal = emDinheiro.reduce(
      (maior, p) => !maior || p.amount.greaterThan(maior.amount) ? p : maior,
      null
    )?.method ?? "TROCA";
    const venda = await tx.sale.create({
      data: {
        code: await proximoCodigo("venda", "VD", tx),
        totalAmount: total,
        costAmount: custo,
        surcharge: acrescimo,
        // A forma "principal" continua na venda para as telas simples: é a
        // de maior valor quando o pagamento foi dividido.
        paymentMethod: formaPrincipal,
        installments: dados.installments ?? 1,
        payments: { create: rateio },
        saleDate: dados.saleDate ?? /* @__PURE__ */ new Date(),
        notes: dados.notes ?? null,
        unitId: dados.unitId,
        customerId: clienteId,
        customerName: nome,
        customerPhone: dados.customerPhone ?? null,
        customerDocument: dados.customerDocument ?? null,
        sellerId: dados.sellerId ?? null,
        // Guarda o nome também quando o vendedor tem login: relatório e
        // fechamento continuam mostrando quem vendeu mesmo se o usuário
        // for desativado ou apagado depois.
        sellerName: vendedorNome,
        cashierId: dados.cashierId ?? null,
        cashRegisterId: turno?.id ?? null,
        preSaleId: dados.preSaleId ?? null,
        items: {
          create: itensComCusto.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: new Prisma3.Decimal(i.unitPrice),
            costPrice: i.costPrice,
            imei: i.imei?.trim() || null,
            serialNumber: i.serialNumber?.trim() || null
          }))
        }
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
        unit: { select: { name: true } },
        seller: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } }
      }
    });
    for (const item of itensComCusto) {
      await movimentar({
        produtoId: item.productId,
        produtoNome: item.productName,
        unidadeId: dados.unitId,
        tipo: "SAIDA",
        motivo: "VENDA",
        quantidade: item.quantity,
        observacao: `Venda ${venda.code} para ${nome ?? "consumidor n\xE3o identificado"}` + (item.imei ? ` \xB7 IMEI ${item.imei}` : "") + (item.serialNumber ? ` \xB7 s\xE9rie ${item.serialNumber}` : ""),
        vendaId: venda.id,
        usuarioId: dados.cashierId ?? dados.sellerId,
        usuarioNome: dados.cashierName,
        tx
      });
    }
    if (dados.trocaNova) {
      await tx.tradeIn.create({
        data: {
          code: await proximoCodigo("troca", "TR", tx),
          status: "ACEITA",
          modelo: dados.trocaNova.modelo,
          cor: dados.trocaNova.cor ?? null,
          armazenamento: dados.trocaNova.armazenamento ?? null,
          valorAvaliado: daTroca,
          valorSaida: total,
          customerName: nome ?? "Consumidor",
          customerPhone: dados.customerPhone ?? null,
          customerDocument: dados.customerDocument ?? null,
          sellerId: dados.sellerId ?? dados.cashierId,
          unitId: dados.unitId,
          saleId: venda.id,
          defeitos: []
        }
      });
    }
    return venda;
  });
  if (dados.sellerId && dados.sellerId !== dados.cashierId) {
    await notificar({
      userId: dados.sellerId,
      title: `Venda ${resultado.code} finalizada`,
      message: `${dados.customerName?.trim() || "Consumidor"} \xB7 ${resultado.items.length} item(ns) \xB7 R$ ${Number(resultado.totalAmount).toFixed(2)}`,
      link: "/minhas-vendas"
    });
  }
  return resultado;
}

// server/caixa.ts
var rotasCaixa = Router10();
rotasCaixa.use(autenticar);
async function resumoDoTurno(where) {
  const [vendas, porPagamento, itens] = await Promise.all([
    db.sale.aggregate({ where, _sum: { totalAmount: true, costAmount: true }, _count: true }),
    // Soma pelo rateio, não pela venda: com pagamento dividido, jogar o
    // total inteiro na forma "principal" faria a gaveta não bater com o
    // extrato da maquininha no fim do dia.
    // Por conta também: o fechamento precisa bater com cada extrato.
    db.salePayment.groupBy({
      by: ["method", "destino"],
      where: { sale: where },
      _sum: { amount: true },
      _count: true
    }),
    db.saleItem.aggregate({ where: { sale: where }, _sum: { quantity: true } })
  ]);
  const total = numero(vendas._sum.totalAmount);
  const somaDasFormas = porPagamento.reduce((s, p) => s + numero(p._sum.amount), 0);
  return {
    quantidadeDeVendas: vendas._count,
    itensVendidos: itens._sum.quantity ?? 0,
    total,
    lucro: total - numero(vendas._sum.costAmount),
    ticketMedio: vendas._count ? total / vendas._count : 0,
    /**
     * Diferença entre o total do turno e a soma das formas.
     *
     * Deve ser sempre zero. Se não for, alguma venda ficou sem rateio, e é
     * melhor a tela dizer isso do que apresentar uma quebra de caixa que
     * não existe.
     */
    divergencia: Math.abs(total - somaDasFormas) < 0.01 ? 0 : total - somaDasFormas,
    porPagamento: Object.keys(PAGAMENTO_LABEL).flatMap((forma) => {
      const linhas = porPagamento.filter((p) => p.method === forma);
      if (forma === "PIX" && linhas.some((l) => l.destino)) {
        return linhas.map((l) => ({
          forma,
          rotulo: l.destino ?? PAGAMENTO_LABEL[forma],
          quantidade: l._count,
          total: numero(l._sum.amount)
        }));
      }
      return [
        {
          forma,
          rotulo: PAGAMENTO_LABEL[forma],
          quantidade: linhas.reduce((s, l) => s + l._count, 0),
          total: linhas.reduce((s, l) => s + numero(l._sum.amount), 0)
        }
      ];
    })
  };
}
rotasCaixa.get(
  "/atual",
  exigir("pdv"),
  rota(async (req, res) => {
    const turno = await db.cashRegister.findFirst({
      where: { cashierId: req.usuario.id, status: "ABERTO" },
      include: { unit: { select: { id: true, name: true } } },
      orderBy: { openedAt: "desc" }
    });
    if (!turno) {
      res.json({ aberto: false, turno: null, resumo: null });
      return;
    }
    const resumo = await resumoDoTurno({
      cashRegisterId: turno.id,
      status: "FINALIZADA"
    });
    res.json(limpar({ aberto: true, turno, resumo }));
  })
);
rotasCaixa.post(
  "/abrir",
  exigir("pdv"),
  rota(async (req, res) => {
    const { unitId, notes } = validar(
      z9.object({
        unitId: z9.string().uuid().optional().nullable(),
        notes: z9.string().trim().max(300).optional().nullable()
      }),
      req.body ?? {}
    );
    const aberto = await db.cashRegister.findFirst({
      where: { cashierId: req.usuario.id, status: "ABERTO" }
    });
    if (aberto) throw new AppError("Voc\xEA j\xE1 tem um caixa aberto. Feche-o antes de abrir outro.");
    const turno = await db.cashRegister.create({
      data: {
        code: await proximoCodigo("caixa", "CX"),
        cashierId: req.usuario.id,
        unitId: unitId ?? req.usuario.unidadeId ?? null,
        notes: notes ?? null
      },
      include: { unit: { select: { name: true } } }
    });
    await registrarLog({ acao: "ABRIR_CAIXA", entidade: "CashRegister", id: turno.id, req });
    res.status(201).json(limpar({ turno, message: `Caixa ${turno.code} aberto.` }));
  })
);
rotasCaixa.post(
  "/fechar",
  exigir("caixa.fechar"),
  rota(async (req, res) => {
    const { notes } = validar(
      z9.object({ notes: z9.string().trim().max(500).optional().nullable() }),
      req.body ?? {}
    );
    const turno = await db.cashRegister.findFirst({
      where: { cashierId: req.usuario.id, status: "ABERTO" },
      orderBy: { openedAt: "desc" }
    });
    if (!turno) throw new AppError("Voc\xEA n\xE3o tem caixa aberto.");
    const resumo = await resumoDoTurno({ cashRegisterId: turno.id, status: "FINALIZADA" });
    const fechado = await db.cashRegister.update({
      where: { id: turno.id },
      data: {
        status: "FECHADO",
        closedAt: /* @__PURE__ */ new Date(),
        notes: notes ?? turno.notes,
        // Congela o resumo: o fechamento é o retrato daquele momento.
        summary: JSON.parse(JSON.stringify(resumo))
      },
      include: { unit: { select: { name: true } }, cashier: { select: { name: true } } }
    });
    await registrarLog({
      acao: "FECHAR_CAIXA",
      entidade: "CashRegister",
      id: turno.id,
      alteracoes: { total: resumo.total, vendas: resumo.quantidadeDeVendas },
      req
    });
    res.json(
      limpar({
        turno: fechado,
        resumo,
        message: `Caixa ${turno.code} fechado \xB7 ${resumo.quantidadeDeVendas} venda(s) \xB7 ${reais(resumo.total)}`
      })
    );
  })
);
rotasCaixa.get(
  "/",
  exigir("pdv"),
  rota(async (req, res) => {
    const q = validar(
      z9.object({
        cashierId: z9.string().uuid().optional(),
        status: z9.enum(["ABERTO", "FECHADO"]).optional()
      }),
      semVazios(req.query)
    );
    const de = podeFazer(req.usuario?.papel, "caixa.verTodos") ? q.cashierId : req.usuario.id;
    const turnos = await db.cashRegister.findMany({
      where: { ...de ? { cashierId: de } : {}, ...q.status ? { status: q.status } : {} },
      include: { cashier: { select: { name: true } }, unit: { select: { name: true } } },
      orderBy: { openedAt: "desc" },
      take: 60
    });
    res.json(limpar(turnos));
  })
);
rotasCaixa.get(
  "/:id/relatorio",
  exigir("pdv"),
  rota(async (req, res) => {
    const { format } = validar(
      z9.object({ format: z9.enum(["json", "pdf", "xlsx", "csv"]).default("json") }),
      semVazios(req.query)
    );
    const turno = await db.cashRegister.findUnique({
      where: { id: req.params.id },
      include: { cashier: { select: { id: true, name: true } }, unit: { select: { name: true } } }
    });
    if (!turno) throw naoEncontrado("Caixa");
    if (!podeFazer(req.usuario?.papel, "caixa.verTodos") && turno.cashierId !== req.usuario.id) {
      throw new AppError("Este fechamento \xE9 de outro caixa", 403);
    }
    const where = { cashRegisterId: turno.id, status: "FINALIZADA" };
    const [vendas, resumo] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: true,
          seller: { select: { name: true } },
          unit: { select: { name: true } }
        },
        orderBy: { saleDate: "asc" }
      }),
      resumoDoTurno(where)
    ]);
    const linhas = vendas.flatMap(
      (v) => v.items.map((i) => ({
        code: v.code,
        data: dataHoraBR(v.saleDate),
        vendedor: v.seller?.name ?? v.sellerName ?? "\u2014",
        cliente: v.customerName ?? "\u2014",
        produto: i.productName ?? "\u2014",
        imei: i.imei ?? "\u2014",
        serie: i.serialNumber ?? "\u2014",
        quantidade: i.quantity,
        valor: numero(i.unitPrice) * i.quantity,
        pagamento: PAGAMENTO_LABEL[v.paymentMethod],
        parcelas: v.installments,
        unidade: v.unit.name
      }))
    );
    if (format === "json") {
      res.json(limpar({ turno, resumo, vendas: linhas }));
      return;
    }
    await exportar(res, format, {
      title: `Fechamento de Caixa ${turno.code}`,
      subtitle: `Caixa: ${turno.cashier.name} \xB7 Aberto em ${dataHoraBR(turno.openedAt)}` + (turno.closedAt ? ` \xB7 Fechado em ${dataHoraBR(turno.closedAt)}` : " \xB7 EM ABERTO"),
      columns: [
        { header: "Venda", key: "code", width: 11 },
        { header: "Data/hora", key: "data", width: 15 },
        { header: "Vendedor", key: "vendedor", width: 15 },
        { header: "Cliente", key: "cliente", width: 18 },
        { header: "Produto", key: "produto", width: 24 },
        { header: "IMEI", key: "imei", width: 16 },
        { header: "N\xBA s\xE9rie", key: "serie", width: 14 },
        { header: "Qtd", key: "quantidade", width: 5, align: "right" },
        { header: "Valor", key: "valor", width: 12, align: "right", format: decimal },
        { header: "Pagamento", key: "pagamento", width: 12 },
        { header: "Parc.", key: "parcelas", width: 6, align: "right" },
        { header: "Unidade", key: "unidade", width: 12 }
      ],
      rows: linhas,
      summary: [
        { label: "Vendas", value: String(resumo.quantidadeDeVendas) },
        { label: "Produtos vendidos", value: String(resumo.itensVendidos) },
        ...resumo.porPagamento.filter((p) => p.quantidade > 0).map((p) => ({ label: `Total em ${p.rotulo}`, value: reais(p.total) })),
        { label: "TOTAL GERAL", value: reais(resumo.total) },
        { label: "Ticket m\xE9dio", value: reais(resumo.ticketMedio) },
        { label: "Lucro estimado", value: reais(resumo.lucro) }
      ]
    });
  })
);

// server/prevendas.ts
import { Prisma as Prisma4 } from "@prisma/client";
import { Router as Router11 } from "express";
import { z as z10 } from "zod";

// server/preco-minimo.ts
async function exigirChaveSeAbaixoDoMinimo(itens, chave) {
  if (!itens.length) return;
  const produtos = await db.product.findMany({
    where: { id: { in: itens.map((i) => i.productId) } },
    select: { id: true, name: true, wholesalePrice: true }
  });
  const abaixo = itens.flatMap((item) => {
    const produto = produtos.find((p) => p.id === item.productId);
    if (!produto?.wholesalePrice) return [];
    const minimo = numero(produto.wholesalePrice);
    if (item.unitPrice >= minimo) return [];
    return [{ nome: produto.name, cobrado: item.unitPrice, minimo }];
  });
  if (!abaixo.length) return;
  const lista = abaixo.map((a) => `${a.nome} por R$ ${a.cobrado.toFixed(2)} (m\xEDnimo R$ ${a.minimo.toFixed(2)})`).join("; ");
  if (await conferirChaveDeAcesso(chave)) return;
  if (!await temChaveDeAcesso()) {
    throw new AppError(
      `Abaixo do pre\xE7o de atacado: ${lista}. Nenhuma chave de acesso foi cadastrada \u2014 pe\xE7a ao administrador para criar uma em Configura\xE7\xF5es.`,
      403
    );
  }
  throw new AppError(
    chave?.trim() ? `Chave de acesso incorreta. ${lista}.` : `Abaixo do pre\xE7o de atacado: ${lista}. Informe a chave de acesso do administrador.`,
    403
  );
}

// server/prevendas.ts
var rotasPreVendas = Router11();
rotasPreVendas.use(autenticar);
var PAGAMENTOS = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA", "EM_ABERTO", "OUTRO"];
var STATUS_PRE_VENDA = [
  "AGUARDANDO_CAIXA",
  "EM_ATENDIMENTO",
  "FINALIZADA",
  "CANCELADA",
  "EXPIRADA"
];
var COM_TUDO = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          model: true,
          imei: true,
          brand: true,
          capacity: true,
          color: true,
          condicao: true,
          // Uma só: é miniatura de conferência, não galeria.
          photos: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } }
        }
      }
    }
  },
  seller: { select: { id: true, name: true } },
  tradeIn: {
    select: {
      id: true,
      code: true,
      modelo: true,
      imei: true,
      imeiSituacao: true,
      valorAvaliado: true,
      estado: true,
      defeitos: true
    }
  },
  cashier: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  sale: { select: { id: true, code: true } }
};
var itemSchema = z10.object({
  productId: z10.string().uuid("Selecione o produto"),
  quantity: z10.coerce.number().int().min(1, "Quantidade m\xEDnima: 1"),
  unitPrice: z10.coerce.number().min(0, "Informe o valor"),
  imei: z10.string().trim().max(40).optional().nullable(),
  serialNumber: z10.string().trim().max(60).optional().nullable()
});
var preVendaSchema = z10.object({
  customerName: z10.string().trim().min(2, "Informe o nome do cliente").max(180),
  customerPhone: z10.string().trim().max(30).optional().nullable(),
  customerDocument: z10.string().trim().max(30).optional().nullable(),
  customerId: z10.string().uuid().optional().nullable(),
  unitId: z10.string().uuid().optional().nullable(),
  paymentMethod: z10.enum(PAGAMENTOS).optional().nullable(),
  installments: z10.coerce.number().int().min(1).max(24).default(1),
  notes: z10.string().trim().max(1e3).optional().nullable(),
  items: z10.array(itemSchema).min(1, "Inclua ao menos um produto"),
  /** Aparelho usado que o cliente está dando como parte do pagamento. */
  tradeInId: z10.string().uuid().optional().nullable(),
  /** Libera montar a pré-venda abaixo do preço de atacado. */
  chaveDeAcesso: z10.string().trim().max(60).optional().nullable()
});
var podeVerTodas = (req) => podeFazer(req.usuario?.papel, "prevenda.verTodas");
async function liberarTroca(preSaleId) {
  await db.tradeIn.updateMany({
    where: { preSaleId, status: "AVALIADA" },
    data: { preSaleId: null }
  });
}
rotasPreVendas.get(
  "/",
  rota(async (req, res) => {
    const q = validar(
      z10.object({
        page: z10.coerce.number().int().min(1).optional(),
        pageSize: z10.coerce.number().int().min(1).max(100).optional(),
        // Aceita mais de um status separado por vírgula: a fila do caixa
        // precisa das que aguardam e das que já estão sendo atendidas.
        status: z10.string().optional().transform((v) => v ? v.split(",").map((s) => s.trim()).filter(Boolean) : void 0).pipe(z10.array(z10.enum(STATUS_PRE_VENDA)).min(1).optional()),
        sellerId: z10.string().uuid().optional(),
        search: z10.string().trim().optional(),
        startDate: z10.coerce.date().optional(),
        endDate: z10.coerce.date().optional()
      }),
      semVazios(req.query)
    );
    const p = paginacao(q);
    const periodo2 = intervalo(q.startDate, q.endDate);
    const where = {
      // Um vendedor nunca vê a pré-venda de outro.
      ...podeVerTodas(req) ? q.sellerId ? { sellerId: q.sellerId } : {} : { sellerId: req.usuario.id },
      ...q.status ? { status: { in: q.status } } : {},
      ...periodo2 ? { createdAt: periodo2 } : {},
      ...q.search ? {
        OR: [
          { code: { contains: q.search, mode: "insensitive" } },
          { customerName: { contains: q.search, mode: "insensitive" } },
          { customerPhone: { contains: q.search, mode: "insensitive" } }
        ]
      } : {}
    };
    const [lista, total, pendentes] = await Promise.all([
      db.preSale.findMany({
        where,
        include: COM_TUDO,
        skip: p.skip,
        take: p.take,
        // Aguardando primeiro: são as que pedem ação do caixa.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }]
      }),
      db.preSale.count({ where }),
      db.preSale.count({ where: { ...where, status: "AGUARDANDO_CAIXA" } })
    ]);
    res.json(limpar({ ...paginado(lista, total, p), pendentes }));
  })
);
rotasPreVendas.get(
  "/:id",
  rota(async (req, res) => {
    const preVenda = await db.preSale.findUnique({ where: { id: req.params.id }, include: COM_TUDO });
    if (!preVenda) throw naoEncontrado("Pr\xE9-venda");
    if (!podeVerTodas(req) && preVenda.sellerId !== req.usuario.id) {
      throw new AppError("Esta pr\xE9-venda \xE9 de outro vendedor", 403);
    }
    const itens = await Promise.all(
      preVenda.items.map(async (item) => ({
        ...item,
        disponivel: preVenda.unitId ? await disponivel(item.productId, preVenda.unitId) : null
      }))
    );
    res.json(limpar({ ...preVenda, items: itens }));
  })
);
rotasPreVendas.post(
  "/",
  exigir("prevenda.criar"),
  rota(async (req, res) => {
    const dados = validar(preVendaSchema, req.body);
    await exigirChaveSeAbaixoDoMinimo(dados.items, dados.chaveDeAcesso);
    const produtos = await db.product.findMany({
      where: { id: { in: dados.items.map((i) => i.productId) } },
      select: { id: true, name: true }
    });
    if (produtos.length !== new Set(dados.items.map((i) => i.productId)).size) {
      throw naoEncontrado("Produto");
    }
    const bruto = dados.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    let abatimento = 0;
    if (dados.tradeInId) {
      const troca = await db.tradeIn.findUnique({ where: { id: dados.tradeInId } });
      if (!troca) throw naoEncontrado("Troca");
      if (troca.preSaleId || troca.saleId) {
        throw new AppError(`A troca ${troca.code} j\xE1 est\xE1 em outra pr\xE9-venda.`);
      }
      if (troca.status !== "AVALIADA") {
        throw new AppError(`A troca ${troca.code} n\xE3o est\xE1 mais dispon\xEDvel.`);
      }
      if (troca.imeiSituacao === "BLOQUEADO") {
        throw new AppError(`A troca ${troca.code} tem IMEI bloqueado na Anatel.`);
      }
      abatimento = Number(troca.valorAvaliado);
    }
    const total = Math.max(0, bruto - abatimento);
    const preVenda = await db.preSale.create({
      data: {
        code: await proximoCodigo("prevenda", "PV"),
        sellerId: req.usuario.id,
        customerId: dados.customerId ?? null,
        customerName: dados.customerName,
        customerPhone: dados.customerPhone ?? null,
        customerDocument: dados.customerDocument ?? null,
        unitId: dados.unitId ?? req.usuario.unidadeId ?? null,
        paymentMethod: dados.paymentMethod ?? null,
        installments: dados.installments,
        notes: dados.notes ?? null,
        totalAmount: new Prisma4.Decimal(total),
        ...dados.tradeInId ? { tradeIn: { connect: { id: dados.tradeInId } } } : {},
        // Sem atendimento no mesmo dia, some da fila do caixa.
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3),
        items: {
          create: dados.items.map((i) => ({
            productId: i.productId,
            productName: produtos.find((p) => p.id === i.productId)?.name,
            quantity: i.quantity,
            unitPrice: new Prisma4.Decimal(i.unitPrice),
            imei: i.imei?.trim() || null,
            serialNumber: i.serialNumber?.trim() || null
          }))
        }
      },
      include: COM_TUDO
    });
    await notificarPerfil("CAIXA", {
      title: `Nova pr\xE9-venda ${preVenda.code}`,
      message: `${preVenda.customerName} \xB7 ${dados.items.length} item(ns) \xB7 R$ ${total.toFixed(2)}` + (abatimento ? ` (troca de R$ ${abatimento.toFixed(2)} j\xE1 abatida)` : "") + ` \xB7 por ${req.usuario.nome}`,
      link: "/caixa"
    });
    await registrarLog({
      acao: "CRIAR_PREVENDA",
      entidade: "PreSale",
      id: preVenda.id,
      alteracoes: { codigo: preVenda.code, total, itens: dados.items.length, troca: dados.tradeInId ?? null },
      req
    });
    res.status(201).json(limpar({ ...preVenda, message: `Pr\xE9-venda ${preVenda.code} enviada ao caixa.` }));
  })
);
rotasPreVendas.post(
  "/:id/atender",
  exigir("venda.finalizar"),
  rota(async (req, res) => {
    const preVenda = await db.preSale.findUnique({ where: { id: req.params.id } });
    if (!preVenda) throw naoEncontrado("Pr\xE9-venda");
    if (preVenda.status === "FINALIZADA") throw new AppError("Esta pr\xE9-venda j\xE1 virou venda.");
    if (preVenda.status === "CANCELADA") throw new AppError("Esta pr\xE9-venda foi cancelada.");
    if (preVenda.status === "EM_ATENDIMENTO" && preVenda.cashierId !== req.usuario.id) {
      const outro = await db.user.findUnique({ where: { id: preVenda.cashierId ?? "" } });
      throw new AppError(`${outro?.name ?? "Outro caixa"} j\xE1 est\xE1 atendendo esta pr\xE9-venda.`, 409);
    }
    const atualizada = await db.preSale.update({
      where: { id: preVenda.id },
      data: { status: "EM_ATENDIMENTO", cashierId: req.usuario.id },
      include: COM_TUDO
    });
    res.json(limpar(atualizada));
  })
);
var finalizarSchema = z10.object({
  unitId: z10.string().uuid("Informe de qual unidade o produto saiu"),
  paymentMethod: z10.enum(PAGAMENTOS),
  installments: z10.coerce.number().int().min(1).max(24).default(1),
  /** Pagamento dividido, igual ao do balcão. */
  payments: z10.array(
    z10.object({
      method: z10.enum(PAGAMENTOS),
      amount: z10.coerce.number().min(0.01, "Informe o valor desta forma"),
      installments: z10.coerce.number().int().min(1).max(24).default(1),
      notes: z10.string().trim().max(120).optional().nullable(),
      /** Taxa da maquininha, em %. Guardada com a venda. */
      feePercent: z10.coerce.number().min(0).max(99.99).optional().nullable(),
      /** Em qual conta caiu — usado no Pix, que tem mais de uma. */
      destino: z10.string().trim().max(60).optional().nullable()
    })
  ).max(6, "No m\xE1ximo 6 formas na mesma venda").optional(),
  notes: z10.string().trim().max(1e3).optional().nullable(),
  /** O caixa pode corrigir valor e identificadores antes de fechar. */
  items: z10.array(itemSchema.extend({ id: z10.string().uuid().optional() })).optional(),
  /** Libera fechar abaixo do preço de atacado. */
  chaveDeAcesso: z10.string().trim().max(60).optional().nullable()
});
rotasPreVendas.post(
  "/:id/finalizar",
  exigir("venda.finalizar"),
  rota(async (req, res) => {
    const dados = validar(finalizarSchema, req.body);
    if (dados.items) await exigirChaveSeAbaixoDoMinimo(dados.items, dados.chaveDeAcesso);
    const preVenda = await db.preSale.findUnique({
      where: { id: req.params.id },
      include: { items: true, seller: { select: { id: true, name: true } }, tradeIn: true }
    });
    if (!preVenda) throw naoEncontrado("Pr\xE9-venda");
    if (preVenda.status === "FINALIZADA") throw new AppError("Esta pr\xE9-venda j\xE1 virou venda.");
    if (preVenda.status === "CANCELADA") throw new AppError("Esta pr\xE9-venda foi cancelada.");
    if (preVenda.tradeIn?.imeiSituacao === "BLOQUEADO") {
      throw new AppError(
        `A troca ${preVenda.tradeIn.code} tem IMEI bloqueado na Anatel. N\xE3o \xE9 poss\xEDvel fechar a venda com esse aparelho.`
      );
    }
    const itens = (dados.items ?? preVenda.items).map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: numero(i.unitPrice),
      imei: i.imei ?? null,
      serialNumber: i.serialNumber ?? null
    }));
    const venda = await registrarVenda({
      itens,
      unitId: dados.unitId,
      paymentMethod: dados.paymentMethod,
      installments: dados.installments,
      pagamentos: dados.payments,
      trocaValor: preVenda.tradeIn ? numero(preVenda.tradeIn.valorAvaliado) : null,
      customerName: preVenda.customerName,
      customerPhone: preVenda.customerPhone,
      customerDocument: preVenda.customerDocument,
      customerId: preVenda.customerId,
      notes: dados.notes ?? preVenda.notes,
      sellerId: preVenda.sellerId,
      cashierId: req.usuario.id,
      cashierName: req.usuario.nome,
      preSaleId: preVenda.id
    });
    await db.preSale.update({
      where: { id: preVenda.id },
      data: { status: "FINALIZADA", cashierId: req.usuario.id }
    });
    if (preVenda.tradeIn) {
      await db.tradeIn.update({
        where: { id: preVenda.tradeIn.id },
        data: { status: "ACEITA", saleId: venda.id }
      });
    }
    await registrarLog({
      acao: "FINALIZAR_PREVENDA",
      entidade: "Sale",
      id: venda.id,
      alteracoes: {
        preVenda: preVenda.code,
        venda: venda.code,
        unidade: venda.unit.name,
        pagamento: dados.paymentMethod,
        total: numero(venda.totalAmount)
      },
      req
    });
    res.json(
      limpar({
        sale: venda,
        message: `Venda ${venda.code} registrada. Estoque atualizado na ${venda.unit.name}.`
      })
    );
  })
);
rotasPreVendas.post(
  "/:id/cancelar",
  exigir("venda.finalizar"),
  rota(async (req, res) => {
    const { motivo } = validar(
      z10.object({ motivo: z10.string().trim().max(300).optional() }),
      req.body ?? {}
    );
    const preVenda = await db.preSale.findUnique({ where: { id: req.params.id } });
    if (!preVenda) throw naoEncontrado("Pr\xE9-venda");
    if (preVenda.status === "FINALIZADA") throw new AppError("Esta pr\xE9-venda j\xE1 virou venda.");
    await db.preSale.update({
      where: { id: preVenda.id },
      data: {
        status: "CANCELADA",
        cashierId: req.usuario.id,
        notes: motivo ? `${preVenda.notes ?? ""}
Cancelada: ${motivo}`.trim() : preVenda.notes
      }
    });
    await liberarTroca(preVenda.id);
    await notificar({
      userId: preVenda.sellerId,
      title: `Pr\xE9-venda ${preVenda.code} cancelada`,
      message: motivo ? `Motivo: ${motivo}` : `Cancelada por ${req.usuario.nome}`,
      link: "/minhas-prevendas"
    });
    await registrarLog({ acao: "CANCELAR_PREVENDA", entidade: "PreSale", id: preVenda.id, req });
    res.json({ message: `Pr\xE9-venda ${preVenda.code} cancelada. O estoque n\xE3o foi alterado.` });
  })
);
rotasPreVendas.delete(
  "/:id",
  rota(async (req, res) => {
    const preVenda = await db.preSale.findUnique({ where: { id: req.params.id } });
    if (!preVenda) throw naoEncontrado("Pr\xE9-venda");
    const dono = preVenda.sellerId === req.usuario.id;
    if (!dono && !podeVerTodas(req)) throw new AppError("Esta pr\xE9-venda \xE9 de outro vendedor", 403);
    if (preVenda.status !== "AGUARDANDO_CAIXA") {
      throw new AppError("O caixa j\xE1 come\xE7ou a atender \u2014 pe\xE7a para ele cancelar.");
    }
    await db.preSale.update({ where: { id: preVenda.id }, data: { status: "CANCELADA" } });
    await liberarTroca(preVenda.id);
    await registrarLog({ acao: "CANCELAR_PREVENDA", entidade: "PreSale", id: preVenda.id, req });
    res.json({ message: `Pr\xE9-venda ${preVenda.code} cancelada.` });
  })
);

// server/aberto.ts
import { Prisma as Prisma5 } from "@prisma/client";
import { Router as Router12 } from "express";
import { z as z11 } from "zod";
var rotasEmAberto = Router12();
rotasEmAberto.use(autenticar);
var COM_A_VENDA = {
  sale: {
    select: {
      id: true,
      code: true,
      saleDate: true,
      customerName: true,
      customerPhone: true,
      customerDocument: true,
      unit: { select: { id: true, name: true } },
      seller: { select: { name: true } },
      sellerName: true,
      items: { select: { productName: true, quantity: true } }
    }
  }
};
var diasDesde = (d) => Math.floor((Date.now() - d.getTime()) / 864e5);
rotasEmAberto.get(
  "/",
  exigir("prevenda.verTodas"),
  rota(async (req, res) => {
    const q = validar(
      z11.object({
        page: z11.coerce.number().int().min(1).optional(),
        pageSize: z11.coerce.number().int().min(1).max(200).optional(),
        search: z11.string().trim().optional(),
        unitId: z11.string().uuid().optional(),
        /** "abertos" (padrão), "quitados" ou "todos". */
        situacao: z11.enum(["abertos", "quitados", "todos"]).default("abertos")
      }),
      semVazios(req.query)
    );
    const p = paginacao(q);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const where = {
      method: "EM_ABERTO",
      ...q.situacao === "abertos" ? { settledAt: null } : {},
      ...q.situacao === "quitados" ? { NOT: { settledAt: null } } : {},
      sale: {
        // Venda cancelada não cobra ninguém.
        status: "FINALIZADA",
        ...unidade ? { unitId: unidade } : {},
        ...q.search ? {
          OR: [
            { customerName: contem(q.search) },
            { customerPhone: contem(q.search) },
            { code: contem(q.search) }
          ]
        } : {}
      }
    };
    const [lista, total, emAberto] = await Promise.all([
      db.salePayment.findMany({
        where,
        include: COM_A_VENDA,
        skip: p.skip,
        take: p.take,
        // Mais antigo primeiro: é o que está esperando há mais tempo.
        orderBy: { sale: { saleDate: "asc" } }
      }),
      db.salePayment.count({ where }),
      db.salePayment.aggregate({
        where: { method: "EM_ABERTO", settledAt: null, sale: { status: "FINALIZADA" } },
        _sum: { amount: true },
        _count: true
      })
    ]);
    res.json(
      limpar({
        ...paginado(
          lista.map((p2) => ({
            ...p2,
            dias: diasDesde(p2.sale.saleDate),
            vendedor: p2.sale.seller?.name ?? p2.sale.sellerName ?? null,
            produtos: p2.sale.items.map((i) => `${i.quantity}\xD7 ${i.productName}`).join(", ")
          })),
          total,
          p
        ),
        resumo: {
          cobrancas: emAberto._count,
          total: numero(emAberto._sum.amount)
        }
      })
    );
  })
);
var baixaSchema = z11.object({
  /** Como o cliente pagou a dívida. */
  method: z11.enum(["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA", "OUTRO"])
});
rotasEmAberto.post(
  "/:id/receber",
  exigir("venda.finalizar"),
  rota(async (req, res) => {
    const { method } = validar(baixaSchema, req.body);
    const cobranca = await db.salePayment.findUnique({
      where: { id: req.params.id },
      include: { sale: { select: { code: true, customerName: true } } }
    });
    if (!cobranca || cobranca.method !== "EM_ABERTO") throw naoEncontrado("Cobran\xE7a");
    if (cobranca.settledAt) throw new AppError("Esta cobran\xE7a j\xE1 foi quitada.");
    await db.salePayment.update({
      where: { id: cobranca.id },
      data: {
        settledAt: /* @__PURE__ */ new Date(),
        settledMethod: method,
        settledById: req.usuario?.id ?? null,
        // Agora o dinheiro entrou: o líquido deixa de ser zero.
        netAmount: cobranca.amount
      }
    });
    await registrarLog({
      acao: "RECEBER_EM_ABERTO",
      entidade: "SalePayment",
      id: cobranca.id,
      alteracoes: { venda: cobranca.sale.code, valor: numero(cobranca.amount), forma: method },
      req
    });
    res.json({
      message: `Recebido de ${cobranca.sale.customerName ?? "cliente"}: R$ ${numero(cobranca.amount).toFixed(2)} da venda ${cobranca.sale.code}.`
    });
  })
);
rotasEmAberto.post(
  "/:id/reabrir",
  exigir("venda.finalizar"),
  rota(async (req, res) => {
    const cobranca = await db.salePayment.findUnique({ where: { id: req.params.id } });
    if (!cobranca || cobranca.method !== "EM_ABERTO") throw naoEncontrado("Cobran\xE7a");
    if (!cobranca.settledAt) throw new AppError("Esta cobran\xE7a j\xE1 est\xE1 em aberto.");
    await db.salePayment.update({
      where: { id: cobranca.id },
      data: {
        settledAt: null,
        settledMethod: null,
        settledById: null,
        netAmount: new Prisma5.Decimal(0)
      }
    });
    await registrarLog({ acao: "REABRIR_EM_ABERTO", entidade: "SalePayment", id: cobranca.id, req });
    res.json({ message: "Cobran\xE7a reaberta." });
  })
);

// server/trocas.ts
import { Prisma as Prisma6 } from "@prisma/client";
import { Router as Router13 } from "express";
import { z as z12 } from "zod";

// shared/trocas.ts
var DEFEITOS = [
  { chave: "bateria", rotulo: "Bateria ruim" },
  { chave: "tela", rotulo: "Tela com avaria" },
  { chave: "traseira", rotulo: "Traseira trincada" },
  { chave: "camera", rotulo: "C\xE2mera com problema" },
  { chave: "botoes", rotulo: "Bot\xF5es falhando" },
  { chave: "carga", rotulo: "N\xE3o carrega direito" },
  { chave: "biometria", rotulo: "Biometria / Face ID n\xE3o funciona" },
  { chave: "molhado", rotulo: "J\xE1 tomou \xE1gua" },
  { chave: "reparo", rotulo: "J\xE1 foi aberto / tem pe\xE7a trocada" },
  { chave: "conta", rotulo: "Conta do fabricante ainda logada" }
];
var DEFEITO_ROTULO = Object.fromEntries(
  DEFEITOS.map((d) => [d.chave, d.rotulo])
);
var SITUACOES_IMEI = [
  { chave: "NAO_CONSULTADO", rotulo: "Ainda n\xE3o consultei", tom: "neutral" },
  { chave: "REGULAR", rotulo: "Regular", tom: "success" },
  { chave: "IRREGULAR", rotulo: "Irregular / n\xE3o homologado", tom: "warning" },
  { chave: "BLOQUEADO", rotulo: "Roubado, furtado ou bloqueado", tom: "danger" }
];
var SITUACAO_IMEI_ROTULO = Object.fromEntries(
  SITUACOES_IMEI.map((s) => [s.chave, s.rotulo])
);
function imeiValido(imei) {
  const numeros = imei.replace(/\D/g, "");
  if (numeros.length !== 15) return false;
  let soma = 0;
  for (let i = 0; i < 15; i += 1) {
    let d = Number(numeros[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

// server/trocas.ts
var rotasTrocas = Router13();
rotasTrocas.use(autenticar);
var CHAVES_DEFEITO = DEFEITOS.map((d) => d.chave);
var COM_TUDO2 = {
  photos: { select: { id: true, tipo: true }, orderBy: { createdAt: "asc" } },
  seller: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  preSale: { select: { id: true, code: true, status: true } },
  sale: { select: { id: true, code: true } }
};
var paraJson = (t) => ({
  ...limpar(t),
  photos: t.photos.map((f) => ({ id: f.id, tipo: f.tipo, url: `/api/trocas/fotos/${f.id}` })),
  /** Quanto o cliente ainda precisa pagar. Negativo = a loja é que deve. */
  diferenca: Number(t.valorSaida) - Number(t.valorAvaliado)
});
var fotoSchema = z12.object({
  tipo: z12.enum(["ANATEL", "DOCUMENTO", "APARELHO"]),
  /** data:image/jpeg;base64,… já reduzida pelo navegador. */
  data: z12.string().max(4e6)
});
var trocaSchema = z12.object({
  modelo: z12.string().trim().min(2, "Informe o modelo do aparelho").max(120),
  marca: z12.string().trim().max(60).optional().nullable(),
  armazenamento: z12.string().trim().max(20).optional().nullable(),
  cor: z12.string().trim().max(40).optional().nullable(),
  /**
   * Opcional porque o balcão não para.
   *
   * Quando vem, é conferido de verdade: erro de digitação vira problema
   * depois que o cliente já foi embora.
   */
  imei: z12.string().trim().transform((v) => v.replace(/\D/g, "")).refine((v) => v === "" || v.length === 15, "O IMEI tem 15 n\xFAmeros").refine((v) => v === "" || imeiValido(v), "Esse IMEI n\xE3o passa na confer\xEAncia \u2014 confira os n\xFAmeros").optional().nullable(),
  imeiSituacao: z12.enum(["NAO_CONSULTADO", "REGULAR", "IRREGULAR", "BLOQUEADO"]).default("NAO_CONSULTADO"),
  estado: z12.string().trim().max(40).optional().nullable(),
  defeitos: z12.array(z12.enum(CHAVES_DEFEITO)).default([]),
  observacoes: z12.string().trim().max(2e3).optional().nullable(),
  valorAvaliado: z12.coerce.number().min(0, "Informe quanto vale o aparelho do cliente"),
  productId: z12.string().uuid().optional().nullable(),
  saidaNome: z12.string().trim().max(180).optional().nullable(),
  valorSaida: z12.coerce.number().min(0).default(0),
  customerId: z12.string().uuid().optional().nullable(),
  customerName: z12.string().trim().min(2, "Informe o nome do cliente").max(180),
  customerPhone: z12.string().trim().max(30).optional().nullable(),
  customerDocument: z12.string().trim().max(30).optional().nullable(),
  unitId: z12.string().uuid().optional().nullable(),
  photos: z12.array(fotoSchema).max(10).optional()
});
var podeVerTodas2 = (req) => podeFazer(req.usuario?.papel, "prevenda.verTodas");
function separarFotos2(fotos) {
  return (fotos ?? []).flatMap((f) => {
    const base64 = f.data.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!base64) return [];
    return [{ tipo: f.tipo, mimeType: base64[1], data: Buffer.from(base64[2], "base64") }];
  });
}
rotasTrocas.get(
  "/",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const q = validar(
      z12.object({
        page: z12.coerce.number().int().min(1).optional(),
        pageSize: z12.coerce.number().int().min(1).max(100).optional(),
        status: z12.string().optional().transform((v) => v ? v.split(",").map((s) => s.trim()).filter(Boolean) : void 0).pipe(z12.array(z12.enum(["AVALIADA", "ACEITA", "RECUSADA"])).min(1).optional()),
        search: z12.string().trim().optional(),
        /** Só as que ainda não foram amarradas a uma pré-venda. */
        livres: z12.enum(["true", "false"]).optional()
      }),
      semVazios(req.query)
    );
    const p = paginacao(q);
    const where = {
      ...podeVerTodas2(req) ? {} : { sellerId: req.usuario.id },
      ...q.status ? { status: { in: q.status } } : {},
      ...q.livres === "true" ? { preSaleId: null, saleId: null, status: "AVALIADA" } : {},
      ...q.search ? {
        OR: [
          { code: { contains: q.search, mode: "insensitive" } },
          { imei: { contains: q.search } },
          { modelo: { contains: q.search, mode: "insensitive" } },
          { customerName: { contains: q.search, mode: "insensitive" } }
        ]
      } : {}
    };
    const [lista, total] = await Promise.all([
      db.tradeIn.findMany({ where, include: COM_TUDO2, skip: p.skip, take: p.take, orderBy: { createdAt: "desc" } }),
      db.tradeIn.count({ where })
    ]);
    res.json(paginado(lista.map(paraJson), total, p));
  })
);
rotasTrocas.get(
  "/:id",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id }, include: COM_TUDO2 });
    if (!troca) throw naoEncontrado("Troca");
    if (!podeVerTodas2(req) && troca.sellerId !== req.usuario.id) {
      throw new AppError("Esta troca \xE9 de outro vendedor", 403);
    }
    res.json(paraJson(troca));
  })
);
rotasTrocas.get(
  "/fotos/:id",
  rota(async (req, res) => {
    const foto2 = await db.tradeInPhoto.findUnique({ where: { id: req.params.id } });
    if (!foto2) throw naoEncontrado("Foto");
    res.setHeader("Content-Type", foto2.mimeType);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(Buffer.from(foto2.data));
  })
);
rotasTrocas.post(
  "/",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const dados = validar(trocaSchema, req.body);
    const repetido = dados.imei ? await db.tradeIn.findFirst({
      where: { imei: dados.imei, status: { not: "RECUSADA" } },
      select: { code: true, createdAt: true }
    }) : null;
    if (repetido) {
      throw new AppError(
        `Esse IMEI j\xE1 foi recebido na troca ${repetido.code}. Se for outro aparelho, confira os n\xFAmeros.`
      );
    }
    if (dados.imeiSituacao === "BLOQUEADO") {
      throw new AppError(
        "A Anatel aponta este aparelho como roubado, furtado ou bloqueado. N\xE3o \xE9 poss\xEDvel receb\xEA-lo."
      );
    }
    let saidaNome = dados.saidaNome ?? null;
    if (dados.productId) {
      const produto = await db.product.findUnique({ where: { id: dados.productId }, select: { name: true } });
      if (!produto) throw naoEncontrado("Produto");
      saidaNome = produto.name;
    }
    const troca = await db.tradeIn.create({
      data: {
        code: await proximoCodigo("troca", "TR"),
        sellerId: req.usuario.id,
        unitId: dados.unitId ?? req.usuario.unidadeId ?? null,
        modelo: dados.modelo,
        marca: dados.marca ?? null,
        armazenamento: dados.armazenamento ?? null,
        cor: dados.cor ?? null,
        imei: dados.imei || null,
        imeiSituacao: dados.imeiSituacao,
        imeiCheckedAt: dados.imeiSituacao === "NAO_CONSULTADO" ? null : /* @__PURE__ */ new Date(),
        estado: dados.estado ?? null,
        defeitos: dados.defeitos,
        observacoes: dados.observacoes ?? null,
        valorAvaliado: new Prisma6.Decimal(dados.valorAvaliado),
        productId: dados.productId ?? null,
        saidaNome,
        valorSaida: new Prisma6.Decimal(dados.valorSaida),
        customerId: dados.customerId ?? null,
        customerName: dados.customerName,
        customerPhone: dados.customerPhone ?? null,
        customerDocument: dados.customerDocument ?? null,
        photos: { create: separarFotos2(dados.photos) }
      },
      include: COM_TUDO2
    });
    await registrarLog({
      acao: "CRIAR_TROCA",
      entidade: "TradeIn",
      id: troca.id,
      alteracoes: { codigo: troca.code, imei: troca.imei, valor: dados.valorAvaliado },
      req
    });
    res.status(201).json({
      ...paraJson(troca),
      message: `Troca ${troca.code} registrada \u2014 ${dados.modelo} avaliado em R$ ${dados.valorAvaliado.toFixed(2)}.`
    });
  })
);
var situacaoSchema = z12.object({
  imeiSituacao: z12.enum(["NAO_CONSULTADO", "REGULAR", "IRREGULAR", "BLOQUEADO"]),
  /** Print da consulta, se veio junto. */
  foto: z12.string().max(4e6).optional().nullable()
});
rotasTrocas.post(
  "/:id/anatel",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const { imeiSituacao, foto: foto2 } = validar(situacaoSchema, req.body);
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado("Troca");
    if (!podeVerTodas2(req) && troca.sellerId !== req.usuario.id) {
      throw new AppError("Esta troca \xE9 de outro vendedor", 403);
    }
    const novas = separarFotos2(foto2 ? [{ tipo: "ANATEL", data: foto2 }] : []);
    const atualizada = await db.tradeIn.update({
      where: { id: troca.id },
      data: {
        imeiSituacao,
        imeiCheckedAt: imeiSituacao === "NAO_CONSULTADO" ? null : /* @__PURE__ */ new Date(),
        photos: novas.length ? { create: novas } : void 0
      },
      include: COM_TUDO2
    });
    if (imeiSituacao === "BLOQUEADO") {
      await notificarPerfil("ADMIN", {
        title: `IMEI bloqueado na troca ${troca.code}`,
        message: `${troca.modelo} \xB7 IMEI ${troca.imei} \xB7 cliente ${troca.customerName}`,
        link: "/trocas"
      });
    }
    await registrarLog({ acao: "ANATEL_TROCA", entidade: "TradeIn", id: troca.id, req });
    res.json(paraJson(atualizada));
  })
);
rotasTrocas.post(
  "/:id/recusar",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado("Troca");
    if (troca.status === "ACEITA") throw new AppError("Esta troca j\xE1 virou venda.");
    if (!podeVerTodas2(req) && troca.sellerId !== req.usuario.id) {
      throw new AppError("Esta troca \xE9 de outro vendedor", 403);
    }
    await db.tradeIn.update({
      where: { id: troca.id },
      data: { status: "RECUSADA", preSaleId: null }
    });
    await registrarLog({ acao: "RECUSAR_TROCA", entidade: "TradeIn", id: troca.id, req });
    res.json({ message: `Troca ${troca.code} recusada \u2014 o aparelho volta para o cliente.` });
  })
);
rotasTrocas.delete(
  "/:id",
  exigir("troca.criar"),
  rota(async (req, res) => {
    const troca = await db.tradeIn.findUnique({ where: { id: req.params.id } });
    if (!troca) throw naoEncontrado("Troca");
    if (troca.status === "ACEITA") throw new AppError("Esta troca j\xE1 virou venda e faz parte do hist\xF3rico.");
    if (!podeVerTodas2(req) && troca.sellerId !== req.usuario.id) {
      throw new AppError("Esta troca \xE9 de outro vendedor", 403);
    }
    await db.tradeIn.delete({ where: { id: troca.id } });
    await registrarLog({ acao: "EXCLUIR_TROCA", entidade: "TradeIn", id: troca.id, req });
    res.json({ message: `Troca ${troca.code} exclu\xEDda.` });
  })
);

// server/vendas.ts
import { Prisma as Prisma7 } from "@prisma/client";
import { Router as Router14 } from "express";
import { z as z13 } from "zod";

// server/recibo.ts
import PDFDocument2 from "pdfkit";
var AZUL2 = "#0F172A";
var CINZA = "#475569";
var BORDA = "#94A3B8";
var FAIXA = "#E2E8F0";
var CLARO = "#F8FAFC";
var dinheiro2 = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var dataBR2 = (d) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
function enviarRecibo(res, r) {
  const doc = new PDFDocument2({ margin: 28, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="comprovante-${r.code}.pdf"`);
  doc.pipe(res);
  const x0 = doc.page.margins.left;
  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const PAD = 6;
  const quadro = (y2, altura, preenchimento) => {
    if (preenchimento) doc.rect(x0, y2, largura, altura).fill(preenchimento);
    doc.rect(x0, y2, largura, altura).lineWidth(0.7).strokeColor(BORDA).stroke();
  };
  const secao = (titulo) => {
    const y2 = doc.y;
    quadro(y2, 16, FAIXA);
    doc.fillColor(AZUL2).font("Helvetica-Bold").fontSize(8).text(titulo, x0 + PAD, y2 + 4.5, {
      lineBreak: false
    });
    doc.y = y2 + 16;
  };
  const alturaTopo = 56;
  let y = doc.y;
  quadro(y, alturaTopo);
  doc.fillColor(AZUL2).font("Helvetica-Bold").fontSize(13).text(r.loja.nome.toUpperCase(), x0 + PAD, y + 8, {
    width: largura * 0.55,
    lineBreak: false
  });
  doc.font("Helvetica").fontSize(8).fillColor(CINZA);
  let linhaY = y + 25;
  for (const texto3 of [linhaDeEndereco(r.loja), linhaDeCidade(r.loja), r.loja.documento && `CNPJ/CPF: ${r.loja.documento}`]) {
    if (!texto3) continue;
    doc.text(texto3, x0 + PAD, linhaY, { width: largura * 0.55, lineBreak: false });
    linhaY += 10;
  }
  doc.font("Helvetica-Bold").fontSize(8).fillColor(AZUL2);
  let direitaY = y + 9;
  for (const texto3 of [r.loja.telefone, r.loja.email]) {
    if (!texto3) continue;
    doc.text(texto3, x0, direitaY, { width: largura - PAD, align: "right", lineBreak: false });
    direitaY += 10;
  }
  doc.font("Helvetica").fillColor(CINZA).text(`Vendedor: ${r.sellerName?.trim() || "\u2014"}`, x0, direitaY, {
    width: largura - PAD,
    align: "right",
    lineBreak: false
  });
  doc.y = y + alturaTopo;
  y = doc.y;
  quadro(y, 20, CLARO);
  doc.fillColor(AZUL2).font("Helvetica-Bold").fontSize(11).text(`COMPROVANTE N\xBA ${r.code}`, x0, y + 5.5, {
    width: largura,
    align: "center",
    lineBreak: false
  });
  doc.fontSize(9).text(dataBR2(r.saleDate), x0, y + 6.5, {
    width: largura - PAD,
    align: "right",
    lineBreak: false
  });
  doc.y = y + 20;
  secao("DADOS DO CLIENTE");
  const linhaDeCampos = (pares) => {
    const yl = doc.y;
    quadro(yl, 16);
    const metade = largura / 2;
    pares.slice(0, 2).forEach(([rotulo, valor], i) => {
      const cx = x0 + i * metade;
      if (i === 1) {
        doc.moveTo(cx, yl).lineTo(cx, yl + 16).lineWidth(0.7).strokeColor(BORDA).stroke();
      }
      doc.fillColor(CINZA).font("Helvetica-Bold").fontSize(8).text(rotulo, cx + PAD, yl + 4.5, {
        width: 70,
        lineBreak: false
      });
      doc.fillColor(AZUL2).font("Helvetica").text(valor || "\u2014", cx + PAD + 72, yl + 4.5, {
        width: metade - 72 - PAD * 2,
        lineBreak: false,
        ellipsis: true
      });
    });
    doc.y = yl + 16;
  };
  linhaDeCampos([
    ["Cliente:", r.customerName?.trim() || "Consumidor n\xE3o identificado"],
    ["CPF/CNPJ:", r.customerDocument ?? ""]
  ]);
  linhaDeCampos([
    ["Telefone:", r.customerPhone ?? ""],
    ["Loja:", r.unitName ?? ""]
  ]);
  doc.y += 6;
  secao("PRODUTOS");
  const colunas = [
    { titulo: "ITEM", peso: 6, alinhar: "center" },
    { titulo: "NOME", peso: 46 },
    { titulo: "UND.", peso: 8, alinhar: "center" },
    { titulo: "QTD.", peso: 9, alinhar: "right" },
    { titulo: "VR. UNIT.", peso: 15, alinhar: "right" },
    { titulo: "SUBTOTAL", peso: 16, alinhar: "right" }
  ];
  const peso = colunas.reduce((s, c) => s + c.peso, 0);
  const larguras = colunas.map((c) => c.peso / peso * largura);
  const linhaDaTabela = (valores2, altura, opcoes) => {
    const yl = doc.y;
    quadro(yl, altura, opcoes?.fundo);
    let x = x0;
    colunas.forEach((c, i) => {
      if (i > 0) {
        doc.moveTo(x, yl).lineTo(x, yl + altura).lineWidth(0.7).strokeColor(BORDA).stroke();
      }
      doc.fillColor(opcoes?.negrito ? AZUL2 : "#1E293B").font(opcoes?.negrito ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(valores2[i] ?? "", x + 4, yl + 4.5, {
        width: larguras[i] - 8,
        align: c.alinhar ?? "left",
        lineBreak: false,
        ellipsis: true
      });
      x += larguras[i];
    });
    if (opcoes?.subtexto) {
      doc.fillColor(CINZA).font("Helvetica").fontSize(6.5).text(opcoes.subtexto, x0 + larguras[0] + 4, yl + 14, {
        width: larguras[1] - 8,
        lineBreak: false,
        ellipsis: true
      });
    }
    doc.y = yl + altura;
  };
  linhaDaTabela(colunas.map((c) => c.titulo), 16, { negrito: true, fundo: FAIXA });
  r.items.forEach((item, i) => {
    const identificador = [item.imei && `IMEI ${item.imei}`, item.serialNumber && `N\xBA ${item.serialNumber}`].filter(Boolean).join(" \xB7 ");
    if (doc.y > doc.page.height - doc.page.margins.bottom - 150) doc.addPage();
    linhaDaTabela(
      [
        String(i + 1),
        item.productName,
        "UN",
        dinheiro2(item.quantity),
        dinheiro2(item.unitPrice),
        dinheiro2(item.unitPrice * item.quantity)
      ],
      identificador ? 24 : 16,
      { subtexto: identificador || void 0 }
    );
  });
  const pecas = r.items.reduce((s, i) => s + i.quantity, 0);
  const somaDosItens = r.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  linhaDaTabela(["", "TOTAL", "", dinheiro2(pecas), "", dinheiro2(somaDosItens)], 16, {
    negrito: true,
    fundo: FAIXA
  });
  doc.y += 4;
  const totalDireita = (rotulo, valor, grande = false) => {
    const yl = doc.y;
    doc.fillColor(AZUL2).font("Helvetica-Bold").fontSize(grande ? 11 : 9).text(`${rotulo} ${valor}`, x0, yl, { width: largura - PAD, align: "right", lineBreak: false });
    doc.y = yl + (grande ? 16 : 12);
  };
  totalDireita("PRODUTOS:", dinheiro2(somaDosItens));
  totalDireita("TOTAL:", `R$ ${dinheiro2(r.total)}`, true);
  doc.y += 4;
  secao("DADOS DO PAGAMENTO");
  const colsPag = [
    { titulo: "DATA", peso: 16 },
    { titulo: "VALOR", peso: 16, alinhar: "right" },
    { titulo: "FORMA DE PAGAMENTO", peso: 30 },
    { titulo: "OBSERVA\xC7\xC3O", peso: 38 }
  ];
  const pesoPag = colsPag.reduce((s, c) => s + c.peso, 0);
  const largsPag = colsPag.map((c) => c.peso / pesoPag * largura);
  const linhaPag = (valores2, negrito = false, fundo) => {
    const yl = doc.y;
    quadro(yl, 16, fundo);
    let x = x0;
    colsPag.forEach((c, i) => {
      if (i > 0) {
        doc.moveTo(x, yl).lineTo(x, yl + 16).lineWidth(0.7).strokeColor(BORDA).stroke();
      }
      doc.fillColor(negrito ? AZUL2 : "#1E293B").font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(valores2[i] ?? "", x + 4, yl + 4.5, {
        width: largsPag[i] - 8,
        align: c.alinhar ?? "left",
        lineBreak: false,
        ellipsis: true
      });
      x += largsPag[i];
    });
    doc.y = yl + 16;
  };
  linhaPag(colsPag.map((c) => c.titulo), true, FAIXA);
  for (const p of r.payments) {
    const forma = PAGAMENTO_LABEL[p.method] ?? p.method;
    const observacao = p.method === "TROCA" && r.troca ? [r.troca.modelo, r.troca.imei && `IMEI ${r.troca.imei}`].filter(Boolean).join(" \xB7 ") : "";
    linhaPag([
      dataBR2(r.saleDate),
      dinheiro2(p.amount),
      p.installments > 1 ? `${forma} \u2014 ${p.installments}x de ${dinheiro2(p.amount / p.installments)}` : forma,
      observacao
    ]);
  }
  if (r.notes?.trim()) {
    doc.y += 6;
    secao("OBSERVA\xC7\xD5ES");
    const yl = doc.y;
    const alturaObs = Math.max(20, doc.heightOfString(r.notes.trim(), { width: largura - PAD * 2 }) + 9);
    quadro(yl, alturaObs);
    doc.fillColor("#1E293B").font("Helvetica").fontSize(8).text(r.notes.trim(), x0 + PAD, yl + 5, {
      width: largura - PAD * 2
    });
    doc.y = yl + alturaObs;
  }
  doc.y += 14;
  const yAss = doc.y;
  quadro(yAss, 44);
  doc.moveTo(x0 + largura * 0.25, yAss + 26).lineTo(x0 + largura * 0.75, yAss + 26).lineWidth(0.7).strokeColor(AZUL2).stroke();
  doc.fillColor(CINZA).font("Helvetica").fontSize(8).text("Assinatura do cliente", x0, yAss + 30, {
    width: largura,
    align: "center",
    lineBreak: false
  });
  doc.y = yAss + 44;
  doc.y += 8;
  doc.fillColor(CINZA).fontSize(7).font("Helvetica").text(
    [
      r.loja.rodape,
      "Documento sem valor fiscal, emitido para controle interno e comprova\xE7\xE3o de compra. Guarde este comprovante para qualquer atendimento de garantia ou troca."
    ].filter(Boolean).join("\n"),
    x0,
    doc.y,
    { width: largura, align: "center" }
  );
  doc.end();
}

// server/vendas.ts
var rotasVendas = Router14();
rotasVendas.use(autenticar);
var PAGAMENTOS2 = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "TRANSFERENCIA", "EM_ABERTO", "OUTRO"];
var COM_TUDO3 = {
  items: { include: { product: { select: { id: true, name: true, model: true, category: true } } } },
  customer: true,
  unit: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  cashier: { select: { id: true, name: true } },
  preSale: { select: { id: true, code: true } },
  payments: { orderBy: { amount: "desc" } }
};
var filtrosSchema2 = z13.object({
  page: z13.coerce.number().int().min(1).optional(),
  pageSize: z13.coerce.number().int().min(1).max(200).optional(),
  search: z13.string().trim().optional(),
  productId: z13.string().uuid().optional(),
  categoryId: z13.string().uuid().optional(),
  paymentMethod: z13.enum(PAGAMENTOS2).optional(),
  sellerId: z13.string().uuid().optional(),
  cashierId: z13.string().uuid().optional(),
  unitId: z13.string().uuid().optional(),
  startDate: z13.coerce.date().optional(),
  endDate: z13.coerce.date().optional(),
  sortBy: z13.string().optional(),
  sortOrder: z13.enum(["asc", "desc"]).optional()
});
async function filtrarVendas(q, unidadeId) {
  const cond = [{ status: "FINALIZADA" }];
  if (q.search) {
    cond.push({
      OR: [
        { code: contem(q.search) },
        { customerName: contem(q.search) },
        { customerPhone: contem(q.search) },
        { customerDocument: contem(q.search) },
        { items: { some: { productName: contem(q.search) } } },
        { items: { some: { imei: contem(q.search) } } },
        { items: { some: { serialNumber: contem(q.search) } } },
        { items: { some: { product: { name: contem(q.search) } } } }
      ]
    });
  }
  if (q.productId) cond.push({ items: { some: { productId: q.productId } } });
  if (q.categoryId) {
    cond.push({ items: { some: { product: { categoryId: { in: await comAsFilhas(q.categoryId) } } } } });
  }
  if (q.paymentMethod) cond.push({ paymentMethod: q.paymentMethod });
  if (q.sellerId) cond.push({ sellerId: q.sellerId });
  if (q.cashierId) cond.push({ cashierId: q.cashierId });
  if (unidadeId) cond.push({ unitId: unidadeId });
  const periodo2 = intervalo(q.startDate, q.endDate);
  if (periodo2) cond.push({ saleDate: periodo2 });
  return { AND: cond };
}
rotasVendas.get(
  "/",
  rota(async (req, res) => {
    const q = validar(filtrosSchema2, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const p = paginacao(q);
    const where = await filtrarVendas(q, unidade);
    const [lista, total, somas, itens] = await Promise.all([
      db.sale.findMany({
        where,
        include: COM_TUDO3,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(q.sortBy, q.sortOrder, ["saleDate", "totalAmount", "code", "createdAt"], {
          saleDate: "desc"
        })
      }),
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalAmount: true, costAmount: true } }),
      db.saleItem.aggregate({ where: { sale: where }, _sum: { quantity: true } })
    ]);
    res.json(
      limpar({
        ...paginado(lista, total, p),
        totals: {
          revenue: somas._sum.totalAmount ?? 0,
          profit: numero(somas._sum.totalAmount) - numero(somas._sum.costAmount),
          items: itens._sum.quantity ?? 0
        }
      })
    );
  })
);
rotasVendas.get(
  "/:id",
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({ where: { id: req.params.id }, include: COM_TUDO3 });
    if (!venda) throw naoEncontrado("Venda");
    res.json(limpar(venda));
  })
);
var vendaSchema = z13.object({
  items: z13.array(
    z13.object({
      productId: z13.string().uuid("Selecione o produto"),
      quantity: z13.coerce.number().int().min(1, "Quantidade m\xEDnima: 1"),
      unitPrice: z13.coerce.number().min(0, "Informe o valor"),
      imei: z13.string().trim().max(40).optional().nullable(),
      serialNumber: z13.string().trim().max(60).optional().nullable()
    })
  ).min(1, "Inclua ao menos um produto"),
  unitId: z13.string().uuid("Informe de qual unidade o produto saiu"),
  paymentMethod: z13.enum(PAGAMENTOS2),
  installments: z13.coerce.number().int().min(1).max(24).default(1),
  /**
   * Pagamento dividido: parte no PIX, parte no cartão, e por aí.
   *
   * Vazio = a venda inteira em `paymentMethod`. A soma tem de fechar com
   * o total, e isso é conferido dentro da transação.
   */
  payments: z13.array(
    z13.object({
      method: z13.enum(PAGAMENTOS2),
      amount: z13.coerce.number().min(0.01, "Informe o valor desta forma"),
      installments: z13.coerce.number().int().min(1).max(24).default(1),
      notes: z13.string().trim().max(120).optional().nullable(),
      /** Taxa da maquininha, em %. Guardada com a venda. */
      feePercent: z13.coerce.number().min(0).max(99.99).optional().nullable(),
      /** Em qual conta caiu — usado no Pix, que tem mais de uma. */
      destino: z13.string().trim().max(60).optional().nullable()
    })
  ).max(6, "No m\xE1ximo 6 formas na mesma venda").optional(),
  /**
   * Opcional na venda de balcão.
   *
   * No caixa a fila anda, e exigir nome e CPF de quem paga R$ 60 num cabo
   * atrasa todo mundo. A pré-venda continua pedindo: lá o caixa precisa
   * saber de quem é o pedido.
   */
  customerName: z13.string().trim().max(180).optional().nullable(),
  customerPhone: z13.string().trim().max(30).optional().nullable(),
  customerDocument: z13.string().trim().max(30).optional().nullable(),
  customerId: z13.string().uuid().optional().nullable(),
  /** Cobrado além do preço dos produtos — o repasse da taxa do cartão. */
  acrescimo: z13.coerce.number().min(0).max(999999).optional().nullable(),
  /** Libera vender abaixo do preço de atacado. */
  chaveDeAcesso: z13.string().trim().max(60).optional().nullable(),
  /**
   * Aparelho que o cliente deixou como parte do pagamento.
   *
   * Versão de balcão: só o que dá para anotar com o cliente na frente.
   * O aparelho vira uma forma de pagamento e o cliente paga a diferença.
   */
  tradeIn: z13.object({
    modelo: z13.string().trim().min(2, "Informe o modelo do aparelho").max(120),
    cor: z13.string().trim().max(40).optional().nullable(),
    armazenamento: z13.string().trim().max(20).optional().nullable(),
    valorAvaliado: z13.coerce.number().min(0.01, "Informe quanto vale o aparelho do cliente")
  }).optional().nullable(),
  /** Vendedor que atendeu, para a comissão. Vazio = o próprio caixa. */
  sellerId: z13.string().uuid().optional().nullable(),
  /**
   * Nome digitado no balcão.
   *
   * Nem todo vendedor tem login: a loja tem gente no salão que nunca entra
   * no sistema. Sem isto, a venda ficaria no nome do caixa e a comissão
   * apontaria para a pessoa errada.
   */
  sellerName: z13.string().trim().max(120).optional().nullable(),
  notes: z13.string().trim().max(1e3).optional().nullable(),
  saleDate: z13.coerce.date().optional()
});
rotasVendas.post(
  "/",
  exigir("pdv"),
  rota(async (req, res) => {
    const dados = validar(vendaSchema, req.body);
    await exigirChaveSeAbaixoDoMinimo(dados.items, dados.chaveDeAcesso);
    let vendedorId = dados.sellerId ?? req.usuario.id;
    if (dados.sellerName?.trim()) {
      const encontrado = await db.user.findFirst({
        where: { name: { equals: dados.sellerName.trim(), mode: "insensitive" } },
        select: { id: true }
      });
      vendedorId = encontrado?.id ?? null;
    }
    const venda = await registrarVenda({
      itens: dados.items,
      unitId: dados.unitId,
      paymentMethod: dados.paymentMethod,
      installments: dados.installments,
      pagamentos: dados.payments,
      acrescimo: dados.acrescimo,
      trocaNova: dados.tradeIn,
      customerName: dados.customerName,
      sellerName: dados.sellerName,
      customerPhone: dados.customerPhone,
      customerDocument: dados.customerDocument,
      customerId: dados.customerId,
      notes: dados.notes,
      sellerId: vendedorId,
      cashierId: req.usuario.id,
      cashierName: req.usuario.nome,
      saleDate: dados.saleDate
    });
    await registrarLog({
      acao: "CRIAR_VENDA",
      entidade: "Sale",
      id: venda.id,
      alteracoes: {
        venda: venda.code,
        unidade: venda.unit.name,
        pagamento: dados.paymentMethod,
        total: numero(venda.totalAmount)
      },
      req
    });
    res.status(201).json(limpar(venda));
  })
);
rotasVendas.delete(
  "/:id",
  exigir("venda.cancelar"),
  rota(async (req, res) => {
    const motivo = String(req.query.reason ?? "").trim();
    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, unit: { select: { name: true } } }
    });
    if (!venda) throw naoEncontrado("Venda");
    if (venda.status === "CANCELADA") throw new AppError("Esta venda j\xE1 foi cancelada.");
    for (const item of venda.items) {
      await movimentar({
        produtoId: item.productId,
        produtoNome: item.productName ?? "Produto",
        unidadeId: venda.unitId,
        tipo: "ENTRADA",
        motivo: "CANCELAMENTO",
        quantidade: item.quantity,
        observacao: `Cancelamento da venda ${venda.code}${motivo ? ` \xB7 ${motivo}` : ""}`,
        vendaId: venda.id,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome
      });
    }
    await db.sale.update({ where: { id: venda.id }, data: { status: "CANCELADA" } });
    await registrarLog({
      acao: "CANCELAR_VENDA",
      entidade: "Sale",
      id: venda.id,
      alteracoes: { venda: venda.code, motivo },
      req
    });
    res.json({
      message: `Venda ${venda.code} cancelada. ${venda.items.length} item(ns) devolvidos ao estoque da ${venda.unit.name}.`
    });
  })
);
rotasVendas.get(
  "/:id/recibo",
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payments: { orderBy: { amount: "desc" } },
        unit: { select: { name: true } },
        seller: { select: { name: true } },
        cashier: { select: { name: true } },
        tradeIn: { select: { modelo: true, imei: true, cor: true, armazenamento: true, valorAvaliado: true } }
      }
    });
    if (!venda) throw naoEncontrado("Venda");
    enviarRecibo(res, {
      loja: await lojaSalva(),
      code: venda.code,
      saleDate: venda.saleDate,
      unitName: venda.unit?.name,
      customerName: venda.customerName,
      customerPhone: venda.customerPhone,
      customerDocument: venda.customerDocument,
      sellerName: venda.seller?.name ?? venda.sellerName,
      cashierName: venda.cashier?.name,
      notes: venda.notes,
      items: venda.items.map((i) => ({
        productName: i.productName ?? "Produto",
        quantity: i.quantity,
        unitPrice: numero(i.unitPrice),
        imei: i.imei,
        serialNumber: i.serialNumber
      })),
      payments: venda.payments.map((p) => ({
        method: p.method,
        amount: numero(p.amount),
        installments: p.installments
      })),
      troca: venda.tradeIn ? {
        modelo: [venda.tradeIn.modelo, venda.tradeIn.armazenamento, venda.tradeIn.cor].filter(Boolean).join(" \xB7 "),
        imei: venda.tradeIn.imei,
        valor: numero(venda.tradeIn.valorAvaliado)
      } : null,
      total: numero(venda.totalAmount)
    });
  })
);
var edicaoSchema = z13.object({
  customerName: z13.string().trim().max(180).optional().nullable(),
  customerPhone: z13.string().trim().max(30).optional().nullable(),
  customerDocument: z13.string().trim().max(30).optional().nullable(),
  sellerName: z13.string().trim().max(120).optional().nullable(),
  notes: z13.string().trim().max(1e3).optional().nullable(),
  saleDate: z13.coerce.date().optional(),
  /** Lista completa e definitiva dos itens. */
  items: z13.array(
    z13.object({
      productId: z13.string().uuid(),
      quantity: z13.coerce.number().int().min(1),
      unitPrice: z13.coerce.number().min(0),
      imei: z13.string().trim().max(40).optional().nullable(),
      serialNumber: z13.string().trim().max(60).optional().nullable()
    })
  ).min(1, "A venda precisa de ao menos um produto").optional(),
  paymentMethod: z13.enum(PAGAMENTOS2).optional(),
  installments: z13.coerce.number().int().min(1).max(24).optional(),
  /** Lista completa e definitiva das formas de pagamento. */
  payments: z13.array(
    z13.object({
      method: z13.enum([...PAGAMENTOS2, "TROCA"]),
      amount: z13.coerce.number().min(0.01),
      installments: z13.coerce.number().int().min(1).max(24).default(1)
    })
  ).max(6).optional()
});
rotasVendas.put(
  "/:id",
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(edicaoSchema, req.body);
    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, payments: true, tradeIn: true, unit: { select: { name: true } } }
    });
    if (!venda) throw naoEncontrado("Venda");
    if (venda.status === "CANCELADA") {
      throw new AppError("Esta venda est\xE1 cancelada. Registre uma nova em vez de edit\xE1-la.");
    }
    let vendedorId = venda.sellerId;
    if (dados.sellerName !== void 0) {
      const nome = dados.sellerName?.trim();
      vendedorId = nome ? (await db.user.findFirst({
        where: { name: { equals: nome, mode: "insensitive" } },
        select: { id: true }
      }))?.id ?? null : null;
    }
    const resultado = await db.$transaction(async (tx) => {
      let total = numero(venda.totalAmount);
      let custo = numero(venda.costAmount);
      const ajustes = [];
      if (dados.items) {
        const produtos = await tx.product.findMany({
          where: { id: { in: dados.items.map((i) => i.productId) } },
          select: { id: true, name: true, costPrice: true }
        });
        if (produtos.length !== new Set(dados.items.map((i) => i.productId)).size) {
          throw naoEncontrado("Produto");
        }
        const antes = /* @__PURE__ */ new Map();
        for (const i of venda.items) antes.set(i.productId, (antes.get(i.productId) ?? 0) + i.quantity);
        const depois = /* @__PURE__ */ new Map();
        for (const i of dados.items) depois.set(i.productId, (depois.get(i.productId) ?? 0) + i.quantity);
        for (const produtoId of /* @__PURE__ */ new Set([...antes.keys(), ...depois.keys()])) {
          const diferenca = (depois.get(produtoId) ?? 0) - (antes.get(produtoId) ?? 0);
          if (diferenca === 0) continue;
          const nome = produtos.find((p) => p.id === produtoId)?.name ?? venda.items.find((i) => i.productId === produtoId)?.productName ?? "Produto";
          await movimentar({
            produtoId,
            produtoNome: nome,
            unidadeId: venda.unitId,
            tipo: diferenca > 0 ? "SAIDA" : "ENTRADA",
            motivo: diferenca > 0 ? "VENDA" : "CANCELAMENTO",
            quantidade: Math.abs(diferenca),
            observacao: `Corre\xE7\xE3o da venda ${venda.code}: ${nome} passou de ${antes.get(produtoId) ?? 0} para ${depois.get(produtoId) ?? 0}`,
            vendaId: venda.id,
            usuarioId: req.usuario?.id,
            usuarioNome: req.usuario?.nome,
            tx
          });
          ajustes.push(`${nome} ${antes.get(produtoId) ?? 0} \u2192 ${depois.get(produtoId) ?? 0}`);
        }
        total = dados.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        custo = dados.items.reduce(
          (s, i) => s + numero(produtos.find((p) => p.id === i.productId).costPrice) * i.quantity,
          0
        );
        await tx.saleItem.deleteMany({ where: { saleId: venda.id } });
        await tx.saleItem.createMany({
          data: dados.items.map((i) => ({
            saleId: venda.id,
            productId: i.productId,
            productName: produtos.find((p) => p.id === i.productId).name,
            quantity: i.quantity,
            unitPrice: new Prisma7.Decimal(i.unitPrice),
            costPrice: produtos.find((p) => p.id === i.productId).costPrice,
            imei: i.imei?.trim() || null,
            serialNumber: i.serialNumber?.trim() || null
          }))
        });
      }
      const daTroca = venda.tradeIn ? numero(venda.tradeIn.valorAvaliado) : 0;
      let rateio = dados.payments?.map((p) => ({
        method: p.method,
        amount: new Prisma7.Decimal(p.amount),
        installments: p.installments,
        notes: null
      }));
      if (!rateio && dados.items) {
        const semTroca = venda.payments.filter((p) => p.method !== "TROCA");
        const alvo = total - daTroca;
        const somaAtual = semTroca.reduce((s, p) => s + numero(p.amount), 0);
        const diferenca = alvo - somaAtual;
        if (Math.abs(diferenca) >= 0.01 && semTroca.length) {
          const maior = semTroca.reduce((m, p) => numero(p.amount) > numero(m.amount) ? p : m);
          rateio = venda.payments.map((p) => ({
            method: p.method,
            amount: p.id === maior.id ? new Prisma7.Decimal(numero(p.amount) + diferenca) : p.amount,
            installments: p.installments,
            notes: null
          }));
        }
      }
      if (rateio) {
        const soma = rateio.reduce((s, p) => s + numero(p.amount), 0);
        if (Math.abs(soma - total) >= 0.01) {
          throw new AppError(
            `As formas de pagamento somam R$ ${soma.toFixed(2)}, mas a venda \xE9 de R$ ${total.toFixed(2)}.`
          );
        }
        await tx.salePayment.deleteMany({ where: { saleId: venda.id } });
        await tx.salePayment.createMany({
          data: rateio.map((p) => ({ ...p, saleId: venda.id }))
        });
      }
      const principal = (rateio ?? venda.payments).filter((p) => p.method !== "TROCA").reduce(
        (m, p) => !m || p.amount.greaterThan(m.amount) ? p : m,
        null
      )?.method;
      const atualizada = await tx.sale.update({
        where: { id: venda.id },
        data: {
          ...dados.customerName !== void 0 ? { customerName: dados.customerName?.trim() || null } : {},
          ...dados.customerPhone !== void 0 ? { customerPhone: dados.customerPhone?.trim() || null } : {},
          ...dados.customerDocument !== void 0 ? { customerDocument: dados.customerDocument?.trim() || null } : {},
          ...dados.sellerName !== void 0 ? { sellerName: dados.sellerName?.trim() || null, sellerId: vendedorId } : {},
          ...dados.notes !== void 0 ? { notes: dados.notes?.trim() || null } : {},
          ...dados.saleDate ? { saleDate: dados.saleDate } : {},
          ...dados.installments ? { installments: dados.installments } : {},
          ...dados.paymentMethod ? { paymentMethod: dados.paymentMethod } : {},
          ...principal && !dados.paymentMethod ? { paymentMethod: principal } : {},
          totalAmount: new Prisma7.Decimal(total),
          costAmount: new Prisma7.Decimal(custo)
        },
        include: { items: true, payments: true }
      });
      return { atualizada, ajustes, total };
    });
    await registrarLog({
      acao: "EDITAR_VENDA",
      entidade: "Sale",
      id: venda.id,
      alteracoes: {
        venda: venda.code,
        totalAntes: numero(venda.totalAmount),
        totalDepois: resultado.total,
        estoque: resultado.ajustes
      },
      req
    });
    res.json(
      limpar({
        ...resultado.atualizada,
        message: `Venda ${venda.code} atualizada.` + (resultado.ajustes.length ? ` Estoque ajustado: ${resultado.ajustes.join(", ")}.` : "")
      })
    );
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
  app2.use("/api/pre-sales", rotasPreVendas);
  app2.use("/api/trocas", rotasTrocas);
  app2.use("/api/em-aberto", rotasEmAberto);
  app2.use("/api/cash", rotasCaixa);
  app2.use("/api/notifications", rotasNotificacoes);
  app2.use("/api/movements", rotasMovimentacoes);
  app2.use("/api/units", rotasUnidades);
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
