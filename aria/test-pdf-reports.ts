/**
 * Utilitário Temporário para Testar a Visualização dos Relatórios Dark Mode em PDF.
 * Roda direto com: npx tsx test-pdf-reports.ts
 */

import { PdfService, ReportLayoutData } from './apps/api/src/services/pdf/pdf.service';
import * as fs from 'fs';
import * as path from 'path';

const pdfService = new PdfService();

async function runTest() {
  console.log('🖼️  Gerando PDF Reports...');

  // --- MODELO MAVERICK ---
  const maverickData: ReportLayoutData = {
    title: 'Análise de Nicho & Roteiros (Maverick)',
    clientName: 'Erick Roseng',
    clientId: 'CXX-0822',
    reportDate: new Date().toLocaleDateString('pt-BR'),
    metrics: [
      { label: 'Nichos Analisados', value: 4 },
      { label: 'Vídeos Virais Encontrados', value: 28 },
      { label: 'Roteiros Gerados', value: 5 }
    ],
    results: [
      { name: 'Engajamento no Tema (Edição de Vídeo)', status: 'ALTO', detail: 'Taxa de visualização constante nos primeiros 3s.' },
      { name: 'Roteiro #3: Dica Contraintuitiva', status: 'CRIADO', detail: 'Hook focado na quebra de expectativa sobre o DaVinci Resolve.' },
      { name: 'Pesquisa de Hashtags', status: 'CONCLUÍDO', detail: 'Foram mapeadas as melhores hashtags B2B no segmento Dev.' }
    ],
    diagnosis: 'A análise identificou que o público está fadigado de tutoriais lentos. Os roteiros foram construídos priorizando dinamismo visual e cortes diretos. O conteúdo está alinhado com o ICP e pronto para produção.'
  };

  // --- MODELO ATLAS ---
  const atlasData: ReportLayoutData = {
    title: 'Monitoramento Semanal de Campanhas (Atlas)',
    clientName: 'Erick Roseng',
    clientId: 'CXX-0822',
    reportDate: new Date().toLocaleDateString('pt-BR'),
    metrics: [
      { label: 'Campanhas Ativas', value: 12 },
      { label: 'Orçamento Gasto', value: 'R$ 4.530,00' },
      { label: 'Leads Gerados', value: 408 }
    ],
    results: [
      { name: 'Campanha Conversão [CBO]', status: 'AQUECIDA', detail: 'O CPA atual é de R$ 11.20, superando a meta diária.' },
      { name: 'Público LAL 1%', status: 'FADIGADO', detail: 'A frequência bateu 3.4. O Atlas pausou o conjunto de anúncios.' },
      { name: 'Campanha Retargeting', status: 'OTIMIZADO', detail: 'Melhor alcance de ROI na semana (5.2x).' }
    ],
    diagnosis: 'As campanhas estão saudáveis com CPA 12% abaixo da margem de risco. A rede de Meta Ads sofreu desestabilização sexta-feira, mas o Atlas equilibrou o orçamento nas campanhas que mantiveram a performance ativa.'
  };

  // --- MODELO GRAHAM ---
  const grahamData: ReportLayoutData = {
    title: 'Diligência Técnica & Refatoração (Graham)',
    clientName: 'Erick Roseng',
    clientId: 'CXX-0822',
    reportDate: new Date().toLocaleDateString('pt-BR'),
    metrics: [
      { label: 'Commits Analisados', value: 78 },
      { label: 'Issues Resolvidas', value: 9 },
      { label: 'Ganho em Performance', value: '+34%' }
    ],
    results: [
      { name: 'Renderização do ChatService', status: 'OTIMIZADO', detail: 'Remoção de re-renders no loop infinito do React.' },
      { name: 'Implementação de Puppeteer', status: 'VERIFICADO', detail: 'Módulo injetado corretamente nas rotas sem Memory Leaks.' },
      { name: 'Vulnerabilidades de NPM', status: 'SEGURO', detail: 'Zero pacotes com known issues no audit.' }
    ],
    diagnosis: 'O Codebase encontra-se limpo e performático. O sistema principal do Express não tem mais loops de I/O em banco que estavamos enfrentando com Prisma. Cobertura de testes pode ser incrementada.'
  };

  // Geração
  console.log('⏳ Gerando MAVERICK...');
  const mavBuffer = await pdfService.generatePdfBuffer('maverick', maverickData);
  fs.writeFileSync(path.join(__dirname, 'test-maverick.pdf'), mavBuffer);

  console.log('⏳ Gerando ATLAS...');
  const atlasBuffer = await pdfService.generatePdfBuffer('atlas', atlasData);
  fs.writeFileSync(path.join(__dirname, 'test-atlas.pdf'), atlasBuffer);

  console.log('⏳ Gerando GRAHAM...');
  const grahamBuffer = await pdfService.generatePdfBuffer('graham', grahamData);
  fs.writeFileSync(path.join(__dirname, 'test-graham.pdf'), grahamBuffer);

  console.log('✅ Tudo Pronto! PDFs gerados em:', __dirname);
}

runTest().catch(console.error);
