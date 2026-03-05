import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';
import { loadMaverickMethodology } from '../knowledge/methodology';
import { buildFormatMenu, buildFormatInstructions } from '../knowledge/content-formats';

export interface ScriptOutput {
    title: string;
    format: string;        // "Reels" | "Carrossel"
    format_type: string;   // ex: "reels_react", "carrossel_educativo"
    format_name: string;   // ex: "Reels React", "Carrossel Educativo"
    why_format: string;    // por que este formato para este tema
    framework: string;
    why_framework: string;
    hook: string;
    body: string;
    visual_cues: string[];
    filming_tip: string;   // instrução prática de como gravar
    cta: string;
}

const SCRIPT_SCHEMA = `{
  "title": "string — título criativo do roteiro",
  "format": "Reels|Carrossel",
  "format_type": "id do formato escolhido (ex: reels_react, carrossel_educativo)",
  "format_name": "nome legível do formato (ex: Reels React, Carrossel Educativo)",
  "why_format": "string — 1 frase explicando por que este formato específico é o melhor para este tema",
  "framework": "nome exato do framework de copywriting (ex: PAS, AIDA, HOOK_STORY_OFFER)",
  "why_framework": "string — 1 frase explicando por que este framework para este formato e objetivo",
  "hook": "string — gancho COMPLETO dos primeiros 3 segundos ou slide 1. Deve ser brutal e irresistível.",
  "body": "string — corpo completo do roteiro seguindo a estrutura do formato escolhido, com indicações [Visual: ...] e [Tom: ...] intercaladas",
  "visual_cues": ["indicação de produção 1", "indicação de câmera ou edição 2"],
  "filming_tip": "string — instrução prática e objetiva de como gravar/produzir este conteúdo específico",
  "cta": "string — chamada para ação específica, concreta e irresistível"
}`;

export class CopywriterAgent {
    private llm: LLMService;
    private scholar: ScholarEngine;
    private methodology: string;

    constructor() {
        this.llm = new LLMService('sonnet');
        this.scholar = new ScholarEngine();
        this.methodology = loadMaverickMethodology();
    }

    async generateScripts(strategicPlan: string): Promise<string> {
        const formatMenu = buildFormatMenu();

        // 1. Extract script ideas + choose the best specific format for each
        const ideas = await this.llm.analyzeJson<{
            title: string;
            context: string;
            format_type: string;
            recommended_framework: string;
        }[]>(
            `Analise o plano estratégico abaixo e extraia as ideias de roteiros sugeridas.
Para cada ideia, escolha o formato mais adequado ao tema e objetivo dentre as opções abaixo.

FORMATOS DISPONÍVEIS:
${formatMenu}

REGRAS DE SELEÇÃO:
- Analise o tema, objetivo e público de cada ideia
- Escolha o format_type que maximiza engajamento para aquele conteúdo específico
- Varie os formatos entre as ideias — não use o mesmo tipo para todos
- Prefira Reels virais (react, trend_meme) para temas de topo de funil
- Use carrossel educativo ou narrativo para conteúdo que merece ser salvo

PLANO:
${strategicPlan}`,
            '[{ "title": "Título da ideia", "context": "O que comunicar e para quem", "format_type": "id do formato (ex: reels_react, carrossel_educativo)", "recommended_framework": "AIDA|PAS|BAB|HOOK_STORY_OFFER|OPEN_LOOP|VOSS" }]'
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
        const scriptPromises = ideas.map(idea => this.generateSingleScript(idea, bookCitations, systemPrompt));
        const scripts: ScriptOutput[] = await Promise.all(scriptPromises);

        return JSON.stringify(scripts, null, 2);
    }

    private async generateSingleScript(
        idea: { title: string; context: string; format_type: string; recommended_framework: string },
        bookCitations: string,
        systemPrompt: string,
    ): Promise<ScriptOutput> {
        const formatInstructions = buildFormatInstructions(idea.format_type);

        const prompt = `Escreva o roteiro COMPLETO para o conteúdo abaixo. Retorne APENAS JSON.

BRIEFING:
- Título: ${idea.title}
- Contexto e público: ${idea.context}
- Formato selecionado: ${idea.format_type}
- Framework de copywriting: ${idea.recommended_framework}

${formatInstructions ? `INSTRUÇÕES DO FORMATO:\n${formatInstructions}\n` : ''}
${bookCitations ? `REFERÊNCIAS DOS LIVROS (use para embasar o copy):\n${bookCitations}\n` : ''}

IMPORTANTE: Siga EXATAMENTE a estrutura de roteiro do formato selecionado.
O campo "body" deve refletir a estrutura específica deste formato (ex: slides numerados para carrossel, marcações de tempo para reels).
O campo "filming_tip" deve ser uma instrução prática específica para ESTE roteiro (não genérica).

RETORNE APENAS O JSON COM ESTA ESTRUTURA:
${SCRIPT_SCHEMA}`;

        return this.llm.analyzeJson<ScriptOutput>(prompt, SCRIPT_SCHEMA, systemPrompt);
    }
}
