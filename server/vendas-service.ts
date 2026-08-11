import { PaymentMethod, Prisma } from '@prisma/client';
import { AppError, naoEncontrado } from './core';
import { db } from './db';
import { disponivel, movimentar } from './estoque';
import { notificar } from './notificacoes';

/**
 * Onde a venda realmente acontece.
 *
 * É o único caminho que baixa estoque por venda — tanto o PDV direto
 * quanto a finalização de uma pré-venda passam por aqui. Concentrar isso
 * num lugar só é o que garante que as duas portas apliquem as mesmas
 * regras: conferir saldo, impedir IMEI repetido, gerar movimentação.
 */

export interface ItemDaVenda {
  productId: string;
  quantity: number;
  unitPrice: number;
  imei?: string | null;
  serialNumber?: string | null;
}

export interface DadosDaVenda {
  itens: ItemDaVenda[];
  unitId: string;
  paymentMethod: PaymentMethod;
  installments?: number;
  customerName: string;
  customerPhone?: string | null;
  customerDocument?: string | null;
  customerId?: string | null;
  notes?: string | null;
  /** Quem vendeu (para comissão). Pode ser o próprio caixa. */
  sellerId?: string | null;
  /** Quem recebeu o pagamento. */
  cashierId?: string | null;
  cashierName?: string | null;
  preSaleId?: string | null;
  saleDate?: Date;
}

/** Gera o próximo número visível (VD-000001, PV-000001). */
export async function proximoCodigo(nome: string, prefixo: string, tx?: Prisma.TransactionClient): Promise<string> {
  const cliente = tx ?? db;

  const contador = await cliente.sequence.upsert({
    where: { name: nome },
    update: { value: { increment: 1 } },
    create: { name: nome, value: 1 },
  });

  return `${prefixo}-${String(contador.value).padStart(6, '0')}`;
}

/**
 * Impede vender duas vezes o mesmo aparelho.
 *
 * Só olha vendas finalizadas: uma pré-venda cancelada não bloqueia nada,
 * e o IMEI volta a ficar livre.
 */
export async function conferirIdentificadores(
  itens: ItemDaVenda[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const cliente = tx ?? db;

  const identificadores = itens.flatMap((i) =>
    [i.imei?.trim(), i.serialNumber?.trim()].filter((v): v is string => Boolean(v)),
  );
  if (!identificadores.length) return;

  const jaVendido = await cliente.saleItem.findFirst({
    where: {
      sale: { status: 'FINALIZADA' },
      OR: [{ imei: { in: identificadores } }, { serialNumber: { in: identificadores } }],
    },
    include: { sale: { select: { code: true, saleDate: true } } },
  });

  if (jaVendido) {
    const qual = jaVendido.imei ?? jaVendido.serialNumber;
    throw new AppError(
      `Este produto já foi vendido ou está sendo finalizado em outra venda (${qual} — venda ${jaVendido.sale.code}).`,
      409,
    );
  }
}

/**
 * Registra a venda, baixa o estoque e gera as movimentações — numa
 * transação só, para não existir venda sem baixa nem baixa sem venda.
 */
export async function registrarVenda(dados: DadosDaVenda) {
  if (!dados.itens.length) throw new AppError('Inclua ao menos um produto na venda');

  const resultado = await db.$transaction(async (tx) => {
    const unidade = await tx.unit.findUnique({ where: { id: dados.unitId } });
    if (!unidade) throw naoEncontrado('Unidade');

    await conferirIdentificadores(dados.itens, tx);

    // Confere tudo antes de mexer em qualquer saldo: melhor recusar a venda
    // inteira do que baixar metade dela.
    const produtos = new Map<string, Prisma.ProductGetPayload<object>>();

    for (const item of dados.itens) {
      const produto =
        produtos.get(item.productId) ??
        (await tx.product.findUnique({ where: { id: item.productId } }));

      if (!produto) throw naoEncontrado('Produto');
      produtos.set(item.productId, produto);

      const livre = await disponivel(item.productId, dados.unitId, tx);
      if (livre < item.quantity) {
        throw new AppError(
          `Estoque insuficiente na ${unidade.name} para "${produto.name}". Disponível: ${livre} unidade(s).`,
        );
      }
    }

    // Cliente: reaproveita pelo telefone/documento, senão cria.
    let clienteId = dados.customerId ?? null;
    if (!clienteId) {
      const existente =
        (dados.customerPhone
          ? await tx.customer.findFirst({ where: { phone: dados.customerPhone } })
          : null) ??
        (dados.customerDocument
          ? await tx.customer.findFirst({ where: { document: dados.customerDocument } })
          : null) ??
        (await tx.customer.findFirst({
          where: { name: { equals: dados.customerName, mode: 'insensitive' } },
        }));

      clienteId =
        existente?.id ??
        (
          await tx.customer.create({
            data: {
              name: dados.customerName,
              phone: dados.customerPhone ?? null,
              document: dados.customerDocument ?? null,
            },
          })
        ).id;
    }

    const itensComCusto = dados.itens.map((item) => {
      const produto = produtos.get(item.productId)!;
      return {
        ...item,
        productName: produto.name,
        costPrice: new Prisma.Decimal(produto.costPrice),
      };
    });

    const total = itensComCusto.reduce(
      (soma, i) => soma.add(new Prisma.Decimal(i.unitPrice).mul(i.quantity)),
      new Prisma.Decimal(0),
    );
    const custo = itensComCusto.reduce(
      (soma, i) => soma.add(i.costPrice.mul(i.quantity)),
      new Prisma.Decimal(0),
    );

    // Vincula ao turno de caixa aberto, se houver.
    const turno = dados.cashierId
      ? await tx.cashRegister.findFirst({
          where: { cashierId: dados.cashierId, status: 'ABERTO' },
          orderBy: { openedAt: 'desc' },
        })
      : null;

    const venda = await tx.sale.create({
      data: {
        code: await proximoCodigo('venda', 'VD', tx),
        totalAmount: total,
        costAmount: custo,
        paymentMethod: dados.paymentMethod,
        installments: dados.installments ?? 1,
        saleDate: dados.saleDate ?? new Date(),
        notes: dados.notes ?? null,
        unitId: dados.unitId,
        customerId: clienteId,
        customerName: dados.customerName,
        customerPhone: dados.customerPhone ?? null,
        customerDocument: dados.customerDocument ?? null,
        sellerId: dados.sellerId ?? null,
        cashierId: dados.cashierId ?? null,
        cashRegisterId: turno?.id ?? null,
        preSaleId: dados.preSaleId ?? null,
        items: {
          create: itensComCusto.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: new Prisma.Decimal(i.unitPrice),
            costPrice: i.costPrice,
            imei: i.imei?.trim() || null,
            serialNumber: i.serialNumber?.trim() || null,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
        unit: { select: { name: true } },
        seller: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } },
      },
    });

    for (const item of itensComCusto) {
      await movimentar({
        produtoId: item.productId,
        produtoNome: item.productName,
        unidadeId: dados.unitId,
        tipo: 'SAIDA',
        motivo: 'VENDA',
        quantidade: item.quantity,
        observacao:
          `Venda ${venda.code} para ${dados.customerName}` +
          (item.imei ? ` · IMEI ${item.imei}` : '') +
          (item.serialNumber ? ` · série ${item.serialNumber}` : ''),
        vendaId: venda.id,
        usuarioId: dados.cashierId ?? dados.sellerId,
        usuarioNome: dados.cashierName,
        tx,
      });
    }

    return venda;
  });

  // Avisa o vendedor depois que a transação fechou — notificação não pode
  // segurar a venda nem desfazê-la.
  if (dados.sellerId && dados.sellerId !== dados.cashierId) {
    await notificar({
      userId: dados.sellerId,
      title: `Venda ${resultado.code} finalizada`,
      message: `${dados.customerName} · ${resultado.items.length} item(ns) · R$ ${Number(resultado.totalAmount).toFixed(2)}`,
      link: '/minhas-vendas',
    });
  }

  return resultado;
}
