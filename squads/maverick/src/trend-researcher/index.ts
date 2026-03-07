import { LLMService } from '../core/llm';
import { InstagramScraper } from '../tools/instagramScraper';
import { PatternAnalyzer } from '../tools/patternAnalyzer';
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
    likes?: number;
    comments?: number;
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
    private scraper: InstagramScraper;
    private analyzer: PatternAnalyzer;
    private currentICP: string = '';

    constructor() {
        this.llm = new LLMService('deepseek');
        this.scraper = new InstagramScraper();
        this.analyzer = new PatternAnalyzer();
    }

    /**
     * Extrai 3 hashtags específicas do nicho do ICP.
     *
     * Estratégia:
     * 1. Identifica o ICP e o tema central que o criador ensina/vende
     * 2. Extrai hashtags reais do Instagram que criadores virais DESSE NICHO usam
     * 3. Mix: 1 ampla + 2 específicas do nicho
     */
    async extractKeywords(plan: string): Promise<string[]> {
        const result = await this.llm.analyzeJson<{
            icp: string;
            tema_central: string;
            keywords: string[]
        }>(
            `Analise o plano estratégico abaixo e identifique as 3 MELHORES TERMOS DE BUSCA para encontrar vídeos virais no Instagram relacionados ao nicho do criador.

PASSO 1 — Identifique:
- ICP (quem é o criador e seu público-alvo)
- Tema central (o que ele ensina/vende/transforma)

PASSO 2 — Selecione EXATAMENTE 3 termos de busca:
- São palavras que o PÚBLICO-ALVO digitaria no Instagram para encontrar conteúdo sobre o problema/desejo dele
- Podem ter 1 a 4 palavras, com espaços, acentos e caracteres normais
- Mix: 1 termo AMPLO do tema + 2 termos ESPECÍFICOS do nicho/dor/transformação
- Devem trazer vídeos ALINHADOS ao nicho do criador

REGRAS:
- NÃO use termos genéricos como: "conteúdo", "dicas", "brasil", "instagram", "viral"
- FOQUE no que o público pesquisa quando sente a dor ou deseja a transformação
- NÃO use hashtags (sem #, sem palavras coladas)

EXEMPLOS CORRETOS:

ICP: Coach financeiro, ensina a sair das dívidas para assalariados
Tema: educação financeira para endividados
Keywords: ["educação financeira", "como sair das dívidas", "independência financeira"]

ICP: Nutricionista, emagrecimento feminino sem dieta restritiva
Tema: emagrecimento sustentável para mulheres
Keywords: ["emagrecer sem dieta", "emagrecimento feminino", "como perder peso"]

ICP: Copywriter, ensina copywriting para infoprodutores iniciantes
Tema: copywriting e vendas online
Keywords: ["copywriting para iniciantes", "como escrever para vender", "vendas online"]

ICP: Personal trainer, hipertrofia para homens acima de 30
Tema: ganho de massa muscular
Keywords: ["ganhar massa muscular", "hipertrofia masculina", "treino para ganhar músculo"]

PLANO ESTRATÉGICO:
${plan.slice(0, 2500)}`,
            '{ "icp": "descrição completa do ICP", "tema_central": "o que o criador ensina/vende", "keywords": ["termo de busca 1", "termo de busca 2", "termo de busca 3"] }',
        );

        // Sanitiza: apenas trim e lowercase — mantém acentos e espaços (busca normal)
        const keywords = (result.keywords || [])
            .map(k => k.trim().toLowerCase().replace(/^#+/, '').trim())
            .filter(k => k.length > 2 && k.length < 60)
            .slice(0, 3);

        this.currentICP = result.icp || '';
        const tema = result.tema_central || '';

        process.stdout.write(`[ICP] ${this.currentICP}\n`);
        process.stdout.write(`[TEMA] ${tema}\n`);
        process.stdout.write(`[KEYWORDS] "${keywords.join('", "')}"\n`);

        return keywords;
    }

    /**
     * Filtra posts irrelevantes para o ICP usando verificação de caption.
     * Remove posts claramente fora do nicho antes de passar para o LLM.
     */
    private filterByICPRelevance(posts: any[], hashtags: string[]): any[] {
        if (!this.currentICP || posts.length === 0) return posts;

        // Termos do nicho: cada keyword já são palavras normais com espaço
        // Expande em palavras individuais (3+ letras) para melhor cobertura
        const nicheTerms = hashtags.flatMap(kw => {
            const normalized = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const words = normalized.split(/\s+/).filter(w => w.length >= 3);
            return [normalized, ...words];
        });

        const before = posts.length;
        const filtered = posts.filter(p => {
            const text = ((p.caption || '') + ' ' + (p.caption_preview || '')).toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

            // Inclui se o caption menciona algum termo do nicho
            const hasNicheTerm = nicheTerms.some(term => text.includes(term));

            // Inclui também se não tem caption (não conseguiu extrair — não descartar)
            const hasNoCaption = !p.caption || p.caption.length < 10;

            return hasNicheTerm || hasNoCaption;
        });

        if (filtered.length < before) {
            process.stdout.write(`[ICP FILTER] ${before - filtered.length} posts fora do nicho removidos. Restam: ${filtered.length}\n`);
        }

        return filtered.length > 0 ? filtered : posts; // se filtrou demais, retorna todos
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
                    q: `site:instagram.com/reels ${keyword} brasil`,
                    gl: 'br',
                    hl: 'pt-br',
                    lr: 'lang_pt',
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
                    views: this.parseViewsFromText(result.snippet || result.title || ''),
                }));

            process.stdout.write(`[GOOGLE] Encontrados ${results.length} Reels para "${keyword}"\n`);
            return results;
        } catch (error: any) {
            process.stderr.write(`[GOOGLE] Erro na busca: ${error?.message}\n`);
            return [];
        }
    }

    /**
     * NOVA ESTRATÉGIA: Instagram Scraper + Pattern Analysis
     * 1. Scraper busca vídeos virais via DuckDuckGo + Playwright
     * 2. Filtra por 100k+ views
     * 3. LLM analisa padrões (hook, tema, formato, CTA)
     * 4. Retorna reference posts estruturados
     */
    async fetchTopPostsViaInstagramScraper(
        keywords: string[],
        maxAgeDays = 45,
    ): Promise<any[]> {
        // Coleta sem threshold — ranking relativo feito depois por filterAndSortByVirality
        // minViews=0 para não descartar nenhum post antes de ter o panorama completo
        const viralPosts = await this.scraper.scrapeMultipleHashtags(keywords, 0, 15, maxAgeDays);

        if (viralPosts.length === 0) {
            process.stdout.write(`[SCRAPER] Nenhum post viral encontrado\n`);
            return [];
        }

        process.stdout.write(`[SCRAPER] Analisando padrões de ${viralPosts.length} posts virais...\n`);

        // Análise de padrões via LLM
        const patterns = await this.analyzer.analyzeVirtualPosts(viralPosts);

        // Converter para formato compatível com o restante do pipeline
        const formatted = patterns.map(p => ({
            url: p.url,
            type: 'Video',
            caption: p.analysis.hook,
            caption_preview: p.analysis.hook,
            likesCount: p.engagement.likes || undefined,
            commentsCount: p.engagement.comments || undefined,
            videoPlayCount: p.views,
            shortCode: p.url.split('/').pop() || `reel-${p.url.slice(-10)}`,
            _viralScore: p.viral_score,
            analysis: p.analysis,
        }));

        process.stdout.write(`[SCRAPER] ${formatted.length} posts com análise de padrões prontos\n`);
        return formatted;
    }

    /**
     * ESTRATÉGIA FALLBACK (Google Search Only - Zero Apify):
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
    async fetchTopPosts(keywords: string[], maxAgeDays = 45): Promise<any[]> {
        // ÚNICO MÉTODO: Instagram Scraper (Playwright)
        // Sem threshold de views aqui — deixa o filterAndSortByVirality ranquear relativamente
        try {
            process.stdout.write(`\n[FETCH] Iniciando Instagram Scraper (max ${maxAgeDays}d)...\n`);
            const scraperPosts = await this.fetchTopPostsViaInstagramScraper(keywords, maxAgeDays);

            process.stdout.write(`[FETCH] ✅ ${scraperPosts.length} posts coletados via Scraper\n`);
            return scraperPosts;
        } catch (error: any) {
            process.stderr.write(`[FETCH] ⚠️ Scraper falhou: ${error.message}\n`);
            return [];
        }
    }


    /**
     * Extrai contagem de views real do texto do snippet do Google
     * Ex: "850K visualizações", "1,2M views", "50 mil visualizações"
     */
    private parseViewsFromText(text: string): number | undefined {
        // Padrões em português e inglês
        const patterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
            // "1.2M visualizações" ou "1,2M views"
            [/(\d+[.,]\d+)\s*[Mm]\s*(?:visualiza[çc][ãa]o?s?|views?)/i, m => parseFloat(m[1].replace(',', '.')) * 1_000_000],
            // "850K visualizações" ou "850k views"
            [/(\d+[.,]?\d*)\s*[Kk]\s*(?:visualiza[çc][ãa]o?s?|views?)/i, m => parseFloat(m[1].replace(',', '.')) * 1_000],
            // "1M visualizações"
            [/(\d+)\s*[Mm]\s*(?:visualiza[çc][ãa]o?s?|views?)/i, m => parseInt(m[1]) * 1_000_000],
            // "50 mil visualizações"
            [/(\d+[.,]?\d*)\s*mil\s*(?:visualiza[çc][ãa]o?s?|views?)?/i, m => parseFloat(m[1].replace(',', '.')) * 1_000],
            // "150000 visualizações"
            [/(\d{6,})\s*(?:visualiza[çc][ãa]o?s?|views?)/i, m => parseInt(m[1])],
        ];

        for (const [regex, calc] of patterns) {
            const match = text.match(regex);
            if (match) {
                const views = calc(match);
                if (views > 0) return Math.round(views);
            }
        }
        return undefined;
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
        // Calcula score para cada post (mantém todos que têm URL — caption pode ser vazia)
        const postsWithScore = posts
            .filter(p => p.url)
            .map(p => ({
                ...p,
                _viralScore: this.calculateViralScore(p),
            }));

        if (postsWithScore.length === 0) return [];

        const MIN_VIEWS = 100_000;
        const MIN_LIKES_FALLBACK = 5_000; // proxy quando não há views

        // 1ª camada: posts com views confirmadas >= 100k
        const confirmed = postsWithScore
            .filter(p => {
                const views = p.videoPlayCount || p.views || 0;
                return views >= MIN_VIEWS;
            })
            .sort((a, b) => b._viralScore - a._viralScore);

        if (confirmed.length >= 3) {
            process.stdout.write(`[VIRALITY FILTER] ${confirmed.length} posts com 100k+ views confirmadas\n`);
            return confirmed.slice(0, 12);
        }

        // 2ª camada: sem views extraídas, mas com curtidas expressivas (>= 5k)
        const byLikes = postsWithScore
            .filter(p => {
                const views = p.videoPlayCount || p.views || 0;
                const likes = p.likesCount || p.likes || 0;
                if (views >= MIN_VIEWS) return true;
                if (views === 0 && likes >= MIN_LIKES_FALLBACK) return true;
                return false;
            })
            .sort((a, b) => b._viralScore - a._viralScore);

        if (byLikes.length >= 1) {
            process.stdout.write(`[VIRALITY FILTER] ${byLikes.length} posts aceitos por curtidas (views não extraídas)\n`);
            return byLikes.slice(0, 12);
        }

        // 3ª camada: extração completamente falhou — usa os primeiros da busca (Instagram rankeia por relevância)
        process.stdout.write(`[VIRALITY FILTER] Extração de métricas falhou — usando ordem algorítmica do Instagram (top 8)\n`);
        return postsWithScore.slice(0, 8);
    }

    /**
     * Converte análise de padrões do scraper (VideoPattern) em insights estruturados (TrendInsight)
     * Mapeia: pattern → hook_pattern, emotional_trigger → engagement_signal, etc
     */
    private convertAnalysisToInsights(posts: any[]): TrendInsight[] {
        const patternMap: Record<string, string> = {
            'Storytelling': 'Narrativa Envolvente',
            'Pergunta': 'Pergunta Provocadora',
            'Dissonância': 'Dissonância Absoluta',
            'Revelação': 'Revelação de Bastidores',
            'Comparação': 'Comparativo Before/After',
            'Tópicos': 'Lista de Dicas',
            'Outro': 'Padrão Único',
        };

        const triggerMap: Record<string, string> = {
            'Fear': 'Ativa o medo do cliente não avançar — urgência',
            'Desire': 'Desejo de transformação — aspiracional',
            'Shame': 'Vergonha de estar fazendo errado — identidade',
            'Curiosity': 'Curiosidade e open loops — vicio atencional',
            'Anger': 'Raiva contra inimigo comum — tribalismo',
            'Hope': 'Esperança de mudança possível — motivação',
            'Inspiration': 'Inspiração por exemplo — prova social',
        };

        const postsWithAnalysis = posts.filter(p => p.analysis);

        return postsWithAnalysis.map(post => ({
            hook_pattern: patternMap[post.analysis.format] || post.analysis.format,
            angle: `${post.analysis.theme} — ${post.analysis.pattern}`,
            engagement_signal: triggerMap[post.analysis.emotional_trigger] || post.analysis.emotional_trigger,
            example_hook: post.analysis.hook,
            format: post.type || 'Video',
        }));
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
        const viralPosts = this.filterAndSortByVirality(posts);

        // Filtra por relevância ao ICP (remove posts fora do nicho)
        const topPosts = this.filterByICPRelevance(viralPosts, keywords);

        // ✅ SE JÁ HÁ ANÁLISE (novo scraper), usar conversão direta
        const hasAnalysis = topPosts.some(p => p.analysis);
        if (hasAnalysis) {
            process.stdout.write(`[ANÁLISE] ✅ Posts já com análise de padrões (novo scraper)\n`);
            const insightsFromAnalysis = this.convertAnalysisToInsights(topPosts);

            // Detectar formatos dominantes
            const formats = new Map<string, number>();
            topPosts.forEach(p => {
                const fmt = p.type || 'Video';
                formats.set(fmt, (formats.get(fmt) || 0) + 1);
            });
            const dominantFormats = Array.from(formats.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(e => e[0]);

            // Sumarizar
            const themes = new Set(topPosts.filter(p => p.analysis?.theme).map(p => p.analysis.theme));
            const triggers = new Set(topPosts.filter(p => p.analysis?.emotional_trigger).map(p => p.analysis.emotional_trigger));
            const nicheSummary = themes.size > 0
                ? `Principais temas: ${Array.from(themes).slice(0, 3).join(', ')}. Emoções que convertem: ${Array.from(triggers).slice(0, 2).join(', ')}.`
                : 'Análise disponível nos padrões extraídos.';

            const referencePosts = topPosts.map(p => ({
                url: p.url || '',
                caption_preview: p.caption || p.analysis?.hook || '',
                likes: p.likesCount || undefined,
                comments: p.commentsCount || undefined,
                views: p.videoPlayCount,
                type: p.type || 'Video',
            })).filter(r => r.url);

            return {
                keywords_searched: keywords,
                posts_analyzed: topPosts.length,
                insights: insightsFromAnalysis,
                dominant_formats: dominantFormats,
                niche_summary: nicheSummary,
                reference_posts: referencePosts,
            };
        }

        // ⚠️ SE NÃO HÁ ANÁLISE (fallback Google), usar LLM para extrair
        process.stdout.write(`[ANÁLISE] 🔄 Extraindo padrões via LLM (fallback Google Search)\n`);

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
                likes: p.likesCount || undefined,
                comments: p.commentsCount || undefined,
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
     * @param plan - Plano estratégico do perfil
     * @param preselectedKeywords - Keywords já confirmadas pelo usuário (pula extração LLM)
     */
    async research(plan: string, preselectedKeywords?: string[], maxAgeDays = 45): Promise<TrendResearch> {
        const keywords = preselectedKeywords && preselectedKeywords.length > 0
            ? preselectedKeywords
            : await this.extractKeywords(plan);
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

        const posts = await this.fetchTopPosts(keywords, maxAgeDays);

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

// Export alias para compatibilidade com testes
export { TrendResearcherAgent as TrendResearcher };
