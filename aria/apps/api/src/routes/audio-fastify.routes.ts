import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AudioService } from '@aria/core';

const audioService = new AudioService();

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['wav', 'mp3', 'ogg', 'm4a', 'webm'];

export async function registerAudioRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /api/audio/transcribe
     * Transcribes audio using Whisper API. Expects multipart/form-data with "audio" field.
     */
    fastify.post('/transcribe', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await req.file();

            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided' });
            }

            const format = ((data.fields['format'] as any)?.value || 'wav').toLowerCase();

            if (!ALLOWED_FORMATS.includes(format)) {
                return reply.status(400).send({
                    error: `Unsupported format: ${format}. Supported: ${ALLOWED_FORMATS.join(', ')}`,
                });
            }

            const buffer = await data.toBuffer();

            if (buffer.length > MAX_AUDIO_SIZE) {
                const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
                return reply.status(400).send({
                    error: `File too large (${sizeMb}MB). Maximum: 10MB.`,
                });
            }

            const transcription = await audioService.transcribeFromBuffer(buffer, {
                format: format as 'wav' | 'mp3' | 'ogg' | 'm4a',
                language: 'pt',
                maxRetries: 2,
            });

            if (!transcription || transcription.trim().length === 0) {
                return reply.status(422).send({
                    error: 'No speech detected in audio. Please try again with clearer audio.',
                });
            }

            return reply.send({
                text: transcription,
                duration: Math.round((buffer.length / 172000) * 100) / 100,
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[AudioRoutes] Transcription error:', errorMsg);

            if (errorMsg.includes('rate_limit')) {
                return reply.status(429).send({
                    error: 'Too many transcription requests. Please try again in a moment.',
                });
            }

            if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
                return reply.status(504).send({
                    error: 'Transcription took too long. Please try with a shorter audio.',
                });
            }

            return reply.status(500).send({ error: `Transcription failed: ${errorMsg}` });
        }
    });
}
