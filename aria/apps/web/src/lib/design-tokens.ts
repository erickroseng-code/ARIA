/**
 * Story 6.2 — Task 1: Design System Planning & Color Tokens
 * Central design tokens for the ARIA Design System.
 */

export const colors = {
    primary: {
        50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
        400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
        800: '#3730A3', 900: '#312E81',
    },
    success: { light: '#D1FAE5', DEFAULT: '#10B981', dark: '#065F46' },
    warning: { light: '#FEF3C7', DEFAULT: '#F59E0B', dark: '#92400E' },
    danger: { light: '#FEE2E2', DEFAULT: '#EF4444', dark: '#991B1B' },
    neutral: {
        50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
        400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
        800: '#1E293B', 900: '#0F172A',
    },
} as const;

/** 8px base spacing scale */
export const spacing = {
    0: '0px', 0.5: '4px', 1: '8px', 1.5: '12px',
    2: '16px', 2.5: '20px', 3: '24px', 4: '32px',
    5: '40px', 6: '48px', 8: '64px', 10: '80px',
    12: '96px', 16: '128px',
} as const;

/** Typography scale */
export const typography = {
    h1: { size: '2.25rem', weight: '700', lineHeight: '1.2', letterSpacing: '-0.02em' },
    h2: { size: '1.875rem', weight: '600', lineHeight: '1.25', letterSpacing: '-0.01em' },
    h3: { size: '1.5rem', weight: '600', lineHeight: '1.3' },
    h4: { size: '1.25rem', weight: '600', lineHeight: '1.35' },
    h5: { size: '1.125rem', weight: '500', lineHeight: '1.4' },
    h6: { size: '1rem', weight: '500', lineHeight: '1.5' },
    body: { size: '0.9375rem', weight: '400', lineHeight: '1.6' },
    caption: { size: '0.8125rem', weight: '400', lineHeight: '1.4' },
    label: { size: '0.75rem', weight: '500', lineHeight: '1.4', letterSpacing: '0.04em' },
} as const;

/** Border radius tokens */
export const radii = {
    sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '24px', full: '9999px',
} as const;

/** Shadow tokens */
export const shadows = {
    sm: '0 1px 2px rgba(0,0,0,0.2)',
    md: '0 4px 6px rgba(0,0,0,0.15)',
    lg: '0 10px 15px rgba(0,0,0,0.15)',
    xl: '0 20px 25px rgba(0,0,0,0.2)',
    glow: '0 0 20px rgba(99,102,241,0.25)',
    'glow-lg': '0 0 40px rgba(99,102,241,0.35)',
} as const;
