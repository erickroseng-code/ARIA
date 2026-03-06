import { TrendResearcherAgent } from './src/trend-researcher/index';

const testPlan = `
ESTRATÉGIA DE CONTEÚDO

**ICP (Ideal Customer Profile):**
Mulher empreendedora de 25-45 anos que quer crescer online com marketing de conteúdo, especializada em copywriting e redes sociais.

**Objetivos:**
- Aumentar autoridade no nicho de copywriting
- Gerar leads qualificados para consultoria
- Montar comunidade de copywriters iniciantes

**Histórico:**
Perfil cresceu de 5k para 45k followers em 8 meses com conteúdo educativo sobre copywriting e hooks virais.
`;

async function runDebugTest() {
    try {
        console.log('📊 [DEBUG] Iniciando teste diagnostico do TrendResearcherAgent...\n');

        const researcher = new TrendResearcherAgent();

        // PASSO 1: Verificar extração de keywords
        console.log('📍 PASSO 1: Extrair keywords (deve ser EXATAMENTE 3 simples)\n');
        const keywords = await researcher['extractKeywords'](testPlan);

        console.log(`✅ Keywords extraídos: ${keywords.map(k => `"${k}"`).join(', ')}`);
        console.log(`✓ Quantidade: ${keywords.length} (esperado: 3)\n`);

        if (keywords.length !== 3) {
            console.error('❌ ERRO: Número de keywords diferente de 3!');
            process.exit(1);
        }

        // PASSO 2: Fazer a busca
        console.log('📍 PASSO 2: Buscar posts (verificar tipos de post)\n');
        const posts = await researcher['fetchTopPosts'](keywords, 15);

        console.log(`✅ Posts encontrados no total: ${posts.length}`);

        if (posts.length === 0) {
            console.error('❌ ERRO: Nenhum post encontrado!');
            process.exit(1);
        }

        // Analisar tipos de post
        const typeBreakdown = posts.reduce((acc: Record<string, number>, p: any) => {
            const type = p.type || 'UNKNOWN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        console.log('\n📊 Breakdown de tipos de post:');
        for (const [type, count] of Object.entries(typeBreakdown)) {
            console.log(`  ${type}: ${count} posts`);
        }

        // Verificar campos
        console.log('\n📋 Estrutura do primeiro post:');
        const first = posts[0];
        console.log(`  type: "${first.type}"`);
        console.log(`  likesCount: ${first.likesCount}`);
        console.log(`  commentsCount: ${first.commentsCount}`);
        console.log(`  videoPlayCount: ${first.videoPlayCount}`);
        console.log(`  videoViewCount: ${first.videoViewCount}`);
        console.log(`  images: ${first.images ? `${first.images.length} imagens` : 'undefined'}`);

        // PASSO 3: Viral scoring
        console.log('\n📍 PASSO 3: Filtro de viralidade (verificar se Reels sobrevivem)\n');
        const filtered = await researcher['filterAndSortByVirality'](posts);

        console.log(`✅ Posts após filtro viral: ${filtered.length}/${posts.length}`);

        if (filtered.length === 0) {
            console.error('❌ ERRO: Filtro viral removeu TODOS os posts!');
            console.log('\n🔍 Debug: Analisando scores do primeiro post...');
            const test = posts[0];
            const likes = test.likesCount || 0;
            const comments = test.commentsCount || 0;
            const views = test.videoPlayCount || test.videoViewCount || 0;
            const engagement = likes + comments;

            console.log(`  Likes: ${likes}, Comments: ${comments}, Views: ${views}`);
            console.log(`  Engagement base: ${engagement}`);

            if (engagement === 0) {
                console.log('  ⚠️ Post tem 0 engagement — será filtrado');
            }
        }

        // Tipos após filtro
        const filteredTypeBreakdown = filtered.reduce((acc: Record<string, number>, p: any) => {
            const type = p.type || 'UNKNOWN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        console.log('\n📊 Tipos de post após filtro viral:');
        for (const [type, count] of Object.entries(filteredTypeBreakdown)) {
            console.log(`  ${type}: ${count} posts`);
        }

        // PASSO 4: Análise de padrões
        console.log('\n📍 PASSO 4: Análise de padrões (extrair insights)\n');
        const result = await researcher.research(testPlan);

        console.log(`✅ Análise concluída!`);
        console.log(`  Keywords: ${result.keywords_searched.join(', ')}`);
        console.log(`  Posts analisados: ${result.posts_analyzed}`);
        console.log(`  Insights encontrados: ${result.insights.length}`);
        console.log(`  Posts com URLs: ${result.reference_posts.length}`);

        if (result.insights.length > 0) {
            console.log('\n🎯 Padrões de hooks identificados:');
            result.insights.slice(0, 3).forEach((ins, i) => {
                console.log(`  ${i + 1}. ${ins.hook_pattern} (${ins.format})`);
            });
        }

        if (result.reference_posts.length === 0) {
            console.error('\n❌ AVISO: Nenhuma URL foi extraída dos posts!');
        } else {
            console.log('\n✅ Amostra de posts com URLs:');
            result.reference_posts.slice(0, 2).forEach((post, i) => {
                console.log(`  ${i + 1}. ${post.type}: ${post.likes} likes / ${post.comments} comments`);
                console.log(`     URL: ${post.url.substring(0, 60)}...`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ TESTE DIAGNOSTICO COMPLETO');
        console.log('='.repeat(80));

    } catch (error: any) {
        console.error(`\n❌ ERRO: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

runDebugTest();
