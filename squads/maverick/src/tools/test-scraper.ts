/**
 * Script de teste manual do InstagramScraper
 *
 * Uso:
 *   npx ts-node src/tools/test-scraper.ts [keyword] [minViews] [maxPosts] [maxAgeDays]
 *
 * Exemplos:
 *   npx ts-node src/tools/test-scraper.ts fitness
 *   npx ts-node src/tools/test-scraper.ts empreendedorismo 50000 8 30
 */

import { InstagramScraper } from './instagramScraper';

async function main() {
    const keyword = process.argv[2] || 'fitness';
    const minViews = parseInt(process.argv[3] || '50000');
    const maxPosts = parseInt(process.argv[4] || '8');
    const maxAgeDays = parseInt(process.argv[5] || '45');

    console.log('\n' + '='.repeat(60));
    console.log(`🔍 Keyword  : #${keyword}`);
    console.log(`📊 Min views: ${minViews.toLocaleString('pt-BR')}`);
    console.log(`📦 Max posts: ${maxPosts}`);
    console.log(`📅 Max age  : ${maxAgeDays} dias`);
    console.log('='.repeat(60) + '\n');

    const scraper = new InstagramScraper();

    const results = await scraper.scrapeViralReels(keyword, minViews, maxPosts, maxAgeDays);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ RESULTADO FINAL — ${results.length} posts virais\n`);

    results.forEach((post, i) => {
        const views = post.views != null ? post.views.toLocaleString('pt-BR') + ' views' : 'views n/d';
        const likes = post.likes != null ? post.likes.toLocaleString('pt-BR') + ' curtidas' : '';
        const age = post.ageDays != null ? `${post.ageDays}d atrás` : '';
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
