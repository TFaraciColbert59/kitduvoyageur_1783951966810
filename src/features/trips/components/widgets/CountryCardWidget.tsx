'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs font-sans">
      <div className="flex items-center gap-1.5">
        <MapPin size={13} aria-hidden="true" />
        <h3 className="font-display font-bold text-xs text-[var(--lkv-primary)]">Destination</h3>
      </div>
      <Link
        href={`/pays/${countryCode.toLowerCase()}`}
        className="flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-white/60 transition-colors group min-h-[44px] cursor-pointer"
        aria-label={`Ouvrir la fiche pays ${countryName ?? countryCode}`}
      >
        <span
          className="text-2xl leading-none shrink-0"
          aria-hidden="true"
        >
          {flagEmoji(countryCode)}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--lkv-text-primary)] truncate">
            {countryName ?? countryCode}
          </span>
          <span className="glass-pill text-[9px] font-bold text-[var(--lkv-text-secondary)] mt-0.5">
            {countryCode} · fiche pays
          </span>
        </span>
      </Link>
    </div>
  );
}

export default CountryCardWidget;
