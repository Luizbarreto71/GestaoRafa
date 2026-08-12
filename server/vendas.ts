import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { autenticar, somenteAdmin } from './auth';
import {
  AppError,
  contem,
  intervalo,
  limpar,
  naoEncontrado,
  numero,
  ordenar,
  paginacao,
  paginado,
  rota,
  semVazios,
  validar,
} from './core';
import { db, registrarLog } from './db';
import { enviarRecibo } from './recibo';
import { lojaSalva } from './sistema';
import {
  comAsFilhas,
  movimentar,
} from './estoque';
import { exigir } from './permissoes';
import { unidadePermitida } from './unidades';
import { registrarVenda } from './vendas-service';

/** Vendas concluídas: consulta, PDV direto e cancelamento. */

export const rotasVendas = Router();
rotasVendas.use(autenticar);

const PAGAMENTOS = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'EM_ABERTO', 'OUTRO'] as const;

const COM_TUDO = {
  items: { include: { product: { select: { id: true, name: true, model: true, category: true } } } },
  customer: true,
  unit: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  cashier: { select: { id: true, name: true } },
  preSale: { select: { id: true, code: true } },
  payments: { orderBy: { amount: 'desc' } as const },
} satisfies Prisma.SaleInclude;

const filtrosSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAGAMENTOS).optional(),
  sellerId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FiltrosVenda = z.infer<typeof filtrosSchema>;

export async function filtrarVendas(q: FiltrosVenda, unidadeId?: string): Promise<Prisma.SaleWhereInput> {
  const cond: Prisma.SaleWhereInput[] = [{ status: 'FINALIZADA' }];

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
        { items: { some: { product: { name: contem(q.search) } } } },
      ],
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

  const periodo = intervalo(q.startDate, q.endDate);
  if (periodo) cond.push({ saleDate: periodo });

  return { AND: cond };
}

rotasVendas.get(
  '/',
  rota(async (req, res) => {
    const q = validar(filtrosSchema, semVazios(req.query));
    const unidade = unidadePermitida(req.usuario, q.unitId);
    const p = paginacao(q as Record<string, unknown>);
    const where = await filtrarVendas(q, unidade);

    const [lista, total, somas, itens] = await Promise.all([
      db.sale.findMany({
        where,
        include: COM_TUDO,
        skip: p.skip,
        take: p.take,
        orderBy: ordenar(q.sortBy, q.sortOrder, ['saleDate', 'totalAmount', 'code', 'createdAt'], {
          saleDate: 'desc',
        }) as never,
      }),
      db.sale.count({ where }),
      db.sale.aggregate({ where, _sum: { totalAmount: true, costAmount: true } }),
      db.saleItem.aggregate({ where: { sale: where }, _sum: { quantity: true } }),
    ]);

    res.json(
      limpar({
        ...paginado(lista, total, p),
        totals: {
          revenue: somas._sum.totalAmount ?? 0,
          profit: numero(somas._sum.totalAmount) - numero(somas._sum.costAmount),
          items: itens._sum.quantity ?? 0,
        },
      }),
    );
  }),
);

rotasVendas.get(
  '/:id',
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({ where: { id: req.params.id }, include: COM_TUDO });
    if (!venda) throw naoEncontrado('Venda');
    res.json(limpar(venda));
  }),
);

// ------------------------------------------------------------- PDV direto

const vendaSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Selecione o produto'),
        quantity: z.coerce.number().int().min(1, 'Quantidade mínima: 1'),
        unitPrice: z.coerce.number().min(0, 'Informe o valor'),
        imei: z.string().trim().max(40).optional().nullable(),
        serialNumber: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1, 'Inclua ao menos um produto'),
  unitId: z.string().uuid('Informe de qual unidade o produto saiu'),
  paymentMethod: z.enum(PAGAMENTOS),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  /**
   * Pagamento dividido: parte no PIX, parte no cartão, e por aí.
   *
   * Vazio = a venda inteira em `paymentMethod`. A soma tem de fechar com
   * o total, e isso é conferido dentro da transação.
   */
  payments: z
    .array(
      z.object({
        method: z.enum(PAGAMENTOS),
        amount: z.coerce.number().min(0.01, 'Informe o valor desta forma'),
        installments: z.coerce.number().int().min(1).max(24).default(1),
        notes: z.string().trim().max(120).optional().nullable(),
        /** Taxa da maquininha, em %. Guardada com a venda. */
        feePercent: z.coerce.number().min(0).max(99.99).optional().nullable(),
      }),
    )
    .max(6, 'No máximo 6 formas na mesma venda')
    .optional(),
  /**
   * Opcional na venda de balcão.
   *
   * No caixa a fila anda, e exigir nome e CPF de quem paga R$ 60 num cabo
   * atrasa todo mundo. A pré-venda continua pedindo: lá o caixa precisa
   * saber de quem é o pedido.
   */
  customerName: z.string().trim().max(180).optional().nullable(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerDocument: z.string().trim().max(30).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  /**
   * Aparelho que o cliente deixou como parte do pagamento.
   *
   * Versão de balcão: só o que dá para anotar com o cliente na frente.
   * O aparelho vira uma forma de pagamento e o cliente paga a diferença.
   */
  tradeIn: z
    .object({
      modelo: z.string().trim().min(2, 'Informe o modelo do aparelho').max(120),
      cor: z.string().trim().max(40).optional().nullable(),
      armazenamento: z.string().trim().max(20).optional().nullable(),
      valorAvaliado: z.coerce.number().min(0.01, 'Informe quanto vale o aparelho do cliente'),
    })
    .optional()
    .nullable(),
  /** Vendedor que atendeu, para a comissão. Vazio = o próprio caixa. */
  sellerId: z.string().uuid().optional().nullable(),
  /**
   * Nome digitado no balcão.
   *
   * Nem todo vendedor tem login: a loja tem gente no salão que nunca entra
   * no sistema. Sem isto, a venda ficaria no nome do caixa e a comissão
   * apontaria para a pessoa errada.
   */
  sellerName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  saleDate: z.coerce.date().optional(),
});

/** Venda feita direto no balcão, sem passar por pré-venda. */
rotasVendas.post(
  '/',
  exigir('pdv'),
  rota(async (req, res) => {
    const dados = validar(vendaSchema, req.body);

    // Quem leva a comissão.
    //
    // O nome digitado manda: se bate com alguém que tem login, a venda é
    // dele; se é alguém de fora do sistema, fica sem usuário em vez de cair
    // no colo do caixa — senão a comissão iria para quem só recebeu o
    // dinheiro. Resolver aqui, e não na tela, evita registro contraditório.
    let vendedorId: string | null = dados.sellerId ?? req.usuario!.id;

    if (dados.sellerName?.trim()) {
      const encontrado = await db.user.findFirst({
        where: { name: { equals: dados.sellerName.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      vendedorId = encontrado?.id ?? null;
    }

    const venda = await registrarVenda({
      itens: dados.items,
      unitId: dados.unitId,
      paymentMethod: dados.paymentMethod as never,
      installments: dados.installments,
      pagamentos: dados.payments,
      trocaNova: dados.tradeIn,
      customerName: dados.customerName,
      sellerName: dados.sellerName,
      customerPhone: dados.customerPhone,
      customerDocument: dados.customerDocument,
      customerId: dados.customerId,
      notes: dados.notes,
      sellerId: vendedorId,
      cashierId: req.usuario!.id,
      cashierName: req.usuario!.nome,
      saleDate: dados.saleDate,
    });

    await registrarLog({
      acao: 'CRIAR_VENDA',
      entidade: 'Sale',
      id: venda.id,
      alteracoes: {
        venda: venda.code,
        unidade: venda.unit.name,
        pagamento: dados.paymentMethod,
        total: numero(venda.totalAmount),
      },
      req,
    });

    res.status(201).json(limpar(venda));
  }),
);

/**
 * Cancela a venda e devolve tudo ao estoque.
 *
 * A venda não é apagada: vira CANCELADA e as devoluções entram como
 * movimentação. Assim o histórico continua contando o que aconteceu.
 */
rotasVendas.delete(
  '/:id',
  exigir('venda.cancelar'),
  rota(async (req, res) => {
    const motivo = String(req.query.reason ?? '').trim();

    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, unit: { select: { name: true } } },
    });
    if (!venda) throw naoEncontrado('Venda');
    if (venda.status === 'CANCELADA') throw new AppError('Esta venda já foi cancelada.');

    for (const item of venda.items) {
      await movimentar({
        produtoId: item.productId,
        produtoNome: item.productName ?? 'Produto',
        unidadeId: venda.unitId,
        tipo: 'ENTRADA',
        motivo: 'CANCELAMENTO',
        quantidade: item.quantity,
        observacao: `Cancelamento da venda ${venda.code}${motivo ? ` · ${motivo}` : ''}`,
        vendaId: venda.id,
        usuarioId: req.usuario?.id,
        usuarioNome: req.usuario?.nome,
      });
    }

    await db.sale.update({ where: { id: venda.id }, data: { status: 'CANCELADA' } });

    await registrarLog({
      acao: 'CANCELAR_VENDA',
      entidade: 'Sale',
      id: venda.id,
      alteracoes: { venda: venda.code, motivo },
      req,
    });

    res.json({
      message: `Venda ${venda.code} cancelada. ${venda.items.length} item(ns) devolvidos ao estoque da ${venda.unit.name}.`,
    });
  }),
);

/**
 * Comprovante da venda, pronto para imprimir.
 *
 * Vem "inline" e não como download: a tela precisa exibir o PDF para
 * conseguir mandar para a impressora sem o caixa procurar o arquivo.
 */
rotasVendas.get(
  '/:id/recibo',
  rota(async (req, res) => {
    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        payments: { orderBy: { amount: 'desc' } },
        unit: { select: { name: true } },
        seller: { select: { name: true } },
        cashier: { select: { name: true } },
        tradeIn: { select: { modelo: true, imei: true, cor: true, armazenamento: true, valorAvaliado: true } },
      },
    });
    if (!venda) throw naoEncontrado('Venda');

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
        productName: i.productName ?? 'Produto',
        quantity: i.quantity,
        unitPrice: numero(i.unitPrice),
        imei: i.imei,
        serialNumber: i.serialNumber,
      })),
      payments: venda.payments.map((p) => ({
        method: p.method,
        amount: numero(p.amount),
        installments: p.installments,
      })),
      troca: venda.tradeIn
        ? {
            modelo: [venda.tradeIn.modelo, venda.tradeIn.armazenamento, venda.tradeIn.cor]
              .filter(Boolean)
              .join(' · '),
            imei: venda.tradeIn.imei,
            valor: numero(venda.tradeIn.valorAvaliado),
          }
        : null,
      total: numero(venda.totalAmount),
    });
  }),
);

// -------------------------------------------------------------- Edição

const edicaoSchema = z.object({
  customerName: z.string().trim().max(180).optional().nullable(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerDocument: z.string().trim().max(30).optional().nullable(),
  sellerName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  saleDate: z.coerce.date().optional(),
  /** Lista completa e definitiva dos itens. */
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
        unitPrice: z.coerce.number().min(0),
        imei: z.string().trim().max(40).optional().nullable(),
        serialNumber: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1, 'A venda precisa de ao menos um produto')
    .optional(),
  paymentMethod: z.enum(PAGAMENTOS).optional(),
  installments: z.coerce.number().int().min(1).max(24).optional(),
  /** Lista completa e definitiva das formas de pagamento. */
  payments: z
    .array(
      z.object({
        method: z.enum([...PAGAMENTOS, 'TROCA'] as const),
        amount: z.coerce.number().min(0.01),
        installments: z.coerce.number().int().min(1).max(24).default(1),
      }),
    )
    .max(6)
    .optional(),
});

/**
 * Corrige uma venda já registrada.
 *
 * Mudar item mexe em estoque, e mudar valor mexe no caixa — então tudo
 * acontece numa transação só, ajustando a diferença em vez de refazer a
 * venda: o histórico continua mostrando o que aconteceu de verdade.
 */
rotasVendas.put(
  '/:id',
  somenteAdmin,
  rota(async (req, res) => {
    const dados = validar(edicaoSchema, req.body);

    const venda = await db.sale.findUnique({
      where: { id: req.params.id },
      include: { items: true, payments: true, tradeIn: true, unit: { select: { name: true } } },
    });
    if (!venda) throw naoEncontrado('Venda');
    if (venda.status === 'CANCELADA') {
      throw new AppError('Esta venda está cancelada. Registre uma nova em vez de editá-la.');
    }

    // Quem vendeu: mesma regra do balcão, para não haver dois caminhos.
    let vendedorId = venda.sellerId;
    if (dados.sellerName !== undefined) {
      const nome = dados.sellerName?.trim();
      vendedorId = nome
        ? ((await db.user.findFirst({
            where: { name: { equals: nome, mode: 'insensitive' } },
            select: { id: true },
          }))?.id ?? null)
        : null;
    }

    const resultado = await db.$transaction(async (tx) => {
      let total = numero(venda.totalAmount);
      let custo = numero(venda.costAmount);
      const ajustes: string[] = [];

      if (dados.items) {
        const produtos = await tx.product.findMany({
          where: { id: { in: dados.items.map((i) => i.productId) } },
          select: { id: true, name: true, costPrice: true },
        });
        if (produtos.length !== new Set(dados.items.map((i) => i.productId)).size) {
          throw naoEncontrado('Produto');
        }

        // Ajusta pela diferença, produto a produto. Devolver tudo e baixar
        // tudo de novo encheria o histórico de movimentos que não houve.
        const antes = new Map<string, number>();
        for (const i of venda.items) antes.set(i.productId, (antes.get(i.productId) ?? 0) + i.quantity);

        const depois = new Map<string, number>();
        for (const i of dados.items) depois.set(i.productId, (depois.get(i.productId) ?? 0) + i.quantity);

        for (const produtoId of new Set([...antes.keys(), ...depois.keys()])) {
          const diferenca = (depois.get(produtoId) ?? 0) - (antes.get(produtoId) ?? 0);
          if (diferenca === 0) continue;

          const nome =
            produtos.find((p) => p.id === produtoId)?.name ??
            venda.items.find((i) => i.productId === produtoId)?.productName ??
            'Produto';

          await movimentar({
            produtoId,
            produtoNome: nome,
            unidadeId: venda.unitId,
            tipo: diferenca > 0 ? 'SAIDA' : 'ENTRADA',
            motivo: diferenca > 0 ? 'VENDA' : 'CANCELAMENTO',
            quantidade: Math.abs(diferenca),
            observacao: `Correção da venda ${venda.code}: ${nome} passou de ${antes.get(produtoId) ?? 0} para ${depois.get(produtoId) ?? 0}`,
            vendaId: venda.id,
            usuarioId: req.usuario?.id,
            usuarioNome: req.usuario?.nome,
            tx,
          });

          ajustes.push(`${nome} ${antes.get(produtoId) ?? 0} → ${depois.get(produtoId) ?? 0}`);
        }

        total = dados.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        custo = dados.items.reduce(
          (s, i) => s + numero(produtos.find((p) => p.id === i.productId)!.costPrice) * i.quantity,
          0,
        );

        await tx.saleItem.deleteMany({ where: { saleId: venda.id } });
        await tx.saleItem.createMany({
          data: dados.items.map((i) => ({
            saleId: venda.id,
            productId: i.productId,
            productName: produtos.find((p) => p.id === i.productId)!.name,
            quantity: i.quantity,
            unitPrice: new Prisma.Decimal(i.unitPrice),
            costPrice: produtos.find((p) => p.id === i.productId)!.costPrice,
            imei: i.imei?.trim() || null,
            serialNumber: i.serialNumber?.trim() || null,
          })),
        });
      }

      // O rateio precisa fechar com o total, senão o caixa não bate.
      const daTroca = venda.tradeIn ? numero(venda.tradeIn.valorAvaliado) : 0;
      let rateio = dados.payments?.map((p) => ({
        method: p.method,
        amount: new Prisma.Decimal(p.amount),
        installments: p.installments,
        notes: null,
      }));

      if (!rateio && dados.items) {
        // Mudou o valor e ninguém disse como pagar: mantém as formas e
        // joga a diferença na maior, que é o comportamento previsível.
        const semTroca = venda.payments.filter((p) => p.method !== 'TROCA');
        const alvo = total - daTroca;
        const somaAtual = semTroca.reduce((s, p) => s + numero(p.amount), 0);
        const diferenca = alvo - somaAtual;

        if (Math.abs(diferenca) >= 0.01 && semTroca.length) {
          const maior = semTroca.reduce((m, p) => (numero(p.amount) > numero(m.amount) ? p : m));
          rateio = venda.payments.map((p) => ({
            method: p.method,
            amount:
              p.id === maior.id ? new Prisma.Decimal(numero(p.amount) + diferenca) : p.amount,
            installments: p.installments,
            notes: null,
          }));
        }
      }

      if (rateio) {
        const soma = rateio.reduce((s, p) => s + numero(p.amount), 0);
        if (Math.abs(soma - total) >= 0.01) {
          throw new AppError(
            `As formas de pagamento somam R$ ${soma.toFixed(2)}, mas a venda é de R$ ${total.toFixed(2)}.`,
          );
        }

        await tx.salePayment.deleteMany({ where: { saleId: venda.id } });
        await tx.salePayment.createMany({
          data: rateio.map((p) => ({ ...p, saleId: venda.id })),
        });
      }

      const principal = (rateio ?? venda.payments)
        .filter((p) => p.method !== 'TROCA')
        .reduce<{ method: string; amount: Prisma.Decimal } | null>(
          (m, p) => (!m || p.amount.greaterThan(m.amount) ? p : m),
          null,
        )?.method;

      const atualizada = await tx.sale.update({
        where: { id: venda.id },
        data: {
          ...(dados.customerName !== undefined ? { customerName: dados.customerName?.trim() || null } : {}),
          ...(dados.customerPhone !== undefined ? { customerPhone: dados.customerPhone?.trim() || null } : {}),
          ...(dados.customerDocument !== undefined
            ? { customerDocument: dados.customerDocument?.trim() || null }
            : {}),
          ...(dados.sellerName !== undefined
            ? { sellerName: dados.sellerName?.trim() || null, sellerId: vendedorId }
            : {}),
          ...(dados.notes !== undefined ? { notes: dados.notes?.trim() || null } : {}),
          ...(dados.saleDate ? { saleDate: dados.saleDate } : {}),
          ...(dados.installments ? { installments: dados.installments } : {}),
          ...(dados.paymentMethod ? { paymentMethod: dados.paymentMethod } : {}),
          ...(principal && !dados.paymentMethod ? { paymentMethod: principal as never } : {}),
          totalAmount: new Prisma.Decimal(total),
          costAmount: new Prisma.Decimal(custo),
        },
        include: { items: true, payments: true },
      });

      return { atualizada, ajustes, total };
    });

    await registrarLog({
      acao: 'EDITAR_VENDA',
      entidade: 'Sale',
      id: venda.id,
      alteracoes: {
        venda: venda.code,
        totalAntes: numero(venda.totalAmount),
        totalDepois: resultado.total,
        estoque: resultado.ajustes,
      },
      req,
    });

    res.json(
      limpar({
        ...resultado.atualizada,
        message:
          `Venda ${venda.code} atualizada.` +
          (resultado.ajustes.length ? ` Estoque ajustado: ${resultado.ajustes.join(', ')}.` : ''),
      }),
    );
  }),
);
