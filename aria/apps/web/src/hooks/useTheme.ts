'use client';

import { create } from 'zustand';

/**
 * Story 6.2 — Task 4: Dark Mode Implementation
 * Zustand-based theme store with localStorage persistence.
 */

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const useTheme = create<ThemeState>((set) => ({
    theme: (typeof window !== 'undefined' && (localStorage.getItem('aria-theme') as Theme)) || 'dark',
    setTheme: (theme) => {
        set({ theme });
        if (typeof window !== 'undefined') {
            localStorage.setItem('aria-theme', theme);
            document.documentElement.classList.toggle('dark', theme === 'dark');
        }
    },
    toggleTheme: () =>
        set((state) => {
            const next = state.theme === 'dark' ? 'light' : 'dark';
            if (typeof window !== 'undefined') {
                localStorage.setItem('aria-theme', next);
                document.documentElement.classList.toggle('dark', next === 'dark');
            }
            return { theme: next };
        }),
}));
