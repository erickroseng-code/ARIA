import puppeteer from 'puppeteer';
import * as path from 'path';

export type SquadTheme = 'maverick' | 'atlas' | 'graham';

export interface ReportLayoutData {
  title: string;
  clientName: string;
  clientId: string;
  reportDate: string;
  metrics: { label: string; value: string | number }[]; // Colunas do topo
  results: { name: string; status: string; detail: string }[]; // Tabela minimalista
  diagnosis: string;
}

const THEMES: Record<SquadTheme, { name: string; primaryColor: string; accentColor: string }> = {
  maverick: {
    name: 'MAVERICK',
    primaryColor: '#8a2be2', // Roxo vibrante (Complementar à criatividade / Conteúdo)
    accentColor: '#9b4dca',
  },
  atlas: {
    name: 'ATLAS',
    primaryColor: '#00f2fe', // Azul Ciano Bright (Complementar à tecnologia/Ads/Performance)
    accentColor: '#4facfe',
  },
  graham: {
    name: 'GRAHAM',
    primaryColor: '#4ade80', // Verde Menta (Complementar a Finanças/Engenharia/Lógica pura)
    accentColor: '#22c55e',
  }
};

export class PdfService {
  /**
   * Converte a payload de dados num HTML string estiloso com Dark Mode e CSS de alta precisão.
   */
  private generateHtml(squad: SquadTheme, data: ReportLayoutData): string {
    const theme = THEMES[squad];

    // CSS minimalista, contrastante: Fundo puro (0,0,0), Texto #fff e variações de Dark Gray
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

          :root {
            --bg-color: #000000;
            --text-color: #ffffff;
            --text-muted: #888888;
            --border-color: #333333;
            --squad-primary: ${theme.primaryColor};
            --squad-accent: ${theme.accentColor};
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 50px 60px;
            font-size: 14px;
            line-height: 1.6;
          }

          /* --- HIERARQUIA & HEADER --- */
          .header {
            margin-bottom: 50px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 20px;
          }

          .report-title {
            font-size: 28px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--squad-primary);
            margin-bottom: 8px;
          }

          .report-subtitle {
            font-weight: 300;
            color: var(--text-muted);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          /* --- TOP COLUMNS (Informações do Cliente) --- */
          .info-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 60px;
          }

          .info-col {
            flex: 1;
            padding-right: 20px;
          }

          .info-label {
            font-weight: 600;
            color: var(--squad-primary);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }

          .info-value {
            font-weight: 300;
            font-size: 16px;
          }

          /* --- TABLE RESULTADOS --- */
          .section-title {
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 20px;
            color: var(--text-muted);
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 60px; /* Grande respiro */
          }

          th {
            text-align: left;
            padding-bottom: 12px;
            font-weight: 400;
            font-size: 12px;
            color: var(--text-muted);
            border-bottom: 1px solid var(--border-color);
          }

          td {
            padding: 16px 0;
            font-weight: 300;
            border-bottom: 1px solid #1a1a1a;
          }

          .highlight {
            color: var(--squad-primary);
            font-weight: 600;
          }

          /* --- DIAGNÓSTICO FINAL --- */
          .diagnosis-box {
            background-color: #0a0a0a;
            border-left: 3px solid var(--squad-primary);
            padding: 24px;
            margin-top: 40px;
          }

          .diagnosis-text {
            font-weight: 300;
            color: #dddddd;
            white-space: pre-wrap;
          }

          /* --- FOOTER --- */
          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 10px;
            color: var(--text-muted);
            font-weight: 300;
            letter-spacing: 1px;
            border-top: 1px solid var(--border-color);
            padding-top: 20px;
          }
        </style>
      </head>
      <body>

        <div class="header">
          <div class="report-title">RELATÓRIO ${theme.name}</div>
          <div class="report-subtitle">${data.title}</div>
        </div>

        <div class="info-grid">
          <div class="info-col">
            <div class="info-label">Cliente</div>
            <div class="info-value">${data.clientName}</div>
          </div>
          <div class="info-col">
            <div class="info-label">ID do Cliente</div>
            <div class="info-value">${data.clientId}</div>
          </div>
          <div class="info-col">
            <div class="info-label">Data</div>
            <div class="info-value">${data.reportDate}</div>
          </div>
        </div>

        <div class="info-grid">
          ${data.metrics.map(m => `
            <div class="info-col">
              <div class="info-label">${m.label}</div>
              <div class="info-value">${m.value}</div>
            </div>
          `).join('')}
        </div>

        <div class="section-title">Resultados Consolidados</div>
        <table>
          <thead>
            <tr>
              <th>MÉTRICA / TAREFA</th>
              <th>STATUS</th>
              <th>DETALHE</th>
            </tr>
          </thead>
          <tbody>
            ${data.results.map(r => `
              <tr>
                <td style="width: 40%">${r.name}</td>
                <td style="width: 20%" class="highlight">${r.status}</td>
                <td style="width: 40%">${r.detail}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="section-title">Diagnóstico Final</div>
        <div class="diagnosis-box">
          <div class="diagnosis-text">${data.diagnosis}</div>
        </div>

        <div class="footer">
          Gerado automaticamente por ARIA Intelligence System — Squad ${theme.name}
        </div>

      </body>
      </html>
    `;
  }

  /**
   * Recebe os dados, aplica o HTML e dispara o headless browser para capturar o PDF
   * e retorna o Buffer bruto para envio via Express/Fastify/Telegram.
   */
  async generatePdfBuffer(squad: SquadTheme, data: ReportLayoutData): Promise<Buffer> {
    const htmlContent = this.generateHtml(squad, data);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Carrega o HTML cru na página
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // O @types/puppeteer para pdf é Uint8Array, que pode ser transformado em Buffer no node >= 18
      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true, // Imprime cores de fundo (Dark Mode) - CRITICAL!
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px'
        }
      });

      return Buffer.from(pdfUint8Array);
    } finally {
      await browser.close();
    }
  }
}
