import { cn } from "@/lib/utils";
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
  const displayContent =
    revealLength !== undefined && !isUser
      ? message.content.slice(0, revealLength)
      : message.content;

  const isSpeaking = !isUser && revealLength !== undefined && revealLength < message.content.length;

  if (isUser) {
    return (
      <div className="w-full mb-8 animate-fade-in">
        {/* Avatar row — right aligned */}
        <div className="flex items-center gap-2.5 mb-3 justify-end">
          <span className="text-xs font-semibold text-foreground/60 tracking-wide uppercase">Erick</span>
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-foreground/10">
            <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
          </div>
        </div>
        {/* Content — right aligned */}
        <div className="pr-[38px] text-right">
          <p className="text-[15px] leading-snug text-foreground/80 whitespace-pre-wrap">{message.content}</p>
          <span className="text-[11px] opacity-25 mt-1.5 block">
            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }

  // ARIA message — full-width AI style
  return (
    <div className="w-full mb-8 animate-fade-in">
      {/* Avatar row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn(
          "w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/20 transition-all duration-300",
          isSpeaking && "ring-primary/50 shadow-[0_0_12px_hsl(200_60%_50%/0.3)]"
        )}>
          <img src={ariaLogo} alt="ARIA" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-semibold text-primary/80 tracking-wide uppercase">ARIA</span>
        {isSpeaking && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1 h-1 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">falando</span>
          </div>
        )}
      </div>

      {/* Content — full width */}
      <div className="pl-[38px]">
        {revealLength === 0 ? (
          <span className="inline-block w-2 h-5 bg-primary/40 animate-pulse rounded-sm" />
        ) : (
          <>
            <p className="text-[15px] leading-[1.75] text-foreground/90 whitespace-pre-wrap">
              {displayContent}
              {isSpeaking && (
                <span className="inline-block w-1.5 h-[18px] bg-primary/50 animate-pulse rounded-sm ml-0.5 align-middle" />
              )}
            </p>
            {!isSpeaking && (
              <span className="text-[11px] opacity-25 mt-2 block">
                {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
