import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';

/** En-tête sobre, sans 4ᵉ bouton : retour + titre + preuve. */
export function RankingsHeader() {
  return (
    <div className="border-b border-[color:var(--glass-rim)] bg-[color:var(--glass-bg-strong)] backdrop-blur-[24px] backdrop-saturate-[1.5]">
      <div className="mx-auto flex w-full max-w-[980px] items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]">
        <Link
          href="/explorer"
          aria-label="Retour à Explorer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-label)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none"
        >
          <Icon name="chevron-left" size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.16em] text-[color:var(--glass-label-tertiary)]">
            Le Kit du Voyageur
          </p>
          <h1 className="truncate font-display text-[length:var(--lkv-text-title-sm)] font-extrabold leading-tight text-[color:var(--glass-label)]">
            Classements
          </h1>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-2 py-1 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-secondary)] sm:inline-flex">
          <Icon name="shield-check" size={13} />
          Preuves
        </span>
      </div>
    </div>
  );
}

export default RankingsHeader;
