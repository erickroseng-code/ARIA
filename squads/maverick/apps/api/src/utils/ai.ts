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

// Models known to support response_format: json_object
const JSON_CAPABLE_MODELS = new Set([
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "openai/gpt-oss-120b:free",
]);

/**
 * Extract a valid JSON object from a model response that may include
 * markdown fences, reasoning text, or trailing content.
 */
export function extractJSON(raw: string): string {
    // 1. Strip ```json ... ``` fences
    let text = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    // 2. Try to find first { ... } block in case model added preamble/epilogue
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(start, end + 1);
    }

    return text;
}

export async function generateWithFallback(messages: any[], options: any = {}) {
    const needsJson = options?.response_format?.type === 'json_object';
    let lastError: any = null;

    for (const model of FREE_MODELS) {
        try {
            console.log(`[Maverick AI] Trying model: ${model}`);

            // Only pass response_format to models that support it
            const modelOptions = { ...options };
            if (needsJson && !JSON_CAPABLE_MODELS.has(model)) {
                delete modelOptions.response_format;
            }

            const completion = await openai.chat.completions.create({
                model: model,
                messages: messages,
                ...modelOptions
            });

            // If we needed JSON but model doesn't natively support it,
            // validate the content is parseable before returning
            if (needsJson && !JSON_CAPABLE_MODELS.has(model)) {
                const raw = completion.choices[0]?.message?.content || '{}';
                const extracted = extractJSON(raw);
                JSON.parse(extracted); // throws if invalid — triggers next model
                // Patch the content so caller gets clean JSON
                completion.choices[0].message.content = extracted;
            }

            console.log(`[Maverick AI] Success with model: ${model}`);
            return completion;
        } catch (error: any) {
            console.warn(`[Maverick AI] Failed with model ${model}: ${error.message}`);
            lastError = error;
        }
    }

    throw new Error(`All models failed. Last error: ${lastError?.message}`);
}
