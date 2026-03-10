'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

// Logos as public paths
const clickupLogo = '/integrations/clickup.png';
const telegramLogo = '/integrations/telegram.png';
const notionLogo = '/integrations/notion.png';
const figmaLogo = '/integrations/figma.png';

interface QuickAction {
    id: string;
    label: string;
    description: string;
    logo: string;
    color: string;
    gradient: string;
    href?: string;
    ariaCommand?: string;
    toastMessage: string;
}

const ACTIONS: QuickAction[] = [
    {
        id: 'clickup',
        label: 'Nova Tarefa',
        description: 'ClickUp',
        logo: clickupLogo,
        color: '#7B68EE',
        gradient: 'from-[#7B68EE]/20 to-[#7B68EE]/5',
        href: 'https://app.clickup.com/new/task',
        toastMessage: 'Abrindo ClickUp para criar tarefa…',
    },
    {
        id: 'telegram',
        label: 'Nova Mensagem',
        description: 'Telegram',
        logo: telegramLogo,
        color: '#2AABEE',
        gradient: 'from-[#2AABEE]/20 to-[#2AABEE]/5',
        href: 'https://t.me',
        toastMessage: 'Abrindo Telegram…',
    },
    {
        id: 'notion',
        label: 'Novo Documento',
        description: 'Notion',
        logo: notionLogo,
        color: '#ffffff',
        gradient: 'from-white/10 to-white/5',
        href: 'https://notion.new',
        toastMessage: 'Abrindo Notion para criar documento…',
    },
    {
        id: 'figma',
        label: 'Novo Design',
        description: 'Figma',
        logo: figmaLogo,
        color: '#F24E1E',
        gradient: 'from-[#F24E1E]/20 to-[#F24E1E]/5',
        href: 'https://www.figma.com/design',
        toastMessage: 'Abrindo Figma para criar design…',
    },
];

interface ActionButtonProps {
    action: QuickAction;
    onAction: (action: QuickAction) => void;
}

function ActionButton({ action, onAction }: ActionButtonProps) {
    return (
        <button
            onClick={() => onAction(action)}
            className={cn(
                'group relative flex flex-col items-center gap-3 p-4 rounded-2xl border border-white/[0.05] transition-all duration-200',
                'bg-gradient-to-b', action.gradient,
                'hover:scale-[1.03] hover:shadow-xl hover:border-white/[0.10] active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-white/20',
            )}
            style={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--shadow-color' as any]: action.color,
            }}
        >
            {/* Glow on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                    boxShadow: `0 0 24px -4px ${action.color}40`,
                }}
            />

            {/* Logo */}
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.06] bg-black/20 overflow-hidden p-1.5 relative z-10"
                style={{ boxShadow: `0 4px 12px ${action.color}20` }}
            >
                <img
                    src={action.logo}
                    alt={action.description}
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
            </div>

            {/* Labels */}
            <div className="text-center relative z-10">
                <p className="text-xs font-semibold text-white/85 leading-tight">{action.label}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{action.description}</p>
            </div>

            {/* "New" ripple indicator */}
            <div
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ backgroundColor: action.color }}
            />
        </button>
    );
}

export function QuickActionsWidget() {
    const { showToast } = useToast();

    const handleAction = (action: QuickAction) => {
        showToast(action.toastMessage, 'success');
        if (action.href) {
            window.open(action.href, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="bg-[#0B0B0C] border border-white/[0.05] rounded-2xl p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">Ações Rápidas</h3>
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-4 gap-2">
                {ACTIONS.map(action => (
                    <ActionButton key={action.id} action={action} onAction={handleAction} />
                ))}
            </div>
        </div>
    );
}
