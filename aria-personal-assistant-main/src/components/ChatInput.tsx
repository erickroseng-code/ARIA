import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

const ChatInput = ({ onSend, disabled, prefill, onPrefillConsumed }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (prefill) {
      setMessage(prefill);
      onPrefillConsumed?.();
      textareaRef.current?.focus();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  const handleSubmit = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleVoice = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setMessage(transcript);

      // Auto-send on final result
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          if (transcript.trim()) {
            onSend(transcript.trim());
            setMessage("");
          }
        }, 500);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onSend]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-6">
      <div className={cn(
        "bg-secondary border border-border rounded-2xl flex items-end gap-2 px-4 py-3 transition-all duration-300",
        isListening && "border-primary/40 shadow-[0_0_20px_hsl(18_50%_50%/0.15)]"
      )}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Ouvindo..." : "Converse com ARIA..."}
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground text-[15px] leading-relaxed scrollbar-hidden min-h-[24px]"
        />
        <div className="flex items-center gap-1 pb-0.5">
          <button
            onClick={toggleVoice}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              isListening
                ? "bg-primary/20 text-primary animate-pulse"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Microfone"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
            className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition-all duration-200"
            aria-label="Enviar"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
