'use client';

/**
 * Story 6.2 — Task 3: Component Library — Badge
 */

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    neutral: 'bg-white/5 text-white/60 border-white/10',
};

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
}

export function Badge({ variant = 'neutral', children, className = '', dot }: BadgeProps) {
    return (
        <span
            className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5
        text-xs font-medium rounded-full border
        ${variantClasses[variant]} ${className}
      `}
        >
            {dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
            {children}
        </span>
    );
}
