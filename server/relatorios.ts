import { Router } from 'express';
import { z } from 'zod';
import { autenticar } from './auth';
import { AppError, dataBR, dataDoFiltro, dataHoraCurta, intervalo, numero, PAGAMENTO_LABEL, rota, semVazios, validar } from './core';
import { exigir } from './permissoes';
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
import { montarListaDeAtacado } from './lista-atacado';
import { emojisDeCategoria } from './sistema';
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
  return `Período: ${q.startDate ? dataDoFiltro(q.startDate) : 'início'} até ${q.endDate ? dataDoFiltro(q.endDate) : 'hoje'}`;
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
        // Zerado não é estoque. A linha continua no banco depois que a
        // última peça sai, e listá-la faz o relatório da Hermes mostrar
        // mercadoria que só existe em outra unidade.
        quantity: { gt: 0 },
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

    // Sem filtro de unidade, o produto aparece uma vez com o total somado.
    // Repetir a mesma peça uma linha por prateleira obriga quem lê a somar
    // de cabeça para saber quanto a loja tem.
    const agrupadas = new Map<string, { product: (typeof linhasDeEstoque)[number]['product']; quantity: number }>();

    for (const linha of linhasDeEstoque) {
      const chave = linha.productId;
      const atual = agrupadas.get(chave);
      if (atual) atual.quantity += linha.quantity;
      else agrupadas.set(chave, { product: linha.product, quantity: linha.quantity });
    }

    const linhas = [...agrupadas.values()].map(({ product: p, quantity }) => ({
      name: p.name,
      category: p.category.name,
      brand: p.brand ?? '—',
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

    const nomeDaUnidade = unidade
      ? ((await db.unit.findUnique({ where: { id: unidade }, select: { name: true } }))?.name ?? null)
      : null;

    await exportar(res, q.format, {
      title: 'Relatório de Estoque',
      // A unidade sai do rodapé de cada linha e vai para o cabeçalho: ela é
      // a mesma no relatório inteiro.
      subtitle: `${nomeDaUnidade ?? 'Todas as unidades'} · ${periodo(q)}`,
      // Separado por condição: lacrado e vitrine são mercadorias
      // diferentes, com preço diferente, e misturá-las esconde o que a
      // loja tem de cada uma.
      // Separado por categoria — que agora carrega a condição:
      // "Celulares › Vitrine" é um bloco, "Celulares › Lacrado" é outro.
      group: { key: 'category', totals: ['quantity', 'totalCost', 'totalSale'] },
      columns: [
        { header: 'Produto', key: 'name', width: 26 },
        { header: 'Categoria', key: 'category', width: 14 },
        { header: 'Marca', key: 'brand', width: 12 },
        qtd('Qtd', 'quantity', 7),
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
 * Lista de tudo em estoque, pronta para colar no grupo de atacado.
 *
 * Sai como texto puro, no formato exato que a loja usa no grupo: cada
 * quebra de linha e cada ponto e vírgula fazem parte do resultado. A
 * montagem fica em `lista-atacado.ts` — aqui só se decide o que entra.
 */
rotasRelatorios.get(
  '/whatsapp-list',
  rota(async (req, res) => {
    const q = validar(
      z.object({
        categoryId: z.string().uuid().optional(),
        unitId: z.string().uuid().optional(),
        /** Sem estoque some da lista — é o padrão: não se oferece o que acabou. */
        somenteDisponiveis: z.enum(['true', 'false']).default('true'),
      }),
      semVazios(req.query),
    );

    const unidade = unidadePermitida(req.usuario, q.unitId);
    const somenteDisponiveis = q.somenteDisponiveis === 'true';

    const produtos = await db.product.findMany({
      where: {
        ...(q.categoryId ? { categoryId: { in: await comAsFilhas(q.categoryId) } } : {}),
        // Sem preço de atacado o produto não é de atacado: mandar o preço
        // de varejo para o grupo seria oferecer a mercadoria errada.
        wholesalePrice: { not: null },
        // Vendido e reservado já têm dono.
        status: 'EM_ESTOQUE',
        ...(somenteDisponiveis
          ? { stock: { some: { quantity: { gt: 0 }, ...(unidade ? { unitId: unidade } : {}) } } }
          : unidade
            ? { stock: { some: { unitId: unidade } } }
            : {}),
      },
      include: { category: { select: { id: true, name: true, ordem: true } } },
    });

    const { texto, resumo } = montarListaDeAtacado(
      produtos.map((p) => ({
        name: p.name,
        capacity: p.capacity,
        atacado: numero(p.wholesalePrice),
        categoriaId: p.category.id,
        categoriaNome: p.category.name,
        categoriaOrdem: p.category.ordem,
      })),
      await emojisDeCategoria(),
    );

    res.json({ texto, resumo });
  }),
);

// ------------------------------------------------- Relatório do crédito

/**
 * As taxas do cartão, transação por transação.
 *
 * É a folha que se põe ao lado do extrato da maquininha no fim do mês.
 * Cada linha traz o que foi passado, em quantas vezes, em que bandeira, o
 * que a máquina descontou e o que sobrou — e o total diz, de uma vez, se o
 * repasse da taxa está cobrindo o custo ou se a loja está bancando.
 */
rotasRelatorios.get(
  '/by-card',
  exigir('relatorios'),
  rota(async (req, res) => {
    const q = validar(base, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const quando = intervalo(q.startDate, q.endDate);

    const pagamentos = await db.salePayment.findMany({
      where: {
        // Débito também passa na maquininha e também tem taxa quando a
        // loja cadastra uma. Deixar de fora esconderia parte do custo.
        method: { in: ['CREDITO', 'DEBITO'] },
        sale: {
          status: 'FINALIZADA',
          ...(quando ? { saleDate: quando } : {}),
          ...(unidade ? { unitId: unidade } : {}),
        },
      },
      include: {
        sale: {
          select: {
            code: true,
            saleDate: true,
            customerName: true,
            surcharge: true,
            payments: { where: { method: 'CREDITO' }, select: { amount: true } },
          },
        },
      },
      orderBy: { sale: { saleDate: 'asc' } },
    });

    const tabela = await taxasDoCartao();

    const linhas = pagamentos.map((p) => {
      const bruto = numero(p.amount);
      const parcelas = p.installments || 1;
      const ehCredito = p.method === 'CREDITO';

      // A taxa gravada na venda é a que vale. Ela muda com o tempo, e o
      // relatório de hoje não pode recalcular o passado com o preço novo.
      const percentual =
        p.feePercent != null
          ? numero(p.feePercent)
          : ehCredito
            ? (taxaDe(tabela, parcelas, p.bandeira === 'elo' ? 'elo' : 'padrao') ?? 0)
            : 0;

      const taxa = p.netAmount != null ? bruto - numero(p.netAmount) : bruto * (percentual / 100);
      const final = bruto - taxa;

      // O acréscimo é da venda inteira. Com mais de uma linha de crédito,
      // cada uma leva a sua parte — senão o lucro apareceria dobrado.
      const totalNoCredito = p.sale.payments.reduce((s, x) => s + numero(x.amount), 0) || bruto;
      const repasse = ehCredito ? numero(p.sale.surcharge) * (bruto / totalNoCredito) : 0;

      return {
        data: dataBR(p.sale.saleDate),
        code: p.sale.code,
        autorizacao: p.autorizacao ?? '—',
        cliente: p.sale.customerName ?? 'Consumidor',
        bruto,
        parcelas: ehCredito ? (parcelas === 1 ? '1x' : `${parcelas}x`) : '—',
        bandeira: ehCredito
          ? p.bandeira === 'elo'
            ? 'ELO / AMEX'
            : 'VISA / MASTER'
          : 'DÉBITO',
        percentual,
        repasse,
        taxa,
        final,
        lucro: repasse - taxa,
      };
    });

    const soma = (campo: 'bruto' | 'repasse' | 'taxa' | 'final' | 'lucro') =>
      linhas.reduce((s, l) => s + l[campo], 0);

    const bruto = soma('bruto');
    const taxaTotal = soma('taxa');

    await exportar(res, q.format, {
      title: 'Relatório de Taxas',
      subtitle: periodo(q),
      // Por bandeira e parcelamento juntos: é assim que a taxa é cobrada, e
      // é o corte que mostra onde o dinheiro está indo.
      group: { key: 'bandeira', totals: ['bruto', 'repasse', 'taxa', 'final', 'lucro'] },
      columns: [
        { header: 'Data', key: 'data', width: 11 },
        { header: 'Venda', key: 'code', width: 12 },
        { header: 'Autorização', key: 'autorizacao', width: 13 },
        money('Valor bruto', 'bruto', 13),
        { header: 'Parcelas', key: 'parcelas', width: 9, align: 'right' as const },
        { header: 'Taxa %', key: 'percentual', width: 8, align: 'right' as const,
          format: (v: unknown) => `${decimal(v)}%` },
        money('Taxa do cliente', 'repasse', 14),
        money('Minha taxa', 'taxa', 12),
        money('Valor final', 'final', 13),
        money('Lucro', 'lucro', 12),
      ],
      rows: linhas,
      summary: [
        { label: 'Transações', value: String(linhas.length) },
        { label: 'Valor bruto', value: reais(bruto) },
        { label: 'Taxa paga pelo cliente', value: reais(soma('repasse')) },
        { label: 'Minha taxa', value: reais(taxaTotal) },
        {
          label: 'Taxa média',
          value: bruto > 0 ? `${((taxaTotal / bruto) * 100).toFixed(2).replace('.', ',')}%` : '—',
        },
        { label: 'Valor final (cai na conta)', value: reais(soma('final')) },
        { label: 'Lucro na taxa', value: reais(soma('lucro')) },
      ],
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
      select: {
        method: true,
        amount: true,
        installments: true,
        saleId: true,
        feePercent: true,
        netAmount: true,
        settledAt: true,
        destino: true,
      },
    });

    // Venda antiga não tem taxa gravada. Em vez de mostrar zero — que
    // contradiz a maquininha —, calcula pela tabela atual. O valor gravado
    // sempre manda, para o passado não mudar quando a taxa mudar.
    const tabela = await taxasDoCartao();

    const liquidoDe = (p: (typeof pagamentos)[number]) => {
      if (p.netAmount != null) return numero(p.netAmount);
      // Fiado só vira dinheiro quando alguém dá baixa.
      if (p.method === 'EM_ABERTO') return p.settledAt ? numero(p.amount) : 0;
      if (p.method !== 'CREDITO') return numero(p.amount);

      const taxa = taxaDe(tabela, p.installments, 'padrao');
      return taxa != null ? numero(p.amount) * (1 - taxa / 100) : numero(p.amount);
    };

    const total = pagamentos.reduce((s, p) => s + numero(p.amount), 0);

    // Pix da loja tem mais de uma conta: uma linha por conta, senão não dá
    // para conferir extrato nenhum.
    const chaves = [
      ...new Set(
        pagamentos.map((p) => (p.method === 'PIX' && p.destino ? `PIX::${p.destino}` : p.method)),
      ),
    ];
    const ordem = Object.keys(PAGAMENTO_LABEL);
    chaves.sort((a, b) => ordem.indexOf(a.split('::')[0]) - ordem.indexOf(b.split('::')[0]));

    const linhas = chaves
      .map((chave) => {
        const [forma, conta] = chave.split('::');
        const daForma = pagamentos.filter(
          (p) => p.method === forma && (conta ? p.destino === conta : !(forma === 'PIX' && p.destino)),
        );
        const soma = daForma.reduce((s, p) => s + numero(p.amount), 0);

        // Uma venda dividida em dois Pix conta como uma venda, não duas.
        const vendas = new Set(daForma.map((p) => p.saleId)).size;
        const parceladas = daForma.filter((p) => p.installments > 1);

        const liquido = daForma.reduce((s, p) => s + liquidoDe(p), 0);

        // "Taxa" é só o que a maquininha come. No fiado a diferença entre
        // vendido e recebido é dívida, não custo — chamar as duas de taxa
        // faria a loja achar que pagou uma comissão que não existe.
        const taxa = daForma.reduce(
          (s, p) => s + (p.method === 'CREDITO' ? numero(p.amount) - liquidoDe(p) : 0),
          0,
        );
        const aReceber = daForma.reduce(
          (s, p) => s + (p.method === 'EM_ABERTO' && !p.settledAt ? numero(p.amount) : 0),
          0,
        );

        return {
          payment: conta ?? PAGAMENTO_LABEL[forma],
          sales: vendas,
          lancamentos: daForma.length,
          total: soma,
          taxa,
          aReceber,
          liquido,
          share: total > 0 ? (soma / total) * 100 : 0,
          ticket: vendas > 0 ? soma / vendas : 0,
          parcelado: parceladas.length
            ? `${parceladas.length} em até ${Math.max(...parceladas.map((p) => p.installments))}x`
            : '—',
        };
      })
      // Forma sem movimento no período só ocuparia linha.
      .filter((l) => l.lancamentos > 0);

    // Só a troca fica de fora: aparelho nunca vira dinheiro na conta. O
    // fiado entra, e o próprio líquido resolve — zero enquanto está em
    // aberto, valor cheio depois da baixa.
    const emDinheiro = linhas.filter((l) => l.payment !== PAGAMENTO_LABEL.TROCA);

    await exportar(res, q.format, {
      title: 'Vendas por Forma de Pagamento',
      subtitle: periodo(q),
      columns: [
        { header: 'Forma de pagamento', key: 'payment', width: 22 },
        qtd('Vendas', 'sales', 10),
        qtd('Lançamentos', 'lancamentos', 12),
        money('Total', 'total', 15),
        money('Taxa da maquininha', 'taxa', 14),
        money('A receber', 'aReceber', 13),
        money('Na conta', 'liquido', 14),
        { header: '% do total', key: 'share', width: 10, align: 'right', format: (v) => `${Number(v).toFixed(1)}%` },
        money('Ticket médio', 'ticket', 13),
        { header: 'Parcelados', key: 'parcelado', width: 13 },
      ],
      rows: linhas,
      summary: [
        { label: 'Formas usadas', value: String(linhas.length) },
        { label: 'Vendido em dinheiro', value: reais(emDinheiro.reduce((s, l) => s + l.total, 0)) },
        { label: 'Taxa da maquininha', value: reais(linhas.reduce((s, l) => s + l.taxa, 0)) },
        { label: 'Ainda a receber', value: reais(linhas.reduce((s, l) => s + l.aReceber, 0)) },
        { label: 'Já está na conta', value: reais(emDinheiro.reduce((s, l) => s + l.liquido, 0)) },
        { label: 'Movimentado', value: reais(total) },
      ],
    });
  }),
);
