import puppeteer from 'puppeteer';
import * as path from 'path';

export type SquadTheme = 'atlas' | 'graham';

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

    // CSS variables exatas do outfit-insights
    const tailwindConfig = `
      tailwind.config = {
        darkMode: ['class'],
        theme: {
          extend: {
            colors: {
              border: "hsl(var(--border))",
              background: "hsl(var(--background))",
              foreground: "hsl(var(--foreground))",
              primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
              secondary: { DEFAULT: "hsl(var(--secondary))" },
              muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
              card: { DEFAULT: "hsl(var(--card))" },
              destructive: { DEFAULT: "hsl(var(--destructive))" },
            },
            fontFamily: {
              sans: ['Outfit', 'sans-serif'],
            }
          }
        }
      }
    `;

    // Vamos forçar os KPIs e as tabelas usando a referência exata do outfit-insights
    // O Lucide.js renderiza os ícones no client-side após o load.
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        
        <script>${tailwindConfig}</script>
        
        <style type="text/tailwindcss">
          @layer base {
            :root {
              --background: 220 18% 8%;
              --foreground: 210 40% 98%;
              --card: 220 18% 11%;
              --primary: 142 71% 45%;
              --secondary: 220 18% 14%;
              --secondary-foreground: 215 20% 65%;
              --muted: 220 18% 14%;
              --muted-foreground: 217 12% 45%;
              --destructive: 0 63% 51%;
              --border: 217 15% 18%;

              --kpi-orange: 28 90% 55%;
              --kpi-purple: 265 80% 60%;
              --kpi-pink: 330 80% 60%;
              --kpi-cyan: 175 70% 50%;
              --kpi-magenta: 320 75% 55%;
            }
            body {
              background-color: hsl(var(--background));
              color: hsl(var(--foreground));
              /* Fix to fit nicely on A4 */
              width: 1100px;
              margin: 0 auto;
            }
          }
          .tabular-nums { font-feature-settings: 'tnum'; }
          .kpi-shadow { box-shadow: 0 0 0 1px hsla(0,0%,100%,0.05), 0px 4px 12px -4px hsla(0,0%,0%,0.3); }
          .card-border { box-shadow: 0 0 0 1px hsla(0,0%,100%,0.05), 0px 4px 12px -4px hsla(0,0%,0%,0.2); }
        </style>
      </head>
      <body class="min-h-screen bg-background antialiased px-8 py-10">

        <!-- Header -->
        <header class="pt-6 pb-2">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center pt-0.5" style="background: linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})">
              <i data-lucide="${squad === 'atlas' ? 'zap' : 'pie-chart'}" class="text-foreground w-[18px] h-[18px]"></i>
            </div>
            <div>
              <h1 class="text-lg font-semibold tracking-tight text-foreground leading-tight">
                ${theme.name} | ${data.title}
              </h1>
              <p class="text-sm text-muted-foreground">${data.clientName} (${data.clientId}) — Data: ${data.reportDate}</p>
            </div>
          </div>
        </header>

        <!-- KPI Cards Grid -->
        <section class="grid grid-cols-5 gap-4 py-8">
          ${data.metrics.map((kpi, i) => {
            const icons = ['dollar-sign', 'eye', 'mouse-pointer-click', 'trending-up', 'circle-dot'];
            const icon = icons[i % icons.length];
            const vars = ['--kpi-orange', '--kpi-purple', '--kpi-pink', '--kpi-cyan', '--kpi-magenta'];
            const accent = vars[i % vars.length];
            return `
            <div class="rounded-lg bg-card p-5 relative overflow-hidden kpi-shadow" style="box-shadow: 0 0 0 1px hsl(var(${accent}))33, 0px 4px 12px -4px hsla(0,0%,0%,0.3);">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style="background-color: hsl(var(${accent}))18">
                <i data-lucide="${icon}" class="w-[18px] h-[18px]" style="color: hsl(var(${accent}))"></i>
              </div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">${kpi.label}</p>
              <p class="text-2xl font-semibold tracking-tight tabular-nums text-foreground leading-none">${kpi.value.toString()}</p>
            </div>
            `;
          }).join('')}
        </section>

        <!-- Dynamic Section depending if there is diagnosis or it's just Atlas generic -->
        <section class="py-6">
          <div class="rounded-lg bg-card card-border">
             <div class="p-6 pb-4">
                <h2 class="text-xl font-medium uppercase tracking-tight text-muted-foreground">Resultados Analíticos</h2>
             </div>
             <div class="overflow-x-auto">
               <table class="w-full text-sm">
                 <thead>
                   <tr class="border-b border-border">
                     <th class="text-left font-medium text-muted-foreground px-6 py-3">Métrica / Tarefa</th>
                     <th class="text-left font-medium text-muted-foreground px-6 py-3">Status</th>
                     <th class="text-left font-medium text-muted-foreground px-6 py-3">Detalhe</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${data.results.map(r => `
                     <tr class="border-b border-border/50 transition-colors duration-150 hover:bg-[hsla(0,0%,100%,0.03)]">
                       <td class="px-6 py-4 font-medium text-foreground">${r.name}</td>
                       <td class="px-6 py-4">
                          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium tracking-wide ${r.status.toLowerCase().includes('ativo') || r.status.toLowerCase().includes('conclu') ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}">${r.status}</span>
                       </td>
                       <td class="px-6 py-4 text-secondary-foreground leading-relaxed">${r.detail}</td>
                     </tr>
                   `).join('')}
                 </tbody>
               </table>
             </div>
          </div>
        </section>

        <!-- Diagnosis Box -->
        <section class="py-6">
          <div class="rounded-lg bg-card card-border p-6 border-l-4" style="border-left-color: ${theme.primaryColor}">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-foreground mb-3 flex items-center gap-2">
              <i data-lucide="brain-circuit" class="w-[16px] h-[16px]"></i> Diagnóstico Final da Inteligência
            </h2>
            <p class="text-secondary-foreground leading-relaxed font-light text-[15px] whitespace-pre-wrap">${data.diagnosis}</p>
          </div>
        </section>

        <script>
          // Renderiza os ícones
          lucide.createIcons();
        </script>
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
      // Adiciona um pequeno delay para garantir que os fontes (Outfit) e o Lucide Icons / Tailwind CDN carreguem e renderizem
      await new Promise(r => setTimeout(r, 1500)); 

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
