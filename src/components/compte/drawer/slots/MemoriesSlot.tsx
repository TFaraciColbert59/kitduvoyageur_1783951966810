'use client';

import React, { useState } from 'react';
import { OutingCard, type OutingCardData } from '../cards/OutingCard';
import { StampTile, type StampTileData } from '../cards/StampTile';
import { EmptyState } from '../memories/EmptyState';
import { YearFilter } from '../memories/YearFilter';
import {
  asRecord,
  asRows,
  normalizeOuting,
  normalizeStamp,
  outingsCountLabel,
  placeLabel,
  timeValue,
} from '../memories/memoriesModel';

export type MemoriesLens = 'timeline' | 'passport' | 'souvenirs';

export interface MemoriesSlotProps {
  lens?: MemoriesLens | string;
  /** Payload du bootstrap : `outings`, `stamps`, `highlights`. */
  payload?: unknown;
  /** Compatibilité avec les fixtures directes du brief (sans payload). */
  outings?: unknown;
  stamps?: unknown;
  [key: string]: unknown;
}

/**
 * La racine garde `lkdv-slot-state` (convention des slots) ; en mode ready on
 * neutralise uniquement la boîte centrée de l'état vide pour laisser la liste
 * occuper la largeur.
 */
const MEMORIES_SLOT_CSS = `
.lkdv-souvenirs-root[data-state="ready"]{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;text-align:left!important;padding:0!important;background:none!important;box-shadow:none!important;border-radius:0!important;gap:12px!important;}
`;

/**
 * Slot Souvenirs — Timeline et Passeport. Les données viennent exclusivement du
 * payload du bootstrap (ou des fixtures directes de test) ; aucun mock, aucune
 * valeur inventée. La lentille Souvenirs reste un état vide tant que les albums
 * À la une ne sont pas livrés (tâche 10).
 */
export function MemoriesSlot({
  lens,
  payload,
  outings: outingsProp,
  stamps: stampsProp,
}: MemoriesSlotProps) {
  const activeLens: MemoriesLens =
    lens === 'passport' || lens === 'souvenirs' ? lens : 'timeline';
  const source = asRecord(payload);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  const outings = asRows(source.outings ?? outingsProp)
    .map(normalizeOuting)
    .filter((outing): outing is OutingCardData => outing !== null)
    .sort((a, b) => timeValue(b) - timeValue(a) || a.title.localeCompare(b.title));
  const stamps = asRows(source.stamps ?? stampsProp)
    .map(normalizeStamp)
    .filter((stamp): stamp is StampTileData => stamp !== null);

  const years = [...new Set(outings.map((outing) => outing.year))]
    .filter((year): year is number => year !== null)
    .sort((a, b) => b - a);
  const activeYear =
    selectedYear !== 'all' && years.includes(selectedYear) ? selectedYear : 'all';
  const visibleOutings =
    activeYear === 'all'
      ? outings
      : outings.filter((outing) => outing.year === activeYear);

  const groups: Array<[string, OutingCardData[]]> = [];
  for (const outing of visibleOutings) {
    const group = groups.find(([label]) => label === outing.monthLabel);
    if (group) group[1].push(outing);
    else groups.push([outing.monthLabel, [outing]]);
  }

  const empty =
    activeLens === 'passport'
      ? stamps.length === 0
      : activeLens === 'souvenirs'
        ? true
        : outings.length === 0;
  const emptyLabel =
    activeLens === 'passport'
      ? 'Aucun lieu validé.'
      : activeLens === 'souvenirs'
        ? 'Aucune story à la une.'
        : 'Aucune sortie enregistrée.';

  let content: React.ReactNode = null;

  if (!empty && activeLens === 'passport') {
    content = (
      <div className="space-y-3">
        <p className="px-0.5 font-mono text-[length:var(--lkv-text-caption,12px)] font-semibold uppercase tracking-wide text-[color:var(--label2)]">
          {placeLabel(stamps.length)}
        </p>
        <ul aria-label="Tampons du passeport" className="grid grid-cols-3 gap-2">
          {stamps.map((stamp) => (
            <StampTile key={stamp.id} stamp={stamp} />
          ))}
        </ul>
      </div>
    );
  } else if (!empty) {
    content = (
      <div className="space-y-3">
        <YearFilter years={years} active={activeYear} onChange={setSelectedYear} />
        <p role="status" aria-live="polite" className="sr-only">
          {outingsCountLabel(visibleOutings.length)}
        </p>
        <div className="space-y-3">
          {groups.map(([label, group]) => (
            <section key={label}>
              <h3 className="mb-1.5 px-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--label2)]">
                {label}
              </h3>
              <ul aria-label={`Sorties de ${label}`} className="space-y-2">
                {group.map((outing) => (
                  <OutingCard key={outing.id} outing={outing} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="lkdv-slot-state lkdv-souvenirs-root"
      data-state={empty ? 'empty' : 'ready'}
      data-testid="slot-content"
      data-slot="souvenirs"
      data-lens={activeLens}
    >
      <style>{MEMORIES_SLOT_CSS}</style>
      {empty ? <EmptyState label={emptyLabel} /> : content}
    </div>
  );
}

export default MemoriesSlot;
