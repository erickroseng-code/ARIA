import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface Message {
    id: string;
    role: "user" | "aria" | "assistant";
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
            <div className="w-full mb-8 animate-fade-in group">
                {/* Avatar row — right aligned */}
                <div className="flex items-center gap-2.5 mb-3 justify-end">
                    <span className="text-xs font-semibold text-foreground/60 tracking-wide uppercase">Erick</span>
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-foreground/10">
                        <Image src="/erick-avatar.png" alt="Erick" width={28} height={28} className="w-full h-full object-cover" />
                    </div>
                </div>
                {/* Content — right aligned */}
                <div className="pr-[38px] text-right">
                    <p className="text-[15px] leading-snug text-white font-medium whitespace-pre-wrap">{message.content}</p>
                    <span className="text-[11px] text-white/60 mt-1.5 block">
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
                    "w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/40 transition-all duration-300",
                    isSpeaking && "ring-primary/80 shadow-[0_0_12px_hsl(200_70%_50%/0.4)]"
                )}>
                    <Image src="/aria-logo.png" alt="ARIA" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-primary/95 tracking-wide uppercase">ARIA</span>
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
                    <span className="inline-block w-2 h-5 bg-primary animate-pulse rounded-sm" />
                ) : (
                    <>
                        <div className="text-[15px] leading-[1.75] text-white/95 whitespace-pre-wrap">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-[1.75] text-[15px] inline text-white/95">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                    em: ({ children }) => <em className="italic text-white/90">{children}</em>,
                                    code: ({ children }) => (
                                        <code className="px-1.5 py-0.5 rounded-md text-[13px] font-mono bg-black/40 text-cyan-300 border border-cyan-500/30">
                                            {children}
                                        </code>
                                    ),
                                    pre: ({ children }) => (
                                        <pre className="bg-black/50 text-cyan-100 p-3 rounded-xl overflow-x-auto my-3 text-[13px] shadow-inner block border border-cyan-500/20">
                                            {children}
                                        </pre>
                                    ),
                                    ul: ({ children }) => <ul className="space-y-1 my-3 pl-2 block">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-[15px] block">{children}</ol>,
                                    li: ({ children }) => {
                                        let textContent = '';
                                        React.Children.forEach(children, child => {
                                            if (typeof child === 'string') textContent += child;
                                            else if (React.isValidElement(child) && typeof child.props.children === 'string') {
                                                textContent += child.props.children;
                                            }
                                        });

                                        const match = textContent.trim().match(/^\[(.*?)\]\s+(.*)$/);

                                        if (match && !isUser) {
                                            const status = match[1];
                                            const taskName = match[2];

                                            let statusColor = 'bg-[#E5E5EA] text-[#86868B]';
                                            if (status.toLowerCase().includes('andamento') || status.toLowerCase().includes('in progress')) {
                                                statusColor = 'bg-[#E8F5E9] text-[#1B5E20]'; // Apple Green
                                            } else if (status.toLowerCase().includes('aguardando') || status.toLowerCase().includes('waiting')) {
                                                statusColor = 'bg-[#FFF3E0] text-[#E65100]'; // Apple Orange
                                            }

                                            return (
                                                <div className="flex items-center justify-between gap-3 p-3 my-2 bg-background border border-border/50 rounded-2xl cursor-default block max-w-2xl transition-all hover:bg-black/5">
                                                    <p className="font-medium text-[14px] text-foreground truncate flex-1">{taskName}</p>
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusColor} shadow-sm shrink-0`}>
                                                        {status}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        return <li className="ml-4 my-1 text-[15px] leading-relaxed relative before:content-['•'] before:absolute before:-left-4 before:text-accent block">{children}</li>;
                                    },
                                }}
                            >
                                {displayContent}
                            </ReactMarkdown>

                            {isSpeaking && (
                                <span className="inline-block w-1.5 h-[18px] bg-primary/50 animate-pulse rounded-sm ml-0.5 align-middle" />
                            )}
                        </div>
                        {!isSpeaking && (
                            <span className="text-[11px] text-foreground/40 mt-2 block">
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
