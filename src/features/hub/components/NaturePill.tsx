'use client';

import type { Nature } from '../engine/hubNature';

const LABELS: Record<Nature, string> = {
  possession: 'Matériel',
  sortie: 'Voyage',
  collectif: 'Rando',
};

/**
 * H3.2 — Pill de nature (affichage seul, zéro sous-titre).
 * L'ouverture du sélecteur est déléguée au parent (HubShell).
 */
export function NaturePill({
  nature,
  open,
  onOpenSwitcher,
}: {
  nature: Nature;
  open: boolean;
  onOpenSwitcher: () => void;
}) {
  const active = nature !== 'possession';
  return (
    <button
      type="button"
      role="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Changer la nature de l'aventure"
      onClick={onOpenSwitcher}
      className={`inline-flex items-center gap-1.5 px-4 min-h-[44px] w-full sm:w-auto rounded-full text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
        active
          ? 'bg-[var(--lkv-primary)] text-white'
          : 'bg-[var(--lkv-surface)] text-[var(--lkv-text-primary)]'
      }`}
    >
      <span className="truncate">
        {LABELS[nature]} <span aria-hidden="true" className="text-[14px]">▾</span>
      </span>
    </button>
  );
}

export default NaturePill;
