'use client';

import { useState, useEffect } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const driveLogo = "/integrations/drive.png";
const clickupLogo = "/integrations/clickup.png";
const notionLogo = "/integrations/notion.png";
const telegramLogo = "/integrations/telegram.png";
const gammaLogo = "/integrations/gamma.png";
const figmaLogo = "/integrations/figma.png";

interface IntegrationDef {
    id: string;
    name: string;
    description: string;
    logo: string;
    statusUrl?: string;
    authUrl?: string;
    // se true, mostra "Em breve" em vez de "Conectar"
    comingSoon?: boolean;
}

const INTEGRATIONS: IntegrationDef[] = [
    {
        id: "google",
        name: "Google Workspace",
        description: "Docs, Drive, Mail, Sheets e Calendar",
        logo: driveLogo,
        statusUrl: `${API_BASE}/api/auth/google/status`,
        authUrl: `${API_BASE}/api/auth/google/url`,
    },
    {
        id: "clickup",
        name: "ClickUp",
        description: "Tarefas e Gerenciamento de Projetos",
        logo: clickupLogo,
        statusUrl: `${API_BASE}/api/auth/clickup/status`,
        authUrl: `${API_BASE}/api/auth/clickup/url`,
    },
    {
        id: "notion",
        name: "Notion",
        description: "Documentação e Knowledge Base",
        logo: notionLogo,
        comingSoon: true,
    },
    {
        id: "telegram",
        name: "Telegram",
        description: "Mensagens e Notificações",
        logo: telegramLogo,
        comingSoon: true,
    },
    {
        id: "gamma",
        name: "Gamma",
        description: "Apresentações com IA",
        logo: gammaLogo,
        comingSoon: true,
    },
    {
        id: "figma",
        name: "Figma",
        description: "Design e Prototipagem",
        logo: figmaLogo,
        comingSoon: true,
    },
];

type StatusMap = Record<string, boolean | null>; // null = loading

interface IntegrationHubProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const IntegrationHub = ({ open, onOpenChange }: IntegrationHubProps) => {
    const [statuses, setStatuses] = useState<StatusMap>({});
    const [connecting, setConnecting] = useState<string | null>(null);

    const fetchStatuses = async () => {
        // Marca todos com statusUrl como "carregando"
        const loading: StatusMap = {};
        INTEGRATIONS.forEach(i => {
            if (i.statusUrl) loading[i.id] = null;
        });
        setStatuses(loading);

        await Promise.all(
            INTEGRATIONS
                .filter(i => i.statusUrl)
                .map(async i => {
                    try {
                        const res = await fetch(i.statusUrl!);
                        const data = await res.json();
                        setStatuses(prev => ({ ...prev, [i.id]: !!data.connected }));
                    } catch {
                        setStatuses(prev => ({ ...prev, [i.id]: false }));
                    }
                })
        );
    };

    useEffect(() => {
        if (open) fetchStatuses();
    }, [open]);

    const openOAuthPopup = (integration: IntegrationDef) => {
        if (!integration.authUrl) return;
        setConnecting(integration.id);

        const width = 500;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        // Abre o popup direto na URL do backend — o backend redireciona para o provider
        const popup = window.open(
            integration.authUrl,
            'OAuth',
            `width=${width},height=${height},top=${top},left=${left},status=no,directories=no,location=no,menubar=no,toolbar=no`
        );

        if (popup) {
            const check = setInterval(() => {
                if (popup.closed) {
                    clearInterval(check);
                    setConnecting(null);
                    // Aguarda 500ms para o banco persistir e então atualiza status
                    setTimeout(() => fetchStatuses(), 500);
                }
            }, 800);
        } else {
            // Popup bloqueado — abre em nova aba
            setConnecting(null);
            window.open(integration.authUrl, '_blank');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[hsl(0_0%_10%)] border-border/50 text-foreground p-0 gap-0 rounded-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-lg font-semibold">Hub de Integrações</DialogTitle>
                </DialogHeader>

                <p className="px-6 text-sm text-muted-foreground leading-relaxed">
                    Conecte a ARIA aos seus aplicativos. Clique em Conectar para autorizar via OAuth — seus dados ficam no seu dispositivo.
                </p>

                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hidden">
                    {INTEGRATIONS.map((integration) => {
                        const status = statuses[integration.id];
                        const isConnected = status === true;
                        const isLoading = status === null;
                        const isConnecting = connecting === integration.id;

                        return (
                            <div
                                key={integration.id}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-xl transition-colors",
                                    "bg-[hsl(0_0%_13%)] border border-border/30",
                                    "hover:border-border/50"
                                )}
                            >
                                <div className="w-10 h-10 rounded-xl bg-[hsl(0_0%_16%)] flex items-center justify-center flex-shrink-0 overflow-hidden p-2">
                                    <img src={integration.logo} alt={integration.name} className="w-6 h-6 object-contain" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{integration.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
                                </div>

                                {/* Estado: carregando */}
                                {isLoading && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground flex-shrink-0">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    </span>
                                )}

                                {/* Estado: conectado */}
                                {!isLoading && isConnected && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                        <Check className="w-3 h-3" />
                                        Conectado
                                    </span>
                                )}

                                {/* Estado: em breve */}
                                {!isLoading && !isConnected && integration.comingSoon && (
                                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/30 text-muted-foreground/60 border border-border/20 flex-shrink-0">
                                        Em breve
                                    </span>
                                )}

                                {/* Estado: pode conectar */}
                                {!isLoading && !isConnected && !integration.comingSoon && (
                                    <button
                                        onClick={() => openOAuthPopup(integration)}
                                        disabled={isConnecting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isConnecting
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <ExternalLink className="w-3 h-3" />
                                        }
                                        {isConnecting ? 'Conectando...' : 'Conectar'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default IntegrationHub;
