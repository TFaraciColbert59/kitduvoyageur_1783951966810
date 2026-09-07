'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

export interface CountryCardWidgetProps {
  countryCode?: string | null;
  countryName?: string | null;
}

/** Drapeau émoji à partir du code ISO 3166-1 alpha-2 (carte pays). */
function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/**
 * Widget `country-card` — point d'unification avec /pays (Y6.5).
 * Depuis son voyage, l'utilisateur atteint la fiche pays en un clic — les deux
 * surfaces partagent le même cockpit (§§1.2, 4.3).
 */
export function CountryCardWidget({ countryCode, countryName }: CountryCardWidgetProps) {
  if (!countryCode) return null;

  return (
    <GlassCard tone="neutral" className="p-3.5 space-y-1.5 rounded-[var(--lkv-radius-card)] border border-white/60">
      <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
        <MapPin size={12} />
        Destination
      </span>
      <Link
        href={`/pays/${countryCode.toLowerCase()}`}
        className="flex items-center gap-2.5 rounded-[var(--lkv-radius-md)] px-1 py-1 hover:bg-white/40 transition-colors group min-h-[44px] cursor-pointer"
        aria-label={`Ouvrir la fiche pays ${countryName ?? countryCode}`}
      >
        <span
          className="text-2xl leading-none shrink-0"
          aria-hidden="true"
        >
          {flagEmoji(countryCode)}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
            {countryName ?? countryCode}
          </span>
          <span className="block text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)]">
            {countryCode} · fiche pays
          </span>
        </span>
      </Link>
    </GlassCard>
  );
}

export default CountryCardWidget;
