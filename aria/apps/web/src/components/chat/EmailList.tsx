import React from 'react';
import { Calendar, User, ChevronRight } from 'lucide-react';
import { cn } from "@/lib/utils";

export interface GmailEmail {
    id: string;
    subject: string;
    from: string;
    date: string;
    snippet: string;
    unread: boolean;
}

interface EmailListProps {
    emails: GmailEmail[];
}

export const EmailList = ({ emails }: EmailListProps) => {
    if (!emails || emails.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 my-6 w-full animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
            {emails.map((email, idx) => (
                <div
                    key={email.id}
                    style={{ transitionDelay: `${idx * 100}ms` }}
                    className={cn(
                        "group relative overflow-hidden rounded-[22px] border border-white/[0.1] bg-white/[0.04] backdrop-blur-[20px] p-5 transition-all duration-500 hover:bg-white/[0.08] hover:border-white/[0.2] hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] hover:-translate-y-1",
                        email.unread && "border-blue-500/30 bg-blue-500/[0.03]"
                    )}
                >
                    {/* Glass Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />

                    {/* Unread Indicator - Premium style */}
                    {email.unread && (
                        <div className="absolute top-4 right-5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-bold text-blue-400 uppercase tracking-tight">
                            <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                            Novo
                        </div>
                    )}

                    <div className="relative flex flex-col gap-3">
                        {/* Header: Subject */}
                        <h3 className={cn(
                            "text-[16px] leading-snug text-white/95 group-hover:text-white transition-colors line-clamp-2 pr-12",
                            email.unread ? "font-bold tracking-tight" : "font-medium"
                        )}>
                            {email.subject}
                        </h3>

                        {/* Sender & Meta */}
                        <div className="flex flex-wrap items-center justify-between gap-y-2 pt-1 border-t border-white/[0.05]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center flex-shrink-0 shadow-inner">
                                    <User className="w-3.5 h-3.5 text-white/80" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-semibold text-white/80 group-hover:text-white transition-colors">
                                        {email.from.split('<')[0].trim() || 'Remetente Desconhecido'}
                                    </span>
                                    <span className="text-[11px] text-white/40 tabular-nums lowercase">
                                        {email.from.includes('<') ? email.from.split('<')[1].replace('>', '') : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-medium bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.05]">
                                <Calendar className="w-3 h-3" />
                                <span>{email.date.split('(')[0].trim()}</span>
                            </div>
                        </div>

                        {/* Snippet Card */}
                        <div className="mt-1 p-3 rounded-xl bg-black/20 border border-white/[0.03] shadow-inner">
                            <p className="text-[13px] leading-relaxed text-white/60 line-clamp-3 italic opacity-80 group-hover:opacity-100 transition-opacity">
                                "{email.snippet}"
                            </p>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between mt-1">
                            <div className="flex gap-2">
                                {/* Decorative dots like Apple window */}
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/30 group-hover:text-blue-400 transition-all duration-300">
                                ABRIR NO GMAIL <ChevronRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
