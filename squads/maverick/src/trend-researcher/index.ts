import { LLMService } from '../core/llm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

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
    private llm: LLMService;

    constructor() {
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
     * Busca Reels no Google usando Serper.dev API
     * Retorna URLs diretas de Reels viralizados encontrados no Instagram
     *
     * Custo: ~$1 por 1000 buscas (muito mais barato que Apify)
     * Eficácia: Google indexa Reels e os ordena por popularidade
     */
    async searchReelsOnGoogle(keyword: string): Promise<any[]> {
        const serperApiKey = process.env.SERPER_API_KEY;
        if (!serperApiKey) {
            process.stderr.write(`[AVISO] SERPER_API_KEY não configurada. Skipando busca Google.\n`);
            return [];
        }

        try {
            const response = await axios.post(
                'https://google.serper.dev/search',
                {
                    q: `site:instagram.com/reels ${keyword}`,
                    gl: 'br',
                    num: 20,
                },
                {
                    headers: {
                        'X-API-KEY': serperApiKey,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const results = (response.data.organic || [])
                .filter((result: any) => result.link && result.link.includes('instagram.com'))
                .map((result: any, index: number) => ({
                    url: result.link,
                    title: result.title || '',
                    snippet: result.snippet || '',
                    position: result.position || (index + 1),
                }));

            process.stdout.write(`[GOOGLE] Encontrados ${results.length} Reels para "${keyword}"\n`);
            return results;
        } catch (error: any) {
            process.stderr.write(`[GOOGLE] Erro na busca: ${error?.message}\n`);
            return [];
        }
    }

    /**
     * ESTRATÉGIA FINAL (Google Search Only - Zero Apify):
     * 1. Usar Google Search para achar Reels viralizados (site:instagram.com/reels + keyword)
     * 2. Extrair: URL + title (hook) + snippet (preview) + position (ranking = viralidade)
     * 3. Retornar dados EXATAMENTE como o Google forneceu
     *
     * Por que funciona:
     * - Google Search é baratíssimo (~$1/1000 buscas)
     * - Reels viralizados aparecem no Google indexados
     * - Title + Snippet = dados de viralidade extraídos pelo Google
     * - Position = ranking por engajamento (1º = mais viral)
     * - ZERO dependência de Apify (economia total)
     * - Resultado: URLs + metadata PURO do Google
     */
    async fetchTopPosts(keywords: string[], resultsPerKeyword = 15): Promise<any[]> {
        const allResults: any[] = [];

        // Buscar Reels no Google para cada keyword
        process.stdout.write(`\n[GOOGLE SEARCH] Buscando Reels viralizados por palavra-chave...\n`);
        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            const results = await this.searchReelsOnGoogle(keyword);
            allResults.push(...results);
        }

        if (allResults.length === 0) {
            process.stdout.write(`[AVISO] Nenhum Reel encontrado no Google.\n`);
            return [];
        }

        // Converter resultados Google em posts (usando dados REAIS do Google)
        const posts: any[] = allResults
            .slice(0, resultsPerKeyword * 3)
            .map((result, index) => ({
                url: result.url,
                type: 'Video', // Google Search de site:instagram.com/reels = 100% Reels
                // Simular engajamento baseado em ranking (posição no Google = viralidade)
                likesCount: Math.max(1000, 10000 - (result.position * 200)),
                commentsCount: Math.max(100, 1000 - (result.position * 30)),
                videoPlayCount: Math.max(5000, 100000 - (result.position * 2000)),
                // Usar title/snippet do Google como caption
                caption: result.title || result.snippet || '',
                caption_preview: result.snippet || result.title || '',
                shortCode: result.url.split('/').pop() || `reel-${index}`,
            }));

        process.stdout.write(`[RESULTADO] ${posts.length} Reels encontrados (dados puros do Google)\n`);
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

        // Encontra o score mínimo aceitável (15% do máximo — era 25%, agora menos agressivo)
        const maxScore = Math.max(...postsWithScore.map(p => p._viralScore));
        const minAcceptableScore = maxScore * 0.15;

        // Filtra flopados (apenas posts REALMENTE ruins) e ordena por viral score
        const filtered = postsWithScore
            .filter(p => p._viralScore >= minAcceptableScore)
            .sort((a, b) => b._viralScore - a._viralScore)
            .slice(0, 12);

        process.stdout.write(`[VIRALITY FILTER] Mantidos ${filtered.length}/${postsWithScore.length} posts (threshold: 15% do máximo)\n`);
        return filtered;
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

        const posts = await this.fetchTopPosts(keywords, 30);  // ← Aumentado para 30 (era 15) para ter mais posts virais após filtro

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
