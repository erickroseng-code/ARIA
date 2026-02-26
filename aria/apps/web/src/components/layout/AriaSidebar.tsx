import { useState } from "react";
import { Home, PanelLeftClose, PanelLeft, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import IntegrationHub from "@/components/layout/IntegrationHub";

const ariaLogo = "/aria-logo.png";
const erickAvatar = "/erick-avatar.png";
const maverickLogo = "/squads/maverick.png";

interface AriaSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onSelectIntegration?: (command: string) => void;
}

const squads = [
    { name: "Maverick", logo: maverickLogo, command: "Fazer uma análise de perfil com o Squad Maverick", description: "Estratégia & Visão" },
];

const AriaSidebar = ({ isOpen, onToggle, onSelectIntegration }: AriaSidebarProps) => {
    const [hubOpen, setHubOpen] = useState(false);

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onToggle}
                />
            )}

            <aside
                className={cn(
                    "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                    "bg-[hsl(var(--sidebar-background))] border-r border-border/50",
                    isOpen ? "w-64" : "w-0 lg:w-16"
                )}
            >
                <div className={cn("flex flex-col h-full overflow-hidden", isOpen ? "opacity-100" : "lg:opacity-100 opacity-0")}>
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 h-16">
                        <img src={ariaLogo} alt="ARIA" className="w-8 h-8 rounded-lg flex-shrink-0" />
                        {isOpen && (
                            <span className="text-lg font-semibold tracking-tight text-foreground">ARIA</span>
                        )}
                        <button
                            onClick={onToggle}
                            className="ml-auto p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Nav */}
                    <nav className="px-2 py-2 space-y-1">
                        <button
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 bg-primary/15 text-primary font-medium"
                        >
                            <Home className="w-5 h-5 flex-shrink-0" />
                            {isOpen && <span>Chat</span>}
                        </button>

                        <button
                            onClick={() => setHubOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-all duration-200"
                        >
                            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
                            {isOpen && <span>Integrações</span>}
                        </button>
                    </nav>

                    {/* Conversation history placeholder */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hidden">
                        {isOpen && (
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">Histórico</p>
                        )}
                        <div className="space-y-0.5">
                            {/* Future: conversation history items will go here */}
                            {isOpen && (
                                <p className="px-3 py-4 text-xs text-muted-foreground/50 text-center">
                                    Suas conversas aparecerão aqui
                                </p>
                            )}
                        </div>

                        {/* Separator */}
                        <div className="mx-3 my-3 h-px bg-border/30" />

                        {/* AI Squads section */}
                        {isOpen && (
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">Squads de IA</p>
                        )}
                        <div className="space-y-0.5">
                            {squads.map((squad) => (
                                <button
                                    key={squad.name}
                                    onClick={() => onSelectIntegration?.(squad.command)}
                                    title={squad.name}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground hover:translate-x-1 hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] active:scale-[0.97] transition-all duration-200"
                                >
                                    <img src={squad.logo} alt={squad.name} className="w-5 h-5 object-contain flex-shrink-0 rounded" />
                                    {isOpen && (
                                        <div className="flex flex-col items-start">
                                            <span>{squad.name}</span>
                                            <span className="text-[10px] text-muted-foreground/60">{squad.description}</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-border/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-foreground/10">
                                <img src={erickAvatar} alt="Erick" className="w-full h-full object-cover" />
                            </div>
                            {isOpen && (
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-foreground truncate">Erick</p>
                                    <p className="text-xs text-muted-foreground truncate">Online</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            <IntegrationHub open={hubOpen} onOpenChange={setHubOpen} />
        </>
    );
};

export default AriaSidebar;
