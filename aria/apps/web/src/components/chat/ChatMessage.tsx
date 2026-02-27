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
          <>
            <p className="text-[16px] leading-[1.78] text-white/95 whitespace-pre-wrap drop-shadow-sm">
              {displayContent}
              {isSpeaking && (
                <span className="inline-block w-1.5 h-[18px] bg-white/70 animate-pulse rounded-sm ml-0.5 align-middle shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
            </p>
            {!isSpeaking && (
              <span className="text-[11px] text-white/40 mt-2 block drop-shadow-sm">
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
