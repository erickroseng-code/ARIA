'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import AriaSidebar from "@/components/layout/AriaSidebar";
import { ExecutiveDashboard } from "@/components/chat/ExecutiveDashboard";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { MaverickSession } from "@/components/chat/MaverickSession";
import { FinanceSession } from "@/components/chat/FinanceSession";
import { TrafficSession } from "@/components/chat/TrafficSession";
import { VoiceOrb } from "@/components/VoiceOrb";
import { useChat } from "@/hooks/useChat";
import { useAriaSpeech } from "@/hooks/useAriaSpeech";
import { useVoiceMode } from "@/hooks/useVoiceMode";
import { HydrationSafeWrapper } from "./HydrationSafeWrapper";
import { useChatStore } from "@/stores/chatStore";
import { ToastProvider } from "@/components/ui/Toast";

export function ChatInterface() {
  const [prefill, setPrefill] = useState("");
  const [energy, setEnergy] = useState(0);
  const [maverickOpen, setMaverickOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aria_active_squad') === 'maverick';
    }
    return false;
  });
  const [financeOpen, setFinanceOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aria_active_squad') === 'finance';
    }
    return false;
  });
  const [trafficOpen, setTrafficOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aria_active_squad') === 'traffic';
    }
    return false;
  });
  const [showDashboard, setShowDashboard] = useState(() => {
    if (typeof window !== 'undefined') {
      const active = localStorage.getItem('aria_active_squad');
      return !active;
    }
    return true;
  });
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [revealLength, setRevealLength] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Efeito para persistir aba do squad ativo após F5
  useEffect(() => {
    if (maverickOpen) {
      localStorage.setItem('aria_active_squad', 'maverick');
    } else if (financeOpen) {
      localStorage.setItem('aria_active_squad', 'finance');
    } else if (trafficOpen) {
      localStorage.setItem('aria_active_squad', 'traffic');
    } else {
      localStorage.removeItem('aria_active_squad');
    }
  }, [maverickOpen, financeOpen, trafficOpen]);

  // Store — for sidebar props
  const { conversations, activeConversationId, streamingConversationId, startNewConversation, switchConversation, deleteConversation } = useChatStore();

  // Real ARIA backend integration
  const { messages, isStreaming, streamingContent, sendMessage, regenerateResponse } = useChat();

  // Só mostra streaming na conversa que está gerando
  const isActiveConversationStreaming = isStreaming && streamingConversationId === activeConversationId;
  const activeStreamingContent = isActiveConversationStreaming ? streamingContent : '';
  const { speak, enqueue, clearQueue, setOnQueueDone, setOnSpeakingChange, setOnEnergyPulse } = useAriaSpeech();

  // Rastreia quantos chars do streamingContent já foram enfileirados para TTS
  const enqueuedCharsRef = useRef(0);
  // Evita chamar pauseListening múltiplas vezes por resposta
  const streamSpeakStartedRef = useRef(false);

  // Modo de voz — wake word "Ei ARIA" + fala contínua
  const {
    state: voiceState,
    lastTranscript,
    isSupported: voiceSupported,
    startListening,
    activateDirectly,
    stopListening,
    pauseListening,
    resumeListening,
  } = useVoiceMode({
    onCommand: useCallback((text: string) => {
      // Mesmo reset que handleSend faz antes de enviar
      setSpeakingMessageId(null);
      setRevealLength(0);
      enqueuedCharsRef.current = 0;
      streamSpeakStartedRef.current = false;
      setShowDashboard(false);
      clearQueue();
      sendMessage(text);
    }, [sendMessage, clearQueue]),
    onStateChange: useCallback((s: import('@/hooks/useVoiceMode').VoiceState) => {
      // Interrompe ARIA se o usuário falar enquanto ela responde
      if (s === 'cmd_listening') clearQueue();
    }, [clearQueue]),
  });

  // On mount: não cria nova conversa cegamente, apenas usa a store persistida.
  useEffect(() => {
    // eslint-disable react-hooks/exhaustive-deps
  }, []);

  // Connect speech energy pulse for cadence-reactive background
  useEffect(() => {
    setOnEnergyPulse((e) => setEnergy(e));
    setOnSpeakingChange((speaking) => {
      if (!speaking) setEnergy(0);
    });
  }, [setOnSpeakingChange, setOnEnergyPulse]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isActiveConversationStreaming, activeStreamingContent, revealLength]);

  const handleSend = useCallback(async (content: string) => {
    setSpeakingMessageId(null);
    setRevealLength(0);
    enqueuedCharsRef.current = 0;
    streamSpeakStartedRef.current = false;
    setShowDashboard(false);
    clearQueue();
    sendMessage(content);
  }, [sendMessage, clearQueue]);

  const handlePrefillConsumed = useCallback(() => {
    setPrefill("");
  }, []);

  // Quick command from welcome screen → fill input
  const handleQuickCommand = useCallback((cmd: string) => {
    setPrefill(cmd);
  }, []);

  // Chunked TTS: enfileira sentenças completas conforme o LLM vai gerando
  useEffect(() => {
    if (!isActiveConversationStreaming || !activeStreamingContent) return;

    const notYetEnqueued = activeStreamingContent.slice(enqueuedCharsRef.current);
    if (notYetEnqueued.length < 8) return; // aguarda mais conteúdo

    // Encontra o último limite de sentença no trecho novo
    const boundaryRegex = /[.!?…]+[\s]+|[.!?…]+$/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = boundaryRegex.exec(notYetEnqueued)) !== null) {
      lastEnd = match.index + match[0].length;
    }
    if (lastEnd === 0) return; // nenhuma sentença completa ainda

    const chunk = notYetEnqueued.slice(0, lastEnd);
    enqueuedCharsRef.current += lastEnd;

    if (!streamSpeakStartedRef.current) {
      streamSpeakStartedRef.current = true;
      setSpeakingMessageId('streaming');
      pauseListening();
    }

    enqueue(chunk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStreamingContent]);

  // Detecta quando uma nova mensagem da ARIA é commitada
  // Enfileira o trecho restante (se houver) e aguarda a queue drenar
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const count = messages.length;
    if (count <= prevMessageCountRef.current) {
      prevMessageCountRef.current = count;
      return;
    }
    prevMessageCountRef.current = count;

    const lastMessage = messages[count - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return;

    const content = lastMessage.content;
    if (!content?.trim()) return;

    setSpeakingMessageId(lastMessage.id);

    const alreadyEnqueued = enqueuedCharsRef.current;
    enqueuedCharsRef.current = 0; // reseta para próxima resposta
    streamSpeakStartedRef.current = false;

    const remaining = content.slice(alreadyEnqueued).trim();

    if (alreadyEnqueued === 0) {
      // Chunked TTS não foi usado (resposta muito curta ou sem pontuação durante stream)
      // Usa speak() convencional com efeito typewriter
      setRevealLength(0);
      pauseListening();
      speak(content, {
        onCharIndex: (charIndex) => setRevealLength(charIndex),
      }).then(() => {
        setSpeakingMessageId(null);
        setRevealLength(content.length);
        resumeListening();
      });
    } else {
      // Chunked TTS já iniciou — enfileira o restante (última sentença sem pontuação, se houver)
      if (remaining) {
        enqueue(remaining);
      }
      setRevealLength(content.length); // texto já visível pelo streaming, sem typewriter

      setOnQueueDone(() => {
        setSpeakingMessageId(null);
        resumeListening();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const energyLevel = energy;
  const hasMessages = messages.length > 0 || isStreaming;
  const isSpeaking = !!speakingMessageId;

  // Estado do orbe: se ARIA está falando, mostra 'processing' no orbe; caso contrário, estado do voice mode
  const orbState = isSpeaking ? 'processing' : voiceState;

  // Derive active squad id for sidebar highlight
  const activeSquad = maverickOpen ? 'maverick' : financeOpen ? 'finance' : trafficOpen ? 'traffic' : null;

  const handleSelectSquad = useCallback((squadId: string | null) => {
    if (squadId === 'maverick') { setMaverickOpen(true); setFinanceOpen(false); setTrafficOpen(false); setShowDashboard(false); }
    else if (squadId === 'finance') { setFinanceOpen(true); setMaverickOpen(false); setTrafficOpen(false); setShowDashboard(false); }
    else if (squadId === 'traffic') { setTrafficOpen(true); setMaverickOpen(false); setFinanceOpen(false); setShowDashboard(false); }
    else { setMaverickOpen(false); setFinanceOpen(false); setTrafficOpen(false); setShowDashboard(true); }
  }, []);

  return (
    <HydrationSafeWrapper fallback={<ChatInterfaceLoading />}>
      <ToastProvider>
        <div className="h-screen w-full overflow-hidden relative bg-background text-white">
          {/* Deep Black Matte Layout */}

          <AriaSidebar
            onSelectIntegration={(cmd) => { setPrefill(cmd); }}
            onSelectSquad={handleSelectSquad}
            activeConversationId={activeConversationId}
            activeSquad={activeSquad}
          />

          <div className="h-full flex flex-col relative z-10 lg:pl-64">
            {/* ── Modo Squad Maverick: painel inline, largura total do chat ── */}
            {maverickOpen ? (
              <MaverickSession onClose={() => setMaverickOpen(false)} />
            ) : financeOpen ? (
              <FinanceSession onClose={() => setFinanceOpen(false)} />
            ) : trafficOpen ? (
              <TrafficSession onClose={() => setTrafficOpen(false)} />
            ) : (
              <>
                <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
                  <div className="flex items-center gap-2" />
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-300 shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                        isSpeaking ? "bg-cyan-400 animate-pulse" : "bg-white/80"
                      )}
                    />
                    <span className="text-xs text-white/80 font-medium drop-shadow-sm">
                      {isSpeaking ? "Falando" : "Online"}
                    </span>
                  </div>
                </header>

                {showDashboard ? (
                  <div className="flex-1 flex flex-col min-h-0 lg:pr-64">
                    <ExecutiveDashboard onSelectSquad={handleSelectSquad} />
                    <div className="shrink-0 px-4 pb-8 flex justify-center">
                      <div className="w-full max-w-3xl z-20">
                        <ChatInput
                          onSend={handleSend}
                          disabled={isStreaming || isSpeaking}
                          prefill={prefill}
                          onPrefillConsumed={handlePrefillConsumed}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex-1 overflow-y-auto scrollbar-hidden px-4"
                      style={{
                        maskImage: 'linear-gradient(to bottom, transparent, black 40px, black calc(100% - 40px), transparent)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40px, black calc(100% - 40px), transparent)'
                      }}
                    >
                      <div className="max-w-3xl mx-auto pt-8 pb-36 space-y-0">
                        {messages.map((msg, idx) => (
                          <ChatMessage
                            key={msg.id}
                            message={{
                              id: msg.id,
                              role: msg.role === 'assistant' ? 'aria' : 'user',
                              content: msg.content,
                              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                            }}
                            revealLength={msg.id === speakingMessageId ? revealLength : undefined}
                            onRegenerate={
                              !isStreaming &&
                                msg.role === 'assistant' &&
                                idx === messages.length - 1
                                ? regenerateResponse
                                : undefined
                            }
                          />
                        ))}
                        {isActiveConversationStreaming && activeStreamingContent && (
                          <ChatMessage
                            message={{
                              id: "streaming",
                              role: "aria",
                              content: activeStreamingContent,
                              timestamp: new Date(Date.now()),
                            }}
                          />
                        )}
                        {isActiveConversationStreaming && !activeStreamingContent && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                    <div className="bg-transparent">
                      <ChatInput
                        onSend={handleSend}
                        disabled={isStreaming || isSpeaking}
                        prefill={prefill}
                        onPrefillConsumed={handlePrefillConsumed}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* VoiceOrb fixo no canto inferior direito — visível sempre */}
          {voiceSupported && !maverickOpen && !financeOpen && !trafficOpen && (
            <div className="fixed bottom-6 right-6 z-50">
              <VoiceOrb
                state={orbState}
                energy={energyLevel}
                lastTranscript={lastTranscript}
                isActive={voiceState !== 'idle'}
                onToggle={() => {
                  if (voiceState === 'idle' || voiceState === 'error') {
                    // Clique em idle/error: ativa direto para cmd_listening
                    activateDirectly();
                  } else if (voiceState === 'wake_listening') {
                    // Clique enquanto aguardando wake word: ativa imediatamente
                    activateDirectly();
                  } else {
                    // Clique durante cmd_listening/processing: desliga
                    stopListening();
                  }
                }}
              />
            </div>
          )}
        </div>
      </ToastProvider>
    </HydrationSafeWrapper>
  );
}

function ChatInterfaceLoading() {
  return (
    <div className="h-screen w-full overflow-hidden relative bg-background">
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    </div>
  );
}
