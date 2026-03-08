'use client';

import { useState } from 'react';
import { Target, BarChart2, TrendingUp, ChevronRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type PerformanceStatus = 'on_track' | 'attention' | 'delayed';

interface SquadMetric {
    id: string;
    name: string;
    description: string;
    color: string;
    gradient: string;
    trackColor: string;
    icon: React.ElementType;
    progress: number; // 0-100
    tasksCompleted: number;
    tasksTotal: number;
    performance: PerformanceStatus;
    keyResult: string;
}

const STATUS_CONFIG: Record<PerformanceStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
    on_track: { label: 'No Prazo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
    attention: { label: 'Atenção', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
    delayed: { label: 'Atrasado', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
};

// Mock data — pluggable via API
const SQUAD_METRICS: SquadMetric[] = [
    {
        id: 'maverick',
        name: 'Maverick',
        description: 'Estratégia & Visão',
        color: '#a855f7',
        gradient: 'from-purple-500 to-pink-500',
        trackColor: 'rgba(168, 85, 247, 0.15)',
        icon: Target,
        progress: 68,
        tasksCompleted: 17,
        tasksTotal: 25,
        performance: 'on_track',
        keyResult: 'Wireframes hi-fi — Sprint 3',
    },
    {
        id: 'graham',
        name: 'Graham',
        description: 'Gestão Financeira',
        color: '#2dd4bf',
        gradient: 'from-teal-400 to-cyan-500',
        trackColor: 'rgba(45, 212, 191, 0.15)',
        icon: BarChart2,
        progress: 82,
        tasksCompleted: 22,
        tasksTotal: 27,
        performance: 'on_track',
        keyResult: 'DRE + Projeção Q2 concluídos',
    },
];

interface CircularProgressProps {
    progress: number;
    color: string;
    trackColor: string;
    size?: number;
    strokeWidth?: number;
}

function CircularProgress({ progress, color, trackColor, size = 72, strokeWidth = 6 }: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="-rotate-90">
            {/* Track */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={trackColor}
                strokeWidth={strokeWidth}
            />
            {/* Progress */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
        </svg>
    );
}

function SquadCard({ squad }: { squad: SquadMetric }) {
    const status = STATUS_CONFIG[squad.performance];
    const StatusIcon = status.icon;
    const SquadIcon = squad.icon;

    return (
        <div className={cn(
            'flex-1 p-5 rounded-2xl border transition-all duration-200 hover:shadow-lg group cursor-default',
            'bg-[#0d0d0f] border-white/[0.06] hover:border-white/[0.10]',
        )}>
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <SquadIcon className="w-4 h-4" style={{ color: squad.color }} />
                    <div>
                        <p className="text-sm font-semibold text-white">{squad.name}</p>
                        <p className="text-[10px] text-white/35">{squad.description}</p>
                    </div>
                </div>
                <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold', status.bg, status.border, status.color)}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {status.label}
                </div>
            </div>

            {/* Progress ring + stats */}
            <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                    <CircularProgress progress={squad.progress} color={squad.color} trackColor={squad.trackColor} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-white tabular-nums">{squad.progress}<span className="text-xs text-white/40 font-medium">%</span></span>
                    </div>
                </div>

                <div className="flex-1 space-y-3">
                    {/* Tasks this week */}
                    <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1">Tarefas (semana)</p>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                    className={cn('h-full rounded-full bg-gradient-to-r', squad.gradient)}
                                    style={{ width: `${(squad.tasksCompleted / squad.tasksTotal) * 100}%`, transition: 'width 1s ease' }}
                                />
                            </div>
                            <span className="text-xs font-semibold text-white/70 tabular-nums">{squad.tasksCompleted}/{squad.tasksTotal}</span>
                        </div>
                    </div>

                    {/* Key result */}
                    <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-0.5">Foco Atual</p>
                        <p className="text-xs text-white/60 leading-snug">{squad.keyResult}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SquadMetricsWidget() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="bg-[#0B0B0C] border border-white/[0.05] rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                onClick={() => setCollapsed(c => !c)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/[0.04] rounded-xl border border-white/[0.06]">
                        <TrendingUp className="w-4 h-4 text-white/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Performance dos Squads</h3>
                </div>
                <ChevronRight className={cn('w-4 h-4 text-white/30 transition-transform duration-200', !collapsed && 'rotate-90')} />
            </button>

            {!collapsed && (
                <div className="px-4 pb-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {SQUAD_METRICS.map(squad => (
                            <SquadCard key={squad.id} squad={squad} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
