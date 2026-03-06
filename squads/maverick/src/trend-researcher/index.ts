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
     * Extrai 3 keywords de busca do Instagram a partir do plano estratégico.
     * São as palavras que um usuário digitaria na busca do Instagram para encontrar
     * conteúdo do nicho — sem # obrigatório, sem depender de quem tagueou o quê.
     */
    async extractKeywords(plan: string): Promise<string[]> {
        const result = await this.llm.analyzeJson<{ keywords: string[] }>(
            `A partir do plano estratégico abaixo, extraia EXATAMENTE 3 termos de busca que representam o nicho e o público-alvo do criador.

Estes termos serão usados na busca do Instagram (como se um usuário digitasse na barra de pesquisa).

CRITÉRIOS:
- Termos que alguém digitaria para encontrar conteúdo sobre o tema
- Podem ser palavras compostas com espaço (ex: "copywriting para iniciantes", "emagrecimento feminino")
- Em português quando o nicho for br
- Específicos o suficiente para ser relevantes, mas não tão longos que retornem zero resultado
- Bons exemplos: "emagrecimento feminino", "copywriting", "investimentos iniciantes", "maternidade real", "marketing digital"
- Ruins (genéricos demais): "fitness", "saude", "vida"

PLANO ESTRATÉGICO:
${plan.slice(0, 2500)}`,
            '{ "keywords": ["termo1", "termo2", "termo3"] }',
        );

        return (result.keywords || [])
            .slice(0, 3)
            .map(k => k.trim())
            .filter(Boolean);
    }

    /**
     * Busca posts via Instagram search — encontra conteúdo viral
     * usando KEYWORDS DIRETOS (não hashtags) na barra de pesquisa.
     * Ex: "copywriting para iniciantes" → pesquisa por essa frase exata
     */
    async fetchTopPosts(keywords: string[], resultsPerKeyword = 8): Promise<any[]> {
        if (keywords.length === 0) return [];

        // Usar instagram-search-scraper para buscar por keywords na barra de pesquisa
        const run = await this.client.actor('apify/instagram-search-scraper').call({
            searchTerms: keywords,
            resultsLimit: resultsPerKeyword,
        });

        const { items } = await this.client.dataset(run.defaultDatasetId!).listItems();
        // Filter out error objects
        return (items || []).filter((p: any) => p.shortCode || p.url);
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

        // Filtra e ordena por viralidade (remove flopados, mantém top viral)
        const topPosts = this.filterAndSortByVirality(posts);

        // Monta referências com URLs diretas para os posts
        const referencePosts: TrendReferencePost[] = topPosts.map(p => {
            // Tipo: "Video" → Reels, "Sidecar" → Carrossel, "Image" → Imagem
            const type = p.type === 'Video' ? 'Reels'
                : (p.type === 'Sidecar' ? 'Carrossel' : 'Imagem');
            // URL: usar campo url direto (hashtag scraper já fornece o link completo)
            const url = p.url || (p.shortCode
                ? `https://www.instagram.com/${type === 'Reels' ? 'reel' : 'p'}/${p.shortCode}/`
                : '');
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

        process.stdout.write(`[STEP] Pesquisando no Instagram por: ${keywords.join(', ')}\n`);

        const posts = await this.fetchTopPosts(keywords, 8);

        process.stdout.write(`[STEP] ${posts.length} posts encontrados — filtrando flopados e mantendo apenas virais...\n`);

        const result = await this.analyzePatterns(posts, keywords);

        process.stdout.write(`[STEP] ${result.posts_analyzed} posts virais selecionados — analisando padroes de hooks e angulos...\n`);

        return result;
    }
}
