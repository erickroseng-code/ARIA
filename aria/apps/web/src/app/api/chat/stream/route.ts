import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ContextStore } from '@aria/core';

const contextStore = new ContextStore();
const claude = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, userId } = await req.json();

    if (!message || !sessionId) {
      return new Response('Missing required fields', { status: 400 });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const context = await contextStore.get(sessionId);
          let systemPrompt =
            'Você é ARIA, um assistente pessoal profissional. Responda sempre em português.';

          if (userId) {
            const activeClientId = await contextStore.getActiveClient(userId);
            if (activeClientId) {
              systemPrompt += `\n\nContexto: o usuário está trabalhando com o cliente ID: ${activeClientId}.`;
            }
          }

          const stream = await claude.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: systemPrompt,
            stream: true,
            messages: [
              ...context.history.slice(-10).map((m: { role: 'user' | 'assistant'; content: string; timestamp?: Date }) => ({
                role: m.role,
                content: m.content,
              })),
              { role: 'user', content: message },
            ],
          });

          let fullResponse = '';

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              fullResponse += event.delta.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', content: event.delta.text })}\n`
                )
              );
            }
          }

          // Save to context store
          await contextStore.append(sessionId, {
            role: 'user',
            content: message,
          });

          await contextStore.append(sessionId, {
            role: 'assistant',
            content: fullResponse,
          });

          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n`)
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
