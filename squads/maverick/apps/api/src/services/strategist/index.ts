import OpenAI from 'openai';

// Assuming we use the same OpenAI client setup as in server.ts
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_KEY",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Maverick AIOS",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
  }
});

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

    const prompt = `
      Atue como um Especialista em Estratégia de Conteúdo (@maverick-strategist).
      
      OBJETIVO: Gerar 3 estratégias de conteúdo para o perfil com base na análise abaixo.
      
      DADOS DO PERFIL (Output do Scout):
      ${JSON.stringify(profileData, null, 2)}
      
      Gere 3 estratégias práticas e disruptivas para corrigir gaps e alavancar os pontos fortes.
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
      const completion = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } // Using json_object might require wrapping in an object if openrouter/gemini enforces it, but let's stick to array if possible, or wrap it.
      });

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
