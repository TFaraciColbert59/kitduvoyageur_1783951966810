'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface PriceTagProps {
  amountEur: number;
  originalAmountEur?: number;
  period?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  freeLabel?: string;
  className?: string;
}

const SIZE_STYLES = {
  sm: 'text-xs',
  md: 'text-sm font-semibold',
  lg: 'text-base font-bold',
  xl: 'text-2xl font-extrabold tracking-tight',
};

/**
 * Format canonique français pour les devises (Euros).
 * Conforme à la charte typographique LKDV et aux HIG Apple.
 */
export function formatCurrencyEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * PriceTag — Composant canonique d'affichage des prix LKDV (Lot 2).
 * Formate en fr-FR, gère les chiffres tabulaires (tabular-nums),
 * les prix barrés et les périodes d'abonnement/location.
 */
export function PriceTag({
  amountEur,
  originalAmountEur,
  period,
  size = 'md',
  freeLabel,
  className = '',
}: PriceTagProps) {
  const isFree = amountEur === 0 && freeLabel;
  const formattedPrice = isFree ? freeLabel : formatCurrencyEur(amountEur);
  const formattedOriginal = originalAmountEur != null ? formatCurrencyEur(originalAmountEur) : null;

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 tabular-nums text-[color:var(--glass-label)]',
        SIZE_STYLES[size],
        className
      )}
    >
      {formattedOriginal && (
        <span className="text-xs font-normal line-through text-[color:var(--glass-secondary)] opacity-70">
          {formattedOriginal}
        </span>
      )}
      <span>{formattedPrice}</span>
      {period && (
        <span className="text-xs font-normal text-[color:var(--glass-secondary)]">
          {period}
        </span>
      )}
    </span>
  );
}

export default PriceTag;
