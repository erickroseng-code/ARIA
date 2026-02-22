import OpenAI from "openai";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Carregamento manual robusto do .env
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

export class LLMService {
    private openai: OpenAI;
    
    // Lista de modelos para fallback em ordem de preferência
    // Lista fornecida pelo usuário
    private models: string[] = [
        "arcee-ai/trinity-large-preview:free",
        "stepfun/step-3.5-flash:free",
        "z-ai/glm-4.5-air:free",
        "deepseek/deepseek-r1-0528:free",
        "openai/gpt-oss-120b:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];

    constructor() {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error("❌ ERRO: OPENROUTER_API_KEY não encontrada no .env do Maverick.");
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: {
                "HTTP-Referer": "https://aios-maverick.local",
                "X-Title": "Maverick Squad",
            }
        });
    }

    async chat(prompt: string, systemInstruction?: string): Promise<string> {
        let lastError: any = null;

        for (const model of this.models) {
            try {
                // console.log(`🧠 Tentando modelo: ${model}...`);
                const completion = await this.openai.chat.completions.create({
                    model: model,
                    messages: [
                        ...(systemInstruction ? [{ role: "system" as const, content: systemInstruction }] : []),
                        { role: "user", content: prompt }
                    ]
                });

                return completion.choices[0]?.message?.content || "";
            } catch (error: any) {
                // Se for rate limit (429), server error (5xx) ou not found (404), tenta o próximo
                if (error.status === 429 || error.status === 404 || (error.status >= 500 && error.status < 600)) {
                    console.warn(`⚠️ Modelo ${model} falhou (${error.status}). Tentando próximo em 2s...`);
                    lastError = error;
                    // Delay para esfriar o rate limit
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                // Se for erro de autenticação ou bad request, aborta logo
                console.error("LLM Fatal Error:", error);
                throw error;
            }
        }

        console.error("❌ Todos os modelos de IA falharam.");
        throw lastError || new Error("Todos os modelos falharam.");
    }

    async analyzeJson<T>(prompt: string, schemaDescription: string): Promise<T> {
        const jsonPrompt = prompt + 
            "\n\nIMPORTANTE: Responda APENAS com um JSON válido seguindo esta estrutura:\n" + 
            schemaDescription + 
            "\n\nNão adicione markdown, explicações ou code blocks. Apenas o JSON puro.";

        try {
            const text = await this.chat(jsonPrompt, "Você é uma API JSON estrita. Nunca retorne nada além de JSON.");
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanText) as T;
        } catch (error) {
            console.error("LLM JSON Error. Raw text:", error);
            throw new Error("Falha ao gerar JSON estruturado.");
        }
    }
}
