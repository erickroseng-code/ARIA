'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import LiquidGlassBackground from "./LiquidGlassBackground";
import AriaSidebar from "@/components/layout/AriaSidebar";
import AriaWelcome from "@/components/chat/AriaWelcome";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { MaverickSession } from "@/components/chat/MaverickSession";
import { useChat } from "@/hooks/useChat";
import { useAriaSpeech } from "@/hooks/useAriaSpeech";
import { HydrationSafeWrapper } from "./HydrationSafeWrapper";
import { useChatStore } from "@/stores/chatStore";

export function ChatInterface() {
  const [prefill, setPrefill] = useState("");
  const [energy, setEnergy] = useState(0);
  const [maverickOpen, setMaverickOpen] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [revealLength, setRevealLength] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store — for sidebar props
  const { conversations, activeConversationId, startNewConversation, switchConversation, deleteConversation } = useChatStore();

  // Real ARIA backend integration
  const { messages, isStreaming, streamingContent, sendMessage, regenerateResponse } = useChat();
  const { speak, setOnSpeakingChange, setOnEnergyPulse } = useAriaSpeech();

  // On mount: always start a fresh conversation so the app opens on the welcome screen
  useEffect(() => {
    startNewConversation();
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
  }, [messages, isStreaming, streamingContent, revealLength]);

  const handleSend = useCallback(async (content: string) => {
    setSpeakingMessageId(null);
    setRevealLength(0);
    sendMessage(content);
  }, [sendMessage]);

  const handlePrefillConsumed = useCallback(() => {
    setPrefill("");
  }, []);

  // Quick command from welcome screen → fill input
  const handleQuickCommand = useCallback((cmd: string) => {
    setPrefill(cmd);
  }, []);

  // New conversation handler
  const handleNewConversation = useCallback(() => {
    startNewConversation();
    setSpeakingMessageId(null);
    setRevealLength(0);
  }, [startNewConversation]);

  // Stream response with speech synthesis
  useEffect(() => {
    if (streamingContent && !isStreaming && speakingMessageId === null) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        setSpeakingMessageId(lastMessage.id);
        setRevealLength(0);
        speak(streamingContent, {
          onCharIndex: (charIndex) => {
            setRevealLength(charIndex);
          },
        }).then(() => {
          setSpeakingMessageId(null);
          setRevealLength(streamingContent.length);
        });
      }
    }
  }, [streamingContent, isStreaming, messages, speak, speakingMessageId]);

  const energyLevel = energy;
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <HydrationSafeWrapper fallback={<ChatInterfaceLoading />}>
      <div className="h-screen w-full overflow-hidden relative bg-gradient-to-br from-[#003355] via-[#0d061a] to-[#4a0a41]">
        {/* Fluid background only on welcome screen */}
        {!hasMessages && <LiquidGlassBackground energy={energyLevel} />}
        {!hasMessages && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}

        <AriaSidebar
          onSelectIntegration={(cmd) => setPrefill(cmd)}
          onSelectSquad={(squadId) => {
            if (squadId === 'maverick') setMaverickOpen(true);
          }}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewConversation={handleNewConversation}
          onSwitchConversation={switchConversation}
          onDeleteConversation={deleteConversation}
        />

        <div className="h-full flex flex-col relative z-10 lg:pl-64">
          {/* ── Modo Squad Maverick: painel inline, largura total do chat ── */}
          {maverickOpen ? (
            <MaverickSession onClose={() => setMaverickOpen(false)} />
          ) : (
            <>
              <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
                <div className="flex items-center gap-2" />
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors duration-300 shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                      speakingMessageId ? "bg-white animate-pulse" : "bg-white/80"
                    )}
                  />
                  <span className="text-xs text-white/80 font-medium drop-shadow-sm">
                    {speakingMessageId ? "Falando" : "Online"}
                  </span>
                </div>
              </header>

              {messages.length === 0 && !isStreaming ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0 lg:pr-64">
                  <div className="bg-white/[0.01] backdrop-blur-xl border border-white/[0.06] shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[28px] px-8 py-10 w-full max-w-[560px] flex flex-col gap-6">
                    <AriaWelcome onSelect={handleQuickCommand} />
                    <ChatInput
                      onSend={handleSend}
                      disabled={isStreaming || !!speakingMessageId}
                      prefill={prefill}
                      onPrefillConsumed={handlePrefillConsumed}
                    />
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
                      {isStreaming && streamingContent && (
                        <ChatMessage
                          message={{
                            id: "streaming",
                            role: "aria",
                            content: streamingContent,
                            timestamp: new Date(Date.now()),
                          }}
                        />
                      )}
                      {isStreaming && !streamingContent && <TypingIndicator />}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                  <div className="bg-transparent">
                    <ChatInput
                      onSend={handleSend}
                      disabled={isStreaming || !!speakingMessageId}
                      prefill={prefill}
                      onPrefillConsumed={handlePrefillConsumed}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </HydrationSafeWrapper>
  );
}

function ChatInterfaceLoading() {
  return (
    <div className="h-screen w-full overflow-hidden relative bg-gradient-to-br from-[#004466] via-[#110825] to-[#5a0c50]">
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    </div>
  );
}
