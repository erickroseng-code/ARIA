import {
    Calendar,
    CalendarPlus,
    CalendarX,
    Mail,
    MailOpen,
    Send,
    CheckSquare,
    PlusCircle,
    Users,
    Search,
    FilePlus,
    Zap,
    BarChart,
    FileSpreadsheet,
    Eraser,
    FileText
} from "lucide-react";
import { LucideIcon } from "lucide-react";

export type IntegrationCategory = 'Calendar' | 'Gmail' | 'ClickUp' | 'Notion' | 'ARIA' | 'Google Sheets';

export interface SlashCommand {
    id: string;
    category: IntegrationCategory;
    title: string;
    syntax: string;
    icon: LucideIcon | string;
}

export const slashCommands: SlashCommand[] = [
    // Google Calendar
    {
        id: 'calendar-today',
        category: 'Calendar',
        title: 'Minha agenda hoje',
        syntax: 'Quais reuniões tenho hoje?',
        icon: '/calendar.svg',
    },
    {
        id: 'calendar-create',
        category: 'Calendar',
        title: 'Agendar reunião',
        syntax: 'Agenda reunião com [nome] amanhã às [hora]',
        icon: '/calendar.svg',
    },
    {
        id: 'calendar-cancel',
        category: 'Calendar',
        title: 'Cancelar reunião',
        syntax: 'Cancela reunião com [nome]',
        icon: '/calendar.svg',
    },

    // Gmail
    {
        id: 'gmail-recent',
        category: 'Gmail',
        title: 'E-mails recentes',
        syntax: 'Quais meus e-mails recentes?',
        icon: '/mail.png',
    },
    {
        id: 'gmail-unread',
        category: 'Gmail',
        title: 'E-mails não lidos',
        syntax: 'Quais e-mails não lidos eu tenho?',
        icon: '/mail.png',
    },
    {
        id: 'gmail-send',
        category: 'Gmail',
        title: 'Enviar e-mail',
        syntax: 'Envie um e-mail para [destinatário] com assunto [assunto]',
        icon: '/mail.png',
    },

    // ClickUp
    {
        id: 'clickup-mytasks',
        category: 'ClickUp',
        title: 'Minhas tarefas',
        syntax: 'Quais são minhas tarefas de hoje?',
        icon: '/clickup.svg',
    },
    {
        id: 'clickup-create',
        category: 'ClickUp',
        title: 'Criar tarefa',
        syntax: 'Criar tarefa [título] no ClickUp',
        icon: '/clickup.svg',
    },
    {
        id: 'clickup-pipeline',
        category: 'ClickUp',
        title: 'Pipeline de clientes',
        syntax: 'Qual o pipeline de clientes?',
        icon: '/clickup.svg',
    },

    // Notion
    {
        id: 'notion-search',
        category: 'Notion',
        title: 'Buscar cliente',
        syntax: 'Cliente: [nome]',
        icon: '/notion.png',
    },
    {
        id: 'notion-create',
        category: 'Notion',
        title: 'Nova tarefa',
        syntax: 'Criar tarefa [título] no Notion',
        icon: '/notion.png',
    },

    // ARIA
    {
        id: 'aria-plan',
        category: 'ARIA',
        title: 'Gerar plano de ataque',
        syntax: 'Gerar plano de ataque',
        icon: '/aria-logo.png',
    },
    {
        id: 'aria-status',
        category: 'ARIA',
        title: 'Status do projeto',
        syntax: 'Qual o status do projeto?',
        icon: '/aria-logo.png',
    },
    {
        id: "sheet-add",
        category: "Google Sheets",
        title: "Adicionar linha",
        syntax: 'Adicione uma linha na planilha "[nome_da_planilha]" com os valores: ',
        icon: '/sheets.svg',
    },
    {
        id: "sheet-new",
        category: "Google Sheets",
        title: "Criar nova aba",
        syntax: 'Crie uma aba chamada "[aba]" na planilha "[planilha]"',
        icon: '/sheets.svg',
    },
    {
        id: "sheet-clear",
        category: "Google Sheets",
        title: "Limpar intervalo",
        syntax: 'Limpe os dados do intervalo [ex: A1:D10] na planilha "[nome_da_planilha]"',
        icon: '/sheets.svg',
    },
    {
        id: "sheet-read",
        category: "Google Sheets",
        title: "Ler planilha",
        syntax: 'Leia os dados da planilha "[nome_da_planilha]"',
        icon: '/sheets.svg',
    }
];
