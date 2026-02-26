'use client';

import { motion } from 'framer-motion';

/**
 * Story 6.1 — Task 4: Loading & Progress Animations
 * Spinner, skeleton loader, and progress bar components.
 */

/* ── Spinner ── */

interface SpinnerProps {
    size?: number;
    color?: string;
    className?: string;
}

export function Spinner({ size = 24, color = '#6366F1', className = '' }: SpinnerProps) {
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            role="status"
            aria-label="Loading"
        >
            <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity={0.2} />
            <motion.circle
                cx="12"
                cy="12"
                r="10"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60"
                strokeDashoffset="45"
            />
        </motion.svg>
    );
}

/* ── Skeleton Loader ── */

interface SkeletonProps {
    width?: string;
    height?: string;
    rounded?: string;
    className?: string;
}

export function Skeleton({
    width = '100%',
    height = '1rem',
    rounded = 'rounded-md',
    className = '',
}: SkeletonProps) {
    return (
        <motion.div
            className={`bg-white/5 ${rounded} ${className}`}
            style={{ width, height }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
        />
    );
}

/** Preset skeleton card */
export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <div className={`space-y-3 p-4 ${className}`}>
            <Skeleton width="40%" height="1.25rem" />
            <Skeleton width="100%" height="0.875rem" />
            <Skeleton width="80%" height="0.875rem" />
            <Skeleton width="60%" height="0.875rem" />
        </div>
    );
}

/* ── Progress Bar ── */

interface ProgressBarProps {
    value: number; // 0-100
    className?: string;
    color?: string;
    showLabel?: boolean;
}

export function ProgressBar({
    value,
    className = '',
    color = '#6366F1',
    showLabel = false,
}: ProgressBarProps) {
    const clampedValue = Math.max(0, Math.min(100, value));

    return (
        <div className={`w-full ${className}`}>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${clampedValue}%` }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
            </div>
            {showLabel && (
                <p className="text-xs text-white/50 mt-1 text-right">{clampedValue}%</p>
            )}
        </div>
    );
}

/* ── Dots Loader (chat typing indicator) ── */

export function DotsLoader({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-1 ${className}`} aria-label="Loading">
            {[0, 1, 2].map((i) => (
                <motion.span
                    key={i}
                    className="w-2 h-2 bg-accent rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}
