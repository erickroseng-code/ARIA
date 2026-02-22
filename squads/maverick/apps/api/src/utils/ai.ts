import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

export const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_KEY",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Maverick AIOS",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
    }
});

const FREE_MODELS = [
    "arcee-ai/trinity-large-preview:free",
    "stepfun/step-3.5-flash:free",
    "z-ai/glm-4.5-air:free",
    "deepseek/deepseek-r1-0528:free",
    "openai/gpt-oss-120b:free",
    "arcee-ai/trinity-mini:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-coder:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "qwen/qwen3-next-80b-a3b-instruct:free"
];

export async function generateWithFallback(messages: any[], options: any = {}) {
    let lastError: any = null;

    for (const model of FREE_MODELS) {
        try {
            console.log(`[Maverick AI] Trying model: ${model}`);
            const completion = await openai.chat.completions.create({
                model: model,
                messages: messages,
                ...options
            });
            console.log(`[Maverick AI] Success with model: ${model}`);
            return completion;
        } catch (error: any) {
            console.warn(`[Maverick AI] Failed with model ${model}: ${error.message}`);
            lastError = error;
            // Continue to the next model in the list
        }
    }

    throw new Error(`All models failed. Last error: ${lastError?.message}`);
}
