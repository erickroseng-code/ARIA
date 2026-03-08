'use client';

import { useState } from 'react';
import { Activity, ChevronRight, Target, BarChart2, FileText, CheckSquare, Tag, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';

type ActivityType = 'task_created' | 'task_completed' | 'doc_updated' | 'status_changed' | 'sprint_started';

interface ActivityEntry {
    id: string;
    squadId: 'maverick' | 'graham';
    type: ActivityType;
    title: string;
    description: string;
    timestamp: Date;
    actor?: string;
}

const SQUAD_CONFIG = {
    maverick: {
        label: 'Maverick',
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/20',
        dot: 'bg-purple-400',
        icon: Target,
    },
    graham: {
        label: 'Graham',
        color: 'text-teal-400',
        bg: 'bg-teal-400/10',
        border: 'border-teal-400/20',
        dot: 'bg-teal-400',
        icon: BarChart2,
    },
};

const TYPE_ICONS: Record<ActivityType, React.ElementType> = {
    task_created: CheckSquare,
    task_completed: CheckSquare,
    doc_updated: FileText,
    status_changed: Tag,
    sprint_started: GitBranch,
};

const TYPE_LABELS: Record<ActivityType, string> = {
    task_created: 'Tarefa criada',
    task_completed: 'Tarefa concluída',
    doc_updated: 'Documento atualizado',
    status_changed: 'Status alterado',
    sprint_started: 'Sprint iniciado',
};

function relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins}min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'ontem';
    return `há ${diffDays} dias`;
}

// Mock activity data — ready to be replaced by real API calls
const MOCK_ACTIVITIES: ActivityEntry[] = [
    {
        id: '1',
        squadId: 'maverick',
        type: 'task_completed',
        title: 'Persona Alex finalizada',
        description: 'UX Research: perfil completo do usuário Beta documentado',
        timestamp: new Date(Date.now() - 45 * 60000),
        actor: 'Maverick',
    },
    {
        id: '2',
        squadId: 'maverick',
        type: 'sprint_started',
        title: 'Sprint 3 iniciado',
        description: 'Foco em wireframes de alta fidelidade e fluxos de conversão',
        timestamp: new Date(Date.now() - 2 * 3600000),
        actor: 'Maverick',
    },
    {
        id: '3',
        squadId: 'graham',
        type: 'doc_updated',
        title: 'DRE de Fevereiro atualizado',
        description: 'Margem operacional revisada: +2.3% vs meta projetada',
        timestamp: new Date(Date.now() - 4 * 3600000),
        actor: 'Graham',
    },
    {
        id: '4',
        squadId: 'maverick',
        type: 'task_created',
        title: 'Script de onboarding criado',
        description: 'Roteiro para vídeo de introdução ao produto alinhado ao pitch',
        timestamp: new Date(Date.now() - 24 * 3600000),
        actor: 'Maverick',
    },
    {
        id: '5',
        squadId: 'graham',
        type: 'status_changed',
        title: 'Meta Q1 revisada',
        description: 'Objetivo de receita ajustado de R$ 45k para R$ 52k',
        timestamp: new Date(Date.now() - 26 * 3600000),
        actor: 'Graham',
    },
];

export function ActivityFeedWidget() {
    const [collapsed, setCollapsed] = useState(false);
    const [filter, setFilter] = useState<'all' | 'maverick' | 'graham'>('all');

    // Extract real user requests from all conversations to build the timeline
    const dynamicActivities: ActivityEntry[] = [];
    const conversations = useChatStore(state => state.conversations);

    // Simple heuristic to assign chat messages to a squad based on context
    const getSquadFromMessage = (content: string): 'maverick' | 'graham' => {
        const c = content.toLowerCase();
        if (c.includes('financeiro') || c.includes('finanças') || c.includes('graham') || c.includes('custos') || c.includes('dre') || c.includes('receita') || c.includes('meta')) {
            return 'graham';
        }
        return 'maverick';
    };

    conversations.forEach(conv => {
        // Only look at user messages
        const userMsgs = conv.messages.filter(m => m.role === 'user');
        userMsgs.forEach(msg => {
            dynamicActivities.push({
                id: msg.id,
                squadId: getSquadFromMessage(msg.content),
                type: 'task_created',
                title: 'Solicitado à ARIA',
                description: msg.content,
                timestamp: new Date(msg.timestamp),
                actor: 'Erick',
            });
        });
    });

    // Combine any mock milestones you want to keep with the dynamic ones
    const staticMilestones = MOCK_ACTIVITIES.filter(a => ['sprint_started', 'status_changed'].includes(a.type));

    const allActivities = [...staticMilestones, ...dynamicActivities]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10); // keep recent 10

    const filtered = allActivities.filter(a => filter === 'all' || a.squadId === filter);

    return (
        <div className="bg-[#0B0B0C] border border-white/[0.05] rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                onClick={() => setCollapsed(c => !c)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                        <Activity className="w-4 h-4 text-white/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Atividade Recente</h3>
                </div>
                <ChevronRight className={cn('w-4 h-4 text-white/30 transition-transform duration-200', !collapsed && 'rotate-90')} />
            </button>

            {!collapsed && (
                <div className="px-4 pb-4">
                    {/* Filter pills */}
                    <div className="flex gap-1.5 mb-4">
                        {(['all', 'maverick', 'graham'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150',
                                    filter === f
                                        ? f === 'maverick'
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            : f === 'graham'
                                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                                : 'bg-white/10 text-white border border-white/15'
                                        : 'text-white/40 hover:text-white/70 border border-transparent'
                                )}
                            >
                                {f === 'all' ? 'Todos' : f === 'maverick' ? 'Maverick' : 'Graham'}
                            </button>
                        ))}
                    </div>

                    {/* Timeline */}
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-2 text-center">
                            <Activity className="w-8 h-8 text-white/15" />
                            <p className="text-xs text-white/30">Nenhuma atividade recente</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute left-5 top-2 bottom-2 w-px bg-white/[0.06]" />

                            <div className="space-y-1">
                                {filtered.map((entry) => {
                                    const squad = SQUAD_CONFIG[entry.squadId];
                                    const TypeIcon = TYPE_ICONS[entry.type];

                                    return (
                                        <div key={entry.id} className="flex gap-3 pl-2 pr-2 py-2.5 rounded-xl hover:bg-white/[0.025] transition-colors group">
                                            {/* Icon dot */}
                                            <div className={cn('w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 z-10', squad.bg, squad.border)}>
                                                <TypeIcon className={cn('w-3 h-3', squad.color)} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <p className="text-xs font-semibold text-white/85 truncate">{entry.title}</p>
                                                    <span className="text-[10px] text-white/25 flex-shrink-0 tabular-nums">{relativeTime(entry.timestamp)}</span>
                                                </div>
                                                <p className="text-[11px] text-white/40 leading-snug mt-0.5 line-clamp-1">{entry.description}</p>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={cn('text-[9px] font-bold uppercase tracking-wider', squad.color)}>{squad.label}</span>
                                                    <span className="text-[9px] text-white/20">·</span>
                                                    <span className="text-[9px] text-white/30">{TYPE_LABELS[entry.type]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
