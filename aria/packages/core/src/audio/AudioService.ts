import whisper from 'node-whisper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface TranscriptionOptions {
  format?: 'wav' | 'mp3' | 'ogg' | 'm4a';
  language?: string;
  maxRetries?: number;
}

/**
 * AudioService handles audio transcription using local Whisper model
 * Features:
 * - Buffer-based transcription (local processing, no API calls)
 * - Retry logic with exponential backoff (2x: 1s, 2s)
 * - Audio validation (size <10MB, duration 1-60s)
 * - Immediate buffer cleanup
 * - Free/offline transcription (no API keys needed)
 */
export class AudioService {
  private retryDelays = [1000, 2000]; // exponential backoff: 1s, 2s
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'aria-audio');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Transcribe audio from a buffer
   * @param buffer - Raw audio buffer
   * @param options - Transcription options
   * @returns Promise containing transcribed text
   */
  async transcribeFromBuffer(
    buffer: Buffer,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    const { format = 'wav', language = 'pt', maxRetries = 2 } = options;

    // Validate audio
    this.validateAudio(buffer);

    let lastError: Error | null = null;
    const finalLanguage = language || 'pt';
    const finalFormat = format || 'wav';
    const tempFile = path.join(this.tempDir, `audio-${Date.now()}.${finalFormat}`);

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Write buffer to temp file
        fs.writeFileSync(tempFile, buffer);

        // Transcribe using local Whisper
        const result = await whisper(tempFile, {
          language: finalLanguage === 'pt' ? 'pt' : (finalLanguage as 'en'),
          output_format: 'json',
        });

        // Cleanup temp file and buffer
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        buffer = Buffer.alloc(0);

        // Extract text from result
        interface TextResult {
          text?: string;
          segments?: Array<{ text: string }>;
        }
        const textResult = result as TextResult | string;
        const text = typeof textResult === 'string'
          ? textResult
          : (textResult?.text || textResult?.segments?.map((s) => s.text)?.join('') || '');
        return text.trim();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on final attempt
        if (attempt < maxRetries) {
          const delay = this.retryDelays[attempt] || 1000;
          await this.sleep(delay);
        }
      } finally {
        // Always cleanup temp file
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Transcrição falhou após ${maxRetries + 1} tentativas. ${lastError?.message || 'Erro desconhecido'}`
    );
  }

  /**
   * Validate audio buffer
   * - Size: < 10MB
   * - Duration: 1-60 seconds (estimated from filesize)
   */
  private validateAudio(buffer: Buffer): void {
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (buffer.length === 0) {
      throw new Error('Áudio inválido ou sem conteúdo');
    }

    if (buffer.length > maxSize) {
      throw new Error(`Arquivo muito grande. Máximo: 10MB, recebido: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Rough duration estimation: WAV ~44.1kHz, 16-bit = ~172KB/s
    const estimatedDuration = buffer.length / 172000;

    if (estimatedDuration < 1) {
      throw new Error('Áudio muito curto. Mínimo: 1 segundo');
    }

    if (estimatedDuration > 60) {
      throw new Error('Áudio muito longo. Máximo: 60 segundos');
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get rate limit info (local Whisper has no limits)
   */
  getRateLimitInfo(): { rpm: number; description: string } {
    return {
      rpm: Infinity,
      description: 'Local Whisper: Unlimited transcriptions (no API rate limits)',
    };
  }
}
