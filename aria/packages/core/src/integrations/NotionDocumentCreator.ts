/**
 * Notion Document Creator
 * Bot humano que cria documentos no Notion via navegador (Playwright)
 * Sem necessidade de API keys - você já está logado!
 *
 * Usage: npm run create:notion-report
 */

import { chromium, Browser, Page } from 'playwright';

export interface ReportContent {
  title: string;
  executiveSummary: string;
  keyMetrics: string[];
  insights: string[];
  recommendations: string[];
  period: { start: Date; end: Date };
}

export class NotionDocumentCreator {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Step 1: Abrir Notion e ir para página desejada
   */
  async openNotionAndNavigate(): Promise<void> {
    console.log('🤖 Bot Humano Notion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Abrindo Notion...');

    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();

    // Ir para Notion (você já está logado)
    await this.page.goto('https://www.notion.so', {
      waitUntil: 'networkidle',
    });

    console.log('✅ Notion aberto!');
    console.log('⏳ Navegando até página de Relatórios...\n');

    // Aguardar usuário navegar até a página desejada
    await this.page.waitForTimeout(3000);
  }

  /**
   * Step 2: Criar página principal do relatório
   */
  async createReportPage(content: ReportContent): Promise<void> {
    if (!this.page) return;

    console.log(`📄 Criando página: "${content.title}"...\n`);

    // Pressionar Ctrl+N para nova página
    await this.page.keyboard.press('Control+N');
    await this.page.waitForTimeout(1000);

    // Digitar título
    await this.page.keyboard.type(content.title, { delay: 50 });
    console.log(`✓ Título digitado: "${content.title}"`);

    // Pressionar Enter para criar título
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);

    console.log('✓ Página principal criada!');
  }

  /**
   * Step 3: Adicionar seção Executive Summary
   */
  async addExecutiveSummary(summary: string): Promise<void> {
    if (!this.page) return;

    console.log('\n📝 Adicionando Executive Summary...');

    // Digitar cabeçalho
    await this.page.keyboard.type('# Executive Summary', { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);

    // Digitar conteúdo
    await this.page.keyboard.type(summary, { delay: 10 });
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.press('Enter');

    console.log('✓ Executive Summary adicionado');
  }

  /**
   * Step 4: Adicionar seção Key Metrics
   */
  async addKeyMetrics(metrics: string[]): Promise<void> {
    if (!this.page) return;

    console.log('\n📊 Adicionando Key Metrics...');

    // Cabeçalho
    await this.page.keyboard.type('# Key Metrics', { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);

    // Cada métrica como bullet point
    for (const metric of metrics) {
      await this.page.keyboard.type(`- ${metric}`, { delay: 10 });
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(100);
    }

    await this.page.keyboard.press('Enter');
    console.log(`✓ ${metrics.length} métricas adicionadas`);
  }

  /**
   * Step 5: Adicionar seção Insights
   */
  async addInsights(insights: string[]): Promise<void> {
    if (!this.page) return;

    console.log('\n💡 Adicionando Insights...');

    // Cabeçalho
    await this.page.keyboard.type('# Insights', { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);

    // Cada insight
    for (const insight of insights) {
      await this.page.keyboard.type(`- ${insight}`, { delay: 10 });
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(100);
    }

    await this.page.keyboard.press('Enter');
    console.log(`✓ ${insights.length} insights adicionados`);
  }

  /**
   * Step 6: Adicionar seção Recommendations
   */
  async addRecommendations(recommendations: string[]): Promise<void> {
    if (!this.page) return;

    console.log('\n🎯 Adicionando Recommendations...');

    // Cabeçalho
    await this.page.keyboard.type('# Recommendations', { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);

    // Cada recomendação
    for (const rec of recommendations) {
      await this.page.keyboard.type(`- ${rec}`, { delay: 10 });
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(100);
    }

    await this.page.keyboard.press('Enter');
    console.log(`✓ ${recommendations.length} recomendações adicionadas`);
  }

  /**
   * Step 7: Adicionar metadata
   */
  async addMetadata(period: { start: Date; end: Date }): Promise<void> {
    if (!this.page) return;

    console.log('\n📌 Adicionando Metadata...');

    const startDate = period.start.toLocaleDateString('pt-BR');
    const endDate = period.end.toLocaleDateString('pt-BR');

    await this.page.keyboard.type('## Período', { delay: 30 });
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.type(`${startDate} até ${endDate}`, { delay: 10 });
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.press('Enter');

    console.log(`✓ Período: ${startDate} até ${endDate}`);
  }

  /**
   * Main flow: Criar relatório completo
   */
  async createFullReport(content: ReportContent): Promise<void> {
    try {
      await this.openNotionAndNavigate();
      await this.createReportPage(content);
      await this.addExecutiveSummary(content.executiveSummary);
      await this.addKeyMetrics(content.keyMetrics);
      await this.addInsights(content.insights);
      await this.addRecommendations(content.recommendations);
      await this.addMetadata(content.period);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Relatório criado no Notion!');
      console.log('\n⏳ Navegador vai fechar em 5 segundos...');
      console.log('   (Você pode interagir enquanto isso)\n');

      await this.page?.waitForTimeout(5000);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

/**
 * CLI entrypoint
 */
if (require.main === module) {
  const mockContent: ReportContent = {
    title: '📊 Report - February 2026',
    executiveSummary:
      'Durante o período de 01/02/2026 a 28/02/2026, o time atingiu marcos significativos com 25 tarefas concluídas enquanto gerenciava 12 clientes ativos. A taxa de conclusão de 75% demonstra consistência operacional forte, com excelente engajamento em reuniões (15 de 18 agendadas completadas).',
    keyMetrics: [
      'Tasks Completed: 25 (75% taxa de conclusão)',
      'Active Clients: 12',
      'Plans Created: 4',
      'Meetings: 15/18 completed (83% conclusão)',
      'Total Meeting Hours: 28.5h',
      'Pending Tasks: 8 (25%)',
      'Tasks Overdue: 2 (25% dos pendentes)',
    ],
    insights: [
      'Task velocity remains strong with consistent completion rates',
      '25% de tarefas pendentes pode indicar restrições de capacidade',
      'High meeting engagement suggests active client collaboration',
      '4 novos planos criados indicam atividade estratégica de planejamento',
    ],
    recommendations: [
      'Focus on clearing pending tasks to improve completion rate above 80%',
      'Schedule regular check-ins with all 12 active clients to maintain momentum',
      'Document lessons learned from completed plans for future reference',
      'Consider implementing task prioritization framework to optimize workload',
    ],
    period: {
      start: new Date('2026-02-01'),
      end: new Date('2026-02-28'),
    },
  };

  const creator = new NotionDocumentCreator();

  creator
    .createFullReport(mockContent)
    .then(() => {
      console.log('✅ Processo concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro:', error);
      process.exit(1);
    });
}
