'use client';

// UI Layouts (MIT) — numbersuffle adapté LKDV via @number-flow/react.
import NumberFlow from '@number-flow/react';
import { cn } from '@/lib/utils';

export interface NumberStatProps {
  value: number;
  /** Précision décimale (défaut 0). */
  decimals?: number;
  /** Préfixe (ex. « + »). */
  prefix?: string;
  /** Suffixe (ex. « € », « kg », « km »). */
  suffix?: string;
  className?: string;
  /** Saut désactivé en reduced-motion (NumberFlow gère). */
  ariaLabel?: string;
}

/**
 * NumberStat — valeur chiffrée animée (compteur) dans le langage LKDV.
 * Remplace les chiffres statiques des cartes/stats (€, kg, km, %, compteurs).
 */
export function NumberStat({
  value,
  decimals = 0,
  prefix,
  suffix,
  className,
  ariaLabel,
}: NumberStatProps) {
  return (
    <NumberFlow
      value={value}
      format={{
        useGrouping: true,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }}
      prefix={prefix}
      suffix={suffix}
      className={cn('font-sans tabular-nums', className)}
      aria-label={ariaLabel}
    />
  );
}

export default NumberStat;
