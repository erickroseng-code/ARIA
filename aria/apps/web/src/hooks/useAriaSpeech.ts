'use client';

import { useCallback, useRef } from 'react';

interface SpeakOptions {
  onCharIndex?: (charIndex: number) => void;
}

// Remove markdown para não falar asteriscos, hashes etc.
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'trecho de código')   // blocos de código
    .replace(/`[^`]+`/g, 'código')                     // inline code
    .replace(/#{1,6}\s+/g, '')                         // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')                 // negrito
    .replace(/\*([^*]+)\*/g, '$1')                     // itálico
    .replace(/~~([^~]+)~~/g, '$1')                     // tachado
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')           // links
    .replace(/^[-*+]\s+/gm, '')                        // listas
    .replace(/^\d+\.\s+/gm, '')                        // listas numeradas
    .replace(/^>\s+/gm, '')                            // blockquotes
    .replace(/\n{3,}/g, '\n\n')                        // excesso de quebras
    .trim();
}

// Cadeia de processamento de áudio para dar timbre Jarvis:
// lowshelf @200Hz +3dB → mais grave / resonante
// highshelf @8kHz -5dB → remove sibilância, deixa mais "digital"
// compressor → volume consistente
async function createJarvisChain(
  audioCtx: AudioContext,
  source: AudioBufferSourceNode,
  analyser: AnalyserNode,
): Promise<AudioNode> {
  const lowShelf = audioCtx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 200;
  lowShelf.gain.value = 3;

  const highShelf = audioCtx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = -5;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  source.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(audioCtx.destination);

  return compressor;
}

export function useAriaSpeech() {
  const isSpeakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const onSpeakingChangeRef = useRef<(speaking: boolean) => void>();
  const onEnergyPulseRef = useRef<(energy: number) => void>();
  const energyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Queue state
  const queueRef = useRef<Array<{ text: string; options?: SpeakOptions }>>([]);
  const queueRunningRef = useRef(false);
  const onQueueDoneRef = useRef<(() => void) | undefined>();

  const setOnSpeakingChange = useCallback((cb: (speaking: boolean) => void) => {
    onSpeakingChangeRef.current = cb;
  }, []);

  const setOnEnergyPulse = useCallback((cb: (energy: number) => void) => {
    onEnergyPulseRef.current = cb;
  }, []);

  // Low-level: sintetiza e toca uma utterance sem gerenciar estado de "speaking"
  // Usado internamente pelo queue runner para evitar flicker entre sentenças
  const _playAudio = useCallback((text: string, options?: SpeakOptions): Promise<void> => {
    return new Promise(async (resolve) => {
      const clean = stripMarkdown(text);
      if (!clean) {
        options?.onCharIndex?.(text.length);
        resolve();
        return;
      }

      try {
        const response = await fetch('/api/tts/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
        });

        if (!response.ok) throw new Error('TTS request falhou');

        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        currentSourceRef.current = source;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        await createJarvisChain(audioCtx, source, analyser);

        const duration = decoded.duration * 1000;
        const charCount = text.length;
        const startTime = Date.now();

        isSpeakingRef.current = true;

        energyTimerRef.current = setInterval(() => {
          if (!isSpeakingRef.current) return;
          analyser.getByteFrequencyData(freqData);
          const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
          const energy = Math.min(1, avg / 80);
          onEnergyPulseRef.current?.(0.2 + energy * 0.8);

          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          options?.onCharIndex?.(Math.floor(progress * charCount));
        }, 50);

        source.onended = () => {
          isSpeakingRef.current = false;
          onEnergyPulseRef.current?.(0);
          if (energyTimerRef.current) clearInterval(energyTimerRef.current);
          options?.onCharIndex?.(text.length);
          audioCtx.close().catch(() => {});
          resolve();
        };

        source.start();
      } catch {
        // Silently skip chunk — queue continues
        resolve();
      }
    });
  }, []);

  const stop = useCallback(() => {
    // Para tudo: queue + áudio atual
    queueRef.current = [];
    queueRunningRef.current = false;
    onQueueDoneRef.current = undefined;

    try { currentSourceRef.current?.stop(); } catch { /* ignora */ }
    try { audioCtxRef.current?.close(); } catch { /* ignora */ }
    if (energyTimerRef.current) clearInterval(energyTimerRef.current);
    isSpeakingRef.current = false;
    onSpeakingChangeRef.current?.(false);
    onEnergyPulseRef.current?.(0);
    currentSourceRef.current = null;
    audioCtxRef.current = null;
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
  }, []);

  // Speak público: interrompe o atual, toca utterance completa com fallback
  // Para textos longos (>4800 chars), chunka em sentenças automaticamente
  const speak = useCallback((text: string, options?: SpeakOptions): Promise<void> => {
    return new Promise(async (resolve) => {
      stop();

      const clean = stripMarkdown(text);
      if (!clean) {
        options?.onCharIndex?.(text.length);
        resolve();
        return;
      }

      // Chunking automático para textos que excedem o limite do backend (~4800 chars)
      const MAX_CHUNK = 4800;
      if (clean.length > MAX_CHUNK) {
        isSpeakingRef.current = true;
        onSpeakingChangeRef.current?.(true);

        // Divide em sentenças respeitando pontuação
        const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
        const chunks: string[] = [];
        let current = '';
        for (const s of sentences) {
          if ((current + s).length > MAX_CHUNK) {
            if (current) chunks.push(current.trim());
            current = s;
          } else {
            current += s;
          }
        }
        if (current.trim()) chunks.push(current.trim());

        let charOffset = 0;
        for (let i = 0; i < chunks.length; i++) {
          if (!queueRunningRef.current && !isSpeakingRef.current) break; // parado externamente
          const chunkText = chunks[i];
          const chunkLen = chunkText.length;
          const chunkOptions: SpeakOptions = options?.onCharIndex ? {
            onCharIndex: (ci) => options.onCharIndex!(charOffset + ci),
          } : undefined;
          await _playAudio(chunkText, chunkOptions);
          charOffset += chunkLen;
        }

        isSpeakingRef.current = false;
        onSpeakingChangeRef.current?.(false);
        onEnergyPulseRef.current?.(0);
        options?.onCharIndex?.(text.length);
        resolve();
        return;
      }

      try {
        const response = await fetch('/api/tts/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
        });

        if (!response.ok) throw new Error('TTS request falhou');

        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        currentSourceRef.current = source;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const freqData = new Uint8Array(analyser.frequencyBinCount);

        await createJarvisChain(audioCtx, source, analyser);

        const duration = decoded.duration * 1000;
        const charCount = text.length;
        const startTime = Date.now();

        isSpeakingRef.current = true;
        onSpeakingChangeRef.current?.(true);

        energyTimerRef.current = setInterval(() => {
          if (!isSpeakingRef.current) return;
          analyser.getByteFrequencyData(freqData);
          const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
          const energy = Math.min(1, avg / 80);
          onEnergyPulseRef.current?.(0.2 + energy * 0.8);

          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          options?.onCharIndex?.(Math.floor(progress * charCount));
        }, 50);

        source.onended = () => {
          isSpeakingRef.current = false;
          onSpeakingChangeRef.current?.(false);
          onEnergyPulseRef.current?.(0);
          if (energyTimerRef.current) clearInterval(energyTimerRef.current);
          options?.onCharIndex?.(text.length);
          audioCtx.close().catch(() => {});
          resolve();
        };

        source.start();
      } catch (err) {
        // Fallback para Web Speech API se o backend falhar
        console.warn('[AriaSpeech] Backend TTS falhou, usando fallback:', err);
        fallbackWebSpeech(text, options, onSpeakingChangeRef, onEnergyPulseRef, resolve);
      }
    });
  }, [stop, _playAudio]);

  // Queue runner: processa itens sequencialmente, gerencia estado de "speaking" globalmente
  const runQueue = useCallback(async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    onSpeakingChangeRef.current?.(true);

    while (queueRef.current.length > 0) {
      if (!queueRunningRef.current) break; // parado externamente
      const item = queueRef.current.shift()!;
      await _playAudio(item.text, item.options);
    }

    // Só sinaliza "done" se não foi interrompido
    if (!queueRunningRef.current) return;

    queueRunningRef.current = false;
    isSpeakingRef.current = false;
    onSpeakingChangeRef.current?.(false);
    onEnergyPulseRef.current?.(0);

    const cb = onQueueDoneRef.current;
    onQueueDoneRef.current = undefined;
    cb?.();
  }, [_playAudio]);

  // Enfileira uma utterance para reprodução sequencial
  const enqueue = useCallback((text: string, options?: SpeakOptions) => {
    const clean = stripMarkdown(text).trim();
    if (!clean) return;
    queueRef.current.push({ text, options });
    runQueue();
  }, [runQueue]);

  // Define callback chamado quando a queue esvaziar
  // Se já estiver vazia, chama imediatamente
  const setOnQueueDone = useCallback((cb: () => void) => {
    if (!queueRunningRef.current && queueRef.current.length === 0) {
      cb();
    } else {
      onQueueDoneRef.current = cb;
    }
  }, []);

  // clearQueue é equivalente a stop (já limpa a queue)
  const clearQueue = stop;

  return { speak, stop, enqueue, clearQueue, setOnQueueDone, setOnSpeakingChange, setOnEnergyPulse };
}

// Fallback: Web Speech API quando o backend TTS não estiver disponível
function fallbackWebSpeech(
  text: string,
  options: SpeakOptions | undefined,
  onSpeakingChangeRef: React.MutableRefObject<((speaking: boolean) => void) | undefined>,
  onEnergyPulseRef: React.MutableRefObject<((energy: number) => void) | undefined>,
  resolve: () => void,
) {
  if (!('speechSynthesis' in window)) {
    options?.onCharIndex?.(text.length);
    resolve();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.92;
  utterance.pitch = 0.85;

  const voices = window.speechSynthesis.getVoices();
  const ptVoice =
    voices.find(v => v.lang.startsWith('pt') && v.name.toLowerCase().includes('antonio')) ||
    voices.find(v => v.lang.startsWith('pt') && !v.name.toLowerCase().includes('female')) ||
    voices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) utterance.voice = ptVoice;

  let pulseTimer: ReturnType<typeof setInterval>;

  utterance.onboundary = (e: SpeechSynthesisEvent) => {
    if (e.name === 'word') {
      options?.onCharIndex?.(e.charIndex + e.charLength);
      onEnergyPulseRef.current?.(0.6 + Math.random() * 0.4);
    }
  };

  utterance.onstart = () => {
    onSpeakingChangeRef.current?.(true);
    pulseTimer = setInterval(() => {
      const base = 0.3 + Math.sin(Date.now() * 0.008) * 0.15;
      onEnergyPulseRef.current?.(base);
    }, 80);
  };

  utterance.onend = () => {
    onSpeakingChangeRef.current?.(false);
    onEnergyPulseRef.current?.(0);
    clearInterval(pulseTimer);
    options?.onCharIndex?.(text.length);
    resolve();
  };

  utterance.onerror = () => {
    onSpeakingChangeRef.current?.(false);
    onEnergyPulseRef.current?.(0);
    clearInterval(pulseTimer);
    options?.onCharIndex?.(text.length);
    resolve();
  };

  window.speechSynthesis.speak(utterance);
}
