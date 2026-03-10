'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
    id: string;
    message: string;
    type?: ToastType;
    duration?: number;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
    return ctx;
}

const ICONS: Record<ToastType, React.ElementType> = {
    success: CheckCircle2,
    info: Info,
    warning: AlertTriangle,
    error: AlertTriangle,
};

const COLORS: Record<ToastType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const type = toast.type ?? 'info';
    const Icon = ICONS[type];

    useEffect(() => {
        // Mount → fade in
        const t = setTimeout(() => setVisible(true), 10);
        // Auto-dismiss
        const d = setTimeout(() => {
            setExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, toast.duration ?? 3500);
        return () => { clearTimeout(t); clearTimeout(d); };
    }, [toast.id, toast.duration, onRemove]);

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl max-w-sm w-full',
                'bg-[#0d0d0f]/90 border-white/10 text-white/90',
                'transition-all duration-300',
                visible && !exiting ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95',
            )}
        >
            <div className={cn('flex-shrink-0 w-5 h-5', COLORS[type].split(' ').pop())}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => { setExiting(true); setTimeout(() => onRemove(toast.id), 300); }}
                className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
        const id = `toast-${++counter.current}`;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Portal-like fixed container */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onRemove={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
