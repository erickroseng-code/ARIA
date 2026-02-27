import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from "@/lib/utils";
import { EmailList, GmailEmail } from "./EmailList";

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
}

const ChatMessage = ({ message, revealLength }: ChatMessageProps) => {
  const isUser = message.role === "user";

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

  const rawDisplayContent =
    revealLength !== undefined && !isUser
      ? message.content.slice(0, revealLength)
      : message.content;

  const displayContent = isUser ? rawDisplayContent : preprocessContent(rawDisplayContent);

  const isSpeaking =
    !isUser && revealLength !== undefined && revealLength < message.content.length;

  if (isUser) {
    return (
      <div className="w-full mb-6 animate-fade-in flex justify-end">
        <div className="flex flex-col items-end max-w-[75%]">
          {/* Avatar row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-white/60 tracking-wide drop-shadow-sm">Erick</span>
            <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-white/30">
              <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Bubble */}
          <div className="bg-white/[0.08] backdrop-blur-md border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.2)] rounded-2xl rounded-tr-sm px-4 py-3">
            <p className="text-[16px] leading-relaxed text-white whitespace-pre-wrap text-right">
              {message.content}
            </p>
          </div>
          <span className="text-[11px] text-white/40 mt-1.5 block drop-shadow-sm">
            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // ARIA message — full-width AI style, no background
  return (
    <div className="w-full mb-6 animate-fade-in">
      {/* Avatar row */}
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className={cn(
            "w-6 h-6 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-white/20 shadow-sm transition-all duration-300",
            isSpeaking && "ring-white/50 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
          )}
        >
          <img src={ariaLogo} alt="ARIA" className="w-full h-full object-cover" />
        </div>
        <span className="text-[11px] font-medium text-white/90 tracking-wide drop-shadow-sm">ARIA</span>
        {isSpeaking && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1 h-1 rounded-full bg-white/80 animate-pulse" />
            <span className="text-[10px] text-white/50">falando</span>
          </div>
        )}
      </div>

      {/* Content — full width, plain */}
      <div className="pl-[34px]">
        {revealLength === 0 ? (
          <span className="inline-block w-2 h-5 bg-white/60 animate-pulse rounded-sm shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        ) : (
          <div className="text-[16px] leading-[1.78] text-white/95 drop-shadow-sm prose prose-invert max-w-none prose-p:leading-[1.78] prose-p:my-0 prose-pre:bg-transparent prose-pre:p-0">
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
                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>
              }}
            >
              {displayContent}
            </ReactMarkdown>
            {isSpeaking && (
              <span className="inline-block w-1.5 h-[18px] bg-white/70 animate-pulse rounded-sm ml-0.5 align-middle shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            )}
            {!isSpeaking && (
              <span className="text-[11px] text-white/40 mt-2 block drop-shadow-sm">
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
