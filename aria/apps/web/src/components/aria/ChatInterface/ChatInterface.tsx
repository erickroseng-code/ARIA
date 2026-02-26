'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import LiquidGlassBackground from "./LiquidGlassBackground";
import AriaSidebar from "@/components/layout/AriaSidebar";
import AriaWelcome from "@/components/chat/AriaWelcome";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useChat } from "@/hooks/useChat";
import { useAriaSpeech } from "@/hooks/useAriaSpeech";
import { HydrationSafeWrapper } from "./HydrationSafeWrapper";

export function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [energy, setEnergy] = useState(0);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [revealLength, setRevealLength] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real ARIA backend integration
  const { messages, isStreaming, streamingContent, sendMessage } = useChat();
  const { speak, setOnSpeakingChange, setOnEnergyPulse } = useAriaSpeech();

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

  // Stream response with speech synthesis
  useEffect(() => {
    if (streamingContent && !isStreaming && speakingMessageId === null) {
      // When streaming ends and we have content, trigger speech synthesis
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

  // Compute energy dynamically
  const energyLevel = energy;
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <HydrationSafeWrapper fallback={<ChatInterfaceLoading />}>
      <div className="h-screen w-full overflow-hidden relative bg-background">
        {/* Fluid background only on welcome screen */}
        {!hasMessages && <LiquidGlassBackground energy={energyLevel} />}

        {/* Dark overlay — only on welcome screen for legibility */}
        {!hasMessages && <div className="absolute inset-0 bg-background/50 pointer-events-none" />}

        <AriaSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onSelectIntegration={(cmd) => setPrefill(cmd)}
        />

        <div
          className={cn(
            "h-full flex flex-col relative z-10 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
            sidebarOpen ? "lg:pl-64" : "lg:pl-16"
          )}
        >
          <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full transition-colors duration-300",
                speakingMessageId ? "bg-primary animate-pulse" : "bg-primary"
              )} />
              <span className="text-xs text-muted-foreground font-medium">
                {speakingMessageId ? "Falando" : "Online"}
              </span>
            </div>
          </header>

          {messages.length === 0 && !isStreaming ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
              <div className="bg-[#121212]/90 backdrop-blur-md border border-white/[0.04] rounded-[28px] px-8 py-10 shadow-2xl w-full max-w-[560px] flex flex-col gap-6">
                <AriaWelcome />
                <ChatInput onSend={handleSend} disabled={isStreaming || !!speakingMessageId} prefill={prefill} onPrefillConsumed={handlePrefillConsumed} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto scrollbar-hidden px-4">
                <div className="max-w-2xl mx-auto py-6 space-y-0">
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={{
                        id: msg.id,
                        role: msg.role === 'assistant' ? 'aria' : 'user',
                        content: msg.content,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                      }}
                      revealLength={
                        msg.id === speakingMessageId ? revealLength : undefined
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
              <div className="backdrop-blur-md bg-background/20 border-t border-border/10">
                <ChatInput
                  onSend={handleSend}
                  disabled={isStreaming || !!speakingMessageId}
                  prefill={prefill}
                  onPrefillConsumed={handlePrefillConsumed}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </HydrationSafeWrapper>
  );
}

// Fallback loading state during server-side rendering
function ChatInterfaceLoading() {
  return (
    <div className="h-screen w-full overflow-hidden relative bg-background">
      <div className="absolute inset-0 bg-background/50 pointer-events-none" />
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    </div>
  );
}
