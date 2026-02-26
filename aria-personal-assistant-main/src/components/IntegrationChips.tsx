import { cn } from "@/lib/utils";
import clickupLogo from "@/assets/integrations/clickup.png";
import notionLogo from "@/assets/integrations/notion.png";
import telegramLogo from "@/assets/integrations/telegram.png";
import calendarLogo from "@/assets/integrations/calendar.png";
import driveLogo from "@/assets/integrations/drive.png";
import mailLogo from "@/assets/integrations/mail.png";
import sheetsLogo from "@/assets/integrations/sheets.png";
import docsLogo from "@/assets/integrations/docs.png";

const integrations = [
  { name: "ClickUp", logo: clickupLogo, command: "Buscar minhas tarefas no ClickUp" },
  { name: "Notion", logo: notionLogo, command: "Buscar nas minhas páginas do Notion" },
  { name: "Telegram", logo: telegramLogo, command: "Verificar mensagens no Telegram" },
  { name: "Calendar", logo: calendarLogo, command: "Mostrar meus próximos eventos do Calendar" },
  { name: "Drive", logo: driveLogo, command: "Buscar arquivos no Google Drive" },
  { name: "Mail", logo: mailLogo, command: "Verificar meus e-mails recentes" },
  { name: "Sheets", logo: sheetsLogo, command: "Abrir minhas planilhas do Sheets" },
  { name: "Docs", logo: docsLogo, command: "Buscar nos meus documentos do Docs" },
];

interface IntegrationChipsProps {
  onSelect: (command: string) => void;
}

const IntegrationChips = ({ onSelect }: IntegrationChipsProps) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-4 max-w-2xl mx-auto">
      {integrations.map((integration) => (
        <button
          key={integration.name}
          onClick={() => onSelect(integration.command)}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-full",
            "glass hover:bg-[hsl(var(--glass-strong))] transition-all duration-200",
            "text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          )}
        >
          <img src={integration.logo} alt={integration.name} className="w-4 h-4 object-contain" />
          <span>{integration.name}</span>
        </button>
      ))}
    </div>
  );
};

export default IntegrationChips;
