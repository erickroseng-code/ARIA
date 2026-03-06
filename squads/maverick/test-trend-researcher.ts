import { TrendResearcherAgent } from './src/trend-researcher/index';

const testPlan = `
PLANO ESTRATÉGICO:

Público-alvo: Mulher empreendedora entre 25-45 anos que quer:
- Crescer seu negócio online
- Perder peso e estar mais saudável
- Criar conteúdo relevante para suas redes sociais
- Aprender estratégias de marketing digital

Nicho: Marketing, empreendedorismo, fitness feminino

Objetivo: Posicionar como influenciadora em estratégia de vendas e transformação pessoal

Conteúdo foco: Dicas de copywriting, estratégias de marketing digital, histórias de transformação

Pontos-chave:
- Copywriting para vendas
- Marketing digital para mulheres
- Empreendedorismo feminino
- Emagrecimento com estratégia
- Conteúdo viral para redes sociais
`;

async function test() {
    try {
        console.log('🧪 Iniciando teste do TrendResearcherAgent...\n');
        
        const agent = new TrendResearcherAgent();
        const result = await agent.research(testPlan);
        
        console.log('\n════════════════════════════════════════════════════════════');
        console.log('📊 RESULTADO DO TESTE');
        console.log('════════════════════════════════════════════════════════════\n');
        
        console.log(`Keywords buscados: ${result.keywords_searched.join(', ')}`);
        console.log(`Posts analisados: ${result.posts_analyzed}`);
        console.log(`Insights encontrados: ${result.insights.length}`);
        console.log(`Formatos dominantes: ${result.dominant_formats.join(', ')}`);
        console.log(`Posts com URL: ${result.reference_posts.length}\n`);
        
        if (result.insights.length > 0) {
            console.log('✅ SUCESSO! Foram encontrados insights:\n');
            result.insights.forEach((insight, i) => {
                console.log(`${i + 1}. Hook: "${insight.hook_pattern}"`);
                console.log(`   Ângulo: ${insight.angle}`);
                console.log(`   Engajamento: ${insight.engagement_signal}\n`);
            });
        }
        
        if (result.reference_posts.length > 0) {
            console.log('\n📱 Posts de referência encontrados:');
            result.reference_posts.slice(0, 3).forEach((post, i) => {
                console.log(`\n${i + 1}. [${post.type}] ${post.likes} likes / ${post.comments} comentários`);
                console.log(`   ${post.caption_preview}...`);
                console.log(`   URL: ${post.url}`);
            });
        }
        
        console.log('\n════════════════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ Erro ao testar:', error);
    }
}

test();
