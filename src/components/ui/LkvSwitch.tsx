'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface LkvSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function LkvSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  id,
}: LkvSwitchProps) {
  const { triggerHaptic } = useHapticFeedback();
  const switchId = id || (label ? `switch-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const handleToggle = () => {
    if (disabled) return;
    triggerHaptic('selection');
    onChange(!checked);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-between gap-3 select-none touch-manipulation',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col cursor-pointer" onClick={handleToggle}>
          {label && <span className="text-xs font-semibold text-[#17402C] leading-snug">{label}</span>}
          {description && <span className="text-[11px] text-[#5A7064] mt-0.5">{description}</span>}
        </div>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2',
          checked ? 'bg-[#17402C]' : 'bg-[#17402C]/20 backdrop-blur-sm'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

export default LkvSwitch;
