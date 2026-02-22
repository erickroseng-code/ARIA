import { generateWithFallback } from '../../utils/ai';
import { ScholarAgent } from '../scholar';

export interface StrategyResult {
  id: number;
  title: string;
  description: string;
  type: string;
  time: string;
  pillars: string[];
}

export class StrategistAgent {
  async generateActionPlan(profileData: any): Promise<StrategyResult[]> {
    console.log(`[Maverick Strategist] Generating action plan based on profile data.`);

    // 1. Ask Scholar for Knowledge
    const scholar = new ScholarAgent();
    // Use the weak points or bio to form a query, or simply ask for general strategy if empty
    const query = profileData.pontos_melhoria ? profileData.pontos_melhoria.join(" ") : "estratégia de conteúdo e persuasão";
    const knowledgeDocs = await scholar.searchKnowledge(query, 3);

    const knowledgeContext = knowledgeDocs.map(d => `[Fonte: ${d.source_file}]\n${d.content}`).join("\n\n");

    const prompt = `
      Atue como um Especialista em Estratégia de Conteúdo (@maverick-strategist).
      
      OBJETIVO: Gerar 3 estratégias de conteúdo para o perfil com base na análise abaixo e no CONHECIMENTO CIENTÍFICO fornecido.
      
      DADOS DO PERFIL (Output do Scout):
      ${JSON.stringify(profileData, null, 2)}
      
      CONHECIMENTO CIENTÍFICO/REFERÊNCIAS (Output do Scholar):
      ${knowledgeContext || "Nenhum contexto extra retornado."}
      
      Gere 3 estratégias práticas e disruptivas para corrigir gaps e alavancar os pontos fortes, aplicando diretamente os conceitos das referências do Scholar acima (cite a fonte se for o caso).
      Formate a resposta ESTritamente como um array JSON com a seguinte estrutura:
      [
        {
          "id": 1,
          "title": "Título Curto e Chamativo",
          "description": "Explicação detalhada da estratégia, o que fazer e por que fazer.",
          "type": "Vídeos Curtos" | "Carrossel" | "Storytelling",
          "time": "Tempo estimado (ex: 7 dias)",
          "pillars": ["Pilar 1", "Pilar 2", "Pilar 3"]
        }
      ]
      
      Seja prático e direto.
      Responda APENAS o array JSON.
    `;

    try {
      const completion = await generateWithFallback(
        [{ role: "user", content: prompt }],
        { response_format: { type: "json_object" } }
      );

      const content = completion.choices[0]?.message?.content;

      // Handle potential markdown block formatting or object wrapping
      let cleanContent = content || "[]";
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
      }

      const parsed = JSON.parse(cleanContent);

      // If the model wrapped it in an object like { "strategies": [...] }
      if (parsed.strategies && Array.isArray(parsed.strategies)) {
        return parsed.strategies;
      }

      if (Array.isArray(parsed)) {
        // ensure IDs are set correctly
        return parsed.map((s, i) => ({ ...s, id: i + 1 }));
      }

      return [];

    } catch (error) {
      console.error("[Maverick Strategist] Error generating plan:", error);
      throw error;
    }
  }
}
