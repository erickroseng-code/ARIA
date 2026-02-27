import { ScoutAgent, ProfileAnalysis } from '../scout/index';
import { ScholarEngine } from '../scholar/engine';
import { LLMService } from '../core/llm';

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
    };
}

export class StrategistAgent {
    private scout: ScoutAgent;
    private scholar: ScholarEngine;
    private llm: LLMService;

    constructor() {
        this.scout = new ScoutAgent();
        this.scholar = new ScholarEngine();
        this.llm = new LLMService();
    }

    async createStrategicPlan(username: string): Promise<string> {
        console.log(`🧠 Strategist: Iniciando análise para @${username}...`);

        // 1. Coleta de Dados (A Realidade)
        console.log('--- Passo 1: Scout (Análise de Perfil) ---');
        let profileData: ProfileAnalysis;
        try {
            profileData = await this.scout.analyzeProfile(username);
        } catch (error) {
            throw new Error(`Scout falhou: ${error}`);
        }

        // 2. Busca de Conhecimento (O Ideal)
        console.log('--- Passo 2: Scholar (Busca de Referências) ---');
        await this.scholar.loadKnowledgeBase();

        const query = (profileData.bio.detected_promise || '') + ' estratégia conteúdo autoridade vendas posicionamento';
        const knowledge = this.scholar.search(query, 10);
        const knowledgeText = knowledge.map(k => `[Fonte: ${k.source}]\n${k.content}`).join('\n\n---\n\n');

        // 3. Análise Estratégica com IA — retorna JSON estruturado
        console.log('--- Passo 3: Raciocínio Estratégico (LLM) ---');

        const postsFormatted = profileData.recent_posts
            .map(p => `  [Post ${p.id}] ${p.caption}`)
            .join('\n');

        const jsonSchema = `{
  "analysis": {
    "positive_points": ["string (cite conceito do Expert)", "string", "string"],
    "profile_gaps": ["string (brecha específica baseada no Expert)", "string", "string"],
    "best_posts": [
      { "caption_preview": "primeiros 70 chars da legenda", "reason": "Por que funciona segundo o Expert (cite fonte)" },
      { "caption_preview": "...", "reason": "..." }
    ],
    "worst_posts": [
      { "caption_preview": "primeiros 70 chars da legenda", "reason": "Por que falha segundo o Expert (seja específico)" },
      { "caption_preview": "...", "reason": "..." }
    ]
  },
  "strategy": {
    "diagnosis": "2-3 frases: o GAP central entre o que o perfil faz e o que o Expert recomenda",
    "key_concept": "Nome do conceito do Expert mais relevante para este perfil",
    "citation": "Trecho exato ou parafraseado da base de conhecimento que embase o diagnóstico",
    "next_steps": [
      "Ideia de roteiro 1 — específica e acionável",
      "Ideia de roteiro 2",
      "Ideia de roteiro 3"
    ]
  }
}`;

        const prompt = `VOCÊ É O MAVERICK STRATEGIST — um consultor de conteúdo que usa EXCLUSIVAMENTE a metodologia do Expert abaixo.

CONHECIMENTO DO EXPERT (Sua única referência):
${knowledgeText || 'Nenhum conhecimento específico encontrado. Use princípios de marketing de autoridade e posicionamento.'}

DADOS EXTRAÍDOS DO PERFIL @${profileData.username}:
- Bio: "${profileData.bio.text}"
- Seguidores: ${profileData.stats.followers}
- Seguindo: ${profileData.stats.following}
- Total de Posts: ${profileData.stats.posts_count}
- Destaques: ${profileData.highlights.has_highlights ? 'Sim' : 'Não detectados'}
- Posts Recentes Analisados:
${postsFormatted || '  [Nenhum post extraído]'}

REGRAS CRÍTICAS:
1. NÃO use conselhos genéricos. USE os conceitos e vocabulário do Expert.
2. CITE a fonte de cada argumento (ex: "Segundo o Manifesto...", "O Expert afirma em [Fonte]...").
3. Identifique melhores e piores posts baseado nos critérios do Expert.
4. O diagnóstico deve ser cirúrgico, não genérico.

RETORNE APENAS JSON VÁLIDO sem markdown, sem texto fora do JSON:
${jsonSchema}`;

        const analysisResult = await this.llm.analyzeJson<MaverickReport['analysis'] & { strategy: MaverickReport['strategy'] }>(
            prompt,
            jsonSchema
        );

        // Montar relatório completo com dados do Scout + análise do LLM
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

        return JSON.stringify(fullReport, null, 2);
    }
}
