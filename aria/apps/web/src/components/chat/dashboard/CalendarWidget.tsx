'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Clock, Users, Video, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CalendarEvent {
    id: string;
    title: string;
    startTime: string; // ISO
    endTime: string;   // ISO
    attendees?: { email: string; name?: string }[];
    meetLink?: string;
    location?: string;
    description?: string;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function minutesUntil(iso: string): number {
    return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

function getInitials(name?: string, email?: string): string {
    if (name) return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return (email ?? '?')[0].toUpperCase();
}

function SkeletonCard() {
    return (
        <div className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] animate-pulse">
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0 pt-0.5">
                <div className="w-8 h-3 bg-white/10 rounded" />
                <div className="w-1 h-10 bg-white/[0.05] rounded-full" />
            </div>
            <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 bg-white/10 rounded" />
                <div className="h-2.5 w-1/3 bg-white/[0.06] rounded" />
                <div className="flex gap-1 mt-2">
                    <div className="w-5 h-5 rounded-full bg-white/10" />
                    <div className="w-5 h-5 rounded-full bg-white/10" />
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-white/20" />
            </div>
            <div>
                <p className="text-sm font-medium text-white/50">Nenhuma reunião hoje</p>
                <p className="text-xs text-white/25 mt-0.5">Aproveite o dia livre 🎉</p>
            </div>
        </div>
    );
}

export function CalendarWidget() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        async function fetchEvents() {
            try {
                setLoading(true);
                const now = new Date();
                const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
                const res = await fetch(`${API_BASE}/api/google-calendar/events?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
                if (!res.ok) throw new Error('Falha ao carregar eventos');
                const data = await res.json();
                // Normalise both array and wrapped response formats
                const list: CalendarEvent[] = Array.isArray(data) ? data : (data.events ?? []);
                setEvents(list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
            } catch {
                setError('Não foi possível carregar o calendário');
            } finally {
                setLoading(false);
            }
        }
        fetchEvents();
    }, []);

    // Next upcoming meeting
    const nextEvent = events.find(e => new Date(e.startTime).getTime() > Date.now());
    const minsUntilNext = nextEvent ? minutesUntil(nextEvent.startTime) : null;

    const hasMeetLink = (e: CalendarEvent) => !!(e.meetLink || e.location?.startsWith('http') || e.description?.includes('meet.google') || e.description?.includes('zoom.us'));
    const getMeetLink = (e: CalendarEvent) => e.meetLink ?? e.location ?? '';

    return (
        <div className="bg-[#0B0B0C] border border-white/[0.05] rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                onClick={() => setCollapsed(c => !c)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 flex items-center justify-center shrink-0">
                        <img
                            src="/integrations/calendar.png"
                            alt="Google Calendar"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Reuniões de Hoje</h3>
                        {minsUntilNext !== null && minsUntilNext > 0 && (
                            <p className="text-[11px] text-blue-400/80 mt-0.5">
                                Próxima em {minsUntilNext < 60 ? `${minsUntilNext}min` : `${Math.floor(minsUntilNext / 60)}h`}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!loading && events.length > 0 && (
                        <span className="text-[10px] font-bold text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">
                            {events.length} {events.length === 1 ? 'reunião' : 'reuniões'}
                        </span>
                    )}
                    <ChevronRight className={cn('w-4 h-4 text-white/30 transition-transform duration-200', !collapsed && 'rotate-90')} />
                </div>
            </button>

            {/* Body */}
            {!collapsed && (
                <div className="px-4 pb-4 space-y-2">
                    {loading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : error ? (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                            <AlertCircle className="w-4 h-4 text-red-400/70 flex-shrink-0" />
                            <p className="text-xs text-red-400/80">{error}</p>
                        </div>
                    ) : events.length === 0 ? (
                        <EmptyState />
                    ) : (
                        events.map((event, idx) => {
                            const isNow = new Date(event.startTime).getTime() <= Date.now() && new Date(event.endTime).getTime() >= Date.now();
                            const isPast = new Date(event.endTime).getTime() < Date.now();
                            const hasLink = hasMeetLink(event);

                            return (
                                <div
                                    key={event.id}
                                    className={cn(
                                        'flex gap-3 p-4 rounded-xl border transition-all duration-200 group',
                                        isNow
                                            ? 'bg-blue-500/[0.08] border-blue-500/20'
                                            : isPast
                                                ? 'bg-white/[0.02] border-white/[0.04] opacity-50'
                                                : 'bg-white/[0.03] border-white/[0.04] hover:bg-white/[0.05]'
                                    )}
                                >
                                    {/* Time column */}
                                    <div className="flex flex-col items-center gap-1 w-12 flex-shrink-0 pt-0.5">
                                        <span className={cn('text-xs font-bold tabular-nums', isNow ? 'text-blue-400' : 'text-white/60')}>
                                            {formatTime(event.startTime)}
                                        </span>
                                        {idx < events.length - 1 && (
                                            <div className="w-px flex-1 bg-white/[0.06] min-h-[12px]" />
                                        )}
                                        <span className="text-[10px] text-white/25 tabular-nums">{formatTime(event.endTime)}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <p className={cn('text-sm font-medium leading-snug truncate', isNow ? 'text-white' : 'text-white/80')}>
                                                {event.title}
                                            </p>
                                            {isNow && (
                                                <span className="flex-shrink-0 text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full border border-blue-500/25 uppercase tracking-wider">
                                                    Agora
                                                </span>
                                            )}
                                        </div>

                                        {/* Attendees avatars */}
                                        {event.attendees && event.attendees.length > 0 && (
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Users className="w-3 h-3 text-white/25" />
                                                <div className="flex -space-x-1.5">
                                                    {event.attendees.slice(0, 5).map((att, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border border-black flex items-center justify-center text-[8px] font-bold text-white"
                                                            title={att.name ?? att.email}
                                                        >
                                                            {getInitials(att.name, att.email)}
                                                        </div>
                                                    ))}
                                                    {event.attendees.length > 5 && (
                                                        <div className="w-5 h-5 rounded-full bg-white/10 border border-black flex items-center justify-center text-[8px] text-white/50">
                                                            +{event.attendees.length - 5}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Join button */}
                                        {hasLink && !isPast && (
                                            <a
                                                href={getMeetLink(event)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                                                    isNow
                                                        ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/25'
                                                        : 'bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white border border-white/[0.06]'
                                                )}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Video className="w-3 h-3" />
                                                Entrar
                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
