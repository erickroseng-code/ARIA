import { useCallback, useRef } from "react";

interface SpeakOptions {
  onCharIndex?: (charIndex: number) => void;
}

export function useAriaSpeech() {
  const isSpeakingRef = useRef(false);
  const onSpeakingChangeRef = useRef<(speaking: boolean) => void>();
  const onEnergyPulseRef = useRef<(energy: number) => void>();

  const setOnSpeakingChange = useCallback((cb: (speaking: boolean) => void) => {
    onSpeakingChangeRef.current = cb;
  }, []);

  const setOnEnergyPulse = useCallback((cb: (energy: number) => void) => {
    onEnergyPulseRef.current = cb;
  }, []);

  const speak = useCallback((text: string, options?: SpeakOptions): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        // Reveal all text immediately if no speech support
        options?.onCharIndex?.(text.length);
        resolve();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      // Try to pick a good Portuguese voice
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(
        (v) => v.lang.startsWith("pt") && v.name.toLowerCase().includes("female")
      ) || voices.find((v) => v.lang.startsWith("pt"));
      if (ptVoice) utterance.voice = ptVoice;

      // Pulse energy on word boundaries for cadence effect
      let pulseTimer: ReturnType<typeof setInterval>;

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        if (event.name === "word") {
          // Report character progress for typewriter
          options?.onCharIndex?.(event.charIndex + event.charLength);
          // Pulse energy up briefly on each word
          onEnergyPulseRef.current?.(0.9 + Math.random() * 0.1);
        }
      };

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        onSpeakingChangeRef.current?.(true);
        // Rhythmic baseline energy oscillation
        pulseTimer = setInterval(() => {
          if (isSpeakingRef.current) {
            const base = 0.4 + Math.sin(Date.now() * 0.008) * 0.2;
            onEnergyPulseRef.current?.(base);
          }
        }, 80);
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        onSpeakingChangeRef.current?.(false);
        onEnergyPulseRef.current?.(0);
        clearInterval(pulseTimer);
        // Ensure all text is revealed
        options?.onCharIndex?.(text.length);
        resolve();
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        onSpeakingChangeRef.current?.(false);
        onEnergyPulseRef.current?.(0);
        clearInterval(pulseTimer);
        options?.onCharIndex?.(text.length);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    onSpeakingChangeRef.current?.(false);
    onEnergyPulseRef.current?.(0);
  }, []);

  return { speak, stop, setOnSpeakingChange, setOnEnergyPulse };
}
