'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

/**
 * Story 6.1 — Task 3: Page & Modal Transitions
 * Fade-slide transition wrapper for page/section content.
 */

const pageVariants = {
    initial: {
        opacity: 0,
        y: 12,
        filter: 'blur(4px)',
    },
    enter: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        filter: 'blur(4px)',
        transition: {
            duration: 0.25,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
};

const modalOverlayVariants = {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalContentVariants = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    enter: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 10,
        transition: { duration: 0.2 },
    },
};

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
    /** Unique key to trigger re-animation on route changes */
    pageKey?: string;
}

export function PageTransition({ children, className = '', pageKey }: PageTransitionProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pageKey}
                variants={pageVariants}
                initial="initial"
                animate="enter"
                exit="exit"
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

interface ModalTransitionProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

export function ModalTransition({ isOpen, onClose, children, className = '' }: ModalTransitionProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        variants={modalOverlayVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        onClick={onClose}
                    />
                    <motion.div
                        className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
                        variants={modalContentVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/** Stagger children animations */
export const staggerContainer = {
    initial: {},
    enter: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

export const staggerItem = {
    initial: { opacity: 0, y: 12 },
    enter: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};
