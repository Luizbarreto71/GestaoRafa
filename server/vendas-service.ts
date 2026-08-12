import { PaymentMethod, Prisma } from '@prisma/client';
import { AppError, naoEncontrado } from './core';
import { taxaDe, type TaxaDeCartao } from '../shared/taxas';
import { taxasDoCartao } from './sistema';
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
  /**
   * Rateio quando o cliente paga de mais de um jeito.
   *
   * Vazio = a venda inteira na forma acima. Quem chama não precisa montar
   * a lista para o caso comum.
   */
  pagamentos?: {
    method: PaymentMethod;
    amount: number;
    installments?: number;
    notes?: string | null;
    /** Taxa da maquininha, em %. Só faz sentido no crédito. */
    feePercent?: number | null;
  }[];
  /**
   * Aparelho recebido na troca, em reais.
   *
   * Entra como forma de pagamento própria: a venda vale o preço cheio, e
   * o cliente pagou parte em dinheiro e parte em aparelho. Somar tudo como
   * dinheiro faria a gaveta não bater; tirar do total faria a venda parecer
   * prejuízo diante do custo do produto.
   */
  trocaValor?: number | null;
  /**
   * Aparelho anotado na hora, no balcão.
   *
   * A caixa registra só o essencial — modelo, cor, capacidade e quanto
   * vale. O cadastro completo, com IMEI e Anatel, fica para quando o
   * aparelho for para a prateleira.
   */
  trocaNova?: {
    modelo: string;
    cor?: string | null;
    armazenamento?: string | null;
    valorAvaliado: number;
  } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerDocument?: string | null;
  customerId?: string | null;
  notes?: string | null;
  /** Quem vendeu (para comissão). Pode ser o próprio caixa. */
  sellerId?: string | null;
  sellerName?: string | null;
  /** Quem recebeu o pagamento. */
  cashierId?: string | null;
  cashierName?: string | null;
  preSaleId?: string | null;
  saleDate?: Date;
}

/** Gera o próximo número visível (VD-000001, PV-000001). */
/** A taxa que vale para a linha: a informada, ou a da tabela da loja. */
function taxaDaLinha(
  tabela: TaxaDeCartao[],
  metodo: string,
  parcelas: number,
  informada: number | null | undefined,
): Prisma.Decimal | null {
  if (metodo !== 'CREDITO') return null;
  const taxa = informada ?? taxaDe(tabela, parcelas, 'padrao');
  return taxa != null ? new Prisma.Decimal(taxa) : null;
}

/** O que sobra depois do desconto da maquininha. */
function liquidoDaLinha(
  tabela: TaxaDeCartao[],
  metodo: string,
  valor: number,
  parcelas: number,
  informada: number | null | undefined,
): Prisma.Decimal {
  const taxa = taxaDaLinha(tabela, metodo, parcelas, informada);
  return new Prisma.Decimal(taxa ? valor * (1 - Number(taxa) / 100) : valor);
}

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

    // Cliente: reaproveita pelo telefone/documento/nome, senão cria.
    //
    // Venda de balcão pode não ter cliente nenhum. Nesse caso a venda fica
    // sem vínculo em vez de criar uma ficha vazia — um cadastro sem nome
    // suja a lista de clientes e não serve para nada depois.
    const nome = dados.customerName?.trim() || null;


    // Quem vendeu: o nome digitado manda; sem ele, o do usuário escolhido.
    let vendedorNome = dados.sellerName?.trim() || null;
    if (!vendedorNome && dados.sellerId) {
      const vendedor = await tx.user.findUnique({
        where: { id: dados.sellerId },
        select: { name: true },
      });
      vendedorNome = vendedor?.name ?? null;
    }
    let clienteId = dados.customerId ?? null;

    if (!clienteId && (nome || dados.customerPhone || dados.customerDocument)) {
      const existente =
        (dados.customerPhone
          ? await tx.customer.findFirst({ where: { phone: dados.customerPhone } })
          : null) ??
        (dados.customerDocument
          ? await tx.customer.findFirst({ where: { document: dados.customerDocument } })
          : null) ??
        (nome
          ? await tx.customer.findFirst({ where: { name: { equals: nome, mode: 'insensitive' } } })
          : null);

      clienteId =
        existente?.id ??
        // Sem nome não há ficha a criar: a tabela exige um.
        (nome
          ? (
              await tx.customer.create({
                data: {
                  name: nome,
                  phone: dados.customerPhone ?? null,
                  document: dados.customerDocument ?? null,
                },
              })
            ).id
          : null);
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

    // Toda venda guarda o rateio, mesmo com forma única: o fechamento soma
    // sempre da mesma tabela, sem caso especial.
    // A taxa do crédito é buscada quando não vem da tela: assim o líquido
    // fica certo mesmo na venda rápida, em que ninguém abre a calculadora.
    const tabela = await taxasDoCartao();

    const daTroca = new Prisma.Decimal(dados.trocaNova?.valorAvaliado ?? dados.trocaValor ?? 0);
    // O que o cliente entrega em dinheiro: o resto vem no aparelho.
    const aReceber = total.minus(daTroca);

    const emDinheiro = dados.pagamentos?.length
      ? dados.pagamentos.map((p) => ({
          method: p.method,
          // Duas casas antes de virar Decimal. Um valor como 318.59999999999997
          // — que aparece sozinho ao dividir por porcentagem — some na soma
          // do JavaScript, mas sobrevive na soma exata do banco e travaria a
          // venda dizendo que dois valores iguais são diferentes.
          amount: new Prisma.Decimal(p.amount.toFixed(2)),
          installments: p.installments ?? 1,
          notes: null as string | null,
        }))
      : aReceber.greaterThan(0)
        ? [
            {
              method: dados.paymentMethod,
              amount: aReceber,
              installments: dados.installments ?? 1,
              notes: null as string | null,
              feePercent: taxaDaLinha(tabela, dados.paymentMethod, dados.installments ?? 1, null),
              netAmount: liquidoDaLinha(
                tabela,
                dados.paymentMethod,
                Number(aReceber),
                dados.installments ?? 1,
                null,
              ),
            },
          ]
        : [];

    const somaEmDinheiro = emDinheiro.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
    // Meio centavo de folga: o dinheiro só existe até o centavo, e recusar
    // por menos que isso seria recusar por um arredondamento invisível.
    if (somaEmDinheiro.minus(aReceber).abs().greaterThan('0.005')) {
      throw new AppError(
        `As formas de pagamento somam R$ ${somaEmDinheiro.toFixed(2)}, mas o cliente tem a pagar R$ ${aReceber.toFixed(2)}.`,
      );
    }

    const rateio = daTroca.greaterThan(0)
      ? [
          ...emDinheiro,
          {
            method: 'TROCA' as PaymentMethod,
            amount: daTroca,
            installments: 1,
            notes: null,
            feePercent: null,
            netAmount: daTroca,
          },
        ]
      : emDinheiro;

    // A forma "principal" é a de maior valor entre as que são dinheiro: é
    // ela que aparece nas telas que mostram uma só.
    const formaPrincipal =
      emDinheiro.reduce<(typeof emDinheiro)[number] | null>(
        (maior, p) => (!maior || p.amount.greaterThan(maior.amount) ? p : maior),
        null,
      )?.method ?? ('TROCA' as PaymentMethod);

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
        // A forma "principal" continua na venda para as telas simples: é a
        // de maior valor quando o pagamento foi dividido.
        paymentMethod: formaPrincipal,
        installments: dados.installments ?? 1,
        payments: { create: rateio },
        saleDate: dados.saleDate ?? new Date(),
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
          `Venda ${venda.code} para ${nome ?? 'consumidor não identificado'}` +
          (item.imei ? ` · IMEI ${item.imei}` : '') +
          (item.serialNumber ? ` · série ${item.serialNumber}` : ''),
        vendaId: venda.id,
        usuarioId: dados.cashierId ?? dados.sellerId,
        usuarioNome: dados.cashierName,
        tx,
      });
    }

    // A troca anotada no balcão vira registro junto com a venda: se a
    // venda falhar, não sobra aparelho fantasma esperando dono.
    if (dados.trocaNova) {
      await tx.tradeIn.create({
        data: {
          code: await proximoCodigo('troca', 'TR', tx),
          status: 'ACEITA',
          modelo: dados.trocaNova.modelo,
          cor: dados.trocaNova.cor ?? null,
          armazenamento: dados.trocaNova.armazenamento ?? null,
          valorAvaliado: daTroca,
          valorSaida: total,
          customerName: nome ?? 'Consumidor',
          customerPhone: dados.customerPhone ?? null,
          customerDocument: dados.customerDocument ?? null,
          sellerId: dados.sellerId ?? dados.cashierId!,
          unitId: dados.unitId,
          saleId: venda.id,
          defeitos: [],
        },
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
      message: `${dados.customerName?.trim() || 'Consumidor'} · ${resultado.items.length} item(ns) · R$ ${Number(resultado.totalAmount).toFixed(2)}`,
      link: '/minhas-vendas',
    });
  }

  return resultado;
}
