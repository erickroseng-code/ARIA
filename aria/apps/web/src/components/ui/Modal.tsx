'use client';

import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Story 6.2 — Task 3: Component Library — Modal
 */

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    footer?: ReactNode;
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Content */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            className={`
                w-full ${sizeClasses[size]}
                bg-neutral-900 border border-white/10
                rounded-2xl shadow-xl overflow-hidden
              `}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            role="dialog"
                            aria-modal="true"
                            aria-label={title}
                        >
                            {/* Header */}
                            {title && (
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                                    <button
                                        onClick={onClose}
                                        className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                                        aria-label="Close modal"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Body */}
                            <div className="px-6 py-5">{children}</div>

                            {/* Footer */}
                            {footer && (
                                <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
                                    {footer}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
