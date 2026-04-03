'use client';

import { useRouter } from "next/navigation";
import { LayoutGrid, Target, BarChart2, Home, Zap, Search, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationHub from "@/components/layout/IntegrationHub";
import { useChatStore } from "@/stores/chatStore";

const ariaLogo = "/aria-logo.png";
const erickAvatar = "/erick-avatar.png";

interface AriaSidebarProps {
    onSelectIntegration?: (command: string) => void;
    onSelectSquad?: (squadId: string | null) => void;
    activeConversationId?: string;
    activeSquad?: string | null;
}

interface SquadDef {
    id: string;
    name: string;
    icon: React.ElementType;
    description: string;
    color: string;
    accentClass: string;
    // 'active' = green dot, 'attention' = amber dot, 'idle' = dim dot
    status: 'active' | 'attention' | 'idle';
}

const squads: SquadDef[] = [
    {
        id: "finance",
        name: "Graham",
        icon: BarChart2,
        description: "Gestão Financeira",
        color: "#2dd4bf",
        accentClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
        status: "active",
    },
    {
        id: "traffic",
        name: "Atlas",
        icon: Zap,
        description: "Meta ADS Manager",
        color: "#f97316",
        accentClass: "text-orange-400 bg-orange-500/10 border-orange-500/20",
        status: "active",
    },
    {
        id: "sherlock",
        name: "Sherlock",
        icon: Search,
        description: "Inteligência Viral",
        color: "#C3FAEA",
        accentClass: "text-[#C3FAEA] bg-[#C3FAEA]/10 border-[#C3FAEA]/20",
        status: "active",
    },
    {
        id: "maverick",
        name: "Maverick V2",
        icon: Zap,
        description: "Copywriter A-List",
        color: "#8b5cf6",
        accentClass: "text-violet-400 bg-violet-500/10 border-violet-500/20",
        status: "active",
    },
    {
        id: "uma",
        name: "Uma",
        icon: Palette,
        description: "Designer de Carrosséis",
        color: "#f43f5e",
        accentClass: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        status: "active",
    },
];

const STATUS_DOT: Record<SquadDef['status'], string> = {
    active: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]",
    attention: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
    idle: "bg-white/20",
};

const AriaSidebar = ({
    onSelectIntegration: _onSelectIntegration,
    onSelectSquad,
    activeSquad,
}: AriaSidebarProps) => {
    const { isHubOpen, setHubOpen } = useChatStore();
    const router = useRouter();

    return (
        <>
            <aside
                className={cn(
                    "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-500",
                    "bg-[#09090A] border-r border-white/[0.04] shadow-2xl",
                    "hidden lg:flex w-64"
                )}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 h-16 group">
                        <img src={ariaLogo} alt="ARIA" className="w-8 h-8 rounded-lg flex-shrink-0" />
                        <span className="text-xl font-semibold tracking-tight text-white drop-shadow-md flex-1">ARIA</span>
                        <button
                            onClick={() => {
                                if (onSelectSquad) {
                                    onSelectSquad(null);
                                } else {
                                    localStorage.removeItem('aria_active_squad');
                                    router.push('/');
                                }
                            }}
                            title="Dashboard Principal"
                            className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                !activeSquad
                                    ? "text-white/70 bg-white/10"
                                    : "text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100"
                            )}
                        >
                            <Home className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Nav */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-hidden">
                        <nav className="space-y-1 pb-4">
                            <button
                                onClick={() => setHubOpen(true)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 text-white/50 hover:text-white hover:bg-white/[0.04]"
                            >
                                <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                                <span>Integrações</span>
                            </button>
                        </nav>

                        <div className="mx-2 my-2 border-t border-white/[0.04]" />

                        {/* Squads */}
                        <p className="text-[11px] font-bold text-white/25 px-3 mb-2 uppercase tracking-widest">
                            Squads de IA
                        </p>
                        <div className="space-y-px pb-4">
                            {squads.map((squad) => {
                                const isActive = activeSquad === squad.id;
                                const Icon = squad.icon;

                                return (
                                    <button
                                        key={squad.id}
                                        onClick={() => {
                                            if (squad.id === "sherlock") {
                                                router.push("/sherlock");
                                            } else if (squad.id === "uma") {
                                                router.push("/uma");
                                            } else {
                                                if (onSelectSquad) {
                                                    onSelectSquad(squad.id);
                                                } else {
                                                    localStorage.setItem('aria_active_squad', squad.id);
                                                    router.push("/");
                                                }
                                            }
                                        }}
                                        title={squad.description}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group/squad",
                                            isActive
                                                ? "bg-white/[0.08] text-white"
                                                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                                        )}
                                    >
                                        {/* Status dot */}
                                        <div className="relative flex-shrink-0">
                                            <Icon
                                                className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : "text-white/40 group-hover/squad:text-white/70")}
                                            />
                                            <span
                                                className={cn(
                                                    "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#09090A] transition-all duration-300",
                                                    STATUS_DOT[squad.status]
                                                )}
                                            />
                                        </div>

                                        <div className="flex-1 text-left overflow-hidden">
                                            <p className="truncate leading-none">{squad.name}</p>
                                            <p className={cn(
                                                "text-[10px] truncate mt-0.5 transition-colors",
                                                isActive ? "text-white/40" : "text-white/25 group-hover/squad:text-white/35"
                                            )}>
                                                {squad.description}
                                            </p>
                                        </div>

                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <div
                                                className="w-1 h-5 rounded-full flex-shrink-0"
                                                style={{ background: `linear-gradient(to bottom, ${squad.color}, ${squad.color}80)` }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
                            </div>
                            <div className="overflow-hidden flex-1">
                                <p className="text-sm font-medium text-white truncate">Erick</p>
                                <p className="text-xs text-white/40 truncate">Online</p>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        </div>
                    </div>
                </div>
            </aside>

            <IntegrationHub open={isHubOpen} onOpenChange={setHubOpen} />
        </>
    );
};

export default AriaSidebar;
