/**
 * Script de teste manual do InstagramScraper
 *
 * Uso (1 keyword):
 *   npx ts-node src/tools/test-scraper.ts fitness
 *   npx ts-node src/tools/test-scraper.ts empreendedorismo 50000 8 45
 *
 * Uso (múltiplas keywords — separadas por vírgula):
 *   npx ts-node src/tools/test-scraper.ts "educação financeira,como sair das dívidas,independência financeira"
 *   npx ts-node src/tools/test-scraper.ts "copywriting,vendas online,como escrever para vender" 30000 6 45
 *
 * Parâmetros:
 *   [1] keywords   — keyword única ou lista separada por vírgula
 *   [2] minViews   — mínimo de views (padrão: 50000)
 *   [3] maxPosts   — máximo de posts por keyword (padrão: 8)
 *   [4] maxAgeDays — máximo de dias desde a publicação (padrão: 45)
 *   [5] strategy   — 'click' (padrão) ou 'hover'
 */

import { InstagramScraper } from './instagramScraper';

async function main() {
  const raw        = process.argv[2] || 'fitness';
  const minViews   = parseInt(process.argv[3] || '50000');
  const maxPosts   = parseInt(process.argv[4] || '8');
  const maxAgeDays = parseInt(process.argv[5] || '45');
  const strategy   = (process.argv[6] || 'click') as 'click' | 'hover';

  // Suporta múltiplas keywords separadas por vírgula
  const keywords = raw.split(',').map(k => k.trim()).filter(Boolean);

  console.log('\n' + '='.repeat(60));
  if (keywords.length === 1) {
    console.log(`🔍 Keyword  : #${keywords[0]}`);
  } else {
    console.log(`🔍 Keywords : ${keywords.map((k, i) => `[${i + 1}] "${k}"`).join(' | ')}`);
  }
  console.log(`📊 Min views: ${minViews.toLocaleString('pt-BR')}`);
  console.log(`📦 Max posts: ${maxPosts} por keyword`);
  console.log(`📅 Max age  : ${maxAgeDays} dias`);
  console.log(`⚙️  Strategy : ${strategy}`);
  console.log('='.repeat(60) + '\n');

  const scraper = new InstagramScraper();

  let results;
  if (keywords.length === 1) {
    results = await scraper.scrapeViralReels(keywords[0], minViews, maxPosts, maxAgeDays, strategy);
  } else {
    results = await scraper.scrapeMultipleHashtags(keywords, minViews, maxPosts, maxAgeDays, strategy);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ RESULTADO FINAL — ${results.length} posts virais\n`);

  results.forEach((post, i) => {
    const views   = post.views != null ? post.views.toLocaleString('pt-BR') + ' views' : 'views n/d';
    const likes   = post.likes != null ? post.likes.toLocaleString('pt-BR') + ' curtidas' : '';
    const age     = post.ageDays != null ? `${post.ageDays}d atrás` : '';
    const caption = post.caption?.slice(0, 80) || '(sem legenda)';

    console.log(`[${i + 1}] ${post.type} | ${views} ${likes ? '| ' + likes : ''} | ${age}`);
    console.log(`    Score: ${post.viral_score} | ${post.url}`);
    console.log(`    "${caption}"`);
    console.log();
  });

  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
