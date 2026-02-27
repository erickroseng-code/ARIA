'use client';

import { LayoutGrid, PlusSquare, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationHub from "@/components/layout/IntegrationHub";
import { Conversation, useChatStore } from "@/stores/chatStore";

const ariaLogo = "/aria-logo.png";
const erickAvatar = "/erick-avatar.png";
const maverickLogo = "/squads/maverick.png";

interface AriaSidebarProps {
    onSelectIntegration?: (command: string) => void;
    onSelectSquad?: (squadId: string) => void;
    conversations?: Conversation[];
    activeConversationId?: string;
    onNewConversation?: () => void;
    onSwitchConversation?: (id: string) => void;
    onDeleteConversation?: (id: string) => void;
}

const squads = [
    { name: "Maverick", logo: maverickLogo, command: "Fazer uma análise de perfil com o Squad Maverick", description: "Estratégia & Visão" },
];

const AriaSidebar = ({
    onSelectIntegration: _onSelectIntegration,
    onSelectSquad,
    conversations = [],
    activeConversationId,
    onNewConversation,
    onSwitchConversation,
    onDeleteConversation,
}: AriaSidebarProps) => {
    const { isHubOpen, setHubOpen } = useChatStore();

    // Only show conversations that have at least one message
    const conversationsWithMessages = conversations.filter((c) => c.messages.length > 0);

    return (
        <>
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-500",
                    "bg-[#0f071a]/40 backdrop-blur-3xl border-r border-white/[0.08] shadow-[1px_0_24px_rgba(0,0,0,0.5)]",
                    "hidden lg:flex w-64"
                )}
            >
                <div className="flex flex-col h-full overflow-hidden opacity-100">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 h-16">
                        <img src={ariaLogo} alt="ARIA" className="w-8 h-8 rounded-lg flex-shrink-0" />
                        <span className="text-xl font-semibold tracking-tight text-white drop-shadow-md">ARIA</span>
                    </div>

                    {/* Nav */}
                    <nav className="px-2 py-2 space-y-1">
                        {/* New Conversation button */}
                        <button
                            onClick={onNewConversation}
                            title="Nova Conversa"
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-white/80 hover:bg-white/10 hover:text-white"
                        >
                            <PlusSquare className="w-5 h-5 flex-shrink-0" />
                            <span>Nova Conversa</span>
                        </button>

                        {/* Integrations */}
                        <button
                            onClick={() => setHubOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200"
                        >
                            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
                            <span>Integrações</span>
                        </button>
                    </nav>

                    {/* Conversation history */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hidden">
                        {conversationsWithMessages.length > 0 && (
                            <p className="text-xs font-medium text-white/60 uppercase tracking-wider px-3 mb-2 drop-shadow-sm">
                                Histórico
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {conversationsWithMessages.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={cn(
                                        "group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200",
                                        conv.id === activeConversationId && "bg-white/15 text-white font-medium"
                                    )}
                                >
                                    <button
                                        onClick={() => onSwitchConversation?.(conv.id)}
                                        title={conv.title}
                                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                                    >
                                        <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                                        <span className="truncate">{conv.title}</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteConversation?.(conv.id); }}
                                        title="Excluir conversa"
                                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded-md text-white/50 hover:text-red-400 hover:bg-red-400/20 transition-all duration-150"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {conversationsWithMessages.length === 0 && (
                                <p className="px-3 py-4 text-xs text-white/50 text-center">
                                    Suas conversas aparecerão aqui
                                </p>
                            )}
                        </div>

                        {/* Separator */}
                        {/* Spacer instead of separator */}
                        <div className="mx-3 my-4" />

                        {/* AI Squads section */}
                        <p className="text-xs font-medium text-white/60 uppercase tracking-wider px-3 mb-2 drop-shadow-sm">
                            Squads de IA
                        </p>
                        <div className="space-y-0.5">
                            {squads.map((squad) => (
                                <button
                                    key={squad.name}
                                    onClick={() => onSelectSquad?.(squad.name.toLowerCase())}
                                    title={squad.name}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[16px] text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1 hover:shadow-[0_0_12px_rgba(255,255,255,0.1)] active:scale-[0.97] transition-all duration-200"
                                >
                                    <img src={squad.logo} alt={squad.name} className="w-6 h-6 object-contain flex-shrink-0 rounded" />
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className="font-medium">{squad.name}</span>
                                        <span className="text-[11px] text-white/50">{squad.description}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-black/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-foreground/10">
                                <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-white truncate drop-shadow-sm">Erick</p>
                                <p className="text-xs text-white/60 truncate">Online</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <IntegrationHub open={isHubOpen} onOpenChange={setHubOpen} />
        </>
    );
};

export default AriaSidebar;
