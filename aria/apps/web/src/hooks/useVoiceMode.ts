'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState =
  | 'idle'             // desligado
  | 'wake_listening'   // ouvindo em background para "Ei ARIA"
  | 'cmd_listening'    // ouvindo o comando após wake word / clique
  | 'processing'       // enviando para o chat
  | 'error';           // erro (permissão negada, etc)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => AnySpeechRecognition;
  webkitSpeechRecognition?: new () => AnySpeechRecognition;
}

interface UseVoiceModeOptions {
  onCommand: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  enabled?: boolean;
}

// Remove acentos e lowercases — "Ária" → "aria"
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const WAKE_WORDS_NORMALIZED = [
  'aria',
  'ei aria',
  'hey aria',
  'ei, aria',
  'e aria',
  'a aria',
  'eia aria',
];

function hasWakeWord(t: string): boolean {
  const n = normalize(t);
  return WAKE_WORDS_NORMALIZED.some(w => n.includes(w));
}

function stripWakeWord(raw: string): string {
  const norm = normalize(raw);
  for (const w of WAKE_WORDS_NORMALIZED) {
    if (norm.startsWith(w)) {
      return raw.slice(w.length).replace(/^[,.\s]+/, '').trim();
    }
  }
  return raw.trim();
}

function playBeep(rising: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const [f0, f1] = rising ? [880, 1200] : [1200, 600];
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 500);
  } catch { /* ignora */ }
}

export function useVoiceMode({ onCommand, onStateChange, enabled = true }: UseVoiceModeOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');

  // ─── Refs estáveis (não causam re-render nem re-run de effects) ───────────
  const stateRef = useRef<VoiceState>('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const commandBufferRef = useRef('');
  const commandSentRef = useRef(false);     // evita enviar o mesmo comando duas vezes
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  // KEY FIX: onCommand em ref para que o useEffect NÃO precise dela como dep
  // Assim o effect só roda UMA VEZ e não aborta a recognition quando isStreaming muda
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const setStateSync = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setState(s);
    onStateChangeRef.current?.(s);
  }, []);

  const startRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (isRunningRef.current || isPausedRef.current) return;
    if (stateRef.current === 'idle' || stateRef.current === 'error') return;
    if (!rec) {
      // recognition ainda não inicializado — aguarda próximo tick
      setTimeout(() => startRecognition(), 100);
      return;
    }
    try {
      rec.start();
      isRunningRef.current = true;
    } catch { /* já rodando */ }
  }, []);

  const stopRecognition = useCallback(() => {
    try { recognitionRef.current?.abort(); } catch { /* ignora */ }
    isRunningRef.current = false;
  }, []);

  // ─── Processa o buffer acumulado e envia o comando ────────────────────────
  const flushCommand = useCallback(() => {
    if (commandSentRef.current) return;      // já foi enviado
    const raw = commandBufferRef.current.trim();
    if (!raw) return;

    const cleaned = stripWakeWord(raw);
    if (!cleaned) return;

    commandSentRef.current = true;
    commandBufferRef.current = '';

    setStateSync('processing');
    onCommandRef.current(cleaned);

    // Volta para wake word após enviar
    setTimeout(() => {
      setStateSync('wake_listening');
      setLastTranscript('');
      commandSentRef.current = false;
    }, 300);
  }, [setStateSync]);

  // ─── API pública ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as SpeechRecognitionWindow;
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) return;
    setStateSync('wake_listening');
    setLastTranscript('');
    startRecognition();
  }, [setStateSync, startRecognition]);

  /** Ativação direta por clique — vai reto para cmd_listening */
  const activateDirectly = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as SpeechRecognitionWindow;
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) {
      console.warn('[VoiceMode] Web Speech API não disponível');
      return;
    }
    playBeep(true);
    commandBufferRef.current = '';
    commandSentRef.current = false;
    setLastTranscript('');
    setStateSync('cmd_listening');
    startRecognition();
  }, [setStateSync, startRecognition]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    commandBufferRef.current = '';
    commandSentRef.current = false;
    setStateSync('idle');
    setLastTranscript('');
    stopRecognition();
    playBeep(false);
  }, [setStateSync, stopRecognition]);

  const pauseListening = useCallback(() => {
    if (stateRef.current === 'idle') return;
    isPausedRef.current = true;
    stopRecognition();
  }, [stopRecognition]);

  const resumeListening = useCallback(() => {
    if (stateRef.current === 'idle') return;
    isPausedRef.current = false;
    setStateSync('wake_listening');
    setLastTranscript('');
    commandSentRef.current = false;
    startRecognition();
  }, [setStateSync, startRecognition]);

  // ─── Setup da Web Speech API — roda só UMA VEZ (sem onCommand nas deps) ──
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const win = window as SpeechRecognitionWindow;
    const Cls = win.webkitSpeechRecognition || win.SpeechRecognition;
    if (!Cls) return;

    const rec = new Cls();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'pt-BR';
    rec.maxAlternatives = 3;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const isFinal: boolean = result.isFinal;

      // Pega todas as alternativas para maximizar detecção de wake word
      const transcripts: string[] = [];
      for (let i = 0; i < result.length; i++) transcripts.push(result[i].transcript);
      const primary = transcripts[0] ?? '';

      setLastTranscript(primary);

      if (stateRef.current === 'wake_listening') {
        if (hasWakeWord(transcripts.join(' '))) {
          playBeep(true);
          commandBufferRef.current = '';
          commandSentRef.current = false;
          setLastTranscript('');
          setStateSync('cmd_listening');
        }
        return;
      }

      if (stateRef.current === 'cmd_listening') {
        commandBufferRef.current = primary;

        if (isFinal) {
          // isFinal disparou: agenda flush com pequeno delay
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            flushCommand();
          }, 400);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      isRunningRef.current = false;
      if (event.error === 'not-allowed') {
        console.error('[VoiceMode] Microfone negado — verifique permissões do browser');
        setStateSync('error');
        // Volta para idle após mostrar o erro por 3s
        setTimeout(() => {
          if (stateRef.current === 'error') setStateSync('idle');
        }, 3000);
        return;
      }
      // 'no-speech' é normal, não logar
      if (event.error !== 'no-speech') {
        console.warn('[VoiceMode] Erro:', event.error);
      }
    };

    rec.onstart = () => { isRunningRef.current = true; };

    rec.onend = () => {
      isRunningRef.current = false;

      // KEY FIX: se estávamos em cmd_listening e o recognition terminou
      // sem isFinal ter sido disparado — processa o que temos agora
      if (stateRef.current === 'cmd_listening' && commandBufferRef.current.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        flushCommand();
      }

      // Auto-restart se não estiver idle/error ou pausado
      if (stateRef.current !== 'idle' && stateRef.current !== 'error' && !isPausedRef.current) {
        restartTimerRef.current = setTimeout(startRecognition, 250);
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { rec.abort(); } catch { /* ignora */ }
    };
  }, [enabled, setStateSync, startRecognition, flushCommand]);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return {
    state,
    lastTranscript,
    isSupported,
    startListening,
    activateDirectly,
    stopListening,
    pauseListening,
    resumeListening,
    isActive: state !== 'idle',
  };
}
