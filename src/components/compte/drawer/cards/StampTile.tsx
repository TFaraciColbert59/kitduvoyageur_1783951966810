'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/** Un tampon de passeport normalisé depuis les massifs réellement visités. */
export interface StampTileData {
  id: string;
  name: string;
  kind: string;
  outings: number;
  verified: boolean;
}

const KIND_LABELS: Record<string, string> = {
  massif: 'Massif',
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Lieu';
}

function outingsLabel(count: number): string {
  return `${count} sortie${count > 1 ? 's' : ''}`;
}

/**
 * Tuile de tampon du passeport — 96 px, sceau, lieu, type et nombre de
 * sorties. Le sceau « vérifié » n'apparaît que si une trace GPS réelle a été
 * enregistrée pour ce massif.
 */
export function StampTile({ stamp }: { stamp: StampTileData }) {
  const initial = stamp.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <li
      data-testid="stamp-tile"
      className="relative flex h-24 min-h-[96px] flex-col items-center justify-center overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-1.5 py-2 text-center backdrop-blur-[var(--blur-md)]"
    >
      {stamp.verified ? (
        <span
          aria-label="Lieu vérifié"
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] text-[9px] font-bold text-white"
        >
          <LKDVIcon name="valider" size="1em" className="lkdv-icon-inline" /></span>
      ) : null}

      <span
        aria-hidden="true"
        className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-[13px] font-bold ${
          stamp.verified
            ? 'border-[color:var(--lkv-primary)] text-[color:var(--lkv-primary)]'
            : 'border-dashed border-[color:var(--label2)] text-[color:var(--label2)]'
        }`}
      >
        {initial}
      </span>

      <h4 className="m-0 w-full truncate text-[length:var(--lkv-text-caption-2,11px)] font-semibold leading-tight text-[color:var(--label)]">
        {stamp.name}
      </h4>
      <span className="w-full truncate font-mono text-[9.5px] text-[color:var(--label2)]">
        {kindLabel(stamp.kind)}
      </span>
      <span className="w-full truncate font-mono text-[9.5px] font-semibold text-[color:var(--label2)]">
        {outingsLabel(stamp.outings)}
      </span>
    </li>
  );
}

export default StampTile;
