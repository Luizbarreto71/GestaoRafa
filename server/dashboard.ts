import { Router } from 'express';
import { autenticar } from './auth';
import { fimDoDia, inicioDoDia, limpar, numero, rota, somarDias } from './core';
import { db } from './db';
import { idsComEstoqueBaixo, valorDoEstoque } from './movimentacoes';

/** Cards, gráfico e alertas da tela inicial. */

export const rotasDashboard = Router();
rotasDashboard.use(autenticar);

rotasDashboard.get(
  '/',
  rota(async (req, res) => {
    const dias = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const hoje = new Date();
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
      valor,
    ] = await Promise.all([
      db.product.count(),
      db.product.aggregate({ _sum: { quantity: true } }),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje } },
        _sum: { quantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioHoje, lte: fimHoje } },
        _sum: { totalPrice: true, costAtSale: true },
      }),
      db.product.findMany({
        where: { id: { in: idsBaixos } },
        include: { category: true, photos: { select: { id: true }, take: 1 } },
        orderBy: { quantity: 'asc' },
      }),
      db.product.count({ where: { quantity: 0 } }),
      db.sale.findMany({
        orderBy: { saleDate: 'desc' },
        take: 8,
        include: {
          product: { select: { name: true, model: true, category: { select: { name: true } } } },
          user: { select: { name: true } },
        },
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioGrafico, lte: fimHoje } },
        select: { saleDate: true, totalPrice: true, quantity: true },
      }),
      db.movement.findMany({
        where: { createdAt: { gte: inicioGrafico, lte: fimHoje } },
        select: { createdAt: true, type: true, quantity: true },
      }),
      db.product.groupBy({ by: ['categoryId'], _sum: { quantity: true }, _count: true }),
      db.category.findMany(),
      db.sale.aggregate({
        where: { saleDate: { gte: inicioDoMes } },
        _sum: { totalPrice: true, costAtSale: true, quantity: true },
      }),
      valorDoEstoque(),
    ]);

    // ---------------------------------------------------- Série do gráfico
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
          itemsSoldMonth: mes._sum.quantity ?? 0,
        },
        chart: Array.from(baldes.values()),
        categories: porCategoria.map((linha) => {
          const categoria = categorias.find((c) => c.id === linha.categoryId);
          return {
            categoryId: linha.categoryId,
            name: categoria?.name ?? 'Sem categoria',
            color: categoria?.color ?? '#64748B',
            products: linha._count,
            quantity: linha._sum.quantity ?? 0,
          };
        }),
        lowStockProducts: estoqueBaixo.map((p) => ({
          ...p,
          photos: p.photos.map((f) => `/api/fotos/${f.id}`),
        })),
        latestSales: ultimasVendas,
      }),
    );
  }),
);

/** Alertas do sino e valor do estoque — o frontend consulta de minuto em minuto. */
rotasDashboard.get(
  '/alerts',
  rota(async (_req, res) => {
    const idsBaixos = await idsComEstoqueBaixo(20);

    const [estoqueBaixo, semEstoque, vendasHoje, valor] = await Promise.all([
      db.product.findMany({
        where: { id: { in: idsBaixos } },
        select: { id: true, name: true, quantity: true, minQuantity: true, model: true },
        orderBy: { quantity: 'asc' },
      }),
      db.product.findMany({
        where: { quantity: 0 },
        select: { id: true, name: true, model: true },
        take: 20,
      }),
      db.sale.findMany({
        where: { saleDate: { gte: inicioDoDia(), lte: fimDoDia() } },
        select: {
          id: true,
          customerName: true,
          totalPrice: true,
          quantity: true,
          saleDate: true,
          product: { select: { name: true } },
        },
        orderBy: { saleDate: 'desc' },
      }),
      valorDoEstoque(),
    ]);

    res.json(
      limpar({
        lowStock: estoqueBaixo,
        outOfStock: semEstoque,
        soldToday: vendasHoje,
        soldTodayCount: vendasHoje.reduce((s, v) => s + v.quantity, 0),
        revenueToday: vendasHoje.reduce((s, v) => s + numero(v.totalPrice), 0),
        stockValue: valor.venda,
        updatedAt: new Date().toISOString(),
      }),
    );
  }),
);
