import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { EmailList, GmailEmail } from "./EmailList";
import { RotateCcw } from "lucide-react";

const ariaLogo = "/aria-logo.png";
const erickAvatar = "/erick-avatar.png";

export interface Message {
  id: string;
  role: "user" | "aria";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  revealLength?: number;
  onRegenerate?: () => void;
}

const ChatMessage = ({ message, revealLength, onRegenerate }: ChatMessageProps) => {
  const isUser = message.role === "user";
  const [typedReveal, setTypedReveal] = React.useState(0);
  const isStreamingMsg = message.id === "streaming";

  // Typewriter effect logic: jumps by chunks of words
  React.useEffect(() => {
    // If it's a user message or we are forced to show everything (no revealLength), just skip
    if (isUser) {
      setTypedReveal(message.content.length);
      return;
    }

    const targetLength = revealLength !== undefined ? revealLength : message.content.length;

    // Fast skip for already rendered messages if not streaming
    if (!isStreamingMsg && typedReveal === 0 && targetLength > 0) {
      setTypedReveal(targetLength);
      return;
    }

    if (typedReveal < targetLength) {
      const timer = setTimeout(() => {
        // Find next word boundaries (approx 3-5 words)
        const remaining = message.content.slice(typedReveal, targetLength);
        const words = remaining.split(' ');

        let increment = 0;
        if (words.length <= 4) {
          increment = remaining.length;
        } else {
          // Join back the first 4 words and get their length
          increment = words.slice(0, 4).join(' ').length + 1;
        }

        setTypedReveal(prev => Math.min(prev + increment, targetLength));
      }, 15); // Fast but perceivable
      return () => clearTimeout(timer);
    }
  }, [typedReveal, revealLength, message.content, isUser, isStreamingMsg]);

  // Heuristic: Try to detect if the AI is outputting an email list in plain text
  // mapping it back to a structure the EmailList can understand.
  const preprocessContent = (content: string) => {
    // Look for lines like "1. **Subject** - De: ... | Date ... Prévia: ..."
    const emailItemRegex = /^(\d+)\.\s+(?:(?:\*\*([^*]+)\*\*)|([^-\n]+))\s*[-—]\s*De:\s+([^\n|]+)\s*\|\s*([^\n\n]+)(?:\s*Prévia:\s*([^\n]+))?/gm;
    const matches = [...content.matchAll(emailItemRegex)];

    if (matches.length >= 2) {
      const emails: GmailEmail[] = matches.map(m => ({
        id: `h-${m[1]}`, // heuristic id
        subject: (m[2] || m[3] || "Sem Assunto").trim(),
        from: m[4].trim(),
        date: m[5].trim(),
        snippet: (m[6] || "").trim(),
        unread: content.toLowerCase().includes("não lidos") || content.toLowerCase().includes("nao lido")
      }));

      // Find the range of the list to replace it with a code block
      const firstMatch = matches[0];
      const lastMatch = matches[matches.length - 1];
      const startIndex = firstMatch.index!;
      const endIndex = lastMatch.index! + lastMatch[0].length;

      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex);

      return `${before}\n\n\`\`\`gmail\n${JSON.stringify(emails)}\n\`\`\`\n\n${after}`;
    }
    return content;
  };

  const rawDisplayContent = isUser ? message.content : message.content.slice(0, typedReveal);
  const displayContent = isUser ? rawDisplayContent : preprocessContent(rawDisplayContent);

  const isSpeaking =
    !isUser && typedReveal < message.content.length;

  if (isUser) {
    return (
      <div className="w-full mb-6 animate-in fade-in slide-in-from-right-4 duration-500 ease-out flex justify-end">
        <div className="flex flex-col items-end max-w-[75%]">
          {/* Avatar row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[14px] font-medium text-white/60 tracking-wide drop-shadow-sm">Erick</span>
            <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-white/30">
              <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Bubble */}
          <div className="bg-white/[0.08] backdrop-blur-md border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.2)] rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-[18px] leading-relaxed text-white whitespace-pre-wrap text-right">
              {message.content}
            </p>
          </div>
          <span className="text-[14px] text-white/40 mt-1.5 block drop-shadow-sm">
            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // ARIA message — full-width AI style, no background
  return (
    <div className="w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out group/message">
      {/* Avatar row */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
          {/* Spinning Gradient Ring (only when streaming/speaking) */}
          {(isSpeaking || isStreamingMsg) && (
            <svg className="absolute -inset-1 w-8 h-8 animate-[spin_2s_linear_infinite] text-primary/70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-0" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
              <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}

          {/* ARIA Logo */}
          <div className={cn(
            "w-5 h-5 rounded-md overflow-hidden relative z-10 bg-transparent transition-all duration-300",
            (isSpeaking || isStreamingMsg) && "shadow-[0_0_12px_rgba(255,255,255,0.4)]"
          )}>
            <img src={ariaLogo} alt="ARIA" className="w-full h-full object-cover" />
          </div>
        </div>
        <span className="text-[14px] font-medium text-white/90 tracking-wide drop-shadow-sm">ARIA</span>
        {(isSpeaking || isStreamingMsg) && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[10px] text-white/50 animate-pulse">gerando</span>
          </div>
        )}

        {/* Regenerate Button */}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="ml-2 p-1.5 rounded-full hover:bg-white/10 text-white/20 hover:text-white/80 transition-all duration-200 flex items-center gap-1.5 group/btn"
            title="Refazer resposta"
          >
            <RotateCcw className="w-3.5 h-3.5 group-hover/btn:rotate-[-45deg] transition-transform duration-300" />
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-0 group-hover/btn:opacity-100 transition-opacity">Refazer</span>
          </button>
        )}
      </div>

      {/* Content — full width, plain */}
      <div className="pl-[34px]">
        {typedReveal === 0 && !isStreamingMsg ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <div className="h-5 w-[60%] rounded bg-gradient-to-r from-white/10 via-white/[0.02] to-transparent animate-pulse" />
            <div className="h-4 w-[40%] rounded bg-gradient-to-r from-white/10 via-white/[0.02] to-transparent animate-pulse animation-delay-150" />
          </div>
        ) : (
          <div className={cn(
            "text-[18px] leading-[1.78] drop-shadow-sm prose prose-invert max-w-none prose-p:leading-[1.78] prose-p:my-0 prose-pre:bg-transparent prose-pre:p-0 transition-opacity duration-300 ease-in-out",
            isStreamingMsg ? "text-white/80" : "text-white/95"
          )}
            style={{
              // Mask for the soft fade-in effect at the end of the reveal
              WebkitMaskImage: (isSpeaking || isStreamingMsg) ? `linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)` : 'none',
              maskImage: (isSpeaking || isStreamingMsg) ? `linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)` : 'none',
            }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ _node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';

                  if (!inline && language === 'gmail') {
                    try {
                      const emails = JSON.parse(String(children).replace(/\n$/, '')) as GmailEmail[];
                      return <EmailList emails={emails} />;
                    } catch (e) {
                      return <pre className={className} {...props}>{children}</pre>;
                    }
                  }

                  return inline ? (
                    <code className={className} {...props}>{children}</code>
                  ) : (
                    <pre className={cn("bg-white/5 p-4 rounded-xl border border-white/10 my-4 overflow-x-auto", className)} {...props}>
                      <code className={className}>{children}</code>
                    </pre>
                  );
                },
                // Preserve the custom paragraph style
                p: ({ children }) => <p className="mb-4 last:mb-0 relative inline-block w-full">{children}</p>
              }}
            >
              {displayContent}
            </ReactMarkdown>

            {/* The Animated Cursor / Tracker at the end of the text while generating */}
            {(isSpeaking || isStreamingMsg) && (
              <span className="inline-block w-2.5 h-[18px] bg-gradient-to-t from-primary to-blue-300 animate-pulse rounded-[2px] ml-1 align-middle shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
            )}

            {!(isSpeaking || isStreamingMsg) && (
              <span className="text-[14px] text-white/40 mt-2 block drop-shadow-sm">
                {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
