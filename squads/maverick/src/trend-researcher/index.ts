import { ApifyClient } from 'apify-client';
import { LLMService } from '../core/llm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const config = dotenv.parse(fs.readFileSync(envPath));
    for (const k in config) process.env[k] = config[k];
}

export interface TrendInsight {
    hook_pattern: string;       // tipo de hook (ex: "Dissonância Absoluta", "Pergunta Provocadora")
    angle: string;              // ângulo de conteúdo que está performando
    engagement_signal: string;  // princípio comportamental por trás do engajamento
    example_hook: string;       // primeiras linhas do caption que funcionam como hook
    format: string;             // "Reels" | "Carrossel" | "Imagem"
}

export interface TrendReferencePost {
    url: string;                // link direto para o post no Instagram
    caption_preview: string;    // primeiros 120 chars do caption
    likes: number;
    comments: number;
    views?: number;
    type: string;               // "Reels" | "Carrossel" | "Imagem"
}

export interface TrendResearch {
    keywords_searched: string[];
    posts_analyzed: number;
    insights: TrendInsight[];
    dominant_formats: string[];
    niche_summary: string;
    reference_posts: TrendReferencePost[];  // posts reais usados como referência
}

const INSIGHTS_SCHEMA = `{
  "insights": [
    {
      "hook_pattern": "nome do padrão de hook identificado (ex: Dissonância Absoluta, Pergunta Provocadora, Revelação de Bastidores, Inimigo Oculto)",
      "angle": "ângulo de conteúdo que está performando (ex: 'erros comuns do iniciante', 'comparativo antes/depois', 'revelação contrasintuitiva')",
      "engagement_signal": "princípio comportamental que explica o alto engajamento — cite conceito pelo nome se possível",
      "example_hook": "as primeiras 1-2 frases do caption que funcionam como hook — verbatim do post",
      "format": "Reels|Carrossel|Imagem"
    }
  ],
  "dominant_formats": ["formato1", "formato2"],
  "niche_summary": "2-3 frases diretas: o que está dominando neste nicho agora — temas, tons e abordagens dos conteúdos mais virais"
}`;

export class TrendResearcherAgent {
    private client: ApifyClient;
    private llm: LLMService;

    constructor() {
        const token = process.env.APIFY_API_TOKEN;
        if (!token) throw new Error('APIFY_API_TOKEN não encontrado no .env');
        this.client = new ApifyClient({ token });
        this.llm = new LLMService('deepseek');
    }

    /**
     * Extrai EXATAMENTE 3 palavras-chave baseado no ICP identificado
     *
     * Estratégia CORRETA:
     * 1. Identifica o ICP (Ideal Customer Profile) do criador
     * 2. Extrai 3 palavras-chave SIMPLES que relacionam com esse ICP
     * 3. Cada palavra é buscada SEPARADAMENTE (não juntas!)
     *
     * Exemplos:
     * ICP: Empreendedora feminina → ["emagrecimento", "feminino", "negocios"]
     * ICP: Criador de conteúdo → ["copywriting", "conteudo", "marketing"]
     * ICP: Especialista em fitness → ["fitness", "saude", "exercicio"]
     */
    async extractKeywords(plan: string): Promise<string[]> {
        const result = await this.llm.analyzeJson<{
            icp: string;
            keywords: string[]
        }>(
            `A partir do plano estratégico abaixo, faça:

1. IDENTIFIQUE o ICP (Ideal Customer Profile) - quem é o criador e seu público
2. EXTRAIA EXATAMENTE 3 palavras-chave simples que relacionam com esse ICP

REGRAS ABSOLUTAS:
- Máximo 1-2 palavras por keyword (simples e genérico)
- Que uma pessoa digitaria na barra de pesquisa do Instagram
- Garantidas de retornar MUITOS posts (não específicas demais)
- Em português se o nicho for BR
- Ordenadas por relevância (mais importante primeiro)

EXEMPLOS:

ICP: Mulher empreendedora que quer emagrecer
Palavras: ["emagrecimento", "feminino", "negocios"]

ICP: Criador de conteúdo iniciante
Palavras: ["copywriting", "conteudo", "marketing"]

ICP: Personal trainer especializado em fitness feminino
Palavras: ["fitness", "saude", "mulheres"]

PLANO ESTRATÉGICO:
${plan.slice(0, 2500)}`,
            '{ "icp": "descrição do ICP", "keywords": ["palavra1", "palavra2", "palavra3"] }',
        );

        const keywords = (result.keywords || [])
            .map(k => k.trim().toLowerCase().replace(/[^a-záéíóúâêôãõç\\s]/g, ''))
            .filter(k => k.length > 2 && k.length < 25)
            .slice(0, 3); // EXATAMENTE 3

        const icp = result.icp || "Não identificado";
        process.stdout.write(`[ICP] ${icp}\n`);
        process.stdout.write(`[KEYWORDS] Extraídos 3 keywords: "${keywords.join('", "')}"\n`);

        return keywords;
    }

    /**
     * Busca posts por hashtag derivado do keyword
     * ESTRATÉGIA COMPROVADA: usar instagram-hashtag-scraper
     *
     * Para cada keyword, derivamos um hashtag simples:
     * "marketing" → busca hashtag "marketing"
     * "emagrecimento" → busca hashtag "emagrecimento"
     * "fitness" → busca hashtag "fitness"
     *
     * Cada busca é SEPARADA e INDEPENDENTE
     */
    async fetchTopPosts(keywords: string[], resultsPerKeyword = 15): Promise<any[]> {
        if (keywords.length === 0) return [];

        const allPosts: any[] = [];

        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            try {
                process.stdout.write(`\n[BUSCA INDIVIDUAL ${i + 1}/${keywords.length}]\n`);
                process.stdout.write(`Buscando hashtag: #${keyword}\n`);

                // Usa instagram-hashtag-scraper que é COMPROVADAMENTE FUNCIONAL
                const run = await this.client.actor('apify/instagram-hashtag-scraper').call({
                    hashtags: [keyword],  // ← Busca ESTE keyword como hashtag
                    resultsLimit: resultsPerKeyword,
                });

                const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();
                const validPosts = (items || []).filter((p: any) => p.shortCode || p.url);

                process.stdout.write(`[BUSCA ${i + 1}] ✅ ${validPosts.length} posts encontrados para #${keyword}\n`);
                allPosts.push(...validPosts);

            } catch (error) {
                process.stdout.write(`[BUSCA ${i + 1}] ❌ Erro para #${keyword}: ${(error as Error).message}\n`);
                // Continua com o próximo keyword
            }
        }

        return allPosts;
    }

    /**
     * Calcula um "Viral Score" que identifica posts realmente virais
     * Critérios:
     * - Likes + Comments (engajamento total)
     * - Comment Rate (comments/(likes+comments)) — quanto maior, mais engajamento genuíno
     * - Views (para Reels, mais importante)
     */
    private calculateViralScore(post: any): number {
        const likes = post.likesCount || 0;
        const comments = post.commentsCount || 0;
        const views = post.videoPlayCount || post.videoViewCount || post.videoViews || 0;

        // Base: engagement total (likes + comentários)
        const engagementBase = likes + comments;
        if (engagementBase === 0) return 0;

        // Bônus: comment rate (comentários genuínos valem mais)
        // Se 20% dos engajamentos são comentários = muito viral (1.2x boost)
        const commentRate = comments / (likes + comments);
        const commentBonus = 1 + commentRate * 0.5; // +0% a +50% de boost

        // Bônus: views (se for Reels)
        // 10k views = 1x boost, 100k views = 2x boost (logarítmico)
        let viewBonus = 1;
        if (views > 0) {
            viewBonus = 1 + Math.log10(Math.max(views, 10)) / 5; // log scale
        }

        const viralScore = engagementBase * commentBonus * viewBonus;
        return parseFloat(viralScore.toFixed(2));
    }

    /**
     * Filtra e ordena posts por viralidade
     * Remove posts flopados (score muito baixo) e mantém apenas os viral hits
     */
    private filterAndSortByVirality(posts: any[]): any[] {
        // Calcula score para cada post
        const postsWithScore = posts
            .filter(p => p.caption && p.caption.length > 20)
            .map(p => ({
                ...p,
                _viralScore: this.calculateViralScore(p),
            }));

        if (postsWithScore.length === 0) return [];

        // Encontra o score mínimo aceitável (25% do máximo)
        const maxScore = Math.max(...postsWithScore.map(p => p._viralScore));
        const minAcceptableScore = maxScore * 0.25;

        // Filtra flopados e ordena por viral score decrescente
        return postsWithScore
            .filter(p => p._viralScore >= minAcceptableScore)
            .sort((a, b) => b._viralScore - a._viralScore)
            .slice(0, 12);
    }

    /**
     * Usa o LLM para extrair padrões de hooks, ângulos e formatos dos posts mais virais.
     */
    async analyzePatterns(posts: any[], keywords: string[]): Promise<TrendResearch> {
        if (posts.length === 0) {
            return {
                keywords_searched: keywords,
                posts_analyzed: 0,
                insights: [],
                dominant_formats: [],
                niche_summary: 'Sem dados de tendência suficientes.',
                reference_posts: [],
            };
        }

        // Log debug: mostra campos disponíveis no primeiro post
        if (posts.length > 0) {
            const firstPost = posts[0];
            process.stderr.write(`[DEBUG] Estrutura do post retornado pelo Apify:\n`);
            process.stderr.write(`  Campos principais: ${Object.keys(firstPost).slice(0, 15).join(', ')}\n`);
            process.stderr.write(`  Tem 'url'? ${!!firstPost.url} | Tem 'shortCode'? ${!!firstPost.shortCode} | Tem 'postUrl'? ${!!firstPost.postUrl} | Tem 'id'? ${!!firstPost.id} | Tem 'code'? ${!!firstPost.code}\n`);
        }

        // Filtra e ordena por viralidade (remove flopados, mantém top viral)
        const topPosts = this.filterAndSortByVirality(posts);

        // Monta referências com URLs diretas para os posts
        const referencePosts: TrendReferencePost[] = topPosts.map(p => {
            // Tipo: "Video" → Reels, "Sidecar" → Carrossel, "Image" → Imagem
            const type = p.type === 'Video' ? 'Reels'
                : (p.type === 'Sidecar' ? 'Carrossel' : 'Imagem');

            // Tenta múltiplos campos para construir a URL
            let url = '';
            if (p.url) {
                url = p.url;
            } else if (p.shortCode) {
                url = `https://www.instagram.com/${type === 'Reels' ? 'reel' : 'p'}/${p.shortCode}/`;
            } else if (p.postUrl) {
                url = p.postUrl;
            } else if (p.id) {
                // Fallback: tentar usar o ID do post
                url = `https://www.instagram.com/p/${p.id}/`;
            } else if (p.code) {
                url = `https://www.instagram.com/${type === 'Reels' ? 'reel' : 'p'}/${p.code}/`;
            }

            // Log debug para entender o que está vindo do Apify
            if (!url && p.caption) {
                process.stderr.write(`[DEBUG] Post sem URL encontrado: ${(p.caption || '').slice(0, 50)}... | Campos: ${Object.keys(p).join(', ')}\n`);
            }

            return {
                url,
                caption_preview: (p.caption || '').slice(0, 120),
                likes: p.likesCount || 0,
                comments: p.commentsCount || 0,
                views: p.videoPlayCount || p.videoViewCount || p.videoViews || undefined,
                type,
            };
        }).filter(r => r.url);

        const postsFormatted = topPosts.map((p, i) => {
            const likes = p.likesCount || 0;
            const comments = p.commentsCount || 0;
            const views = p.videoPlayCount || p.videoViewCount;
            const type = p.type === 'Video' ? 'Reels' : (p.images?.length > 1 ? 'Carrossel' : 'Imagem');
            const viewsStr = views ? ` / ${views.toLocaleString('pt-BR')} views` : '';
            const viralScore = p._viralScore || 0;
            return `[Post ${i + 1}][${type}][Viral Score: ${viralScore}] ${likes.toLocaleString('pt-BR')} likes / ${comments.toLocaleString('pt-BR')} comentários${viewsStr}\n"${(p.caption || '').slice(0, 280)}"`;
        }).join('\n\n');

        // Log: quantas URLs conseguimos extrair
        process.stdout.write(`[STEP] ${referencePosts.length}/${topPosts.length} posts com URLs válidas extraídas\n`);

        const result = await this.llm.analyzeJson<Omit<TrendResearch, 'keywords_searched' | 'posts_analyzed'>>(
            `Você é um analista sênior de tendências de conteúdo no Instagram. Analise os posts mais virais abaixo e extraia os padrões de hooks, ângulos e formatos que estão dominando este nicho.

TERMOS DE BUSCA (keywords usados na barra de pesquisa): ${keywords.join(', ')}

TOP POSTS (ordenados por engajamento real):
${postsFormatted}

OBJETIVO: Identificar o que esses conteúdos têm em comum — padrão de abertura (hook), ângulo narrativo, princípio de persuasão subjacente. Seja específico. Cite os hooks verbatim quando possível.`,
            INSIGHTS_SCHEMA,
        );

        return {
            keywords_searched: keywords,
            posts_analyzed: topPosts.length,
            insights: result.insights || [],
            dominant_formats: result.dominant_formats || [],
            niche_summary: result.niche_summary || '',
            reference_posts: referencePosts,
        };
    }

    /**
     * Pipeline completo: extrai keywords → busca no Instagram → analisa padrões
     */
    async research(plan: string): Promise<TrendResearch> {
        const keywords = await this.extractKeywords(plan);
        if (keywords.length === 0) {
            throw new Error('Não foi possível extrair keywords relevantes do plano');
        }

        process.stdout.write(`\n${'='.repeat(80)}\n`);
        process.stdout.write(`[STEP] INICIANDO 3 BUSCAS SEPARADAS\n`);
        process.stdout.write(`${'='.repeat(80)}\n`);

        for (let i = 0; i < keywords.length; i++) {
            process.stdout.write(`[BUSCA ${i + 1}/3] Palavra-chave #${i + 1}: "${keywords[i]}"\n`);
        }

        process.stdout.write(`${'='.repeat(80)}\n\n`);

        const posts = await this.fetchTopPosts(keywords, 15);

        if (posts.length === 0) {
            process.stdout.write(`\n${'='.repeat(80)}\n`);
            process.stdout.write(`[ERRO] ❌ NENHUM POST ENCONTRADO!\n`);
            process.stdout.write(`Palavras buscadas: ${keywords.join(', ')}\n`);
            process.stdout.write(`Verifique:\n  - Se as palavras estão muito específicas\n  - Conexão e API token do Apify\n`);
            process.stdout.write(`${'='.repeat(80)}\n`);
            return {
                keywords_searched: keywords,
                posts_analyzed: 0,
                insights: [],
                dominant_formats: [],
                niche_summary: 'Nenhum post encontrado para os keywords fornecidos.',
                reference_posts: [],
            };
        }

        process.stdout.write(`\n${'='.repeat(80)}\n`);
        process.stdout.write(`[RESULTADO] ✅ ${posts.length} posts encontrados no total\n`);
        process.stdout.write(`[PASSO 2] Filtrando para manter apenas posts VIRAIS...\n`);
        process.stdout.write(`${'='.repeat(80)}\n\n`);

        const result = await this.analyzePatterns(posts, keywords);

        process.stdout.write(`[STEP] ${result.posts_analyzed} posts virais selecionados — analisando padroes de hooks e angulos...\n`);

        return result;
    }
}
