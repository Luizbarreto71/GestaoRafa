import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import { dataBR, dataHoraBR, intervalo, numero, rota, validar } from './core';
import { db } from './db';
import { decimal, exportar, reais, type Coluna } from './exportar';
import { STATUS_LABEL, TIPO_LABEL } from './movimentacoes';

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
    const entrada = intervalo(q.startDate, q.endDate);

    const produtos = await db.product.findMany({
      where: {
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.supplierId ? { supplierId: q.supplierId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(entrada ? { entryDate: entrada } : {}),
      },
      include: { category: true, supplier: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    const linhas = produtos.map((p) => ({
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? '—',
      model: p.model ?? '—',
      lote: p.lote ?? '—',
      quantity: p.quantity,
      costPrice: numero(p.costPrice),
      salePrice: numero(p.salePrice),
      totalCost: numero(p.costPrice) * p.quantity,
      totalSale: numero(p.salePrice) * p.quantity,
      supplier: p.supplier?.name ?? '—',
      status: STATUS_LABEL[p.status] ?? p.status,
      entryDate: dataBR(p.entryDate),
    }));

    const custo = linhas.reduce((s, l) => s + l.totalCost, 0);
    const venda = linhas.reduce((s, l) => s + l.totalSale, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Estoque',
      subtitle: periodo(q),
      columns: [
        { header: 'Produto', key: 'name', width: 26 },
        { header: 'Categoria', key: 'category', width: 14 },
        { header: 'Marca', key: 'brand', width: 12 },
        { header: 'Modelo', key: 'model', width: 14 },
        { header: 'Lote', key: 'lote', width: 12 },
        qtd('Qtd', 'quantity', 6),
        money('Custo', 'costPrice', 11),
        money('Venda', 'salePrice', 11),
        money('Total custo', 'totalCost'),
        money('Total venda', 'totalSale'),
        { header: 'Fornecedor', key: 'supplier', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Entrada', key: 'entryDate', width: 11 },
      ],
      rows: linhas,
      summary: [
        { label: 'Produtos listados', value: String(linhas.length) },
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
    const quando = intervalo(q.startDate, q.endDate);

    const [categorias, vendas] = await Promise.all([
      db.category.findMany({
        include: { products: { select: { quantity: true, costPrice: true, salePrice: true } } },
        orderBy: { name: 'asc' },
      }),
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { categoryId: true } },
        },
      }),
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
    const quando = intervalo(q.startDate, q.endDate);

    const [fornecedores, vendas] = await Promise.all([
      db.supplier.findMany({
        include: { products: { select: { quantity: true, costPrice: true } } },
        orderBy: { name: 'asc' },
      }),
      db.sale.findMany({
        where: quando ? { saleDate: quando } : {},
        select: {
          quantity: true,
          totalPrice: true,
          costAtSale: true,
          product: { select: { supplierId: true } },
        },
      }),
    ]);

    const linhas = fornecedores.map((f) => {
      const doFornecedor = vendas.filter((v) => v.product.supplierId === f.id);
      const faturamento = doFornecedor.reduce((s, v) => s + numero(v.totalPrice), 0);
      const custo = doFornecedor.reduce((s, v) => s + numero(v.costAtSale) * v.quantity, 0);

      return {
        supplier: f.name,
        active: f.active ? 'Sim' : 'Não',
        products: f.products.length,
        stockQty: f.products.reduce((s, p) => s + p.quantity, 0),
        invested: f.products.reduce((s, p) => s + numero(p.costPrice) * p.quantity, 0),
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
      db.movement.findMany({
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
      base.extend({ type: z.enum(['ENTRADA', 'SAIDA', 'AJUSTE', 'EXCLUSAO']).optional() }),
      req.query,
    );
    const quando = intervalo(q.startDate, q.endDate);

    const movimentos = await db.movement.findMany({
      where: {
        ...(quando ? { createdAt: quando } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.categoryId ? { product: { categoryId: q.categoryId } } : {}),
      },
      include: {
        user: { select: { name: true } },
        product: { select: { model: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const linhas = movimentos.map((m) => ({
      date: dataHoraBR(m.createdAt),
      type: TIPO_LABEL[m.type] ?? m.type,
      product: m.productName ?? '—',
      category: m.product?.category.name ?? '—',
      model: m.product?.model ?? '—',
      quantity: m.quantity,
      balance: m.balanceAfter ?? '—',
      reason: m.reason ?? '—',
      user: m.user?.name ?? '—',
    }));

    const somaPor = (tipo: string) =>
      movimentos.filter((m) => m.type === tipo).reduce((s, m) => s + m.quantity, 0);

    await exportar(res, q.format, {
      title: 'Relatório de Movimentações',
      subtitle: periodo(q),
      columns: [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Tipo', key: 'type', width: 10 },
        { header: 'Produto', key: 'product', width: 24 },
        { header: 'Categoria', key: 'category', width: 13 },
        { header: 'Modelo', key: 'model', width: 13 },
        qtd('Qtd', 'quantity', 6),
        qtd('Saldo', 'balance', 7),
        { header: 'Motivo', key: 'reason', width: 24 },
        { header: 'Usuário', key: 'user', width: 14 },
      ],
      rows: linhas,
      summary: [
        { label: 'Movimentações', value: String(linhas.length) },
        { label: 'Entradas', value: String(somaPor('ENTRADA')) },
        { label: 'Saídas', value: String(somaPor('SAIDA')) },
      ],
    });
  }),
);
