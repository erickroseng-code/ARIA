import Anthropic from '@anthropic-ai/sdk';
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
    private anthropic: Anthropic;
    private model: string = "claude-3-sonnet-20240229"; 

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error("❌ ERRO: ANTHROPIC_API_KEY não encontrada no .env do Maverick.");
        }

        this.anthropic = new Anthropic({
            apiKey: apiKey,
        });
    }

    async chat(prompt: string, systemInstruction?: string): Promise<string> {
        try {
            const message = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4000,
                system: systemInstruction,
                messages: [
                    { role: "user", content: prompt }
                ]
            });

            if (message.content[0].type === 'text') {
                return message.content[0].text;
            }
            return "";
        } catch (error) {
            console.error("LLM Error:", error);
            throw error; // Re-throw para ver o erro exato
        }
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
