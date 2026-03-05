import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';
import { loadMaverickMethodology } from '../knowledge/methodology';
import { buildFormatMenu, buildFormatInstructions } from '../knowledge/content-formats';

export interface ScriptOutput {
    title: string;
    format: string;           // "Reels" | "Carrossel"
    format_type: string;      // ex: "reels_react", "carrossel_educativo"
    format_name: string;      // ex: "Reels React", "Carrossel Educativo"
    funnel_stage: string;     // "TOFU" | "MOFU" | "BOFU"
    funnel_goal: string;      // objetivo específico deste conteúdo no funil
    conversion_angle: string; // ângulo de conversão — o que este conteúdo faz o espectador PENSAR/SENTIR/FAZER
    why_format: string;       // por que este formato para este tema
    framework: string;
    why_framework: string;
    hook: string;
    body: string;
    visual_cues: string[];
    filming_tip: string;      // instrução prática de como gravar
    cta: string;
}

const SCRIPT_SCHEMA = `{
  "title": "string — título criativo do roteiro",
  "format": "Reels|Carrossel",
  "format_type": "id do formato escolhido (ex: reels_react, carrossel_educativo)",
  "format_name": "nome legível do formato (ex: Reels React, Carrossel Educativo)",
  "funnel_stage": "TOFU|MOFU|BOFU",
  "funnel_goal": "string — objetivo específico deste conteúdo no funil (ex: gerar alcance, construir autoridade, captar lead)",
  "conversion_angle": "string — o ângulo de conversão: o que este conteúdo faz o espectador PENSAR/SENTIR/FAZER após assistir",
  "why_format": "string — 1 frase explicando por que este formato específico é o melhor para este tema",
  "framework": "nome exato do framework de copywriting (ex: PAS, AIDA, HOOK_STORY_OFFER)",
  "why_framework": "string — 1 frase explicando por que este framework para este formato e objetivo",
  "hook": "string — gancho COMPLETO dos primeiros 3 segundos ou slide 1. Deve ser brutal e irresistível.",
  "body": "string — corpo completo do roteiro seguindo a estrutura do formato escolhido, com indicações [Visual: ...] e [Tom: ...] intercaladas",
  "visual_cues": ["indicação de produção 1", "indicação de câmera ou edição 2"],
  "filming_tip": "string — instrução prática e objetiva de como gravar/produzir este conteúdo específico",
  "cta": "string — chamada para ação específica, concreta e irresistível. Deve ser coerente com o funnel_stage."
}`;

export class CopywriterAgent {
    private llm: LLMService;
    private scholar: ScholarEngine;
    private methodology: string;

    constructor() {
        this.llm = new LLMService('minimax', 'deepseek');
        this.scholar = new ScholarEngine();
        this.methodology = loadMaverickMethodology();
    }

    async generateScripts(strategicPlan: string): Promise<string> {
        const formatMenu = buildFormatMenu();

        // 1. Extract script ideas + choose format, funnel stage and framework
        const ideas = await this.llm.analyzeJson<{
            title: string;
            context: string;
            format_type: string;
            funnel_stage: string;
            funnel_goal: string;
            recommended_framework: string;
        }[]>(
            `Analise o plano estratégico abaixo e extraia as ideias de roteiros sugeridas.
Para cada ideia, escolha o formato mais adequado ao tema e defina o estágio de funil correto.

FORMATOS DISPONÍVEIS:
${formatMenu}

ESTÁGIOS DE FUNIL:
- TOFU (Top of Funnel): Conteúdo de descoberta e alcance. Objetivo: atrair novos seguidores que ainda não te conhecem. Tom: educativo, surpreendente, polêmico, viralizável. CTA: seguir, salvar, compartilhar.
- MOFU (Middle of Funnel): Conteúdo de autoridade e consideração. Objetivo: aprofundar confiança com quem já te segue. Tom: técnico, detalhado, cases, bastidores. CTA: comentar, entrar na lista, baixar material.
- BOFU (Bottom of Funnel): Conteúdo de conversão. Objetivo: transformar seguidor em cliente/lead. Tom: direto, oferta clara, urgência, prova social. CTA: clicar no link, enviar DM, comprar.

REGRAS DE SELEÇÃO:
- Varie formatos entre as ideias — não use o mesmo tipo para todos
- Varie estágios de funil: inclua mix de TOFU/MOFU/BOFU conforme o funnel_mix do plano estratégico
- Prefira Reels virais (react, trend_meme) para TOFU
- Use carrossel educativo ou narrativo para MOFU
- Use Reels diretos ou carrossel de prova social para BOFU
- Adapte o framework ao estágio: PAS/HOOK_STORY_OFFER para TOFU, AIDA para MOFU, PAS/BAB para BOFU

PLANO:
${strategicPlan}`,
            '[{ "title": "Título da ideia", "context": "O que comunicar e para quem", "format_type": "id do formato (ex: reels_react, carrossel_educativo)", "funnel_stage": "TOFU|MOFU|BOFU", "funnel_goal": "objetivo específico deste conteúdo no funil", "recommended_framework": "AIDA|PAS|BAB|HOOK_STORY_OFFER|OPEN_LOOP|VOSS" }]'
        );

        // 2. Optional: supporting quotes from the knowledge base
        let bookCitations = '';
        try {
            await this.scholar.loadKnowledgeBase();
            const niche = ideas.map(i => i.context).join(' ');
            const citations = await this.scholar.search(niche, 3);
            if (citations.length > 0) {
                bookCitations = citations
                    .map(c => `[${c.source}]: "${c.content.slice(0, 250)}..."`)
                    .join('\n\n');
            }
        } catch {
            // Scholar is optional
        }

        const systemPrompt = `Você é o MAVERICK COPYWRITER — o melhor redator de conteúdo estratégico do Brasil.

Você internalizou completamente os seguintes frameworks e princípios de copywriting:

${this.methodology}

COMO VOCÊ ESCREVE:
- Você NUNCA escreve copy genérica. Cada palavra serve um propósito calculado.
- O GANCHO (hook) é não negociável — deve ser brutal, específico e irresistível nos primeiros 3 segundos.
- Você inclui indicações visuais [Visual: ...] e de tom [Tom: ...] intercaladas no corpo do roteiro.
- Você retorna APENAS JSON válido. Nenhum texto fora do JSON.`;

        // 3. Generate ALL scripts in PARALLEL — major performance improvement
        const scriptPromises = ideas.map(idea => this.generateSingleScript(
            { ...idea, funnel_stage: idea.funnel_stage || 'TOFU', funnel_goal: idea.funnel_goal || '' },
            bookCitations,
            systemPrompt,
        ));
        const scripts: ScriptOutput[] = await Promise.all(scriptPromises);

        return JSON.stringify(scripts, null, 2);
    }

    private async generateSingleScript(
        idea: { title: string; context: string; format_type: string; funnel_stage: string; funnel_goal: string; recommended_framework: string },
        bookCitations: string,
        systemPrompt: string,
    ): Promise<ScriptOutput> {
        const formatInstructions = buildFormatInstructions(idea.format_type);

        const funnelInstructions: Record<string, string> = {
            TOFU: `ESTÁGIO TOFU (Topo de Funil — Descoberta):
- Objetivo: alcançar pessoas que AINDA NÃO te conhecem
- Tom: surpreendente, polêmico, educativo, viralizável
- Hook: deve parar o scroll de quem não te segue — use Dissonância Absoluta, Inimigo Oculto ou Loop de Autoridade
- CTA: leve — seguir, salvar, comentar, compartilhar. NUNCA vender diretamente.`,
            MOFU: `ESTÁGIO MOFU (Meio de Funil — Consideração):
- Objetivo: aprofundar confiança com quem JÁ TE SEGUE
- Tom: técnico, detalhado, bastidores, cases reais com números
- Hook: específico para o nicho — fala diretamente à dor do avatar comprometido
- CTA: médio — entrar na lista, comentar para receber material, baixar guia gratuito`,
            BOFU: `ESTÁGIO BOFU (Fundo de Funil — Conversão):
- Objetivo: converter seguidor em CLIENTE ou LEAD QUALIFICADO
- Tom: direto, urgente, prova social massiva, oferta clara
- Hook: pode citar resultado final ou oferta — foca na transformação concreta
- CTA: alto comprometimento — clique no link, envie DM, compre agora, vagas limitadas`,
        };

        const funnelCtx = funnelInstructions[idea.funnel_stage] || funnelInstructions['TOFU'];

        const prompt = `Escreva o roteiro COMPLETO para o conteúdo abaixo. Retorne APENAS JSON.

BRIEFING:
- Título: ${idea.title}
- Contexto e público: ${idea.context}
- Formato selecionado: ${idea.format_type}
- Estágio de Funil: ${idea.funnel_stage}
- Objetivo no Funil: ${idea.funnel_goal}
- Framework de copywriting: ${idea.recommended_framework}

${funnelCtx}

${formatInstructions ? `INSTRUÇÕES DO FORMATO:\n${formatInstructions}\n` : ''}
${bookCitations ? `REFERÊNCIAS DOS LIVROS (use para embasar o copy):\n${bookCitations}\n` : ''}
IMPORTANTE: Siga EXATAMENTE a estrutura de roteiro do formato selecionado.
O campo "body" deve refletir a estrutura específica deste formato (ex: slides numerados para carrossel, marcações de tempo para reels).
O campo "filming_tip" deve ser uma instrução prática específica para ESTE roteiro (não genérica).
O campo "cta" deve ser coerente com o estágio de funil ${idea.funnel_stage}.

RETORNE APENAS O JSON COM ESTA ESTRUTURA:
${SCRIPT_SCHEMA}`;

        return this.llm.analyzeJson<ScriptOutput>(prompt, SCRIPT_SCHEMA, systemPrompt);
    }
}
