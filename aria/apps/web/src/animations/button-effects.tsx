'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';

/**
 * Story 6.1 — Task 5: Button & Hover Effects
 * Motion-enhanced button with hover, tap, and focus animations.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface MotionButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20',
    secondary:
        'bg-white/10 text-white hover:bg-white/15 border border-white/10',
    ghost:
        'bg-transparent text-white/70 hover:text-white hover:bg-white/5',
    danger:
        'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
};

const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
};

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
    ({ variant = 'primary', size = 'md', children, isLoading, className = '', ...props }, ref) => {
        return (
            <motion.button
                ref={ref}
                className={`
          inline-flex items-center justify-center gap-2 font-medium
          transition-colors duration-200 cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                disabled={isLoading}
                {...props}
            >
                {isLoading ? (
                    <motion.span
                        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                ) : null}
                {children}
            </motion.button>
        );
    }
);
MotionButton.displayName = 'MotionButton';

/* ── Floating Action Button ── */

interface FABProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    children: ReactNode;
}

export function FloatingActionButton({ children, className = '', ...props }: FABProps) {
    return (
        <motion.button
            className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full
        bg-accent text-white shadow-xl shadow-accent/30
        flex items-center justify-center
        ${className}
      `}
            whileHover={{ scale: 1.1, boxShadow: '0 8px 30px rgba(99,102,241,0.4)' }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            {...props}
        >
            {children}
        </motion.button>
    );
}

/* ── Animated Card ── */

interface AnimatedCardProps {
    children: ReactNode;
    className?: string;
    delay?: number;
}

export function AnimatedCard({ children, className = '', delay = 0 }: AnimatedCardProps) {
    return (
        <motion.div
            className={`
        bg-white/5 backdrop-blur-xl border border-white/10
        rounded-2xl overflow-hidden
        ${className}
      `}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            whileHover={{
                borderColor: 'rgba(99,102,241,0.3)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.1)',
                transition: { duration: 0.2 },
            }}
        >
            {children}
        </motion.div>
    );
}
