/**
 * Instagram Engagement Benchmarks 2025-2026
 * Source: "Benchmarks de Engajamento Instagram: Ruim, Bom, Otimo" (March 2026)
 * Brazilian market data from Socialinsider, InfluenceFlow, DataReportal, Metricool.
 */

export interface TierBenchmarks {
    tierName: string;
    followerRange: string;
    otimo: number;       // >= = Otimo
    bom_min: number;     // >= = Bom/Muito Bom range bottom
    bom_max: number;     // < = below Otimo
    ruim: number;        // < = Ruim
}

export const TIER_BENCHMARKS: TierBenchmarks[] = [
    { tierName: 'Nano', followerRange: '< 10k', otimo: 7.0, bom_min: 3.5, bom_max: 6.0, ruim: 1.5 },
    { tierName: 'Micro', followerRange: '10k – 100k', otimo: 4.0, bom_min: 2.0, bom_max: 3.5, ruim: 1.0 },
    { tierName: 'Medio/Macro', followerRange: '100k – 1M', otimo: 3.0, bom_min: 1.2, bom_max: 2.5, ruim: 0.7 },
    { tierName: 'Mega', followerRange: '> 1M', otimo: 1.5, bom_min: 0.5, bom_max: 1.2, ruim: 0.4 },
];

export const GLOBAL_SCALE = [
    { label: 'Ruim', min: 0, max: 0.50, description: 'Critico; risco de invisibilidade algorítmica' },
    { label: 'Abaixo da Media', min: 0.50, max: 1.0, description: 'Alerta; conteudo pode estar saturado ou irrelevante' },
    { label: 'Bom', min: 1.0, max: 3.0, description: 'Saudavel; desempenho padrao para marcas lideres' },
    { label: 'Muito Bom', min: 3.0, max: 6.0, description: 'Forte; comum em micro-influenciadores e nichos' },
    { label: 'Otimo', min: 6.0, max: Infinity, description: 'Excepcional; alta viralidade e lealdade de marca' },
];

export const FORMAT_BENCHMARKS = {
    carousel: { min: 0.55, max: 0.69, highlight: '30% mais engajamento que fotos estaticas; gera salvamentos' },
    reels: { min: 0.50, max: 1.23, highlight: '2.25x mais alcance que fotos estaticas; 55% de views de nao-seguidores' },
    static_image: { min: 0.37, max: 0.50, highlight: 'Queda de 17% ao ano; uso seletivo recomendado' },
    feed_video: { min: 0.55, max: 0.90, highlight: 'Contexto e explicacao; performance estavel' },
};

export const SECTOR_BENCHMARKS: Record<string, { min: number; max: number; format: string }> = {
    'Educacao / Terceiro Setor': { min: 3.5, max: 4.4, format: 'Carrosseis Educativos' },
    'Imobiliario / Juridico': { min: 3.0, max: 4.4, format: 'Reels de Visitacao / Dicas' },
    'Financas / Seguros': { min: 1.8, max: 3.8, format: 'Carrosseis de Educacao Financeira' },
    'Varejo / Bens de Consumo': { min: 1.0, max: 3.0, format: 'Reels de Demonstracao / UGC' },
    'Saude / Farmaceutica': { min: 1.6, max: 3.7, format: 'Videos de Especialistas' },
    'Midia / Entretenimento': { min: 0.8, max: 3.0, format: 'Reels Virais / Noticias Curtas' },
    'Tecnologia / B2B': { min: 0.5, max: 1.5, format: 'Carrosseis de Dados' },
    'Moda / Beleza / Fitness': { min: 2.5, max: 5.1, format: 'Reels Aspiracionais / Tutoriais' },
};

/** Parse follower string like "142K", "1.2M", "14200" to a number */
export function parseFollowerCount(str: string): number {
    const s = str.toLowerCase().replace(',', '.').replace(/\s/g, '');
    if (s.includes('m')) return parseFloat(s) * 1_000_000;
    if (s.includes('k')) return parseFloat(s) * 1_000;
    return parseFloat(s.replace(/[^\d.]/g, '')) || 0;
}

/** Get tier benchmarks based on follower count string */
export function getTierBenchmarks(followersStr: string): TierBenchmarks {
    const count = parseFollowerCount(followersStr);
    if (count < 10_000) return TIER_BENCHMARKS[0];
    if (count < 100_000) return TIER_BENCHMARKS[1];
    if (count < 1_000_000) return TIER_BENCHMARKS[2];
    return TIER_BENCHMARKS[3];
}

/** Classify engagement rate using global scale */
export function classifyEngagementRate(rate: number): string {
    if (rate < 0.50) return 'Ruim';
    if (rate < 1.0) return 'Abaixo da Media';
    if (rate < 3.0) return 'Bom';
    if (rate < 6.0) return 'Muito Bom';
    return 'Otimo';
}

/** Build a benchmark context string to inject into the LLM prompt */
export function buildBenchmarkContext(followersStr: string, avgRate: string | undefined): string {
    const tier = getTierBenchmarks(followersStr);
    const rate = parseFloat(avgRate ?? '0') || 0;
    const classification = classifyEngagementRate(rate);

    return `
BENCHMARKS DE ENGAJAMENTO INSTAGRAM 2025-2026 (Fonte: Socialinsider, InfluenceFlow, DataReportal):

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
