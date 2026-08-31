'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LkvInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  containerClassName?: string;
}

export const LkvInput = forwardRef<HTMLInputElement, LkvInputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      iconPosition = 'left',
      containerClassName,
      className,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={cn('w-full flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[#17402C] tracking-wide"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && iconPosition === 'left' && (
            <span className="absolute left-3.5 text-[#5A7064] pointer-events-none flex items-center justify-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'w-full bg-white/70 backdrop-blur-md border border-[#17402C]/12 rounded-2xl px-4 py-3 text-sm text-[#14140F] placeholder-[#5A7064]/60',
              'transition-all duration-200 outline-none focus:border-[#17402C] focus:ring-1 focus:ring-[#17402C] focus:bg-white/90',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-[#A8443A] focus:border-[#A8443A] focus:ring-[#A8443A]',
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              // Anti-zoom iOS Safari sur mobile : 16px minimum
              'text-[16px] sm:text-sm',
              className
            )}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <span className="absolute right-3.5 text-[#5A7064] pointer-events-none flex items-center justify-center">
              {icon}
            </span>
          )}
        </div>
        {error && <p className="text-[11px] font-medium text-[#A8443A]">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-[#5A7064]">{helperText}</p>}
      </div>
    );
  }
);

LkvInput.displayName = 'LkvInput';
export default LkvInput;
