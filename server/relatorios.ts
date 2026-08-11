import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import { dataBR, dataHoraBR, intervalo, numero, rota, validar } from './core';
import { db } from './db';
import { decimal, exportar, reais, type Coluna } from './exportar';
import { MOTIVO_LABEL, STATUS_PRODUTO_LABEL, TIPO_LABEL } from './estoque';
import { unidadePermitida } from './unidades';

/** Os seis relatórios, todos exportáveis em PDF, Excel ou CSV. */

export const rotasRelatorios = Router();
rotasRelatorios.use(autenticar);

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

const PAGAMENTO_LABEL: Record<string, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  TRANSFERENCIA: 'Transferência',
};

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
    const q = validar(base, req.query);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const entrada = intervalo(q.startDate, q.endDate);

    // Uma linha por produto em cada unidade: é assim que se vê onde está
    // cada peça, em vez de um total que não diz nada.
    const linhasDeEstoque = await db.stock.findMany({
      where: {
        ...(unidade ? { unitId: unidade } : {}),
        product: {
          ...(q.categoryId ? { categoryId: q.categoryId } : {}),
          ...(q.supplierId ? { supplierId: q.supplierId } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(entrada ? { entryDate: entrada } : {}),
        },
      },
      include: {
        unit: { select: { name: true } },
        product: { include: { category: true, supplier: true } },
      },
      orderBy: [{ unit: { name: 'asc' } }, { product: { name: 'asc' } }],
    });

    const linhas = linhasDeEstoque.map(({ product: p, unit, quantity }) => ({
      unit: unit.name,
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? '—',
      model: p.model ?? '—',
      lote: p.lote ?? '—',
      condicao: p.condicao ?? '—',
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
      columns: [
        { header: 'Unidade', key: 'unit', width: 12 },
        { header: 'Produto', key: 'name', width: 24 },
        { header: 'Categoria', key: 'category', width: 13 },
        { header: 'Marca', key: 'brand', width: 11 },
        { header: 'Modelo', key: 'model', width: 13 },
        { header: 'Lote', key: 'lote', width: 11 },
        { header: 'Condição', key: 'condicao', width: 11 },
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
    const q = validar(base, req.query);
    const quando = intervalo(q.startDate, q.endDate);

    const vendas = await db.sale.findMany({
      where: {
        ...(quando ? { saleDate: quando } : {}),
        ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
        ...(q.categoryId ? { product: { categoryId: q.categoryId } } : {}),
        ...(q.supplierId ? { product: { supplierId: q.supplierId } } : {}),
      },
      include: { product: { include: { category: true } }, user: { select: { name: true } } },
      orderBy: { saleDate: 'desc' },
    });

    const linhas = vendas.map((v) => {
      const total = numero(v.totalPrice);
      return {
        date: dataHoraBR(v.saleDate),
        customer: v.customerName ?? '—',
        phone: v.customerPhone ?? '—',
        product: v.product.name,
        category: v.product.category.name,
        quantity: v.quantity,
        unitPrice: numero(v.unitPrice),
        total,
        profit: total - numero(v.costAtSale) * v.quantity,
        payment: PAGAMENTO_LABEL[v.paymentMethod] ?? v.paymentMethod,
        user: v.user?.name ?? '—',
      };
    });

    const faturamento = linhas.reduce((s, l) => s + l.total, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Vendas',
      subtitle: periodo(q),
      columns: [
        { header: 'Data', key: 'date', width: 14 },
        { header: 'Cliente', key: 'customer', width: 20 },
        { header: 'Telefone', key: 'phone', width: 13 },
        { header: 'Produto', key: 'product', width: 24 },
        { header: 'Categoria', key: 'category', width: 13 },
        qtd('Qtd', 'quantity', 6),
        money('Valor unit.', 'unitPrice', 11),
        money('Total', 'total', 11),
        money('Lucro', 'profit', 11),
        { header: 'Pagamento', key: 'payment', width: 13 },
        { header: 'Vendedor', key: 'user', width: 14 },
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
    const q = validar(base, req.query);
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
      db.sale.findMany({
        where: { ...(quando ? { saleDate: quando } : {}), ...(unidade ? { unitId: unidade } : {}) },
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { categoryId: true } },
        },
      }),
    ]);

    const linhas = categorias.map((c) => {
      const doEstoque = linhasDeEstoque.filter((l) => l.product.categoryId === c.id);
      const daCategoria = vendas.filter((v) => v.product.categoryId === c.id);
      const faturamento = daCategoria.reduce((s, v) => s + numero(v.totalPrice), 0);
      const custo = daCategoria.reduce((s, v) => s + numero(v.costAtSale) * v.quantity, 0);

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
    const q = validar(base, req.query);
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    const [fornecedores, linhasDeEstoque, vendas] = await Promise.all([
      db.supplier.findMany({ orderBy: { name: 'asc' } }),
      db.stock.findMany({
        where: unidade ? { unitId: unidade } : {},
        select: { quantity: true, product: { select: { supplierId: true, costPrice: true } } },
      }),
      db.sale.findMany({
        where: { ...(quando ? { saleDate: quando } : {}), ...(unidade ? { unitId: unidade } : {}) },
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { supplierId: true } },
        },
      }),
    ]);

    const linhas = fornecedores.map((f) => {
      const doEstoque = linhasDeEstoque.filter((l) => l.product.supplierId === f.id);
      const doFornecedor = vendas.filter((v) => v.product.supplierId === f.id);
      const faturamento = doFornecedor.reduce((s, v) => s + numero(v.totalPrice), 0);
      const custo = doFornecedor.reduce((s, v) => s + numero(v.costAtSale) * v.quantity, 0);

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
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: { saleDate: true, quantity: true, totalPrice: true, costAtSale: true },
        orderBy: { saleDate: 'asc' },
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
      const b = balde(chave(v.saleDate));
      b.sales += 1;
      b.quantity += v.quantity;
      b.revenue += numero(v.totalPrice);
      b.profit += numero(v.totalPrice) - numero(v.costAtSale) * v.quantity;
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
        ...(q.categoryId ? { product: { categoryId: q.categoryId } } : {}),
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
      date: dataHoraBR(m.createdAt),
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
