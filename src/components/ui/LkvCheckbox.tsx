'use client';
import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { CheckCheckIcon as CheckIcon } from '@/components/icons/check-check';

export interface LkvCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  containerClassName?: string;
}

export const LkvCheckbox = forwardRef<HTMLInputElement, LkvCheckboxProps>(
  ({ label, description, containerClassName, className, checked, disabled, id, onChange, ...props }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-3 cursor-pointer select-none group touch-manipulation',
          disabled && 'opacity-40 cursor-not-allowed',
          containerClassName
        )}
      >
        <div className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded-lg border border-[#17402C]/20 bg-white/70 backdrop-blur-sm flex items-center justify-center transition-all duration-150',
              'peer-checked:bg-[#17402C] peer-checked:border-[#17402C] peer-checked:text-white',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-[#17402C] peer-focus-visible:ring-offset-2',
              className
            )}
          >
            {checked && <CheckIcon size={13} className="text-white stroke-[3]" />}
          </div>
        </div>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-xs font-semibold text-[#17402C] leading-snug">{label}</span>}
            {description && <span className="text-[11px] text-[#5A7064] mt-0.5">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

LkvCheckbox.displayName = 'LkvCheckbox';
export default LkvCheckbox;
