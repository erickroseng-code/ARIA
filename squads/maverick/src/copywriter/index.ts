import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';

export class CopywriterAgent {
    private llm: LLMService;
    private scholar: ScholarEngine;

    constructor() {
        this.llm = new LLMService();
        this.scholar = new ScholarEngine();
    }

    async generateScripts(strategicPlan: string): Promise<string> {
        console.log("✍️ Copywriter: Analisando plano estratégico para gerar roteiros...");

        // 1. Extrair as ideias do plano (usando LLM para ser robusto a variações de formatação)
        const extractionPrompt = "Analise o seguinte Plano de Ação e extraia as 3 ideias de roteiros sugeridas no final.\n\nPLANO:\n" + strategicPlan;
        const schema = 'Uma lista de objetos: [{ "title": "Titulo da Ideia", "context": "Descrição do que fazer", "format": "Reels/Carrossel/Stories" }]';
        
        const ideas = await this.llm.analyzeJson<{ title: string, context: string, format: string }[]>(
            extractionPrompt,
            schema
        );

        console.log(`✍️ Copywriter: ${ideas.length} ideias identificadas. Escrevendo roteiros...`);

        // 2. Buscar modelos de copy na base
        await this.scholar.loadKnowledgeBase();
        const copyModels = this.scholar.search("template roteiro copywriting aida pas", 5);
        const modelsText = copyModels.map(k => k.content).join("\n\n");

        let finalOutput = "# 🎬 Roteiros Finais Maverick\n\n";

        // 3. Escrever cada roteiro
        for (const idea of ideas) {
            console.log(`   > Escrevendo: ${idea.title}...`);
            
            const prompt = `
            VOCÊ É O MAVERICK COPYWRITER.
            
            SUA MISSÃO: Escrever um roteiro técnico para redes sociais baseado na ideia abaixo.
            
            IDEIA:
            - Título: ${idea.title}
            - Contexto: ${idea.context}
            - Formato: ${idea.format}

            USE ESTES MODELOS/CONHECIMENTOS DE COPY (Se houver):
            ${modelsText}

            REGRAS DE ESCRITA:
            1. Use o framework AIDA (Atenção, Interesse, Desejo, Ação) ou PAS (Problema, Agitação, Solução).
            2. Seja direto. Evite "nariz de cera" (enrolação no começo).
            3. O GANCHO (primeiros 3 segundos/slide 1) deve ser brutal.
            4. Inclua indicações visuais entre colchetes [Visual: ...].

            FORMATO DO OUTPUT:
            ## 🎥 Roteiro: ${idea.title}
            **Formato:** ${idea.format}
            
            [Conteúdo do Roteiro aqui...]
            `;

            const script = await this.llm.chat(prompt);
            finalOutput += script + "\n\n---\n\n";
        }

        return finalOutput;
    }
}
