'use client';

import { useState } from 'react';
import { CalendarWidget } from '@/components/chat/dashboard/CalendarWidget';
import { ActivityFeedWidget } from '@/components/chat/dashboard/ActivityFeedWidget';
import { SquadMetricsWidget } from '@/components/chat/dashboard/SquadMetricsWidget';
import { QuickActionsWidget } from '@/components/chat/dashboard/QuickActionsWidget';
import { Target, BarChart2, ArrowRight } from 'lucide-react';

interface ExecutiveDashboardProps {
    onSelectSquad?: (squadId: string) => void;
}

const squads = [
    {
        id: 'maverick',
        name: 'Maverick',
        icon: Target,
        accent: '#a855f7',
        accentBg: 'bg-purple-500/10',
        accentBorder: 'border-purple-500/20',
        accentText: 'text-purple-400',
        tag: 'Estratégia',
        tagBg: 'bg-purple-500/10 text-purple-400/70 border-purple-500/15',
        summary: 'Último foco: alinhamento estratégico e mapeamento da Persona Alex.',
        status: 'active' as const,
        badge: '1 Sessão Pendente',
    },
    {
        id: 'finance',
        name: 'Graham',
        icon: BarChart2,
        accent: '#2dd4bf',
        accentBg: 'bg-teal-500/10',
        accentBorder: 'border-teal-500/20',
        accentText: 'text-teal-400',
        tag: 'Finanças',
        tagBg: 'bg-teal-500/10 text-teal-400/70 border-teal-500/15',
        summary: 'Faturamento saudável. Custos fixos dentro da margem operacional.',
        status: 'active' as const,
        badge: 'Meta Concluída',
    },
];

function SquadCard({ squad, onSelect }: { squad: typeof squads[0]; onSelect?: () => void }) {
    const Icon = squad.icon;

    return (
        <button
            onClick={onSelect}
            className="group w-full text-left bg-[#0d0d0f] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.025] hover:border-white/[0.10] hover:shadow-xl transition-all duration-250 cursor-pointer"
            style={{ ['--squad-color' as never]: squad.accent }}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl border ${squad.accentBg} ${squad.accentBorder}`}>
                    <Icon className={`w-4 h-4 ${squad.accentText}`} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${squad.tagBg}`}>
                    {squad.tag}
                </span>
            </div>

            <h3 className="text-white font-semibold text-base mb-1">{squad.name}</h3>
            <p className="text-white/45 text-sm mb-4 leading-snug">{squad.summary}</p>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/40">
                    <div className={`w-1.5 h-1.5 rounded-full ${squad.accentText.replace('text', 'bg')}/60`}
                        style={{ backgroundColor: squad.accent, opacity: 0.7 }}
                    />
                    {squad.badge}
                </div>
                <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5 ${squad.accentText}`} />
            </div>

            {/* Bottom glow bar on hover */}
            <div
                className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, ${squad.accent}50, transparent)` }}
            />
        </button>
    );
}

export function ExecutiveDashboard({ onSelectSquad }: ExecutiveDashboardProps) {
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
    const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="flex-1 flex flex-col items-center overflow-y-auto scrollbar-hidden">
            <div className="w-full max-w-4xl px-5 lg:px-8 pt-12 pb-10 space-y-6">

                {/* Hero Greeting */}
                <div className="space-y-1.5">
                    <p className="text-emerald-400/70 text-xs font-bold tracking-[0.2em] uppercase">{dateStr}</p>
                    <h1 className="text-[2.25rem] font-semibold text-white tracking-tight leading-tight">
                        {greeting}, Erick
                    </h1>
                    <p className="text-white/35 text-base font-normal">
                        Aqui está o overview do seu dia.
                    </p>
                </div>

                {/* Quick Actions */}
                <QuickActionsWidget />

                {/* Squads Row */}
                <div>
                    <p className="text-[11px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">Squads de IA</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                        {squads.map(squad => (
                            <SquadCard
                                key={squad.id}
                                squad={squad}
                                onSelect={() => onSelectSquad?.(squad.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Squad Metrics */}
                <SquadMetricsWidget />

                {/* Two-column: Calendar + Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <CalendarWidget />
                    <ActivityFeedWidget />
                </div>

            </div>
        </div>
    );
}
