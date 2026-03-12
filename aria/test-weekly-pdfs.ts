/**
 * Gera PDFs com os dados exatos que o Atlas Weekly e o Maverick Weekly irão enviar.
 */
import { PdfService } from './apps/api/src/services/pdf/pdf.service';
import * as fs from 'fs';
import * as path from 'path';

const pdfService = new PdfService();

async function main() {
  console.log('🖼️  Gerando PDFs dos relatórios semanais...\n');

  // ── 1. ATLAS WEEKLY ──────────────────────────────────────────────────────────
  console.log('⏳ Gerando ATLAS WEEKLY...');
  const atlasBuffer = await pdfService.generatePdfBuffer('atlas', {
    title: 'Análise de Performance de Anúncios (Atlas)',
    clientName: 'erick',
    clientId: 'act_2891047362',
    reportDate: '11/03/2026',
    metrics: [
      { label: 'Gasto Total',  value: 'R$ 4.827,14' },
      { label: 'Impressões',   value: '187.432' },
      { label: 'Cliques',      value: '4.921' },
      { label: 'CTR Médio',    value: '2,63%' },
      { label: 'CPC Médio',    value: 'R$ 0,98' },
      { label: 'ROAS Médio',   value: '4,70x' },
    ],
    results: [
      { name: 'Retargeting Quente',   status: 'ATIVO',   detail: 'Campanha em veiculação' },
      { name: 'Interesse Fitness',    status: 'ATIVO',   detail: 'Campanha em veiculação' },
      { name: 'Lookalike 1%',         status: 'ATIVO',   detail: 'Campanha em veiculação' },
      { name: 'Campanha Verão',       status: 'PAUSADA', detail: 'Suspensa no período' },
      { name: 'Público Broad',        status: 'PAUSADA', detail: 'Suspensa no período' },
    ],
    diagnosis: `Período: 04/03 → 11/03/2026

CTR: 2,63% ✅   |   CPC: R$ 0,98 ✅   |   ROAS: 4,70x ✅

3 de 5 campanhas ativas no período.

Pausadas: Campanha Verão, Público Broad

Veja o resumo diário do Atlas para detalhes das ações executadas.`,
  });
  fs.writeFileSync(path.resolve(__dirname, 'preview-atlas-weekly.pdf'), atlasBuffer);
  console.log('✅ preview-atlas-weekly.pdf\n');

  // ── 2. MAVERICK WEEKLY ───────────────────────────────────────────────────────
  console.log('⏳ Gerando MAVERICK WEEKLY...');
  const maverickBuffer = await pdfService.generatePdfBuffer('maverick', {
    title: 'Análise de Nicho & Roteiros (Maverick)',
    clientName: '@seuperfil',
    clientId: 'MAV-0311',
    reportDate: '11/03/2026',
    metrics: [
      { label: 'Seguidores',    value: '125.400' },
      { label: 'Posts',         value: '87' },
      { label: 'Score Geral',   value: '74/100' },
      { label: 'Engajamento',   value: '2,34%' },
    ],
    results: [
      { name: 'Clareza de nicho subiu +8pts',        status: 'FORTE',   detail: 'Posts mais focados no público certo' },
      { name: 'Bio reformulada com proposta de valor', status: 'FORTE',  detail: 'Link ativo com CTA claro' },
      { name: 'CTAs diretos geraram 3x mais DMs',     status: 'FORTE',  detail: '2 posts com resultado acima da média' },
      { name: 'Hooks genéricos nos últimos 3 posts',  status: 'ATENÇÃO', detail: 'Não interrompem o scroll' },
      { name: 'Frequência caiu para 3 posts/semana',  status: 'ATENÇÃO', detail: 'Meta: 5 posts/semana' },
      { name: '"Por que você não emagrece fazendo tudo certo..."', status: 'VIRAL',  detail: 'Dissonância no hook — ativa curiosidade (Cialdini)' },
      { name: '"Dicas para melhorar sua alimentação..."',          status: 'FALHOU', detail: 'Hook genérico sem tensão — não gera scroll-stop' },
    ],
    diagnosis: `Conceito-chave: Hook-Story-Offer

O perfil tem boa clareza de nicho e bio bem estruturada, mas a maioria dos posts falha no hook — os primeiros 2 segundos não geram retenção suficiente para completar o conteúdo.

Próximos passos:
1. Reescrever hooks com PAS (Problema → Agitação → Solução) nos próximos 3 posts
2. Voltar para 5 posts/semana — consistência é o principal driver de alcance
3. Priorizar Carrossel sobre Reels por 2 semanas — seu público responde melhor

ICP: Mulheres 28–42, trabalham fora, buscam emagrecimento sustentável`,
  });
  fs.writeFileSync(path.resolve(__dirname, 'preview-maverick-weekly.pdf'), maverickBuffer);
  console.log('✅ preview-maverick-weekly.pdf\n');

  console.log('🎉 Pronto! Abra os arquivos na pasta /aria:');
  console.log('   aria/preview-atlas-weekly.pdf');
  console.log('   aria/preview-maverick-weekly.pdf');
}

main().catch(console.error);
