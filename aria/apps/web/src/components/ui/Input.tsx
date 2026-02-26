'use client';

import { ReactNode, InputHTMLAttributes, forwardRef } from 'react';

/**
 * Story 6.2 — Task 3: Component Library — Input
 */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, leftIcon, className = '', id, ...props }, ref) => {
        const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-xs font-medium text-white/60 uppercase tracking-wider"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                            {leftIcon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        className={`
              w-full bg-white/5 border rounded-xl px-4 py-2.5
              text-sm text-white placeholder-white/30
              outline-none transition-all duration-200
              focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-10' : ''}
              ${error
                                ? 'border-danger/50 focus:ring-danger/40 focus:border-danger/50'
                                : 'border-white/10 hover:border-white/20'
                            }
              ${className}
            `}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
                        {...props}
                    />
                </div>
                {error && (
                    <p id={`${inputId}-error`} className="text-xs text-danger" role="alert">
                        {error}
                    </p>
                )}
                {helperText && !error && (
                    <p id={`${inputId}-helper`} className="text-xs text-white/40">
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';
