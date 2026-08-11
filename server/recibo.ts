import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { PAGAMENTO_LABEL } from './core';

const AZUL = '#0F172A';
const CINZA = '#475569';
const CLARO = '#F8FAFC';

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface DadosDoRecibo {
  code: string;
  saleDate: Date;
  unitName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerDocument?: string | null;
  sellerName?: string | null;
  cashierName?: string | null;
  notes?: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    imei?: string | null;
    serialNumber?: string | null;
  }[];
  payments: { method: string; amount: number; installments: number }[];
  /** Aparelho recebido na troca, quando houve. */
  troca?: { modelo: string; imei: string; valor: number } | null;
  total: number;
}

/**
 * Comprovante de uma venda, pronto para imprimir.
 *
 * Mesma identidade dos relatórios — faixa escura, tabela listrada — porque
 * é o mesmo papel que circula pela loja. Sai em A4 retrato: imprime em
 * qualquer impressora, sem depender de bobina térmica.
 */
export function enviarRecibo(res: Response, r: DadosDoRecibo): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  // "inline": o navegador precisa exibir para conseguir mandar imprimir.
  res.setHeader('Content-Disposition', `inline; filename="recibo-${r.code}.pdf"`);
  doc.pipe(res);

  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x0 = doc.page.margins.left;

  // ------------------------------------------------------------- cabeçalho
  doc.rect(0, 0, doc.page.width, 78).fill(AZUL);
  doc.fillColor('#FFFFFF').fontSize(19).font('Helvetica-Bold').text('Rafa Multimarcas', x0, 20);
  doc.fontSize(11).font('Helvetica').text('Comprovante de venda', x0, 45);

  doc
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(r.code, x0, 22, { width: largura, align: 'right' });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(r.saleDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), x0, 46, {
      width: largura,
      align: 'right',
    });

  doc.y = 100;

  // ----------------------------------------------------------------- dados
  const bloco = (titulo: string, linhas: [string, string][]) => {
    doc.fillColor(CINZA).fontSize(8).font('Helvetica-Bold').text(titulo.toUpperCase(), x0, doc.y);
    doc.moveDown(0.3);

    for (const [rotulo, valor] of linhas) {
      const y = doc.y;
      doc.fillColor(CINZA).fontSize(9).font('Helvetica').text(rotulo, x0, y, { width: 110 });
      doc
        .fillColor(AZUL)
        .font('Helvetica-Bold')
        .text(valor, x0 + 110, y, { width: largura - 110 });
      doc.y = y + 14;
    }
    doc.moveDown(0.6);
  };

  bloco('Cliente', [
    ['Nome', r.customerName?.trim() || 'Consumidor não identificado'],
    ...((r.customerDocument ? [['CPF', r.customerDocument]] : []) as [string, string][]),
    ...((r.customerPhone ? [['Telefone', r.customerPhone]] : []) as [string, string][]),
  ]);

  bloco('Atendimento', [
    ['Loja', r.unitName ?? '—'],
    ['Vendedor', r.sellerName?.trim() || '—'],
    ['Caixa', r.cashierName?.trim() || '—'],
  ]);

  // ----------------------------------------------------------------- itens
  doc.fillColor(CINZA).fontSize(8).font('Helvetica-Bold').text('PRODUTOS', x0, doc.y);
  doc.moveDown(0.3);

  const colunas: { titulo: string; peso: number; alinhar?: 'right' | 'center' }[] = [
    { titulo: 'Produto', peso: 46 },
    { titulo: 'Qtd', peso: 8, alinhar: 'center' },
    { titulo: 'Valor un.', peso: 20, alinhar: 'right' },
    { titulo: 'Total', peso: 20, alinhar: 'right' },
  ];
  const peso = colunas.reduce((s, c) => s + c.peso, 0);
  const larguras = colunas.map((c) => (c.peso / peso) * largura);

  let y = doc.y;
  doc.rect(x0, y, largura, 18).fill('#E2E8F0');
  doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold');
  let x = x0;
  colunas.forEach((c, i) => {
    doc.text(c.titulo.toUpperCase(), x + 4, y + 5, {
      width: larguras[i] - 8,
      align: c.alinhar ?? 'left',
      lineBreak: false,
    });
    x += larguras[i];
  });
  doc.y = y + 18;

  r.items.forEach((item, indice) => {
    // O identificador vai numa segunda linha: é o que garante ao cliente
    // que o aparelho na caixa é o do papel.
    const identificador = [item.imei && `IMEI ${item.imei}`, item.serialNumber && `Nº ${item.serialNumber}`]
      .filter(Boolean)
      .join(' · ');
    const altura = identificador ? 26 : 16;

    if (doc.y > doc.page.height - doc.page.margins.bottom - 160) doc.addPage();

    y = doc.y;
    if (indice % 2 === 1) doc.rect(x0, y, largura, altura).fill(CLARO);

    doc.fillColor('#1E293B').fontSize(9).font('Helvetica');
    const valores = [
      item.productName,
      String(item.quantity),
      dinheiro(item.unitPrice),
      dinheiro(item.unitPrice * item.quantity),
    ];

    x = x0;
    colunas.forEach((c, i) => {
      doc.text(valores[i], x + 4, y + 4, {
        width: larguras[i] - 8,
        align: c.alinhar ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += larguras[i];
    });

    if (identificador) {
      doc.fillColor(CINZA).fontSize(7).text(identificador, x0 + 4, y + 16, {
        width: larguras[0] - 8,
        lineBreak: false,
      });
    }

    doc.y = y + altura;
  });

  doc.moveDown(0.8);

  // -------------------------------------------------------------- totais
  const linhaDeTotal = (rotulo: string, valor: string, forte = false) => {
    const yl = doc.y;
    doc
      .fillColor(forte ? AZUL : CINZA)
      .fontSize(forte ? 12 : 9)
      .font(forte ? 'Helvetica-Bold' : 'Helvetica')
      .text(rotulo, x0 + largura / 2, yl, { width: largura / 4 });
    doc
      .fillColor(forte ? AZUL : '#1E293B')
      .font('Helvetica-Bold')
      .text(valor, x0 + largura * 0.75, yl, { width: largura / 4, align: 'right' });
    doc.y = yl + (forte ? 20 : 14);
  };

  doc
    .moveTo(x0 + largura / 2, doc.y + 2)
    .lineTo(x0 + largura, doc.y + 2)
    .strokeColor('#CBD5E1')
    .stroke();
  doc.y += 8;

  linhaDeTotal('TOTAL', dinheiro(r.total), true);
  doc.moveDown(0.5);

  // -------------------------------------------------------- pagamento
  doc.fillColor(CINZA).fontSize(8).font('Helvetica-Bold').text('PAGAMENTO', x0, doc.y);
  doc.moveDown(0.3);

  for (const p of r.payments) {
    const yp = doc.y;
    doc
      .fillColor('#1E293B')
      .fontSize(9)
      .font('Helvetica')
      .text(
        `${PAGAMENTO_LABEL[p.method as keyof typeof PAGAMENTO_LABEL] ?? p.method}${
          p.installments > 1 ? ` · ${p.installments}x` : ''
        }`,
        x0,
        yp,
        { width: largura / 2 },
      );
    doc.font('Helvetica-Bold').text(dinheiro(p.amount), x0, yp, { width: largura, align: 'right' });
    doc.y = yp + 14;

    // Logo abaixo da própria linha da troca: identificar o aparelho
    // entregue é o que protege as duas partes se houver discussão depois.
    if (p.method === 'TROCA' && r.troca) {
      doc
        .fillColor(CINZA)
        .fontSize(7.5)
        .font('Helvetica')
        .text(`${r.troca.modelo} · IMEI ${r.troca.imei}`, x0 + 12, doc.y - 2, { width: largura / 2 });
      doc.y += 11;
    }
  }

  if (r.notes?.trim()) {
    doc.moveDown(0.6);
    doc.fillColor(CINZA).fontSize(8).font('Helvetica-Bold').text('OBSERVAÇÃO', x0, doc.y);
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#1E293B').text(r.notes.trim(), x0, doc.y, {
      width: largura,
    });
  }

  // --------------------------------------------------------------- rodapé
  const rodape = doc.page.height - doc.page.margins.bottom - 34;
  doc
    .moveTo(x0, rodape)
    .lineTo(x0 + largura, rodape)
    .strokeColor('#E2E8F0')
    .stroke();

  // Dizer isto é obrigação de honestidade: quem recebe o papel precisa
  // saber que não está com uma nota fiscal na mão.
  doc
    .fillColor(CINZA)
    .fontSize(7.5)
    .font('Helvetica')
    .text(
      'Documento sem valor fiscal, emitido para controle interno e comprovação de compra. ' +
        'Guarde este comprovante para qualquer atendimento de garantia ou troca.',
      x0,
      rodape + 8,
      { width: largura, align: 'center' },
    );

  doc.end();
}
