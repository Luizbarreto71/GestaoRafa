import ExcelJS from 'exceljs';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

/** Motor genérico de exportação: os relatórios só descrevem colunas e linhas. */

export interface Coluna {
  header: string;
  key: string;
  /** Peso da largura, usado no PDF e no Excel. */
  width?: number;
  align?: 'left' | 'right' | 'center';
  /** Formata o valor para exibição. */
  format?: (valor: unknown) => string | number;
}

export interface Relatorio {
  title: string;
  subtitle?: string;
  columns: Coluna[];
  rows: Record<string, unknown>[];
  summary?: { label: string; value: string }[];
}

const AZUL = '#0F172A';

const valorDaCelula = (c: Coluna, linha: Record<string, unknown>): string | number => {
  const bruto = linha[c.key];
  if (c.format) return c.format(bruto);
  if (bruto === null || bruto === undefined) return '';
  if (bruto instanceof Date) return bruto.toLocaleDateString('pt-BR');
  return typeof bruto === 'number' ? bruto : String(bruto);
};

function nomeDoArquivo(titulo: string, ext: string): string {
  const data = new Date().toISOString().slice(0, 10);
  const apelido = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${apelido}-${data}.${ext}`;
}

// --------------------------------------------------------------------- CSV

function enviarCsv(res: Response, r: Relatorio): void {
  const escapar = (v: string | number) => {
    const texto = String(v ?? '');
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const linhas = [r.columns.map((c) => escapar(c.header)).join(';')];
  for (const linha of r.rows) {
    linhas.push(r.columns.map((c) => escapar(valorDaCelula(c, linha))).join(';'));
  }

  if (r.summary?.length) {
    linhas.push('');
    r.summary.forEach((s) => linhas.push(`${escapar(s.label)};${escapar(s.value)}`));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivo(r.title, 'csv')}"`);
  // O BOM faz o Excel abrir a acentuação corretamente.
  res.send(`\uFEFF${linhas.join("\n")}`);
}

// ------------------------------------------------------------------- Excel

async function enviarExcel(res: Response, r: Relatorio): Promise<void> {
  const planilha = new ExcelJS.Workbook();
  planilha.creator = 'Controle Rafa Multimarcas';
  planilha.created = new Date();

  const aba = planilha.addWorksheet(r.title.slice(0, 30) || 'Relatório', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  aba.columns = r.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(14, c.header.length + 4),
  }));

  aba.getRow(1).eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    celula.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  aba.getRow(1).height = 22;

  for (const linha of r.rows) {
    aba.addRow(Object.fromEntries(r.columns.map((c) => [c.key, valorDaCelula(c, linha)])));
  }

  // Zebra nas linhas, para leitura mais fácil.
  aba.eachRow((linha, indice) => {
    if (indice === 1) return;
    linha.eachCell((celula) => {
      celula.alignment = { vertical: 'middle' };
      if (indice % 2 === 0) {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
  });

  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: r.columns.length } };

  if (r.summary?.length) {
    aba.addRow([]);
    r.summary.forEach((s) => {
      aba.addRow([s.label, s.value]).getCell(1).font = { bold: true };
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivo(r.title, 'xlsx')}"`);

  await planilha.xlsx.write(res);
  res.end();
}

// --------------------------------------------------------------------- PDF

function enviarPdf(res: Response, r: Relatorio): void {
  const doc = new PDFDocument({ margin: 32, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivo(r.title, 'pdf')}"`);
  doc.pipe(res);

  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x0 = doc.page.margins.left;

  doc.rect(0, 0, doc.page.width, 62).fill(AZUL);
  doc.fillColor('#FFFFFF').fontSize(17).font('Helvetica-Bold').text('Rafa Multimarcas', x0, 16);
  doc.fontSize(10).font('Helvetica').text(r.title, x0, 38);
  doc.fontSize(8).text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, x0, 38, {
    width: largura,
    align: 'right',
  });

  doc.fillColor(AZUL).y = 78;

  if (r.subtitle) {
    doc.fontSize(9).fillColor('#475569').text(r.subtitle, x0, doc.y);
    doc.moveDown(0.5);
  }

  const peso = r.columns.reduce((s, c) => s + (c.width ?? 16), 0);
  const larguras = r.columns.map((c) => ((c.width ?? 16) / peso) * largura);

  const cabecalho = () => {
    const y = doc.y;
    doc.rect(x0, y, largura, 20).fill('#E2E8F0');
    doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold');
    let x = x0;
    r.columns.forEach((c, i) => {
      doc.text(c.header.toUpperCase(), x + 4, y + 6, {
        width: larguras[i] - 8,
        align: c.align ?? 'left',
        lineBreak: false,
      });
      x += larguras[i];
    });
    doc.y = y + 20;
  };

  cabecalho();
  doc.font('Helvetica').fontSize(8);

  r.rows.forEach((linha, indice) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      cabecalho();
      doc.font('Helvetica').fontSize(8);
    }

    const y = doc.y;
    if (indice % 2 === 1) doc.rect(x0, y, largura, 16).fill('#F8FAFC');

    doc.fillColor('#1E293B');
    let x = x0;
    r.columns.forEach((c, i) => {
      doc.text(String(valorDaCelula(c, linha) ?? ''), x + 4, y + 4, {
        width: larguras[i] - 8,
        align: c.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += larguras[i];
    });

    doc.y = y + 16;
  });

  if (r.summary?.length) {
    doc.moveDown(1);
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(AZUL).text('Resumo', x0, doc.y);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    r.summary.forEach((s) => {
      doc.text(`${s.label}: ${s.value}`, x0, doc.y);
      doc.moveDown(0.2);
    });
  }

  doc.end();
}

export async function exportar(res: Response, formato: string, r: Relatorio): Promise<void> {
  if (formato === 'pdf') return enviarPdf(res, r);
  if (formato === 'csv') return enviarCsv(res, r);
  if (formato === 'xlsx' || formato === 'excel') return enviarExcel(res, r);
  res.json(r);
}

// ------------------------------------------------------------- Formatadores

export const reais = (v: unknown) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Número com vírgula decimal, sem o "R$" — melhor para somar na planilha. */
export const decimal = (v: unknown) => Number(v ?? 0).toFixed(2).replace('.', ',');
