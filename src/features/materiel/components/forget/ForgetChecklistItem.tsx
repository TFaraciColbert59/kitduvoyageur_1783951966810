'use client';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function ForgetChecklistItem({
  label, checked, onToggle,
}: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      aria-pressed={checked}
      className="bg-white/35 rounded-[var(--r-sm)] w-full flex items-center gap-3 p-2 text-left"
    >
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
          checked ? 'bg-sage-500' : 'bg-stone-200'
        }`}
      >
        {checked && <Check size={12} className="text-white" aria-hidden="true" />}
      </span>
      <span className={`text-sm ${checked ? 'line-through text-[color:var(--label-quaternary)]' : 'text-[color:var(--label)]'}`}>
        {label}
      </span>
    </motion.button>
  );
}
