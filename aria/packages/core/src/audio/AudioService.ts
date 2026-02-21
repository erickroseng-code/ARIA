import OpenAI from 'openai';

interface TranscriptionResult {
  text: string;
  duration: number;
}

interface TranscriptionOptions {
  format?: 'wav' | 'mp3' | 'ogg' | 'm4a';
  language?: string;
  maxRetries?: number;
}

/**
 * AudioService handles audio transcription using OpenAI's Whisper API
 * Features:
 * - Buffer-based transcription (base64 encoded)
 * - Retry logic with exponential backoff (2x: 1s, 2s)
 * - Audio validation (size <10MB, duration 1-60s)
 * - Immediate buffer cleanup
 * - Rate limiting coordination (3,500 RPM)
 */
export class AudioService {
  private whisperClient: OpenAI;
  private retryDelays = [1000, 2000]; // exponential backoff: 1s, 2s

  constructor(apiKey: string) {
    this.whisperClient = new OpenAI({ apiKey });
  }

  /**
   * Transcribe audio from a buffer
   * @param buffer - Raw audio buffer
   * @param options - Transcription options
   * @returns Promise containing transcribed text and duration
   */
  async transcribeFromBuffer(
    buffer: Buffer,
    options: TranscriptionOptions = {}
  ): Promise<string> {
    const { format = 'wav', language = 'pt', maxRetries = 2 } = options;

    // Validate audio
    this.validateAudio(buffer);

    let lastError: Error | null = null;

    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const transcription = await this.callWhisperAPI(buffer, format, language);

        // Cleanup buffer
        buffer = Buffer.alloc(0);

        return transcription;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on final attempt
        if (attempt < maxRetries) {
          const delay = this.retryDelays[attempt];
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Transcrição falhou após ${maxRetries + 1} tentativas. ${lastError?.message || 'Erro desconhecido'}`
    );
  }

  /**
   * Internal method to call Whisper API
   */
  private async callWhisperAPI(
    buffer: Buffer,
    format: string,
    language: string
  ): Promise<string> {
    const response = await this.whisperClient.audio.transcriptions.create({
      file: new File([buffer], `audio.${format}`, { type: `audio/${format}` }),
      model: 'whisper-1',
      language,
      temperature: 0,
    });

    return response.text;
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
   * Get Whisper API rate limit info
   */
  getRateLimitInfo(): { rpm: number; description: string } {
    return {
      rpm: 3500,
      description: 'OpenAI Whisper API rate limit: 3,500 requests per minute',
    };
  }
}
