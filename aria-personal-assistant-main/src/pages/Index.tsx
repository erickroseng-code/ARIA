import { useState, useRef, useEffect, useCallback } from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import LiquidGlassBackground from "@/components/LiquidGlassBackground";
import AriaSidebar from "@/components/AriaSidebar";
import AriaWelcome from "@/components/AriaWelcome";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import { useAriaSpeech } from "@/hooks/useAriaSpeech";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [prefill, setPrefill] = useState("");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [revealLength, setRevealLength] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, setOnSpeakingChange, setOnEnergyPulse } = useAriaSpeech();

  // Connect speech energy pulse for cadence-reactive background
  useEffect(() => {
    setOnEnergyPulse((e) => setEnergy(e));
    setOnSpeakingChange((speaking) => {
      if (!speaking) setEnergy(0);
    });
  }, [setOnSpeakingChange, setOnEnergyPulse]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, revealLength]);

  const handleSend = useCallback((content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate ARIA response
    setTimeout(async () => {
      const response = getAriaResponse(content);
      const ariaId = (Date.now() + 1).toString();
      const ariaMessage: Message = {
        id: ariaId,
        role: "aria",
        content: response,
        timestamp: new Date(),
      };

      setIsTyping(false);
      setSpeakingMessageId(ariaId);
      setRevealLength(0);
      setMessages((prev) => [...prev, ariaMessage]);

      // Speak with typewriter sync
      await speak(response, {
        onCharIndex: (charIndex) => {
          setRevealLength(charIndex);
        },
      });

      // Done speaking — reveal all
      setSpeakingMessageId(null);
      setRevealLength(response.length);
    }, 1800);
  }, [speak]);

  return (
    <div className="h-screen w-full overflow-hidden relative bg-gradient-to-br from-background via-background to-[hsl(18_30%_12%)]">
      <LiquidGlassBackground energy={energy} />

      <AriaSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onSelectIntegration={(cmd) => setPrefill(cmd)} />

      <div
        className={cn(
          "h-full flex flex-col relative z-10 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          sidebarOpen ? "lg:pl-64" : "lg:pl-16"
        )}
      >
        <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
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

        {messages.length === 0 && !isTyping ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
            <div className="backdrop-blur-xl bg-background/30 border border-border/20 rounded-3xl px-10 py-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full max-w-2xl">
              <AriaWelcome />
              <ChatInput onSend={handleSend} disabled={isTyping || !!speakingMessageId} prefill={prefill} onPrefillConsumed={() => setPrefill("")} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-hidden px-4">
              <div className="max-w-2xl mx-auto py-6 space-y-0">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    revealLength={
                      msg.id === speakingMessageId ? revealLength : undefined
                    }
                  />
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="backdrop-blur-md bg-background/20 border-t border-border/10">
              <ChatInput onSend={handleSend} disabled={isTyping || !!speakingMessageId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function getAriaResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("olá") || lower.includes("oi") || lower.includes("hey")) {
    return "Olá! É ótimo falar com você. Em que posso ajudar hoje?";
  }
  if (lower.includes("hora") || lower.includes("horas")) {
    return `Agora são ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Precisa de mais alguma coisa?`;
  }
  if (lower.includes("nome")) {
    return "Meu nome é ARIA — sua assistente pessoal inteligente. Fui projetada para tornar o seu dia mais produtivo e organizado.";
  }
  return "Entendido! Assim que meu backend estiver conectado, poderei processar sua solicitação de forma completa. Por enquanto, estou aqui para demonstrar a experiência da interface.";
}

export default Index;
