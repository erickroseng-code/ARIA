/**
 * Maverick Plan — Scout + Strategist autocontido para produção (ARIA Docker)
 * Gera o plano estratégico sem dependência de squads/maverick
 */
import fs from 'fs';
import path from 'path';
import { ApifyClient } from 'apify-client';

// ─── Methodology loader ────────────────────────────────────────────────────────

const METHODOLOGY_DIR = path.join(__dirname, 'methodology');

function loadMethodology(): string {
  const read = (p: string): string => {
    try {
      return fs.readFileSync(p, 'utf-8').trim();
    } catch {
      return '';
    }
  };

  const manifesto = read(path.join(METHODOLOGY_DIR, 'manifesto.txt'));
  const deepIndex = read(path.join(METHODOLOGY_DIR, 'deep_index.md'));

  const frameworksDir = path.join(METHODOLOGY_DIR, 'frameworks');
  const frameworkTexts: string[] = [];
  if (fs.existsSync(frameworksDir)) {
    const files = fs.readdirSync(frameworksDir).sort();
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.md')) {
        const content = read(path.join(frameworksDir, file));
        if (content) frameworkTexts.push(content);
      }
    }
  }

  const result = [
    manifesto ? `# FILOSOFIA MAVERICK\n${manifesto}` : '',
    deepIndex ? `# METODOLOGIA — PRINCÍPIOS DOS LIVROS\n${deepIndex}` : '',
    frameworkTexts.length > 0 ? `# FRAMEWORKS DE COPYWRITING E PERSUASÃO\n${frameworkTexts.join('\n\n---\n\n')}` : '',
  ].filter(Boolean).join('\n\n---\n\n');

  console.log(`[METHODOLOGY] carregado: ${result.length} chars`);
  return result;
}

// ─── Engagement benchmarks ────────────────────────────────────────────────────

interface TierBenchmarks {
  tierName: string;
  followerRange: string;
  otimo: number;
  bom_min: number;
  bom_max: number;
  ruim: number;
}

const TIER_BENCHMARKS: TierBenchmarks[] = [
  { tierName: 'Nano',        followerRange: '< 10k',      otimo: 7.0, bom_min: 3.5, bom_max: 6.0, ruim: 1.5 },
  { tierName: 'Micro',       followerRange: '10k – 100k', otimo: 4.0, bom_min: 2.0, bom_max: 3.5, ruim: 1.0 },
  { tierName: 'Medio/Macro', followerRange: '100k – 1M',  otimo: 3.0, bom_min: 1.2, bom_max: 2.5, ruim: 0.7 },
  { tierName: 'Mega',        followerRange: '> 1M',        otimo: 1.5, bom_min: 0.5, bom_max: 1.2, ruim: 0.4 },
];

function parseFollowerCount(str: string): number {
  const s = str.toLowerCase().replace(',', '.').replace(/\s/g, '');
  if (s.includes('m')) return parseFloat(s) * 1_000_000;
  if (s.includes('k')) return parseFloat(s) * 1_000;
  return parseFloat(s.replace(/[^\d.]/g, '')) || 0;
}

function getTierBenchmarks(followersStr: string): TierBenchmarks {
  const count = parseFollowerCount(followersStr);
  if (count < 10_000)    return TIER_BENCHMARKS[0];
  if (count < 100_000)   return TIER_BENCHMARKS[1];
  if (count < 1_000_000) return TIER_BENCHMARKS[2];
  return TIER_BENCHMARKS[3];
}

function classifyEngagementRate(rate: number): string {
  if (rate < 0.50) return 'Ruim';
  if (rate < 1.0)  return 'Abaixo da Media';
  if (rate < 3.0)  return 'Bom';
  if (rate < 6.0)  return 'Muito Bom';
  return 'Otimo';
}

function buildBenchmarkContext(followersStr: string, avgRate: string | undefined): string {
  const tier = getTierBenchmarks(followersStr);
  const rate = parseFloat(avgRate ?? '0') || 0;
  const classification = classifyEngagementRate(rate);

  return `BENCHMARKS DE ENGAJAMENTO INSTAGRAM 2025-2026 (Fonte: Socialinsider, InfluenceFlow, DataReportal):

Porte do perfil analisado: ${tier.tierName} (${tier.followerRange})
Taxa média deste perfil: ${rate.toFixed(2)}%
Classificação atual: ${classification}

Referências para ${tier.tierName}:
  - Ótimo:        > ${tier.otimo}%
  - Bom/Muito Bom: ${tier.bom_min}% – ${tier.bom_max}%
  - Ruim:          < ${tier.ruim}%

Escala global de mercado:
  < 0,50%  → Ruim (risco de invisibilidade algorítmica)
  0,5–1,0% → Abaixo da Média
  1,0–3,0% → Bom (padrão para marcas líderes)
  3,0–6,0% → Muito Bom (micro-influenciadores e nichos)
  > 6,0%   → Ótimo (excepcional)

Performance por formato:
  Carrossel:   0,55%–0,69% — maior engajamento orgânico; gera salvamentos
  Reels:       0,50%–1,23% — 2,25x mais alcance; 55% de views de não-seguidores
  Foto estática: 0,37%–0,50% — queda de 17% ao ano; uso seletivo
  Vídeo de feed: 0,55%–0,90% — contexto e explicação

Signals de valor (peso algorítmico 2026):
  Compartilhamento por DM > Salvamento > Comentário > Curtida

Use esses dados para calibrar o campo "engagement_panorama" com precisão comparativa.`.trim();
}

function calculateEngagementScore(rate: number, tier: TierBenchmarks): number {
  if (rate >= tier.otimo) {
    return Math.min(100, Math.round(80 + (rate - tier.otimo) / Math.max(tier.otimo, 0.1) * 20));
  } else if (rate >= tier.bom_max) {
    return Math.round(65 + (rate - tier.bom_max) / Math.max(tier.otimo - tier.bom_max, 0.1) * 15);
  } else if (rate >= tier.bom_min) {
    return Math.round(50 + (rate - tier.bom_min) / Math.max(tier.bom_max - tier.bom_min, 0.1) * 15);
  } else if (rate >= tier.ruim) {
    return Math.round(25 + (rate - tier.ruim) / Math.max(tier.bom_min - tier.ruim, 0.1) * 25);
  } else {
    return Math.round(Math.max(0, rate / Math.max(tier.ruim, 0.1) * 25));
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ICP {
  product: string;
  price_range: string;
  main_objection: string;
  ideal_customer: string;
  transformation: string;
}

interface PostMetrics {
  likes: number;
  comments: number;
  views?: number;
  engagement_rate: number;
}

interface RecentPost {
  id: number;
  type: 'Image' | 'Video' | 'Carousel';
  caption: string;
  metrics?: PostMetrics;
}

interface EngagementSummary {
  avg_engagement_rate: number;
  best_format: string;
  top_post_id: number;
  worst_post_id: number;
}

interface ProfileData {
  username: string;
  stats: { followers: string; following: string; posts_count: string };
  bio: { text: string; detected_promise: string };
  highlights: { has_highlights: boolean };
  recent_posts: RecentPost[];
  engagement_summary?: EngagementSummary;
}

// ─── Scout (Apify) ────────────────────────────────────────────────────────────

function inferPromise(bio: string): string {
  const b = bio.toLowerCase();
  if (b.includes('ajudo')) return 'Promessa de ajuda direta/mentoria.';
  if (b.includes('ensino')) return 'Promessa educacional.';
  if (b.includes('vendas') || b.includes('fatur')) return 'Promessa de resultado financeiro.';
  return 'Marca pessoal/lifestyle.';
}

function computeEngagementSummary(posts: RecentPost[], followers: number): EngagementSummary | undefined {
  if (posts.length === 0 || followers === 0) return undefined;
  const withMetrics = posts.filter(p => p.metrics);
  if (withMetrics.length === 0) return undefined;

  const avg = withMetrics.reduce((sum, p) => sum + p.metrics!.engagement_rate, 0) / withMetrics.length;

  const byFormat: Record<string, number[]> = {};
  for (const p of withMetrics) {
    if (!byFormat[p.type]) byFormat[p.type] = [];
    byFormat[p.type].push(p.metrics!.engagement_rate);
  }
  const best_format = Object.entries(byFormat)
    .map(([fmt, rates]) => ({ fmt, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.fmt || 'Image';

  const sorted = [...withMetrics].sort((a, b) => b.metrics!.engagement_rate - a.metrics!.engagement_rate);

  return {
    avg_engagement_rate: parseFloat(avg.toFixed(2)),
    best_format,
    top_post_id: sorted[0].id,
    worst_post_id: sorted[sorted.length - 1].id,
  };
}

async function scoutProfile(username: string): Promise<ProfileData> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN não configurado');

  const client = new ApifyClient({ token });
  const run = await client.actor('apify/instagram-profile-scraper').call({
    usernames: [username],
    resultsLimit: 12,
  });

  const { items } = await client.dataset(run.defaultDatasetId!).listItems();
  if (!items || items.length === 0) {
    throw new Error(`Nenhum dado do Apify para @${username}. Perfil pode ser privado ou inexistente.`);
  }

  const profile = items[0] as any;
  const followers = profile.followersCount || 0;

  const posts: RecentPost[] = (profile.latestPosts || []).slice(0, 12).map((p: any, i: number) => {
    const likes = p.likesCount || 0;
    const comments = p.commentsCount || 0;
    const engagement_rate = followers > 0
      ? parseFloat(((likes + comments) / followers * 100).toFixed(2))
      : 0;
    return {
      id: i + 1,
      type: (p.type === 'Video' ? 'Video' : (p.images?.length > 1 ? 'Carousel' : 'Image')) as RecentPost['type'],
      caption: (p.caption || '').substring(0, 300),
      metrics: { likes, comments, views: p.videoPlayCount || p.videoViewCount, engagement_rate },
    };
  });

  return {
    username: profile.username || username,
    stats: {
      followers: (followers as number).toLocaleString('pt-BR'),
      following: (profile.followsCount || 0).toLocaleString('pt-BR'),
      posts_count: (profile.postsCount || posts.length).toLocaleString('pt-BR'),
    },
    bio: {
      text: profile.biography || '',
      detected_promise: inferPromise(profile.biography || ''),
    },
    highlights: {
      has_highlights: (profile.highlightReelsCount || 0) > 0,
    },
    recent_posts: posts,
    engagement_summary: computeEngagementSummary(posts, followers),
  };
}

// ─── LLM helper ───────────────────────────────────────────────────────────────

async function llmJson<T>(prompt: string, system: string): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  for (const model of ['deepseek/deepseek-v3.2', 'minimax/minimax-m2.5']) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://aria-api.onrender.com',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const data = await res.json() as any;
      const raw: string = data?.choices?.[0]?.message?.content || '';
      if (!raw) continue;

      // Strip markdown fences
      let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try { return JSON.parse(text) as T; } catch { /* try extraction */ }
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]) as T;
    } catch (err) {
      process.stderr.write(`[WARN][plan] modelo ${model} falhou: ${err}\n`);
    }
  }
  throw new Error('Todos os modelos falharam ao gerar JSON do plano');
}

// ─── Strategist ───────────────────────────────────────────────────────────────

const STRATEGY_JSON_SCHEMA = `{
  "analysis": {
    "positive_points": ["string", "string", "string"],
    "profile_gaps": ["string", "string", "string"],
    "best_posts": [
      { "caption_preview": "primeiros 70 chars", "reason": "por que funciona" },
      { "caption_preview": "...", "reason": "..." }
    ],
    "worst_posts": [
      { "caption_preview": "primeiros 70 chars", "reason": "por que falha" },
      { "caption_preview": "...", "reason": "..." }
    ]
  },
  "strategy": {
    "diagnosis": "2-3 frases: GAP central entre o perfil atual e o que a metodologia recomenda",
    "key_concept": "Nome do conceito/framework mais relevante para este perfil",
    "citation": "Trecho da metodologia que embasa o diagnóstico",
    "next_steps": ["Roteiro acionável 1", "Roteiro acionável 2", "Roteiro acionável 3"],
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
    "engagement_panorama_verdict": "2-3 sentenças comparando a taxa de engajamento com benchmarks de mercado",
    "funnel_mix": {
      "tofu_pct": 0,
      "mofu_pct": 0,
      "bofu_pct": 0,
      "reasoning": "Por que esta distribuição TOFU/MOFU/BOFU é ideal para este perfil",
      "tofu_focus": "O que o conteúdo TOFU deve fazer especificamente para este perfil",
      "mofu_focus": "O que o conteúdo MOFU deve fazer",
      "bofu_focus": "O que o conteúdo BOFU deve fazer"
    },
    "suggested_icp": {
      "inferred_audience": "Descrição do público provável — faixa etária, ocupação, situação, aspiração",
      "inferred_product": "O que o criador provavelmente vende ou deveria vender",
      "recommended_positioning": "1-2 frases de posicionamento recomendado",
      "main_pain_addressed": "A dor principal que o conteúdo já aborda (ou deveria abordar)",
      "icp_next_steps": ["Ação concreta 1", "Ação concreta 2", "Ação concreta 3"]
    }
  }
}`;

async function runStrategist(profileData: ProfileData, methodology: string, icp?: ICP): Promise<string> {
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

  const icpContext = icp ? `
ICP (PERFIL DE CLIENTE IDEAL) — fornecido pelo criador:
- Produto/Serviço: ${icp.product}
- Faixa de preço: ${icp.price_range}
- Principal objeção do cliente: ${icp.main_objection}
- Cliente ideal: ${icp.ideal_customer}
- Transformação entregue: ${icp.transformation}

Use este ICP para calibrar TODA a análise e estratégia.
` : '';

  const systemPrompt = `Você é o MAVERICK STRATEGIST — o mais preciso consultor de posicionamento e conteúdo digital do Brasil.

Você internalizou completamente a seguinte metodologia. Ela define como você pensa, analisa e recomenda:

${methodology}

COMO VOCÊ OPERA:
- Você NÃO dá conselhos genéricos. Cada observação é ancorada em um princípio específico da metodologia.
- Você diagnostica com precisão cirúrgica — use os dados REAIS de likes, comentários e engagement rate fornecidos.
- Quando o engagement_rate estiver abaixo de 1%, classifique como crítico. Entre 1-3%, mediano. Acima de 3%, saudável.
- Você cita os conceitos pelo nome: "Moeda Social (Berger)", "Sweet Spot (Pulizzi)", "PAS", "HOOK-STORY-OFFER", etc.
- No campo "engagement_panorama_verdict", escreva 2-3 frases comparando a taxa de engajamento com os benchmarks, citando os números.
- No campo "suggested_icp": ${icp ? 'o criador JÁ FORNECEU contexto de negócio. Use-o para VALIDAR e REFINAR.' : 'o criador NÃO forneceu contexto. INFIRA com base exclusivamente nos dados do perfil. Seja específico.'}
- Você retorna APENAS JSON válido. Nenhum texto fora do JSON.`;

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

SCORE DE PERFIL — avalie cada dimensão de 0-100 com rigor:
- consistency: regularidade e cadência detectável de publicação
- engagement: qualidade das legendas para gerar conversa e compartilhamento
- niche_clarity: clareza de QUEM o perfil serve e COMO ele ajuda
- cta_presence: presença de CTAs explícitas na bio e nas legendas
- bio_quality: a bio tem promessa clara, diferenciação e link?
- overall: média ponderada (não arredonde para múltiplos de 5)

RETORNE APENAS O JSON ABAIXO preenchido:
${STRATEGY_JSON_SCHEMA}`;

  const analysisResult = await llmJson<any>(
    userPrompt + '\n\nIMPORTANTE: Responda APENAS com um JSON válido. Nada além do JSON puro.',
    systemPrompt,
  );

  // Build full report
  const fullReport: any = {
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

  // Capture funnel_mix
  if (analysisResult.strategy?.funnel_mix) {
    fullReport.strategy.funnel_mix = analysisResult.strategy.funnel_mix;
  }

  // Capture suggested_icp with source flag
  if (analysisResult.strategy?.suggested_icp) {
    fullReport.strategy.suggested_icp = {
      ...analysisResult.strategy.suggested_icp,
      icp_source: icp ? 'provided' : 'inferred',
    };
  }

  // Override engagement score with deterministic calculation
  if (fullReport.strategy?.profile_score && profileData.engagement_summary) {
    const rate = profileData.engagement_summary.avg_engagement_rate;
    const engScore = calculateEngagementScore(rate, tier);
    fullReport.strategy.profile_score.dimensions.engagement = engScore;
    const d = fullReport.strategy.profile_score.dimensions;
    fullReport.strategy.profile_score.overall = Math.round(
      (d.consistency + d.engagement + d.niche_clarity + d.cta_presence + d.bio_quality) / 5,
    );
  }

  // Build deterministic engagement_panorama
  if (profileData.engagement_summary) {
    const rate = profileData.engagement_summary.avg_engagement_rate;
    const classification = classifyEngagementRate(rate);
    const tierBenchmark = `Ótimo: >${tier.otimo}% | Bom: ${tier.bom_min}%–${tier.bom_max}% | Ruim: <${tier.ruim}%`;
    const marketPosition =
      rate >= tier.otimo    ? 'Top 10%' :
      rate >= tier.bom_max  ? 'Acima da Media' :
      rate >= tier.bom_min  ? 'Media' :
      rate >= tier.ruim     ? 'Abaixo da Media' : 'Critico';

    const llmVerdict = analysisResult.strategy?.engagement_panorama_verdict
      || fullReport.strategy.engagement_panorama?.verdict;
    const verdict = llmVerdict || (
      `Taxa de ${rate.toFixed(2)}% para perfil ${tier.tierName} (${tier.followerRange}). ` +
      `Referência de mercado: Ótimo >${tier.otimo}%, Bom ${tier.bom_min}%–${tier.bom_max}%.`
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generatePlan(
  username: string,
  icp?: ICP,
  onStep?: (msg: string) => void,
): Promise<string> {
  const methodology = loadMethodology();

  onStep?.('🔍 Coletando dados do perfil via Scout...');
  const profileData = await scoutProfile(username);

  onStep?.('🧠 Analisando perfil com o Strategist...');
  const planJson = await runStrategist(profileData, methodology, icp);

  return planJson;
}
