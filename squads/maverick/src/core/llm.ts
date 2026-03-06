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
    private models: string[];

    constructor(
        primary: 'sonnet' | 'deepseek' | 'minimax' = 'deepseek',
        fallback?: 'sonnet' | 'deepseek' | 'minimax',
    ) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error("❌ ERRO: OPENROUTER_API_KEY não encontrada no .env do Maverick.");
        }

        const MODELS: Record<string, string> = {
            sonnet:   "anthropic/claude-sonnet-4-6",
            deepseek: "deepseek/deepseek-v3.2",
            minimax:  "minimax/minimax-m2.5",
        };

        this.models = fallback
            ? [MODELS[primary], MODELS[fallback]]
            : [MODELS[primary]];

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
                    temperature: 0,
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

    private extractJson<T>(raw: string): T {
        // 1. Strip markdown code fences
        let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

        // 2. Try direct parse first
        try { return JSON.parse(text) as T; } catch { /* continue */ }

        // 3. Extract largest {...} block (handles preamble/postamble text)
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
            try { return JSON.parse(objMatch[0]) as T; } catch { /* continue */ }
        }

        // 4. Extract largest [...] block
        const arrMatch = text.match(/\[[\s\S]*\]/);
        if (arrMatch) {
            try { return JSON.parse(arrMatch[0]) as T; } catch { /* continue */ }
        }

        throw new Error(`Não foi possível extrair JSON. Resposta: ${text.slice(0, 200)}`);
    }

    async analyzeJson<T>(prompt: string, schemaDescription: string, systemPrompt?: string): Promise<T> {
        const jsonPrompt = prompt +
            "\n\nIMPORTANTE: Responda APENAS com um JSON válido seguindo esta estrutura:\n" +
            schemaDescription +
            "\n\nNão adicione markdown, explicações ou code blocks. Apenas o JSON puro.";

        const system = systemPrompt || "Você é uma API JSON estrita. Nunca retorne nada além de JSON.";

        // Tenta cada modelo individualmente — fallback também em caso de JSON inválido
        for (const model of this.models) {
            let raw = '';
            try {
                const completion = await this.openai.chat.completions.create({
                    model,
                    temperature: 0,
                    messages: [
                        { role: "system" as const, content: system },
                        { role: "user", content: jsonPrompt },
                    ],
                });
                raw = completion.choices[0]?.message?.content || '';
                return this.extractJson<T>(raw);
            } catch (error: any) {
                // Log do texto bruto para debug nos logs do PM2
                if (raw) process.stderr.write(`[WARN][JSON] Modelo ${model} retornou JSON inválido: ${raw.slice(0, 300)}\n`);
                else process.stderr.write(`[WARN][JSON] Modelo ${model} falhou: ${error?.message}\n`);

                // Se for erro de autenticação, abort imediato
                if (error?.status === 401 || error?.status === 400) throw error;
                // Caso contrário, tenta o próximo modelo
            }
        }

        throw new Error("Falha ao gerar JSON estruturado — todos os modelos falharam.");
    }
}
