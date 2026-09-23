'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface CountryFlagProps {
  code: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'rect';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
  xl: 'w-12 h-12 text-base',
};

const RECT_SIZES = {
  xs: 'w-5 h-3.5',
  sm: 'w-6 h-4',
  md: 'w-8 h-5.5',
  lg: 'w-10 h-7',
  xl: 'w-14 h-9.5',
};

/**
 * CountryFlag — Composant drapeau canonique vectoriel (Lot 2).
 * Pas d'émojis texte, rendu haute fidélité avec bordure spéculaire de verre.
 */
export function CountryFlag({
  code,
  name,
  size = 'md',
  variant = 'circle',
  className = '',
}: CountryFlagProps) {
  const [hasError, setHasError] = useState(false);
  const isoCode = (code || '').trim().toLowerCase();

  const isCircle = variant === 'circle';
  const sizeClass = isCircle ? SIZE_CLASSES[size] : RECT_SIZES[size];

  if (!isoCode || hasError) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 g2 border border-[color:var(--glass-rim)] text-[color:var(--glass-secondary)] font-mono font-bold select-none',
          isCircle ? 'rounded-full' : 'rounded-[var(--lkv-radius-sm)]',
          sizeClass,
          className
        )}
        title={name || code}
        aria-label={name || code}
      >
        {isoCode ? (
          isoCode.slice(0, 2).toUpperCase()
        ) : (
          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeWidth="2" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden shrink-0 select-none border border-[color:var(--glass-rim)] shadow-xs bg-black/10',
        isCircle ? 'rounded-full' : 'rounded-[var(--lkv-radius-sm)]',
        sizeClass,
        className
      )}
      title={name || code}
      aria-label={name || code}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/${isoCode}.svg`}
        alt={name || code}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
      />
    </span>
  );
}

export default CountryFlag;
