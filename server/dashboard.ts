import { Router } from 'express';
import { autenticar } from './auth';
import { fimDoDia, inicioDoDia, limpar, numero, rota, somarDias } from './core';
import { db } from './db';
import { estoqueBaixo, totalEmEstoque, valorDoEstoque } from './estoque';
import { unidadePermitida } from './unidades';

/**
 * Cards, gráfico e alertas da tela inicial.
 *
 * Tudo aceita `unitId`: sem ele, mostra o consolidado das unidades; com ele,
 * só aquela loja. Gerente e Vendedor caem sempre na própria unidade,
 * independentemente do que peçam.
 */

export const rotasDashboard = Router();
rotasDashboard.use(autenticar);

rotasDashboard.get(
  '/',
  rota(async (req, res) => {
    const dias = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const unidade = unidadePermitida(req.usuario, req.query.unitId as string | undefined);
    const naUnidade = unidade ? { unitId: unidade } : {};

    const hoje = new Date();
    const inicioHoje = inicioDoDia(hoje);
    const fimHoje = fimDoDia(hoje);
    const inicioGrafico = inicioDoDia(somarDias(hoje, -(dias - 1)));
    const inicioDoMes = inicioDoDia(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

    const baixos = await estoqueBaixo(unidade, 10);

    const [
      totalProdutos,
      itensEmEstoque,
      vendidosHoje,
      faturamentoHoje,
      produtosBaixos,
      semEstoque,
      ultimasVendas,
      vendasDoPeriodo,
      movimentosDoPeriodo,
      linhasDeEstoque,
      categorias,
      mes,
      valor,
    ] = await Promise.all([
      db.product.count(),
      totalEmEstoque(unidade),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje }, ...naUnidade },
        _sum: { quantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje }, ...naUnidade },
        _sum: { totalPrice: true, costAtSale: true },
      }),
      db.product.findMany({
        where: { id: { in: baixos.map((b) => b.productId) } },
        include: {
          category: true,
          photos: { select: { id: true }, take: 1 },
          stock: { include: { unit: { select: { name: true } } } },
        },
      }),
      db.stock.count({ where: { quantity: 0, ...naUnidade } }),
      db.sale.findMany({
        where: naUnidade,
        orderBy: { saleDate: 'desc' },
        take: 8,
        include: {
          product: { select: { name: true, model: true, category: { select: { name: true } } } },
          user: { select: { name: true } },
          unit: { select: { name: true } },
        },
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioGrafico, lte: fimHoje }, ...naUnidade },
        select: { saleDate: true, totalPrice: true, quantity: true },
      }),
      db.stockMovement.findMany({
        where: { createdAt: { gte: inicioGrafico, lte: fimHoje }, ...naUnidade },
        select: { createdAt: true, type: true, quantity: true },
      }),
      db.stock.findMany({
        where: naUnidade,
        select: { quantity: true, product: { select: { categoryId: true } } },
      }),
      db.category.findMany(),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioDoMes }, ...naUnidade },
        _sum: { totalPrice: true, costAtSale: true, quantity: true },
      }),
      valorDoEstoque(unidade),
    ]);

    // ------------------------------------------------------ Série do gráfico
    const dia = (d: Date) => inicioDoDia(d).toISOString().slice(0, 10);

    const baldes = new Map<
      string,
      { date: string; vendas: number; faturamento: number; entradas: number; saidas: number }
    >();

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
      if (mov.type === 'ENTRADA') balde.entradas += mov.quantity;
      if (mov.type === 'SAIDA') balde.saidas += mov.quantity;
    }

    // -------------------------------------------- Distribuição por categoria
    const porCategoria = new Map<string, { quantidade: number; produtos: number }>();
    for (const linha of linhasDeEstoque) {
      const id = linha.product.categoryId;
      const atual = porCategoria.get(id) ?? { quantidade: 0, produtos: 0 };
      atual.quantidade += linha.quantity;
      atual.produtos += 1;
      porCategoria.set(id, atual);
    }

    const receitaHoje = numero(faturamentoHoje._sum.totalPrice);
    const receitaMes = numero(mes._sum.totalPrice);

    res.json(
      limpar({
        unitId: unidade ?? null,
        cards: {
          totalProducts: totalProdutos,
          itemsInStock: itensEmEstoque,
          soldToday: vendidosHoje._sum.quantity ?? 0,
          salesCountToday: vendidosHoje._count,
          revenueToday: receitaHoje,
          profitToday: receitaHoje - numero(faturamentoHoje._sum.costAtSale),
          stockValueCost: valor.custo,
          stockValueSale: valor.venda,
          lowStockCount: baixos.length,
          outOfStockCount: semEstoque,
          revenueMonth: receitaMes,
          profitMonth: receitaMes - numero(mes._sum.costAtSale),
          itemsSoldMonth: mes._sum.quantity ?? 0,
          entradas: movimentosDoPeriodo
            .filter((m) => m.type === 'ENTRADA')
            .reduce((s, m) => s + m.quantity, 0),
          saidas: movimentosDoPeriodo
            .filter((m) => m.type === 'SAIDA')
            .reduce((s, m) => s + m.quantity, 0),
        },
        chart: Array.from(baldes.values()),
        categories: Array.from(porCategoria.entries()).map(([id, dados]) => {
          const categoria = categorias.find((c) => c.id === id);
          return {
            categoryId: id,
            name: categoria?.name ?? 'Sem categoria',
            color: categoria?.color ?? '#64748B',
            products: dados.produtos,
            quantity: dados.quantidade,
          };
        }),
        lowStockProducts: produtosBaixos.map((p) => {
          const linha = baixos.find((b) => b.productId === p.id);
          return {
            ...p,
            photos: p.photos.map((f) => `/api/fotos/${f.id}`),
            quantity: linha?.quantity ?? 0,
            unitName: p.stock.find((s) => s.unitId === linha?.unitId)?.unit.name ?? null,
          };
        }),
        latestSales: ultimasVendas,
      }),
    );
  }),
);

/** Alertas do sino — o frontend consulta de minuto em minuto. */
rotasDashboard.get(
  '/alerts',
  rota(async (req, res) => {
    const unidade = unidadePermitida(req.usuario, req.query.unitId as string | undefined);
    const naUnidade = unidade ? { unitId: unidade } : {};

    const baixos = await estoqueBaixo(unidade, 20);

    const [produtos, zerados, vendasHoje, valor] = await Promise.all([
      db.product.findMany({
        where: { id: { in: baixos.map((b) => b.productId) } },
        select: { id: true, name: true, minQuantity: true, model: true },
      }),
      db.stock.findMany({
        where: { quantity: 0, ...naUnidade },
        select: { product: { select: { id: true, name: true, model: true } }, unit: { select: { name: true } } },
        take: 20,
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioDoDia(), lte: fimDoDia() }, ...naUnidade },
        select: {
          id: true,
          customerName: true,
          totalPrice: true,
          quantity: true,
          saleDate: true,
          product: { select: { name: true } },
          unit: { select: { name: true } },
        },
        orderBy: { saleDate: 'desc' },
      }),
      valorDoEstoque(unidade),
    ]);

    const unidades = await db.unit.findMany({ select: { id: true, name: true } });

    res.json(
      limpar({
        lowStock: baixos.map((b) => {
          const produto = produtos.find((p) => p.id === b.productId);
          return {
            id: b.productId,
            name: produto?.name ?? '—',
            model: produto?.model ?? null,
            quantity: b.quantity,
            minQuantity: b.minQuantity,
            unitName: unidades.find((u) => u.id === b.unitId)?.name ?? null,
          };
        }),
        outOfStock: zerados.map((z) => ({ ...z.product, unitName: z.unit.name })),
        soldToday: vendasHoje,
        soldTodayCount: vendasHoje.reduce((s, v) => s + v.quantity, 0),
        revenueToday: vendasHoje.reduce((s, v) => s + numero(v.totalPrice), 0),
        stockValue: valor.venda,
        updatedAt: new Date().toISOString(),
      }),
    );
  }),
);
