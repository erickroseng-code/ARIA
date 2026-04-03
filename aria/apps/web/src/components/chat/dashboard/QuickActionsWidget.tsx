'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

// Logos as public paths
const telegramLogo = '/integrations/telegram.png';
const notionLogo = '/integrations/notion.png';
const figmaLogo = '/integrations/figma.png';

interface QuickAction {
    id: string;
    label: string;
    description: string;
    logo: string;
    color: string;
    href?: string;
    ariaCommand?: string;
    toastMessage: string;
}

const ACTIONS: QuickAction[] = [
    {
        id: 'telegram',
        label: 'Nova Mensagem',
        description: 'Telegram',
        logo: telegramLogo,
        color: '#2AABEE',
        href: 'https://t.me',
        toastMessage: 'Abrindo Telegram…',
    },
    {
        id: 'notion',
        label: 'Novo Documento',
        description: 'Notion',
        logo: notionLogo,
        color: '#ffffff',
        href: 'https://notion.new',
        toastMessage: 'Abrindo Notion para criar documento…',
    },
    {
        id: 'figma',
        label: 'Novo Design',
        description: 'Figma',
        logo: figmaLogo,
        color: '#F24E1E',
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
                'group relative flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] transition-all duration-200',
                'bg-[#0d0d0f] hover:bg-white/[0.02] hover:border-white/[0.10] active:scale-[0.98]',
                'focus:outline-none focus:ring-1 focus:ring-white/10',
            )}
        >
            {/* Icon Container */}
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/[0.06] overflow-hidden p-2 relative z-10"
                style={{
                    backgroundColor: `${action.color}10`,
                    boxShadow: `0 4px 12px ${action.color}10`
                }}
            >
                <img
                    src={action.logo}
                    alt={action.description}
                    className="w-full h-full object-contain filter drop-shadow-sm"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
            </div>

            {/* Labels */}
            <div className="text-left relative z-10 flex-1 overflow-hidden">
                <p className="text-[13px] font-medium text-white/90 leading-tight truncate">{action.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5 font-medium uppercase tracking-wider truncate">{action.description}</p>
            </div>

            {/* Bottom glow bar on hover */}
            <div
                className="absolute bottom-0 left-3 right-3 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, ${action.color}50, transparent)` }}
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
        <div className="bg-[#0B0B0C] border border-white/[0.05] rounded-2xl p-5 mb-6">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5 ps-1">
                <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="text-[11px] font-bold text-white/25 uppercase tracking-[0.15em]">Ações Rápidas</h3>
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {ACTIONS.map(action => (
                    <ActionButton key={action.id} action={action} onAction={handleAction} />
                ))}
            </div>
        </div>
    );
}
