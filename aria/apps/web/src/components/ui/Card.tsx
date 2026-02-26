'use client';

import { ReactNode } from 'react';

/**
 * Story 6.2 — Task 3: Component Library — Card
 * Glassmorphism card with optional header, footer, and hover glow.
 */

interface CardProps {
    children: ReactNode;
    className?: string;
    header?: ReactNode;
    footer?: ReactNode;
    noPadding?: boolean;
    hoverable?: boolean;
}

export function Card({
    children,
    className = '',
    header,
    footer,
    noPadding = false,
    hoverable = false,
}: CardProps) {
    return (
        <div
            className={`
        bg-white/[0.04] dark:bg-white/[0.04]
        backdrop-blur-xl border border-white/10
        rounded-2xl overflow-hidden
        ${hoverable ? 'transition-all duration-200 hover:border-primary-400/30 hover:shadow-glow cursor-pointer' : ''}
        ${className}
      `}
        >
            {header && (
                <div className="px-5 py-4 border-b border-white/5">
                    {header}
                </div>
            )}
            <div className={noPadding ? '' : 'p-5'}>
                {children}
            </div>
            {footer && (
                <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                    {footer}
                </div>
            )}
        </div>
    );
}
