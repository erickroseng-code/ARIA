import { useState } from "react";
import { Home, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import ariaLogo from "@/assets/aria-logo.png";
import erickAvatar from "@/assets/erick-avatar.png";
import clickupLogo from "@/assets/integrations/clickup.png";
import notionLogo from "@/assets/integrations/notion.png";
import telegramLogo from "@/assets/integrations/telegram.png";
import calendarLogo from "@/assets/integrations/calendar.png";
import driveLogo from "@/assets/integrations/drive.png";
import mailLogo from "@/assets/integrations/mail.png";
import sheetsLogo from "@/assets/integrations/sheets.png";
import docsLogo from "@/assets/integrations/docs.png";
import gammaLogo from "@/assets/integrations/gamma.png";
import figmaLogo from "@/assets/integrations/figma.png";
import maverickLogo from "@/assets/squads/maverick.png";

interface AriaSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectIntegration?: (command: string) => void;
}

const integrations = [
  { name: "ClickUp", logo: clickupLogo, command: "Buscar minhas tarefas no ClickUp" },
  { name: "Notion", logo: notionLogo, command: "Buscar nas minhas páginas do Notion" },
  { name: "Telegram", logo: telegramLogo, command: "Verificar mensagens no Telegram" },
  { name: "Calendar", logo: calendarLogo, command: "Mostrar meus próximos eventos do Calendar" },
  { name: "Drive", logo: driveLogo, command: "Buscar arquivos no Google Drive" },
  { name: "Mail", logo: mailLogo, command: "Verificar meus e-mails recentes" },
  { name: "Sheets", logo: sheetsLogo, command: "Abrir minhas planilhas do Sheets" },
  { name: "Docs", logo: docsLogo, command: "Buscar nos meus documentos do Docs" },
  { name: "Gamma", logo: gammaLogo, command: "Criar apresentação no Gamma" },
  { name: "Figma", logo: figmaLogo, command: "Buscar meus projetos no Figma" },
];

const suggestedIntegrations = [
  { name: "Slack", description: "Comunicação em equipe" },
  { name: "GitHub", description: "Repositórios e código" },
  { name: "Trello", description: "Gerenciamento de projetos" },
  { name: "Spotify", description: "Música e produtividade" },
  { name: "WhatsApp", description: "Mensagens instantâneas" },
];

const squads = [
  { name: "Maverick", logo: maverickLogo, command: "Fazer uma análise de perfil com o Squad Maverick", description: "Estratégia & Visão" },
];

const AriaSidebar = ({ isOpen, onToggle, onSelectIntegration }: AriaSidebarProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

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
          </nav>

          {/* Integrations */}
          <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hidden">
            {isOpen && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">Integrações</p>
            )}
            <div className="space-y-0.5">
              {integrations.map((integration) => (
                <button
                  key={integration.name}
                  onClick={() => onSelectIntegration?.(integration.command)}
                  title={integration.name}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground hover:translate-x-1 hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] active:scale-[0.97] transition-all duration-200"
                >
                  <img src={integration.logo} alt={integration.name} className="w-5 h-5 object-contain flex-shrink-0" />
                  {isOpen && <span>{integration.name}</span>}
                </button>
              ))}
            </div>

            {/* Add integration button */}
            <div className="relative mt-1">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                title="Adicionar integração"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-all duration-200"
              >
                <Plus className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span>Adicionar</span>}
              </button>

              {/* Suggestions dropdown */}
              {showSuggestions && isOpen && (
                <div className="mx-2 mt-1 p-2 rounded-xl bg-secondary/80 backdrop-blur-md border border-border/50 animate-fade-in">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1.5">Sugeridas</p>
                  {suggestedIntegrations.map((s) => (
                    <button
                      key={s.name}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                    >
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-50">{s.description}</span>
                    </button>
                  ))}
                </div>
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
    </>
  );
};

export default AriaSidebar;
