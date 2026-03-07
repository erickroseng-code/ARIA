import { GroqService, GROQ_MODELS } from '@aria/core';

/**
 * Helper centralizado de LLM para o Finance Squad.
 * Usa GroqService do @aria/core (sem instalar pacote openai separado).
 * Fallback para OpenRouter via fetch nativo se GROQ_API_KEY não estiver disponível.
 */
async function callGroq(
    userPrompt: string,
    systemPrompt: string,
    temperature: number,
): Promise<string> {
    const groq = new GroqService();
    return groq.call(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        {
            model: GROQ_MODELS.LLAMA_3_3_70B,
            temperature,
            max_tokens: 2048,
        },
    );
}

async function callOpenRouter(
    userPrompt: string,
    systemPrompt: string,
    temperature: number,
): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('Nenhuma chave LLM configurada (GROQ_API_KEY ou OPENROUTER_API_KEY)');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://aios-finance.local',
            'X-Title': 'Finance Squad',
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-v3',
            temperature,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
    const data = (await res.json()) as any;
    return data.choices[0]?.message?.content ?? '';
}

/**
 * Faz uma chamada LLM com system + user prompt.
 * Prioridade: Groq (gratuito, ultra-rápido) → OpenRouter (fallback).
 */
export async function llmChat(
    userPrompt: string,
    systemPrompt: string,
    temperature = 0.3,
): Promise<string> {
    const useGroq = !!process.env.GROQ_API_KEY;
    return useGroq
        ? callGroq(userPrompt, systemPrompt, temperature)
        : callOpenRouter(userPrompt, systemPrompt, temperature);
}
