'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDownIcon } from '@/components/icons/chevron-down';

export interface LkvSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface LkvSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: LkvSelectOption[];
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const LkvSelect = forwardRef<HTMLSelectElement, LkvSelectProps>(
  ({ label, options = [], error, helperText, containerClassName, className, disabled, id, children, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={cn('w-full flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-[#17402C] tracking-wide">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cn(
              'w-full bg-white/70 backdrop-blur-md border border-[#17402C]/12 rounded-2xl pl-4 pr-10 py-3 text-sm text-[#14140F] appearance-none cursor-pointer',
              'transition-all duration-200 outline-none focus:border-[#17402C] focus:ring-1 focus:ring-[#17402C] focus:bg-white/90',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-[#A8443A] focus:border-[#A8443A] focus:ring-[#A8443A]',
              'text-[16px] sm:text-sm',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <span className="absolute right-3.5 text-[#17402C] pointer-events-none flex items-center justify-center">
            <ChevronDownIcon size={16} />
          </span>
        </div>
        {error && <p className="text-[11px] font-medium text-[#A8443A]">{error}</p>}
        {!error && helperText && <p className="text-[11px] text-[#5A7064]">{helperText}</p>}
      </div>
    );
  }
);

LkvSelect.displayName = 'LkvSelect';
export default LkvSelect;
