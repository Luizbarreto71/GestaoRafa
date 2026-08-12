import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import {
  AppError,
  dataBR,
  dataHoraCurta,
  intervalo,
  numero,
  PAGAMENTO_LABEL,
  rota,
  semVazios,
  validar,
} from './core';
import { exigir, podeFazer } from './permissoes';
import { db } from './db';
import { decimal, exportar, reais, type Coluna } from './exportar';
import {
  comAsFilhas,
  MOTIVO_LABEL,
  STATUS_PRODUTO_LABEL,
  TIPO_LABEL,
} from './estoque';
import { unidadePermitida } from './unidades';
import { compararProdutos } from '../shared/ordenar';
import { taxaDe } from '../shared/taxas';
import { taxasDoCartao } from './sistema';

/** Os seis relatórios, todos exportáveis em PDF, Excel ou CSV. */

export const rotasRelatorios = Router();
rotasRelatorios.use(autenticar, exigir('relatorios'));

const base = z.object({
  format: z.enum(['json', 'pdf', 'xlsx', 'csv']).default('json'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.enum(['EM_ESTOQUE', 'RESERVADO', 'VENDIDO']).optional(),
  paymentMethod: z.enum(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA']).optional(),
  unitId: z.string().uuid().optional(),
});

type Base = z.infer<typeof base>;


const periodo = (q: Base) => {
  if (!q.startDate && !q.endDate) return 'Período: todos os registros';
  return `Período: ${q.startDate ? dataBR(q.startDate) : 'início'} até ${q.endDate ? dataBR(q.endDate) : 'hoje'}`;
};

/** Coluna de dinheiro alinhada à direita. */
const money = (header: string, key: string, width = 12): Coluna => ({
  header,
  key,
  width,
  align: 'right',
  format: decimal,
});

/**
 * Preço de referência do produto: o varejo quando existe, senão o atacado.
 * O varejo é opcional no cadastro, então não dá para somar direto por ele.
 */
const precoDeVenda = (p: { salePrice: unknown; wholesalePrice: unknown }): number =>
  numero(p.salePrice as never) || numero(p.wholesalePrice as never);

const qtd = (header: string, key: string, width = 8): Coluna => ({
  header,
  key,
  width,
  align: 'right',
});

// -------------------------------------------------------- Relatório de estoque

rotasRelatorios.get(
  '/stock',
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const entrada = intervalo(q.startDate, q.endDate);

    // Uma linha por produto em cada unidade: é assim que se vê onde está
    // cada peça, em vez de um total que não diz nada.
    const linhasDeEstoque = await db.stock.findMany({
      where: {
        ...(unidade ? { unitId: unidade } : {}),
        product: {
          ...(q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {}),
          ...(q.supplierId ? { supplierId: q.supplierId } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(entrada ? { entryDate: entrada } : {}),
        },
      },
      include: {
        unit: { select: { name: true } },
        product: { include: { category: true, supplier: true } },
      },
      // A ordem final é feita em memória: "menor para o maior" depende de
      // ler os números dentro do nome, e isso o banco não sabe fazer.
      orderBy: [{ unit: { name: 'asc' } }, { product: { name: 'asc' } }],
    });

    linhasDeEstoque.sort((a, b) => {
      const porProduto = compararProdutos(a.product, b.product);
      return porProduto !== 0 ? porProduto : a.unit.name.localeCompare(b.unit.name, 'pt-BR');
    });

    const linhas = linhasDeEstoque.map(({ product: p, unit, quantity }) => ({
      unit: unit.name,
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? '—',
      model: p.model ?? '—',
      lote: p.lote ?? '—',
      quantity,
      costPrice: numero(p.costPrice),
      salePrice: numero(p.salePrice),
      wholesalePrice: p.wholesalePrice != null ? numero(p.wholesalePrice) : null,
      totalCost: numero(p.costPrice) * quantity,
      totalSale: precoDeVenda(p) * quantity,
      supplier: p.supplier?.name ?? '—',
      status: STATUS_PRODUTO_LABEL[p.status] ?? p.status,
      entryDate: dataBR(p.entryDate),
    }));

    const custo = linhas.reduce((s, l) => s + l.totalCost, 0);
    const venda = linhas.reduce((s, l) => s + l.totalSale, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Estoque',
      subtitle: periodo(q),
      // Separado por condição: lacrado e vitrine são mercadorias
      // diferentes, com preço diferente, e misturá-las esconde o que a
      // loja tem de cada uma.
      // Separado por categoria — que agora carrega a condição:
      // "Celulares › Vitrine" é um bloco, "Celulares › Lacrado" é outro.
      group: { key: 'category', totals: ['quantity', 'totalCost', 'totalSale'] },
      columns: [
        { header: 'Unidade', key: 'unit', width: 12 },
        { header: 'Produto', key: 'name', width: 24 },
        { header: 'Categoria', key: 'category', width: 13 },
        { header: 'Marca', key: 'brand', width: 11 },
        { header: 'Modelo', key: 'model', width: 13 },
        { header: 'Lote', key: 'lote', width: 11 },
        qtd('Qtd', 'quantity', 6),
        money('Custo', 'costPrice', 10),
        money('Venda', 'salePrice', 10),
        { header: 'Atacado', key: 'wholesalePrice', width: 10, align: 'right' as const,
          format: (v: unknown) => (v == null ? '—' : decimal(v)) },
        money('Total custo', 'totalCost', 12),
        money('Total venda', 'totalSale', 12),
        { header: 'Fornecedor', key: 'supplier', width: 16 },
        { header: 'Status', key: 'status', width: 11 },
      ],
      rows: linhas,
      summary: [
        { label: 'Linhas listadas', value: String(linhas.length) },
        { label: 'Itens em estoque', value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: 'Valor total (custo)', value: reais(custo) },
        { label: 'Valor total (venda)', value: reais(venda) },
        { label: 'Lucro potencial', value: reais(venda - custo) },
      ],
    });
  }),
);

// --------------------------------------------------------- Relatório de vendas

rotasRelatorios.get(
  '/sales',
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    // Uma linha por item vendido: é o nível em que se confere produto,
    // IMEI e valor. Uma venda com três aparelhos vira três linhas.
    const itens = await db.saleItem.findMany({
      where: {
        sale: {
          status: 'FINALIZADA',
          ...(quando ? { saleDate: quando } : {}),
          ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
          ...(unidade ? { unitId: unidade } : {}),
        },
        ...(q.categoryId ? { product: { categoryId: { in: await comAsFilhas(q.categoryId) } } } : {}),
        ...(q.supplierId ? { product: { supplierId: q.supplierId } } : {}),
      },
      include: {
        product: { include: { category: true } },
        sale: {
          include: {
            seller: { select: { name: true } },
            cashier: { select: { name: true } },
            unit: { select: { name: true } },
            payments: { orderBy: { amount: 'desc' } },
          },
        },
      },
      orderBy: { sale: { saleDate: 'desc' } },
    });

    // Dentro de cada bloco, do menor para o maior — a mesma ordem do
    // relatório de estoque, para procurar a peça no mesmo lugar nos dois.
    // A data desempata, da mais recente para a mais antiga.
    itens.sort((a, b) => {
      const porProduto = compararProdutos(
        { name: a.productName ?? a.product.name, capacity: a.product.capacity },
        { name: b.productName ?? b.product.name, capacity: b.product.capacity },
      );
      return porProduto !== 0
        ? porProduto
        : b.sale.saleDate.getTime() - a.sale.saleDate.getTime();
    });

    const linhas = itens.map((i) => {
      const total = numero(i.unitPrice) * i.quantity;
      return {
        code: i.sale.code,
        date: dataHoraCurta(i.sale.saleDate),
        unit: i.sale.unit.name,
        customer: i.sale.customerName ?? '—',
        phone: i.sale.customerPhone ?? '—',
        product: i.productName ?? i.product.name,
        category: i.product.category.name,
        imei: i.imei ?? i.serialNumber ?? '—',
        quantity: i.quantity,
        unitPrice: numero(i.unitPrice),
        total,
        profit: total - numero(i.costPrice) * i.quantity,
        // Todas as formas, não só a principal: uma venda paga metade no
        // cartão e metade em aparelho mostraria só o cartão, e a troca
        // sumiria justamente de onde se confere o dinheiro.
        payment:
          i.sale.payments.length > 1
            ? i.sale.payments
                .map((p) => `${PAGAMENTO_LABEL[p.method] ?? p.method} ${reais(numero(p.amount))}`)
                .join(' + ')
            : (PAGAMENTO_LABEL[i.sale.paymentMethod] ?? i.sale.paymentMethod),
        installments: i.sale.installments,
        seller: i.sale.seller?.name ?? i.sale.sellerName ?? '—',
        cashier: i.sale.cashier?.name ?? '—',
      };
    });

    const faturamento = linhas.reduce((s, l) => s + l.total, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Vendas',
      subtitle: periodo(q),
      group: { key: 'category', totals: ['quantity', 'total', 'profit'] },
      columns: [
        // Larguras conferidas com dados reais: nome de aparelho e pagamento
        // dividido são os que estouram, e é neles que sobra espaço aqui.
        { header: 'Venda', key: 'code', width: 11 },
        { header: 'Data', key: 'date', width: 13 },
        { header: 'Unidade', key: 'unit', width: 10 },
        { header: 'Cliente', key: 'customer', width: 15 },
        { header: 'Produto', key: 'product', width: 26 },
        { header: 'Categoria', key: 'category', width: 11 },
        { header: 'IMEI / série', key: 'imei', width: 14 },
        qtd('Qtd', 'quantity', 5),
        money('Unit.', 'unitPrice', 11),
        money('Total', 'total', 11),
        money('Lucro', 'profit', 10),
        { header: 'Pagamento', key: 'payment', width: 26 },
        { header: 'Vendedor', key: 'seller', width: 13 },
        { header: 'Caixa', key: 'cashier', width: 11 },
      ],
      rows: linhas,
      summary: [
        { label: 'Vendas realizadas', value: String(linhas.length) },
        { label: 'Itens vendidos', value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: 'Faturamento', value: reais(faturamento) },
        { label: 'Lucro bruto', value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: 'Ticket médio', value: reais(linhas.length ? faturamento / linhas.length : 0) },
      ],
    });
  }),
);

// ----------------------------------------------------- Relatório por categoria

rotasRelatorios.get(
  '/by-category',
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    const [categorias, linhasDeEstoque, vendas] = await Promise.all([
      db.category.findMany({ orderBy: { name: 'asc' } }),
      db.stock.findMany({
        where: unidade ? { unitId: unidade } : {},
        select: {
          quantity: true,
          product: { select: { categoryId: true, costPrice: true, salePrice: true, wholesalePrice: true } },
        },
      }),
      db.saleItem.findMany({
        where: {
          sale: {
            status: 'FINALIZADA',
            ...(quando ? { saleDate: quando } : {}),
            ...(unidade ? { unitId: unidade } : {}),
          },
        },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          product: { select: { categoryId: true, supplierId: true } },
        },
      }),
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
        profit: faturamento - custo,
      };
    });

    await exportar(res, q.format, {
      title: 'Relatório por Categoria',
      subtitle: periodo(q),
      columns: [
        { header: 'Categoria', key: 'category', width: 22 },
        qtd('Produtos', 'products', 10),
        qtd('Em estoque', 'stockQty', 10),
        money('Estoque (custo)', 'stockCost', 14),
        money('Estoque (venda)', 'stockSale', 14),
        qtd('Vendidos', 'soldQty', 10),
        money('Faturamento', 'revenue', 14),
        money('Lucro', 'profit', 13),
      ],
      rows: linhas,
      summary: [
        { label: 'Faturamento total', value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) },
        { label: 'Lucro total', value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: 'Valor em estoque (custo)', value: reais(linhas.reduce((s, l) => s + l.stockCost, 0)) },
      ],
    });
  }),
);

// ---------------------------------------------------- Relatório por fornecedor

rotasRelatorios.get(
  '/by-supplier',
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    const [fornecedores, linhasDeEstoque, vendas] = await Promise.all([
      db.supplier.findMany({ orderBy: { name: 'asc' } }),
      db.stock.findMany({
        where: unidade ? { unitId: unidade } : {},
        select: { quantity: true, product: { select: { supplierId: true, costPrice: true } } },
      }),
      db.saleItem.findMany({
        where: {
          sale: {
            status: 'FINALIZADA',
            ...(quando ? { saleDate: quando } : {}),
            ...(unidade ? { unitId: unidade } : {}),
          },
        },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          product: { select: { categoryId: true, supplierId: true } },
        },
      }),
    ]);

    const linhas = fornecedores.map((f) => {
      const doEstoque = linhasDeEstoque.filter((l) => l.product.supplierId === f.id);
      const doFornecedor = vendas.filter((v) => v.product.supplierId === f.id);
      const faturamento = doFornecedor.reduce((s, v) => s + numero(v.unitPrice) * v.quantity, 0);
      const custo = doFornecedor.reduce((s, v) => s + numero(v.costPrice) * v.quantity, 0);

      return {
        supplier: f.name,
        active: f.active ? 'Sim' : 'Não',
        products: doEstoque.length,
        stockQty: doEstoque.reduce((s, l) => s + l.quantity, 0),
        invested: doEstoque.reduce((s, l) => s + numero(l.product.costPrice) * l.quantity, 0),
        soldQty: doFornecedor.reduce((s, v) => s + v.quantity, 0),
        revenue: faturamento,
        profit: faturamento - custo,
      };
    });

    await exportar(res, q.format, {
      title: 'Relatório por Fornecedor',
      subtitle: periodo(q),
      columns: [
        { header: 'Fornecedor', key: 'supplier', width: 24 },
        { header: 'Ativo', key: 'active', width: 8, align: 'center' },
        qtd('Produtos', 'products', 10),
        qtd('Em estoque', 'stockQty', 11),
        money('Investido', 'invested', 14),
        qtd('Vendidos', 'soldQty', 10),
        money('Faturamento', 'revenue', 14),
        money('Lucro', 'profit', 13),
      ],
      rows: linhas,
      summary: [
        { label: 'Fornecedores', value: String(linhas.length) },
        { label: 'Total investido', value: reais(linhas.reduce((s, l) => s + l.invested, 0)) },
        { label: 'Faturamento', value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) },
      ],
    });
  }),
);

// ------------------------------------------------------- Relatório por período

rotasRelatorios.get(
  '/by-period',
  rota(async (req, res) => {
    const q = validar(base.extend({ groupBy: z.enum(['day', 'month']).default('day') }), req.query);
    const quando = intervalo(q.startDate, q.endDate);

    const [vendas, movimentos] = await Promise.all([
      db.saleItem.findMany({
        where: { sale: { status: 'FINALIZADA', ...(quando ? { saleDate: quando } : {}) } },
        select: {
          quantity: true,
          unitPrice: true,
          costPrice: true,
          sale: { select: { saleDate: true } },
        },
      }),
      db.stockMovement.findMany({
        where: quando ? { createdAt: quando } : {},
        select: { createdAt: true, type: true, quantity: true },
      }),
    ]);

    const chave = (d: Date) =>
      q.groupBy === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : d.toISOString().slice(0, 10);

    const mapa = new Map<
      string,
      { period: string; sales: number; quantity: number; revenue: number; profit: number; entries: number; exits: number }
    >();

    const balde = (k: string) => {
      if (!mapa.has(k)) {
        mapa.set(k, { period: k, sales: 0, quantity: 0, revenue: 0, profit: 0, entries: 0, exits: 0 });
      }
      return mapa.get(k)!;
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
      if (m.type === 'ENTRADA') b.entries += m.quantity;
      if (m.type === 'SAIDA') b.exits += m.quantity;
    }

    const linhas = Array.from(mapa.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((l) => ({
        ...l,
        periodLabel:
          q.groupBy === 'month'
            ? l.period.split('-').reverse().join('/')
            : dataBR(new Date(`${l.period}T12:00:00`)),
      }));

    await exportar(res, q.format, {
      title: 'Relatório por Período',
      subtitle: periodo(q),
      columns: [
        { header: q.groupBy === 'month' ? 'Mês' : 'Dia', key: 'periodLabel', width: 12 },
        qtd('Vendas', 'sales', 9),
        qtd('Itens', 'quantity', 9),
        money('Faturamento', 'revenue', 14),
        money('Lucro', 'profit', 13),
        qtd('Entradas', 'entries', 10),
        qtd('Saídas', 'exits', 10),
      ],
      rows: linhas,
      summary: [
        { label: 'Faturamento total', value: reais(linhas.reduce((s, l) => s + l.revenue, 0)) },
        { label: 'Lucro total', value: reais(linhas.reduce((s, l) => s + l.profit, 0)) },
        { label: 'Itens vendidos', value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
      ],
    });
  }),
);

// -------------------------------------------------- Relatório de movimentações

rotasRelatorios.get(
  '/movements',
  rota(async (req, res) => {
    const q = validar(
      base.extend({ type: z.enum(['ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE']).optional() }),
      req.query,
    );
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    const movimentos = await db.stockMovement.findMany({
      where: {
        ...(quando ? { createdAt: quando } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(unidade ? { unitId: unidade } : {}),
        ...(q.categoryId ? { product: { categoryId: { in: await comAsFilhas(q.categoryId) } } } : {}),
      },
      include: {
        user: { select: { name: true } },
        unit: { select: { name: true } },
        product: { select: { model: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unidades = await db.unit.findMany({ select: { id: true, name: true } });
    const nome = (id?: string | null) => unidades.find((u) => u.id === id)?.name ?? '—';

    const linhas = movimentos.map((m) => ({
      date: dataHoraCurta(m.createdAt),
      unit: m.unit?.name ?? '—',
      type: TIPO_LABEL[m.type] ?? m.type,
      reason: MOTIVO_LABEL[m.reason] ?? m.reason,
      product: m.productName ?? '—',
      category: m.product?.category.name ?? '—',
      quantity: m.type === 'ENTRADA' ? m.quantity : -m.quantity,
      previous: m.previousQuantity ?? '—',
      balance: m.newQuantity ?? '—',
      origin: m.originUnitId ? nome(m.originUnitId) : '—',
      destination: m.destinationUnitId ? nome(m.destinationUnitId) : '—',
      user: m.user?.name ?? '—',
      notes: m.notes ?? '—',
    }));

    const somaPor = (tipo: string) =>
      movimentos.filter((m) => m.type === tipo).reduce((s, m) => s + m.quantity, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Movimentações',
      subtitle: periodo(q),
      columns: [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Unidade', key: 'unit', width: 11 },
        { header: 'Tipo', key: 'type', width: 11 },
        { header: 'Motivo', key: 'reason', width: 15 },
        { header: 'Produto', key: 'product', width: 22 },
        { header: 'Categoria', key: 'category', width: 12 },
        qtd('Qtd', 'quantity', 6),
        qtd('Antes', 'previous', 7),
        qtd('Depois', 'balance', 7),
        { header: 'Origem', key: 'origin', width: 11 },
        { header: 'Destino', key: 'destination', width: 11 },
        { header: 'Usuário', key: 'user', width: 13 },
      ],
      rows: linhas,
      summary: [
        { label: 'Movimentações', value: String(linhas.length) },
        { label: 'Entradas', value: String(somaPor('ENTRADA')) },
        { label: 'Saídas', value: String(somaPor('SAIDA')) },
        { label: 'Transferências', value: String(somaPor('TRANSFERENCIA')) },
      ],
    });
  }),
);

// ------------------------------------------------ Tabela de preços do vendedor

/**
 * Lista de preços para entregar aos vendedores.
 *
 * O preço sai do custo mais um acréscimo fixo (R$ 100 por padrão). O preço
 * de compra NÃO aparece: a lista circula entre os vendedores e mostrar o
 * custo revelaria a margem da loja. Só sai se o administrador pedir.
 */
rotasRelatorios.get(
  '/price-list',
  exigir('financeiro'),
  rota(async (req, res) => {
    const q = validar(
      base.extend({
        /** Quanto somar ao preço de compra. */
        markup: z.coerce.number().min(0).max(999_999).default(100),
        /** Mostrar o custo — só para conferência interna. */
        incluirCusto: z.enum(['true', 'false']).default('false'),
        /** Deixar de fora o que está sem estoque. */
        somenteComEstoque: z.enum(['true', 'false']).default('true'),
      }),
      semVazios(req.query),
    );

    const unidade = unidadePermitida(req.usuario, q.unitId);
    const mostrarCusto = q.incluirCusto === 'true';

    const produtos = await db.product.findMany({
      where: {
        ...(q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {}),
        ...(q.supplierId ? { supplierId: q.supplierId } : {}),
        ...(q.somenteComEstoque === 'true'
          ? { stock: { some: { quantity: { gt: 0 }, ...(unidade ? { unitId: unidade } : {}) } } }
          : {}),
      },
      include: {
        category: true,
        stock: unidade ? { where: { unitId: unidade } } : true,
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    // Dentro de cada categoria, do menor para o maior.
    produtos.sort(
      (a, b) =>
        a.category.name.localeCompare(b.category.name, 'pt-BR') || compararProdutos(a, b),
    );

    const linhas = produtos.map((p) => {
      const custo = numero(p.costPrice);
      const emEstoque = p.stock.reduce((soma, l) => soma + l.quantity, 0);

      return {
        category: p.category.name,
        name: p.name,
        detalhe: [p.brand, p.model].filter(Boolean).join(' ') || '—',
        categoria: p.category.name,
        capacidade: p.capacity ?? '—',
        quantity: emEstoque,
        custo,
        // É este o número que o vendedor usa.
        preco: custo + q.markup,
      };
    });

    const colunas: Coluna[] = [
      { header: 'Categoria', key: 'category', width: 14 },
      { header: 'Produto', key: 'name', width: 26 },
      { header: 'Marca / modelo', key: 'detalhe', width: 16 },
      { header: 'Categoria', key: 'categoria', width: 16 },
      { header: 'Capacidade', key: 'capacidade', width: 12 },
      qtd('Estoque', 'quantity', 8),
      ...(mostrarCusto ? [money('Custo', 'custo', 11)] : []),
      money('PREÇO DE VENDA', 'preco', 14),
    ];

    await exportar(res, q.format, {
      title: 'Tabela de Preços',
      subtitle:
        `Preço = custo + ${reais(q.markup)}` +
        (unidade ? ` · estoque da unidade selecionada` : '') +
        (mostrarCusto ? ' · CONTÉM O CUSTO — uso interno' : ' · não mostra o preço de compra'),
      columns: colunas,
      rows: linhas,
      summary: [
        { label: 'Produtos na lista', value: String(linhas.length) },
        { label: 'Peças em estoque', value: String(linhas.reduce((s, l) => s + l.quantity, 0)) },
        { label: 'Acréscimo aplicado', value: reais(q.markup) },
      ],
    });
  }),
);

// ------------------------------------------------ Lista para o WhatsApp

/**
 * Junta variações do mesmo nome de marca.
 *
 * "Xiaomi", "XIAOMI" e " xiaomi " são a mesma coisa e não podem virar três
 * títulos na lista. Diferenças de letra de verdade (XIOMI × XIAOMI) ficam
 * separadas de propósito: corrigir isso é decisão de quem cadastrou, não
 * palpite do sistema.
 */
const chaveDaMarca = (marca: string | null): string =>
  (marca ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

/**
 * Lista de tudo em estoque, pronta para colar no grupo de atacado.
 *
 * Sai como texto com a formatação do WhatsApp (asterisco marca negrito),
 * separada por marca. Não é PDF de propósito: no grupo o que serve é
 * mensagem, não anexo.
 */
/**
 * Duas marcas que só diferem por um deslize de teclado.
 *
 * Uma letra a mais, a menos ou trocada — "XIOMI" e "XIAOMI". Marcas de
 * verdade que existem juntas no mercado ("POCO" e "PODO") são raras o
 * bastante para valer o aviso; o sistema só avisa, não junta sozinho.
 */
function ehErroDeDigitacao(a: string, b: string): boolean {
  if (a === b) return false;
  // Nomes muito curtos diferem por uma letra com facilidade demais.
  if (Math.min(a.length, b.length) < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;

  // Distância de edição, cortando assim que passa de 1.
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    if (Math.min(...atual) > 1) return false;
    anterior = atual;
  }
  return anterior[b.length] <= 1;
}

rotasRelatorios.get(
  '/whatsapp-list',
  rota(async (req, res) => {
    const q = validar(
      z.object({
        /** De onde sai o preço mostrado. */
        preco: z.enum(['atacado', 'varejo', 'custo']).default('atacado'),
        /** Acréscimo, quando o preço parte do custo. */
        markup: z.coerce.number().min(0).max(999_999).default(100),
        categoryId: z.string().uuid().optional(),
        unitId: z.string().uuid().optional(),
        agruparPor: z.enum(['marca', 'categoria']).default('marca'),
        mostrarQuantidade: z.enum(['true', 'false']).default('true'),
        mostrarCondicao: z.enum(['true', 'false']).default('true'),
        titulo: z.string().trim().max(60).optional(),
      }),
      semVazios(req.query),
    );

    // Preço a partir do custo expõe a margem: exige permissão de financeiro.
    if (q.preco === 'custo' && !podeFazer(req.usuario?.papel, 'financeiro')) {
      throw new AppError('Só o administrador pode montar a lista a partir do preço de compra', 403);
    }

    const unidade = unidadePermitida(req.usuario, q.unitId);

    const produtos = await db.product.findMany({
      where: {
        ...(q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {}),
        // Só o que existe: ninguém oferece no grupo o que já acabou.
        stock: { some: { quantity: { gt: 0 }, ...(unidade ? { unitId: unidade } : {}) } },
      },
      include: {
        category: true,
        stock: unidade ? { where: { unitId: unidade } } : true,
      },
      orderBy: { name: 'asc' },
    });

    // Mesma ordem do relatório de estoque: é a mesma lista, noutro formato.
    produtos.sort(compararProdutos);

    const precoDe = (p: (typeof produtos)[number]): number => {
      if (q.preco === 'custo') return numero(p.costPrice) + q.markup;
      if (q.preco === 'varejo') return numero(p.salePrice) || numero(p.wholesalePrice);
      return numero(p.wholesalePrice) || numero(p.salePrice);
    };

    // Agrupa mantendo a grafia mais usada de cada marca.
    const grupos = new Map<string, { titulo: string; itens: typeof produtos }>();

    for (const p of produtos) {
      const bruto = q.agruparPor === 'categoria' ? p.category.name : p.brand;
      const chave = chaveDaMarca(bruto) || 'OUTROS';

      if (!grupos.has(chave)) {
        grupos.set(chave, { titulo: (bruto ?? '').trim() || 'OUTROS', itens: [] });
      }
      grupos.get(chave)!.itens.push(p);
    }

    const ordenados = [...grupos.entries()].sort(([a], [b]) => {
      // "Outros" sempre por último; o resto em ordem alfabética.
      if (a === 'OUTROS') return 1;
      if (b === 'OUTROS') return -1;
      return a.localeCompare(b, 'pt-BR');
    });

    const dinheiro = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

    const linhas: string[] = [];
    linhas.push(`*${(q.titulo ?? 'RAFA MULTIMARCAS').toUpperCase()}*`);
    linhas.push(`_Lista atualizada em ${dataBR(new Date())}_`);
    linhas.push('');

    let totalPecas = 0;

    for (const [, grupo] of ordenados) {
      linhas.push(`*${grupo.titulo.toUpperCase()}*`);

      for (const p of grupo.itens) {
        const quantidade = p.stock.reduce((s, l) => s + l.quantity, 0);
        totalPecas += quantidade;

        const partes = [p.name];
        // A condição virou subcategoria: sai dali, não de um campo à parte.
        if (q.mostrarCondicao === 'true') {
          const sub = p.category.name.split('›').pop()?.trim();
          if (sub && sub !== p.category.name) partes.push(sub);
        }
        if (q.mostrarQuantidade === 'true') partes.push(`${quantidade}un`);

        linhas.push(`${partes.join(' · ')} — *${dinheiro(precoDe(p))}*`);
      }

      linhas.push('');
    }

    linhas.push('━━━━━━━━━━━━━━━');
    linhas.push(`${produtos.length} modelos · ${totalPecas} peças`);
    linhas.push('_Valores sujeitos a alteração._');

    const texto = linhas.join('\n');

    // Marcas parecidas: avisa em vez de juntar por conta própria.
    const parecidas: string[] = [];
    const chaves = [...grupos.keys()].filter((c) => c !== 'OUTROS');
    for (let i = 0; i < chaves.length; i += 1) {
      for (let j = i + 1; j < chaves.length; j += 1) {
        if (ehErroDeDigitacao(chaves[i], chaves[j])) parecidas.push(`${chaves[i]} / ${chaves[j]}`);
      }
    }

    res.json({
      texto,
      resumo: {
        modelos: produtos.length,
        pecas: totalPecas,
        grupos: ordenados.length,
        semMarca: grupos.get('OUTROS')?.itens.length ?? 0,
      },
      // O sistema não decide por você qual grafia está certa.
      marcasParecidas: [...new Set(parecidas)],
    });
  }),
);

// -------------------------------------------- Relatório por forma de pagamento

rotasRelatorios.get(
  '/by-payment',
  exigir('relatorios'),
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    // Soma pelo rateio, não pela venda: com pagamento dividido, jogar o
    // total inteiro na forma "principal" inventaria dinheiro numa e tiraria
    // de outra.
    const pagamentos = await db.salePayment.findMany({
      where: {
        sale: {
          status: 'FINALIZADA',
          ...(quando ? { saleDate: quando } : {}),
          ...(unidade ? { unitId: unidade } : {}),
        },
      },
      select: { method: true, amount: true, installments: true, saleId: true, feePercent: true, netAmount: true },
    });

    // Venda antiga não tem taxa gravada. Em vez de mostrar zero — que
    // contradiz a maquininha —, calcula pela tabela atual. O valor gravado
    // sempre manda, para o passado não mudar quando a taxa mudar.
    const tabela = await taxasDoCartao();

    const liquidoDe = (p: (typeof pagamentos)[number]) => {
      if (p.netAmount != null) return numero(p.netAmount);
      if (p.method !== 'CREDITO') return numero(p.amount);

      const taxa = taxaDe(tabela, p.installments, 'padrao');
      return taxa != null ? numero(p.amount) * (1 - taxa / 100) : numero(p.amount);
    };

    const total = pagamentos.reduce((s, p) => s + numero(p.amount), 0);

    const linhas = (Object.keys(PAGAMENTO_LABEL) as string[])
      .map((forma) => {
        const daForma = pagamentos.filter((p) => p.method === forma);
        const soma = daForma.reduce((s, p) => s + numero(p.amount), 0);

        // Uma venda dividida em dois Pix conta como uma venda, não duas.
        const vendas = new Set(daForma.map((p) => p.saleId)).size;
        const parceladas = daForma.filter((p) => p.installments > 1);

        const liquido = daForma.reduce((s, p) => s + liquidoDe(p), 0);

        return {
          payment: PAGAMENTO_LABEL[forma],
          sales: vendas,
          lancamentos: daForma.length,
          total: soma,
          taxa: soma - liquido,
          liquido,
          share: total > 0 ? (soma / total) * 100 : 0,
          ticket: vendas > 0 ? soma / vendas : 0,
          parcelado: parceladas.length
            ? `${parceladas.length} em até ${Math.max(...parceladas.map((p) => p.installments))}x`
            : '—',
        };
      })
      // Forma sem movimento no período só ocuparia linha.
      .filter((l) => l.lancamentos > 0)
      .sort((a, b) => b.total - a.total);

    const emDinheiro = linhas.filter((l) => l.payment !== PAGAMENTO_LABEL.TROCA);

    await exportar(res, q.format, {
      title: 'Vendas por Forma de Pagamento',
      subtitle: periodo(q),
      columns: [
        { header: 'Forma de pagamento', key: 'payment', width: 22 },
        qtd('Vendas', 'sales', 10),
        qtd('Lançamentos', 'lancamentos', 12),
        money('Total', 'total', 15),
        money('Taxa da maquininha', 'taxa', 15),
        money('Líquido', 'liquido', 15),
        { header: '% do total', key: 'share', width: 10, align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
        money('Ticket médio', 'ticket', 13),
        { header: 'Parcelados', key: 'parcelado', width: 13 },
      ],
      rows: linhas,
      summary: [
        { label: 'Formas usadas', value: String(linhas.length) },
        { label: 'Vendido em dinheiro', value: reais(emDinheiro.reduce((s, l) => s + l.total, 0)) },
        { label: 'Taxa da maquininha', value: reais(linhas.reduce((s, l) => s + l.taxa, 0)) },
        { label: 'Cai na conta', value: reais(emDinheiro.reduce((s, l) => s + l.liquido, 0)) },
        { label: 'Movimentado', value: reais(total) },
      ],
    });
  }),
);
