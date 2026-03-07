import type { ReportData } from './report-generator';

/**
 * Gera um PDF do relatório financeiro usando pdfkit.
 * Retorna um Buffer com o conteúdo do PDF.
 */
export async function generateReportPdf(report: ReportData): Promise<Buffer> {
  // Dynamic import para evitar erro se pdfkit não estiver instalado
  let PDFDocument: any;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw new Error('pdfkit não instalado. Execute: npm install pdfkit --workspace=api');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const scoreEmoji = (report.netBalance >= 0) ? '🟢' : '🔴';

    // ─── PÁGINA 1: CAPA ───────────────────────────────────────────────────────
    doc
      .fontSize(24).font('Helvetica-Bold')
      .text('Relatório Financeiro Pessoal', { align: 'center' })
      .moveDown(0.5)
      .fontSize(16).font('Helvetica')
      .text(report.monthLabel, { align: 'center' })
      .moveDown(2);

    doc
      .fontSize(14).font('Helvetica-Bold')
      .text('Resumo Executivo', { align: 'center' })
      .moveDown(1);

    // Quadro de resumo
    const summaryData = [
      ['Total Receitas', fmt(report.totalIncome)],
      ['Total Despesas', fmt(report.totalExpenses)],
      ['Saldo Líquido', fmt(report.netBalance)],
    ];

    for (const [label, value] of summaryData) {
      doc.fontSize(12).font('Helvetica-Bold').text(label + ':', { continued: true });
      doc.font('Helvetica').text(' ' + value);
    }

    doc.moveDown(1);

    if (report.alerts.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Alertas de Orçamento:').moveDown(0.3);
      for (const alert of report.alerts) {
        doc.fontSize(10).font('Helvetica')
          .fillColor(alert.level === 'critical' ? '#d32f2f' : '#f57c00')
          .text(`• ${alert.message}`)
          .fillColor('black');
      }
      doc.moveDown(1);
    }

    // ─── PÁGINA 2: ORÇAMENTO VS REALIZADO ────────────────────────────────────
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Orçamento vs. Realizado').moveDown(1);

    // Cabeçalho da tabela
    const colX = [50, 200, 330, 430, 490];
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Categoria', colX[0], doc.y, { width: 140 });
    doc.text('Orçamento', colX[1], doc.y - doc.currentLineHeight(), { width: 120 });
    doc.text('Gasto', colX[2], doc.y - doc.currentLineHeight(), { width: 100 });
    doc.text('%', colX[3], doc.y - doc.currentLineHeight(), { width: 60 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    for (const item of report.byCategory) {
      const pct = item.percentage;
      const color = pct >= 100 ? '#d32f2f' : pct >= 80 ? '#f57c00' : '#388e3c';
      const y = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('black');
      doc.text(item.category, colX[0], y, { width: 140 });
      doc.text(fmt(item.budgeted), colX[1], y, { width: 120 });
      doc.fillColor(color).text(fmt(item.spent), colX[2], y, { width: 100 });
      doc.text(`${pct}%`, colX[3], y, { width: 60 });
      doc.fillColor('black').moveDown(0.4);
    }

    // ─── PÁGINA 3: EXTRATO DE TRANSAÇÕES ─────────────────────────────────────
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Extrato de Transações').moveDown(1);

    const recentTx = report.transactions.slice(-40);
    doc.fontSize(9).font('Helvetica-Bold');
    const txCols = [50, 120, 200, 310, 430];
    doc.text('Data', txCols[0], doc.y, { width: 65 });
    doc.text('Tipo', txCols[1], doc.y - doc.currentLineHeight(), { width: 75 });
    doc.text('Categoria', txCols[2], doc.y - doc.currentLineHeight(), { width: 105 });
    doc.text('Descrição', txCols[3], doc.y - doc.currentLineHeight(), { width: 115 });
    doc.text('Valor', txCols[4], doc.y - doc.currentLineHeight(), { width: 80 });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    for (const tx of recentTx) {
      if (doc.y > 720) { doc.addPage(); doc.moveDown(1); }
      const y = doc.y;
      const color = tx.type === 'receita' ? '#388e3c' : '#424242';
      doc.fontSize(8).font('Helvetica').fillColor('black');
      doc.text(tx.date, txCols[0], y, { width: 65 });
      doc.fillColor(color).text(tx.type, txCols[1], y, { width: 75 });
      doc.fillColor('black').text(tx.category, txCols[2], y, { width: 105 });
      doc.text(tx.description.slice(0, 25), txCols[3], y, { width: 115 });
      doc.fillColor(color).text(fmt(tx.amount), txCols[4], y, { width: 80 });
      doc.fillColor('black').moveDown(0.35);
    }

    // ─── PÁGINA 4: ANÁLISE E RECOMENDAÇÕES ───────────────────────────────────
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Análise e Recomendações').moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Análise do Mês:').moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(report.aiAnalysis).moveDown(1.5);

    if (report.topRecommendations.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Top 3 Ações para o Próximo Mês:').moveDown(0.5);
      report.topRecommendations.forEach((rec, i) => {
        doc.fontSize(10).font('Helvetica').text(`${i + 1}. ${rec}`).moveDown(0.4);
      });
    }

    // Rodapé em todas as páginas
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(8).font('Helvetica').fillColor('#999999')
        .text(
          `Gerado por ARIA • ${new Date().toLocaleDateString('pt-BR')} • Análise baseada nos dados informados`,
          50, 770, { align: 'center', width: 495 },
        );
    }

    doc.end();
  });
}
