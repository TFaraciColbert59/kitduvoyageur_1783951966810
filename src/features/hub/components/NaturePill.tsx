'use client';

import { Button } from '@/components/ui';
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
    <Button
      variant={active ? 'primary' : 'secondary'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Changer la nature de l'aventure"
      onClick={onOpenSwitcher}
      className="w-full sm:w-auto"
    >
      <span className="truncate">
        {LABELS[nature]} <span aria-hidden="true" className="text-[14px]">▾</span>
      </span>
    </Button>
  );
}

export default NaturePill;
