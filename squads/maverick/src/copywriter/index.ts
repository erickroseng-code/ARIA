import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';
import { loadMaverickMethodology } from '../knowledge/methodology';

export interface ScriptOutput {
    title: string;
    format: 'Reels' | 'Carrossel' | 'Stories';
    framework: string;
    why_framework: string;
    hook: string;
    body: string;
    visual_cues: string[];
    cta: string;
}

const SCRIPT_SCHEMA = `{
  "title": "string — título criativo do roteiro",
  "format": "Reels|Carrossel|Stories",
  "framework": "nome exato do framework (ex: PAS, AIDA, HOOK_STORY_OFFER)",
  "why_framework": "string — 1 frase explicando por que este framework para este formato e objetivo",
  "hook": "string — gancho COMPLETO dos primeiros 3 segundos ou slide 1. Deve ser brutal e irresistível.",
  "body": "string — corpo completo do roteiro com indicações [Visual: ...] e [Tom: ...] intercaladas no texto",
  "visual_cues": ["indicação de produção 1", "indicação de câmera ou edição 2"],
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
        // 1. Extract script ideas from the strategic plan
        const ideas = await this.llm.analyzeJson<{ title: string; context: string; format: string; recommended_framework: string }[]>(
            `Analise o plano estratégico abaixo e extraia as ideias de roteiros sugeridas.\n\nPLANO:\n${strategicPlan}`,
            '[{ "title": "Título da ideia", "context": "O que comunicar e para quem", "format": "Reels|Carrossel|Stories", "recommended_framework": "AIDA|PAS|BAB|HOOK_STORY_OFFER|OPEN_LOOP|VOSS" }]'
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
        const scripts = await Promise.all(scriptPromises);

        return JSON.stringify(scripts, null, 2);
    }

    private async generateSingleScript(
        idea: { title: string; context: string; format: string; recommended_framework: string },
        bookCitations: string,
        systemPrompt: string,
    ): Promise<ScriptOutput> {
        const prompt = `Escreva o roteiro COMPLETO para o conteúdo abaixo. Retorne APENAS JSON.

BRIEFING:
- Título: ${idea.title}
- Contexto e público: ${idea.context}
- Formato: ${idea.format}
- Framework recomendado: ${idea.recommended_framework}

${bookCitations ? `REFERÊNCIAS DOS LIVROS (use para embasar o copy):\n${bookCitations}\n` : ''}

RETORNE APENAS O JSON COM ESTA ESTRUTURA:
${SCRIPT_SCHEMA}`;

        return this.llm.analyzeJson<ScriptOutput>(prompt, SCRIPT_SCHEMA, systemPrompt);
    }
}
