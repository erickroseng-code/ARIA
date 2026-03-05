import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';
import { loadMaverickMethodology } from '../knowledge/methodology';

export class CopywriterAgent {
    private llm: LLMService;
    private scholar: ScholarEngine;
    private methodology: string;

    constructor() {
        this.llm = new LLMService('sonnet'); // copywriting criativo — Sonnet ganha em qualidade PT-BR
        this.scholar = new ScholarEngine();
        // Same internalized knowledge as Strategist — LLM already knows the frameworks
        this.methodology = loadMaverickMethodology();
    }

    async generateScripts(strategicPlan: string): Promise<string> {

        // 1. Extract script ideas from strategic plan
        const ideas = await this.llm.analyzeJson<{ title: string; context: string; format: string; recommended_framework: string }[]>(
            `Analise o plano estratégico abaixo e extraia as ideias de roteiros sugeridas.\n\nPLANO:\n${strategicPlan}`,
            '[{ "title": "Título da ideia", "context": "O que comunicar e para quem", "format": "Reels|Carrossel|Stories", "recommended_framework": "AIDA|PAS|BAB|HOOK_STORY_OFFER|OPEN_LOOP|VOSS" }]'
        );


        // 2. Optional: find specific supporting quotes from the books
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

        // 3. Write each script — LLM applies internalized framework knowledge
        const systemPrompt = `Você é o MAVERICK COPYWRITER — o melhor redator de conteúdo estratégico do Brasil.

Você internalizou completamente os seguintes frameworks e princípios de copywriting:

${this.methodology}

COMO VOCÊ ESCREVE:
- Você NUNCA escreve copy genérica. Cada palavra serve um propósito calculado.
- Você seleciona o framework mais adequado para o formato e objetivo do conteúdo.
- O GANCHO (primeiros 3 segundos/slide 1) é não negociável — brutal e irresistível.
- Você inclui indicações visuais entre colchetes [Visual: ...] e de tom [Tom: ...].
- Você cita qual framework está usando e por quê no início de cada roteiro.
- Você retorna APENAS o roteiro em texto limpo. Sem explicações fora do roteiro.`;

        let finalOutput = '# 🎬 Roteiros Finais Maverick\n\n';

        for (const idea of ideas) {

            const prompt = `Escreva o roteiro completo para o conteúdo abaixo.

BRIEFING:
- Título: ${idea.title}
- Contexto e público: ${idea.context}
- Formato: ${idea.format}
- Framework recomendado: ${idea.recommended_framework}

${bookCitations ? `REFERÊNCIAS DIRETAS DOS LIVROS (use para embasar o copy):\n${bookCitations}\n` : ''}

ESTRUTURA DO OUTPUT:
## 🎥 ${idea.title}
**Formato:** ${idea.format} | **Framework:** ${idea.recommended_framework}
**Por que este framework:** [1 frase explicando a escolha]

[Roteiro completo com indicações visuais e de tom]

**CTA:** [chamada para ação específica]`;

            const script = await this.llm.chat(prompt, systemPrompt);
            finalOutput += script + '\n\n---\n\n';
        }

        return finalOutput;
    }
}
