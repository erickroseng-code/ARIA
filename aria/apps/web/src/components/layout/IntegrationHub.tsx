'use client';

import { useState, useEffect, useRef } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
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
    /** URL to GET the OAuth URL from backend (returns JSON { url }) */
    authUrl?: string;
    /** POST endpoint to save an API key */
    saveUrl?: string;
    /** If true, shows API key input form instead of OAuth popup */
    apiKeyAuth?: boolean;
    /** If true, opens authUrl in new tab (legacy external auth) */
    externalAuth?: boolean;
    /** If true, shows "Em breve" */
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
        statusUrl: `${API_BASE}/api/auth/notion/status`,
        saveUrl: `${API_BASE}/api/auth/notion/save`,
        apiKeyAuth: true,
    },
    {
        id: "telegram",
        name: "Telegram",
        description: "Mensagens e Notificações",
        logo: telegramLogo,
        statusUrl: `${API_BASE}/api/auth/telegram/status`,
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
    const [showApiKeyForm, setShowApiKeyForm] = useState<string | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Mutable session cache — NOT used for rendering, only for popup dedup
    const authCache = useRef<Set<string>>((() => {
        if (typeof window === 'undefined') return new Set<string>();
        const cached = sessionStorage.getItem('aria_auth_cache');
        return new Set<string>(cached ? JSON.parse(cached) : []);
    })());

    const fetchStatuses = async () => {
        // Mark all with statusUrl as loading
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
                        const connected = !!data.connected;
                        setStatuses(prev => ({ ...prev, [i.id]: connected }));
                        // If backend says NOT connected, clear the session cache for this provider
                        // so clicking "Conectar" actually opens the popup (prevents stale cache bug)
                        if (!connected) {
                            authCache.current.delete(i.id);
                            sessionStorage.setItem('aria_auth_cache', JSON.stringify(Array.from(authCache.current)));
                        }
                    } catch {
                        setStatuses(prev => ({ ...prev, [i.id]: false }));
                        authCache.current.delete(i.id);
                    }
                })
        );
    };

    useEffect(() => {
        if (open) fetchStatuses();
    }, [open]);

    const saveApiKey = async (integration: IntegrationDef) => {
        if (!apiKeyInput.trim() || !integration.saveUrl) return;
        setSavingApiKey(integration.id);
        setSaveError(null);
        try {
            const res = await fetch(integration.saveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
            // Success — close form and refresh statuses
            setShowApiKeyForm(null);
            setApiKeyInput('');
            await fetchStatuses();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Erro ao salvar chave');
        } finally {
            setSavingApiKey(null);
        }
    };

    const handleConnect = async (integration: IntegrationDef) => {
        // API key auth: show inline form
        if (integration.apiKeyAuth) {
            setShowApiKeyForm(integration.id);
            setApiKeyInput('');
            setSaveError(null);
            return;
        }

        // External auth: open in new tab
        if (integration.externalAuth && integration.authUrl) {
            window.open(integration.authUrl, '_blank');
            return;
        }

        if (!integration.authUrl) return;

        setConnecting(integration.id);

        const width = 500;
        const height = 650;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        // Open popup IMMEDIATELY (synchronous — required by browser popup policy)
        const popup = window.open(
            'about:blank',
            'OAuth',
            `width=${width},height=${height},top=${top},left=${left},status=no,directories=no,location=no,menubar=no,toolbar=no`
        );

        try {
            // Fetch the OAuth URL from backend as JSON
            const res = await fetch(integration.authUrl, {
                headers: { 'Accept': 'application/json' },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({})) as any;
                throw new Error(errData?.error || errData?.hint || `Erro ${res.status}: credenciais OAuth não configuradas no servidor`);
            }

            const data = await res.json() as { url?: string };
            if (!data.url) throw new Error('Backend não retornou URL de autorização');

            if (popup && !popup.closed) {
                // Navigate the popup directly to the provider's OAuth page
                popup.location.href = data.url;

                // Poll for popup close
                const check = setInterval(() => {
                    if (!popup || popup.closed) {
                        clearInterval(check);
                        setConnecting(null);
                        authCache.current.add(integration.id);
                        sessionStorage.setItem('aria_auth_cache', JSON.stringify(Array.from(authCache.current)));
                        // Refresh status after short delay to let backend persist
                        setTimeout(() => fetchStatuses(), 800);
                    }
                }, 800);
            } else {
                // Popup was blocked — open in new tab directly to provider URL
                setConnecting(null);
                window.open(data.url, '_blank');
                authCache.current.add(integration.id);
                sessionStorage.setItem('aria_auth_cache', JSON.stringify(Array.from(authCache.current)));
            }
        } catch (err) {
            if (popup && !popup.closed) popup.close();
            setConnecting(null);
            console.error(`[OAuth ${integration.id}]`, err);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[hsl(0_0%_10%)] border-border/50 text-foreground p-0 gap-0 rounded-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-lg font-semibold">Hub de Integrações</DialogTitle>
                </DialogHeader>

                <p className="px-6 text-sm text-muted-foreground leading-relaxed">
                    Conecte a ARIA aos seus aplicativos. Suas credenciais ficam salvas no dispositivo.
                </p>

                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hidden">
                    {INTEGRATIONS.map((integration) => {
                        const status = statuses[integration.id];
                        const isConnected = status === true;
                        const isLoading = status === null;
                        const isConnecting = connecting === integration.id;
                        const isShowingForm = showApiKeyForm === integration.id;

                        return (
                            <div
                                key={integration.id}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-xl transition-colors",
                                    "bg-[hsl(0_0%_13%)] border border-border/30",
                                    "hover:border-border/50"
                                )}
                            >
                                {/* Logo — always visible */}
                                <div className="w-10 h-10 rounded-xl bg-[hsl(0_0%_16%)] flex items-center justify-center flex-shrink-0 overflow-hidden p-2">
                                    <img src={integration.logo} alt={integration.name} className="w-6 h-6 object-contain" />
                                </div>

                                {/* API key input form (replaces name/desc + button when active) */}
                                {isShowingForm ? (
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={apiKeyInput}
                                                onChange={e => setApiKeyInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveApiKey(integration)}
                                                placeholder={`Chave API do ${integration.name}...`}
                                                className="flex-1 text-xs bg-[hsl(0_0%_9%)] border border-border/40 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500/60"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => saveApiKey(integration)}
                                                disabled={!apiKeyInput.trim() || savingApiKey === integration.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors disabled:opacity-50 disabled:cursor-wait flex-shrink-0"
                                            >
                                                {savingApiKey === integration.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : 'Salvar'}
                                            </button>
                                            <button
                                                onClick={() => { setShowApiKeyForm(null); setApiKeyInput(''); setSaveError(null); }}
                                                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        {saveError && (
                                            <p className="text-xs text-red-400 px-1">{saveError}</p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground">{integration.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{integration.description}</p>
                                        </div>

                                        {/* Loading */}
                                        {isLoading && (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground flex-shrink-0">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            </span>
                                        )}

                                        {/* Connected */}
                                        {!isLoading && isConnected && (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                                <Check className="w-3 h-3" />
                                                Conectado
                                            </span>
                                        )}

                                        {/* Coming soon */}
                                        {!isLoading && !isConnected && integration.comingSoon && (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/30 text-muted-foreground/60 border border-border/20 flex-shrink-0">
                                                Em breve
                                            </span>
                                        )}

                                        {/* API key auth (Notion, etc.) */}
                                        {!isLoading && !isConnected && !integration.comingSoon && integration.apiKeyAuth && (
                                            <button
                                                onClick={() => handleConnect(integration)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors flex-shrink-0"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Configurar
                                            </button>
                                        )}

                                        {/* OAuth popup (Google, ClickUp) */}
                                        {!isLoading && !isConnected && !integration.comingSoon && !integration.apiKeyAuth && !integration.externalAuth && integration.authUrl && (
                                            <button
                                                onClick={() => handleConnect(integration)}
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

                                        {/* External auth (opens new tab) */}
                                        {!isLoading && !isConnected && !integration.comingSoon && integration.externalAuth && (
                                            <button
                                                onClick={() => handleConnect(integration)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors flex-shrink-0"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Configurar
                                            </button>
                                        )}

                                        {/* No connection method available */}
                                        {!isLoading && !isConnected && !integration.comingSoon && !integration.authUrl && !integration.apiKeyAuth && !integration.externalAuth && (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/30 text-muted-foreground/60 border border-border/20 flex-shrink-0">
                                                Não configurado
                                            </span>
                                        )}
                                    </>
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
