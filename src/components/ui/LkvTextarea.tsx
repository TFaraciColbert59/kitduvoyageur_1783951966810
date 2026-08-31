'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LkvTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const LkvTextarea = forwardRef<HTMLTextAreaElement, LkvTextareaProps>(
  ({ label, error, helperText, containerClassName, className, disabled, id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={cn('w-full flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={textareaId} className="text-xs font-semibold text-[#17402C] tracking-wide">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          className={cn(
            'w-full bg-white/70 backdrop-blur-md border border-[#17402C]/12 rounded-2xl px-4 py-3 text-sm text-[#14140F] placeholder-[#5A7064]/60 resize-y',
            'transition-all duration-200 outline-none focus:border-[#17402C] focus:ring-1 focus:ring-[#17402C] focus:bg-white/90',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            error && 'border-[#A8443A] focus:border-[#A8443A] focus:ring-[#A8443A]',
            'text-[16px] sm:text-sm',
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] font-medium text-[#A8443A]">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-[#5A7064]">{helperText}</p>}
      </div>
    );
  }
);

LkvTextarea.displayName = 'LkvTextarea';
export default LkvTextarea;
