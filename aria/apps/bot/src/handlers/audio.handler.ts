import { AudioService } from '@aria/core';
import { ERROR_MESSAGE } from '../templates/responses';

const audioService = new AudioService();
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Handle voice messages from Telegram
 * - Validates audio size and format
 * - Downloads and converts to WAV buffer
 * - Transcribes using AudioService (Whisper API)
 * - Returns transcription to user
 */
export async function audioHandler(ctx: any) {
  const voice = ctx.message?.voice;
  const { sessionId } = ctx.session;
  const userId = ctx.from?.id;

  if (!voice || !sessionId) {
    return;
  }

  // Log request (metadata only)
  ctx.api.logger?.('debug', { sessionId, userId, duration: voice.duration }, 'Processing voice message');

  try {
    // Show "transcribing..." message
    const processingMsg = await ctx.reply('🎙️ Transcrevendo áudio...');

    // Validate audio size
    if (voice.file_size && voice.file_size > MAX_AUDIO_SIZE) {
      const sizeMb = (voice.file_size / (1024 * 1024)).toFixed(1);
      const message = `❌ Áudio muito grande (${sizeMb}MB). Limite: 10MB.`;
      return ctx.editMessageText(message);
    }

    // Validate duration (1-60 seconds)
    const duration = voice.duration || 0;
    if (duration < 1) {
      await ctx.editMessageText('❌ Áudio muito curto. Mínimo: 1 segundo.');
      return;
    }

    if (duration > 60) {
      await ctx.editMessageText('❌ Áudio muito longo. Máximo: 60 segundos.');
      return;
    }

    // Download audio file from Telegram
    const file = await ctx.api.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Falha ao baixar arquivo de áudio');
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Transcribe audio
    let transcription: string;
    try {
      transcription = await audioService.transcribeFromBuffer(audioBuffer, {
        format: 'ogg',
        language: 'pt',
        maxRetries: 2,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      ctx.api.logger?.('error', { sessionId, userId, error: errorMsg }, 'Transcription failed');

      await ctx.editMessageText(`❌ Erro na transcrição: ${errorMsg}`);
      return;
    }

    // Validate transcription result
    if (!transcription || transcription.trim().length === 0) {
      await ctx.editMessageText('⚠️ Áudio inválido ou sem conteúdo. Tente novamente.');
      return;
    }

    // Send transcription result
    const resultMessage = `📝 Transcrito:\n\n${transcription}`;
    await ctx.editMessageText(resultMessage);

    ctx.api.logger?.('debug', { sessionId, userId, length: transcription.length }, 'Transcription successful');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    ctx.api.logger?.('error', { sessionId, userId, error: errorMsg }, 'Audio handler error');

    try {
      await ctx.editMessageText(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
    } catch {
      // Fallback if edit fails
      return ctx.reply(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
    }
  }
}
