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
     * Extrai temas principais do plano estratégico
     * Depois decompõe em palavras-chave individuais para buscas mais precisas
     *
     * Estratégia: Em vez de extrair keywords longos como
     * "marketing digital para vendas" (0 resultados),
     * quebramos em temas curtos: ["marketing", "digital", "vendas"]
     * Cada um é garantido de retornar posts relevantes
     */
    async extractKeywords(plan: string): Promise<string[]> {
        // Passo 1: Extrai os TEMAS principais (sem ser muito específico)
        const themesResult = await this.llm.analyzeJson<{ themes: string[] }>(
            `A partir do plano estratégico abaixo, extraia os TEMAS principais do nicho.

Não queremos frases longas! Queremos os TEMAS (palavras-chave simples) que definem o nicho.

EXEMPLOS:
❌ Ruim (muito específico): "marketing digital para vendas online de produtos"
✅ Bom (temas simples): marketing, digital, vendas, negocios

❌ Ruim: "tecnicas de emagrecimento feminino com foco em saude"
✅ Bom: emagrecimento, feminino, saude, fitness

CRITÉRIOS:
- Palavras simples (1-2 palavras máximo)
- Que alguém digitaria na barra de pesquisa do Instagram
- Garantidas de retornar posts (não muito específicas)
- Em português quando for BR
- Máximo 6 temas

PLANO ESTRATÉGICO:
${plan.slice(0, 2500)}`,
            '{ "themes": ["tema1", "tema2", "tema3"] }',
        );

        const themes = (themesResult.themes || [])
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 2 && t.length < 30)
            .slice(0, 6);

        // Passo 2: Para cada tema, decompõe em palavras individuais
        const keywords = new Set<string>();

        for (const theme of themes) {
            // Adiciona o tema completo
            keywords.add(theme);

            // Separa em palavras individuais (se tiver múltiplas)
            const words = theme.split(/\s+/).filter(w => w.length > 2);
            for (const word of words) {
                keywords.add(word);
            }
        }

        // Log: mostra a estratégia
        process.stdout.write(`[KEYWORDS] Temas extraídos: ${Array.from(keywords).join(', ')}\n`);

        return Array.from(keywords).slice(0, 8); // até 8 keywords únicos
    }

    /**
     * ESTRATÉGIA 1: Tenta buscar direto na barra de pesquisa do Instagram
     * (Simulando um usuário digitando na busca)
     */
    private async fetchPostsFromSearchBar(keywords: string[], resultsPerKeyword: number): Promise<any[]> {
        const allPosts: any[] = [];

        for (const keyword of keywords) {
            try {
                process.stdout.write(`[BUSCA] Simulando busca na barra: "${keyword}"\n`);

                // instagram-search-scraper simula a barra de pesquisa real
                // Parâmetros corretos para o actor
                const run = await this.client.actor('apify/instagram-search-scraper').call({
                    searchQuery: keyword,  // ← Busca por termo (como digitaria na barra)
                    searchType: 'posts',   // ← Especifica que quer posts (não perfis/hashtags)
                    resultsLimit: resultsPerKeyword,
                });

                const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();
                const validPosts = (items || []).filter((p: any) => p.shortCode || p.url);

                if (validPosts.length > 0) {
                    process.stdout.write(`[BUSCA] ✅ ${validPosts.length} posts encontrados (barra de pesquisa) para "${keyword}"\n`);
                    allPosts.push(...validPosts);
                }
            } catch (error) {
                process.stdout.write(`[AVISO] Barra de pesquisa falhou para "${keyword}": ${(error as Error).message}\n`);
            }
        }

        return allPosts;
    }

    /**
     * ESTRATÉGIA 2 (FALLBACK): Busca por tópicos do Instagram
     * Usada se a barra de pesquisa não funcionar
     */
    private async fetchPostsFromTopics(keywords: string[], resultsPerKeyword: number): Promise<any[]> {
        const allPosts: any[] = [];

        for (const keyword of keywords) {
            try {
                process.stdout.write(`[BUSCA] Fallback - Procurando no tópico: "${keyword}"\n`);

                const topicUrl = `https://www.instagram.com/explore/tags/${keyword.replace(/\s+/g, '')}/`;

                const run = await this.client.actor('apify/instagram-posts-scraper').call({
                    startUrls: [topicUrl],
                    resultsLimit: resultsPerKeyword,
                    maxPostsPerPage: resultsPerKeyword,
                });

                const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();
                const validPosts = (items || []).filter((p: any) => p.shortCode || p.url);

                if (validPosts.length > 0) {
                    process.stdout.write(`[BUSCA] ✅ ${validPosts.length} posts encontrados (tópico) para "${keyword}"\n`);
                    allPosts.push(...validPosts);
                }
            } catch (error) {
                process.stdout.write(`[AVISO] Tópico também falhou para "${keyword}": ${(error as Error).message}\n`);
            }
        }

        return allPosts;
    }

    /**
     * Busca posts virais com 2 estratégias:
     * 1. Tenta a barra de pesquisa do Instagram (realista)
     * 2. Fallback para tópicos se a barra falhar
     */
    async fetchTopPosts(keywords: string[], resultsPerKeyword = 8): Promise<any[]> {
        if (keywords.length === 0) return [];

        process.stdout.write(`[BUSCA] Tentando barra de pesquisa do Instagram (Estratégia 1)...\n`);

        // Tenta estratégia 1: barra de pesquisa
        let posts = await this.fetchPostsFromSearchBar(keywords, resultsPerKeyword);

        // Se não funcionou, tenta estratégia 2: tópicos
        if (posts.length === 0) {
            process.stdout.write(`[BUSCA] Barra de pesquisa retornou 0 posts. Tentando tópicos (Estratégia 2)...\n`);
            posts = await this.fetchPostsFromTopics(keywords, resultsPerKeyword);
        }

        return posts;
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

        process.stdout.write(`[STEP] ${keywords.length} temas extraídos: ${keywords.join(', ')}\n`);
        process.stdout.write(`[STEP] Buscando posts virais por tema (estratégia: múltiplas buscas simples)...\n`);

        const posts = await this.fetchTopPosts(keywords, 8);

        if (posts.length === 0) {
            process.stdout.write(`[ERRO] Nenhum post encontrado! Tente:\n  - Keywords mais simples/genéricos\n  - Tópicos mais populares\n  - Verificar conexão e API token do Apify\n`);
            return {
                keywords_searched: keywords,
                posts_analyzed: 0,
                insights: [],
                dominant_formats: [],
                niche_summary: 'Nenhum post encontrado para os keywords fornecidos.',
                reference_posts: [],
            };
        }

        process.stdout.write(`[STEP] ${posts.length} posts encontrados — filtrando flopados e mantendo apenas virais...\n`);

        const result = await this.analyzePatterns(posts, keywords);

        process.stdout.write(`[STEP] ${result.posts_analyzed} posts virais selecionados — analisando padroes de hooks e angulos...\n`);

        return result;
    }
}
