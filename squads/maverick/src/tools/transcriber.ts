/**
 * Transcriber — usa Groq Whisper para transcrever os primeiros segundos de Reels virais
 * Sem ffmpeg: envia o vídeo completo e usa apenas o início da transcrição
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB — limite seguro (Groq aceita até 25MB)
const HOOK_WORD_LIMIT = 80; // ~15 segundos de fala em português

/**
 * Transcreve o hook de um Reel usando Groq Whisper.
 * Retorna as primeiras ~80 palavras (≈15s) ou null se falhar.
 */
export async function transcribeReelHook(videoUrl: string): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        process.stderr.write('[TRANSCRIBER] GROQ_API_KEY não configurada — pulando transcrição\n');
        return null;
    }

    let tmpFile: string | null = null;
    try {
        // Download do vídeo
        const res = await fetch(videoUrl, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return null;

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > MAX_VIDEO_BYTES) {
            process.stderr.write(`[TRANSCRIBER] Vídeo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB) — pulando\n`);
            return null;
        }

        // Salva em temp
        tmpFile = path.join(os.tmpdir(), `maverick-reel-${Date.now()}.mp4`);
        fs.writeFileSync(tmpFile, Buffer.from(buffer));

        // Monta FormData para Groq Whisper
        const formData = new FormData();
        const blob = new Blob([fs.readFileSync(tmpFile)], { type: 'video/mp4' });
        formData.append('file', blob, 'reel.mp4');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'pt');
        formData.append('response_format', 'json');

        const whisperRes = await fetch(GROQ_WHISPER_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
            signal: AbortSignal.timeout(30_000),
        });

        if (!whisperRes.ok) {
            const err = await whisperRes.text();
            process.stderr.write(`[TRANSCRIBER] Erro Groq: ${whisperRes.status} — ${err.slice(0, 200)}\n`);
            return null;
        }

        const data = await whisperRes.json() as { text: string };
        if (!data.text) return null;

        // Retorna apenas as primeiras ~80 palavras (hook)
        const words = data.text.trim().split(/\s+/);
        const hook = words.slice(0, HOOK_WORD_LIMIT).join(' ');
        process.stdout.write(`[TRANSCRIBER] ✅ Transcrição: "${hook.slice(0, 80)}..."\n`);
        return hook;

    } catch (err: any) {
        process.stderr.write(`[TRANSCRIBER] Falha: ${err.message}\n`);
        return null;
    } finally {
        if (tmpFile) try { fs.unlinkSync(tmpFile); } catch { /* ignora */ }
    }
}

/**
 * Transcreve múltiplos Reels em paralelo com limite de concorrência.
 * Retorna Map de videoUrl → transcrição
 */
export async function transcribeReels(
    posts: Array<{ url: string; videoUrl?: string }>,
    concurrency = 3,
): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const reels = posts.filter(p => p.videoUrl);

    if (reels.length === 0) return results;

    process.stdout.write(`[TRANSCRIBER] Transcrevendo ${reels.length} Reels (concorrência: ${concurrency})...\n`);

    // Processa em chunks para não sobrecarregar
    for (let i = 0; i < reels.length; i += concurrency) {
        const chunk = reels.slice(i, i + concurrency);
        const transcriptions = await Promise.all(
            chunk.map(p => transcribeReelHook(p.videoUrl!))
        );
        chunk.forEach((p, idx) => {
            if (transcriptions[idx]) {
                results.set(p.url, transcriptions[idx]!);
            }
        });
    }

    process.stdout.write(`[TRANSCRIBER] ${results.size}/${reels.length} transcrições bem-sucedidas\n`);
    return results;
}
