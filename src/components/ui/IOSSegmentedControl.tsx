'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SegmentedOption {
  id: string;
  label: string;
  badge?: number;
  icon?: React.ReactNode;
}

interface IOSSegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function IOSSegmentedControl({
  options,
  value,
  onChange,
  className = '',
}: IOSSegmentedControlProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div
      role="tablist"
      className={`relative p-1 rounded-full bg-[#EAE6DF]/70 backdrop-blur-xl border border-white/60 flex items-center select-none shadow-xs ${className}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isSelected}
            type="button"
            onClick={() => {
              if (!isSelected) {
                triggerHaptic('selection');
                onChange(opt.id);
              }
            }}
            className={`relative flex-1 min-h-[38px] py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors z-10 cursor-pointer active:scale-[0.98] ${
              isSelected ? 'text-[#17402C] font-bold' : 'text-[#5A7064] hover:text-[#17402C]'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="ios-segmented-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(23,64,44,0.08)] border border-black/[0.04] -z-10"
              />
            )}
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && opt.badge > 0 && (
              <span
                className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-[#17402C] text-white' : 'bg-[#17402C]/10 text-[#17402C]'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
