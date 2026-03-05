import { ScoutAgent, ProfileAnalysis } from '../scout/index';
import { ScholarEngine } from '../scholar/engine';
import { LLMService } from '../core/llm';
import { loadMaverickMethodology } from '../knowledge/methodology';
import { buildBenchmarkContext, getTierBenchmarks, classifyEngagementRate, parseFollowerCount } from '../knowledge/engagement-benchmarks';

export interface ProfileScore {
    overall: number;
    dimensions: {
        consistency: number;
        engagement: number;
        niche_clarity: number;
        cta_presence: number;
        bio_quality: number;
    };
}

export interface EngagementPanorama {
    profile_rate: string;         // ex: "2.34%"
    classification: string;       // "Ruim" | "Abaixo da Media" | "Bom" | "Muito Bom" | "Otimo"
    tier: string;                 // "Nano" | "Micro" | "Medio/Macro" | "Mega"
    tier_benchmark: string;       // ex: "Otimo: >4% | Bom: 2%–3.5% | Ruim: <1%"
    verdict: string;              // 2-3 sentences comparing vs market
    market_position: string;      // "Top 10%" | "Acima da Media" | "Media" | "Abaixo da Media" | "Critico"
}

export interface FunnelMix {
    tofu_pct: number;     // 0-100 — awareness/discovery content
    mofu_pct: number;     // 0-100 — nurturing/consideration content
    bofu_pct: number;     // 0-100 — conversion/sales content
    reasoning: string;    // why this mix for this profile
    tofu_focus: string;   // what TOFU content should achieve for this profile
    mofu_focus: string;   // what MOFU content should achieve
    bofu_focus: string;   // what BOFU content should achieve
}

export interface MaverickReport {
    profile: {
        username: string;
        bio: string;
        followers: string;
        following: string;
        posts_count: string;
    };
    analysis: {
        positive_points: string[];
        profile_gaps: string[];
        best_posts: { caption_preview: string; reason: string }[];
        worst_posts: { caption_preview: string; reason: string }[];
    };
    strategy: {
        diagnosis: string;
        key_concept: string;
        citation: string;
        next_steps: string[];
        profile_score: ProfileScore;
        engagement_panorama?: EngagementPanorama;
        funnel_mix?: FunnelMix;
    };
}

export interface ICP {
    product: string;            // O que o criador vende (produto/serviço/info)
    price_range: string;        // Faixa de preço (ex: "R$97–R$497")
    main_objection: string;     // Principal objeção do cliente (ex: "não tenho tempo")
    ideal_customer: string;     // Descrição do cliente ideal (ex: "mulheres 30-45, mães, querem emagrecer")
    transformation: string;     // Transformação que o produto entrega (ex: "de sedentário a ativo em 60 dias")
}

export class StrategistAgent {
    private scout: ScoutAgent;
    private scholar: ScholarEngine;
    private llm: LLMService;
    private methodology: string;

    constructor() {
        this.scout = new ScoutAgent();
        this.scholar = new ScholarEngine();
        this.llm = new LLMService('deepseek', 'minimax');
        // Load methodology once at startup — this is the LLM's "internalized knowledge"
        this.methodology = loadMaverickMethodology();
    }

    async createStrategicPlan(username: string, icp?: ICP): Promise<string> {
        // 1. Collect profile data
        let profileData: ProfileAnalysis;
        try {
            profileData = await this.scout.analyzeProfile(username);
        } catch (error) {
            throw new Error(`Scout falhou: ${error}`);
        }

        // 2. Scholar: find specific supporting citations from the books
        // (optional — enriches analysis with exact quotes, not the primary knowledge source)
        let supportingCitations = '';
        try {
            await this.scholar.loadKnowledgeBase();
            const nicheContext = [
                profileData.bio.detected_promise || '',
                profileData.bio.text,
            ].filter(Boolean).join(' ');

            const citations = await this.scholar.search(nicheContext, 5);
            if (citations.length > 0) {
                supportingCitations = citations
                    .map(c => `[${c.source}]: "${c.content.slice(0, 300)}..."`)
                    .join('\n\n');
            }
        } catch {
            // Scholar is optional — analysis proceeds without it
        }

        // 3. Strategic analysis — LLM applies internalized methodology to profile

        const postsFormatted = profileData.recent_posts.map(p => {
            const m = p.metrics;
            const metricsStr = m
                ? ` | 👍 ${m.likes} likes | 💬 ${m.comments} comentários${m.views ? ` | 👁 ${m.views} views` : ''} | 📊 ${m.engagement_rate}% eng.`
                : '';
            return `  [Post ${p.id}][${p.type}] ${p.caption}${metricsStr}`;
        }).join('\n');

        const benchmarkContext = buildBenchmarkContext(
            profileData.stats.followers,
            profileData.engagement_summary?.avg_engagement_rate?.toString(),
        );
        const tier = getTierBenchmarks(profileData.stats.followers);

        const engagementContext = profileData.engagement_summary
            ? `\nENGAJAMENTO REAL (calculado sobre ${profileData.stats.followers} seguidores):
- Taxa média de engajamento: ${profileData.engagement_summary.avg_engagement_rate}%
- Formato com melhor performance: ${profileData.engagement_summary.best_format}
- Post com maior engajamento: Post ${profileData.engagement_summary.top_post_id}
- Post com menor engajamento: Post ${profileData.engagement_summary.worst_post_id}

${benchmarkContext}`
            : `\n${benchmarkContext}`;

        const jsonSchema = `{
  "analysis": {
    "positive_points": ["string — cite o conceito/princípio aplicado", "string", "string"],
    "profile_gaps": ["string — brecha específica com nome do framework violado", "string", "string"],
    "best_posts": [
      { "caption_preview": "primeiros 70 chars", "reason": "por que funciona — cite o princípio" },
      { "caption_preview": "...", "reason": "..." }
    ],
    "worst_posts": [
      { "caption_preview": "primeiros 70 chars", "reason": "por que falha — cite o princípio violado" },
      { "caption_preview": "...", "reason": "..." }
    ]
  },
  "strategy": {
    "diagnosis": "2-3 frases: GAP central entre o perfil atual e o que a metodologia recomenda",
    "key_concept": "Nome do conceito/framework mais relevante para este perfil",
    "citation": "Trecho da metodologia que embasa o diagnóstico",
    "next_steps": [
      "Roteiro acionável 1 — específico para este perfil e nicho",
      "Roteiro acionável 2",
      "Roteiro acionável 3"
    ],
    "profile_score": {
      "overall": 0,
      "dimensions": {
        "consistency": 0,
        "engagement": 0,
        "niche_clarity": 0,
        "cta_presence": 0,
        "bio_quality": 0
      }
    },
    "engagement_panorama_verdict": "2-3 sentenças comparando a taxa de engajamento do perfil com os benchmarks de mercado para o seu porte — cite os números de referência",
    "funnel_mix": {
      "tofu_pct": 0,
      "mofu_pct": 0,
      "bofu_pct": 0,
      "reasoning": "Por que esta distribuição TOFU/MOFU/BOFU é ideal para este perfil, considerando tamanho, nicho e maturidade da audiência",
      "tofu_focus": "O que o conteúdo TOFU deve fazer especificamente para este perfil (alcance, descoberta, topo de funil)",
      "mofu_focus": "O que o conteúdo MOFU deve fazer (nurturing, autoridade, consideração)",
      "bofu_focus": "O que o conteúdo BOFU deve fazer (conversão, venda, captação de leads)"
    }
  }
}`;

        const systemPrompt = `Você é o MAVERICK STRATEGIST — o mais preciso consultor de posicionamento e conteúdo digital do Brasil.

Você internalizou completamente a seguinte metodologia. Ela define como você pensa, analisa e recomenda:

${this.methodology}

COMO VOCÊ OPERA:
- Você NÃO dá conselhos genéricos. Cada observação é ancorada em um princípio específico da metodologia.
- Você diagnostica com precisão cirúrgica — use os dados REAIS de likes, comentários e engagement rate fornecidos para identificar padrões concretos (ex: "Reels têm 3x mais engajamento que Carrosséis neste perfil").
- Quando o engagement_rate estiver abaixo de 1%, classifique como crítico. Entre 1-3%, mediano. Acima de 3%, saudável para o tamanho do perfil.
- Você cita os conceitos pelo nome: "Moeda Social (Berger)", "Sweet Spot (Pulizzi)", "PAS", "HOOK-STORY-OFFER", etc.
- No campo "engagement_panorama_verdict", escreva 2-3 frases comparando a taxa de engajamento do perfil com os benchmarks fornecidos, citando os números de referência.
- Você retorna APENAS JSON válido. Nenhum texto fora do JSON.`;

        const icpContext = icp ? `
ICP (PERFIL DE CLIENTE IDEAL) — fornecido pelo criador:
- Produto/Serviço: ${icp.product}
- Faixa de preço: ${icp.price_range}
- Principal objeção do cliente: ${icp.main_objection}
- Cliente ideal: ${icp.ideal_customer}
- Transformação entregue: ${icp.transformation}

Use este ICP para calibrar TODA a análise e estratégia:
- Avalie se o conteúdo atual fala com o cliente ideal descrito
- Verifique se os hooks atacam a principal objeção
- Calibre o funil considerando o ticket e a temperatura do público
- Nos roteiros sugeridos, direcione para atrair e converter ESTE cliente específico
` : '';

        const userPrompt = `Analise o perfil @${profileData.username} e retorne o diagnóstico estratégico completo.
${icpContext}
DADOS DO PERFIL:
- Bio: "${profileData.bio.text}"
- Seguidores: ${profileData.stats.followers}
- Seguindo: ${profileData.stats.following}
- Total de Posts: ${profileData.stats.posts_count}
- Destaques: ${profileData.highlights.has_highlights ? 'Sim' : 'Não detectados'}

POSTS RECENTES ANALISADOS (com métricas reais):
${postsFormatted || '  [Nenhum post extraído]'}
${engagementContext}

${supportingCitations ? `CITAÇÕES DIRETAS DOS LIVROS (para reforçar sua análise):\n${supportingCitations}\n` : ''}
SCORE DE PERFIL — avalie cada dimensão de 0-100 com rigor. Use os dados reais de engajamento para calibrar o score de "engagement" (não estime — calcule com base nos números acima):
- consistency: regularidade e cadência detectável de publicação
- engagement: qualidade das legendas para gerar conversa e compartilhamento
- niche_clarity: clareza de QUEM o perfil serve e COMO ele ajuda
- cta_presence: presença de CTAs explícitas na bio e nas legendas
- bio_quality: a bio tem promessa clara, diferenciação e link?
- overall: média ponderada (não arredonde para múltiplos de 5)

RETORNE APENAS O JSON ABAIXO preenchido:
${jsonSchema}`;

        const analysisResult = await this.llm.analyzeJson<{
            analysis: MaverickReport['analysis'];
            strategy: MaverickReport['strategy'] & { engagement_panorama_verdict?: string; funnel_mix?: FunnelMix };
        }>(userPrompt, jsonSchema, systemPrompt);

        const fullReport: MaverickReport = {
            profile: {
                username: profileData.username,
                bio: profileData.bio.text,
                followers: profileData.stats.followers,
                following: profileData.stats.following,
                posts_count: profileData.stats.posts_count,
            },
            analysis: analysisResult.analysis,
            strategy: analysisResult.strategy,
        };

        // Capturar funnel_mix do LLM
        if (analysisResult.strategy.funnel_mix) {
            fullReport.strategy.funnel_mix = analysisResult.strategy.funnel_mix;
        }

        // Garantir engagement_panorama com dados reais — não depender do LLM
        if (profileData.engagement_summary) {
            const tier = getTierBenchmarks(profileData.stats.followers);
            const rate = profileData.engagement_summary.avg_engagement_rate;
            const classification = classifyEngagementRate(rate);
            const tierBenchmark = `Ótimo: >${tier.otimo}% | Bom: ${tier.bom_min}%–${tier.bom_max}% | Ruim: <${tier.ruim}%`;

            const marketPosition =
                rate >= tier.otimo ? 'Top 10%' :
                rate >= tier.bom_max ? 'Acima da Media' :
                rate >= tier.bom_min ? 'Media' :
                rate >= tier.ruim ? 'Abaixo da Media' : 'Critico';

            // Usa o verdict do LLM se disponível, senão monta um template
            const llmVerdict = (analysisResult.strategy as any).engagement_panorama_verdict || fullReport.strategy.engagement_panorama?.verdict;
            const verdict = llmVerdict || (
                `Taxa de ${rate.toFixed(2)}% para perfil ${tier.tierName} (${tier.followerRange}). ` +
                `Referência de mercado: Ótimo >${tier.otimo}%, Bom ${tier.bom_min}%–${tier.bom_max}%. ` +
                (classification === 'Otimo' ? 'Performance excepcional — top do mercado para o seu porte.' :
                 classification === 'Muito Bom' ? 'Performance forte — acima da média para o seu segmento.' :
                 classification === 'Bom' ? 'Performance saudável dentro do padrão de mercado.' :
                 classification === 'Abaixo da Media' ? 'Alerta: engajamento abaixo da média — estratégia de conteúdo precisa de revisão.' :
                 'Crítico: risco de invisibilidade algorítmica — revisão urgente de estratégia necessária.')
            );

            fullReport.strategy.engagement_panorama = {
                profile_rate: `${rate.toFixed(2)}%`,
                classification,
                tier: tier.tierName,
                tier_benchmark: tierBenchmark,
                verdict,
                market_position: marketPosition,
            };
        }

        return JSON.stringify(fullReport, null, 2);
    }
}
