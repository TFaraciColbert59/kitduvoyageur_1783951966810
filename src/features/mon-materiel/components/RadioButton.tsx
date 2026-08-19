'use client';

/**
 * LKDV — Mon Matériel : radio-bouton personnalisé (cercle animé avec point
 * central). Alternative élégante aux `<input type="radio">` natifs : flou
 * LKDV, point central sage `--mm-forest`, micro-interaction `active:scale`.
 * Accessible (role=radio, aria-checked, focus visible).
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface RadioButtonProps {
  value: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  description?: string;
}

/** Cercle radio animé : anneau sage + point central quand sélectionné. */
export function RadioCircle({
  checked,
  size = 20,
}: {
  checked: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="relative flex items-center justify-center shrink-0 rounded-full border transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: checked ? 'var(--mm-forest)' : 'rgba(11,31,23,0.28)',
        background: checked ? 'rgba(163,196,163,0.14)' : 'rgba(251,250,246,0.6)',
      }}
    >
      <motion.span
        layout
        initial={false}
        animate={{
          scale: checked ? 1 : 0,
          opacity: checked ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
        className="rounded-full"
        style={{ width: size * 0.45, height: size * 0.45, background: 'var(--mm-forest)' }}
      />
    </span>
  );
}

export function RadioButton({
  value,
  label,
  checked,
  onChange,
  name,
  disabled = false,
  description,
}: RadioButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      name={name}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-xs transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A3D]/50 ${
        checked
          ? 'border-[var(--mm-forest)]/45 bg-[var(--mm-ink)]/8 text-[#1C2620] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
          : 'border-[#1C2620]/10 bg-white/45 text-[#1C2620]/80 hover:bg-white/65'
      } disabled:opacity-45`}
    >
      <RadioCircle checked={checked} />
      <span className="min-w-0">
        <span className={`block font-bold ${checked ? 'text-[#1C2620]' : 'text-[#1C2620]/85'}`}>{label}</span>
        {description && <span className="block text-[#1C2620]/55 leading-snug">{description}</span>}
      </span>
    </button>
  );
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  className = '',
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-1.5 ${className}`}>
      {options.map((o) => (
        <RadioButton
          key={o.value}
          name={name}
          value={o.value}
          label={o.label}
          description={o.description}
          checked={value === o.value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}