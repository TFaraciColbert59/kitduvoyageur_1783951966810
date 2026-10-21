'use client';

import React, { useCallback, useRef, useState } from 'react';
import StoriesViewer from '@/components/communaute/StoriesViewer';
import { HighlightCard, type HighlightCardData } from '../cards/HighlightCard';
import { OutingCard, type OutingCardData } from '../cards/OutingCard';
import { StampTile } from '../cards/StampTile';
import { EmptyState } from '../memories/EmptyState';
import { YearFilter } from '../memories/YearFilter';
import { useHighlightViewer } from '../memories/useHighlightViewer';
import {
  asRecord,
  asRows,
  asText,
  normalizeHighlight,
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
  /** Albums `story_highlights` uniquement — jamais le flux général. */
  highlights?: unknown;
  /**
   * Volontairement ignoré : la lentille Souvenirs ne liste QUE les albums
   * `story_highlights`. Le flux général des stories n'entre jamais ici.
   */
  stories?: unknown;
  /** Override hôte/tests de la visionneuse À la une. */
  onOpenHighlight?: (highlight: HighlightCardData) => void;
  [key: string]: unknown;
}

/**
 * Slot Souvenirs — Timeline, Passeport et albums À la une. Les données viennent
 * exclusivement du payload du bootstrap (ou des fixtures directes de test) ;
 * aucun mock, aucune valeur inventée. La lentille Souvenirs ne lit jamais
 * `payload.stories` : seuls les albums `story_highlights` sont listés.
 */
export function MemoriesSlot({
  lens,
  payload,
  outings: outingsProp,
  stamps: stampsProp,
  highlights: highlightsProp,
  onOpenHighlight,
}: MemoriesSlotProps) {
  const activeLens: MemoriesLens = lens === 'passport' || lens === 'souvenirs' ? lens : 'timeline';
  const source = asRecord(payload);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const { slides, openingId, error, open, close } = useHighlightViewer({ onOpenHighlight });

  const outings = asRows(source.outings ?? outingsProp)
    .map(normalizeOuting)
    .filter((outing): outing is OutingCardData => outing !== null)
    .sort((a, b) => timeValue(b) - timeValue(a) || a.title.localeCompare(b.title));
  const stamps = asRows(source.stamps ?? stampsProp)
    .map(normalizeStamp)
    .filter((stamp) => stamp !== null);
  // Seule source de la lentille Souvenirs : payload.highlights (albums
  // story_highlights + story_highlight_items). `payload.stories` n'est jamais lu.
  const highlights = asRows(source.highlights ?? highlightsProp)
    .map(normalizeHighlight)
    .filter((highlight): highlight is HighlightCardData => highlight !== null)
    .sort((a, b) => a.position - b.position);

  const profile = asRecord(source.profile);
  // Pas de nom fabriqué : le nom réel du payload, sinon rien.
  const ownerName = asText(profile.name) || asText(profile.handle);
  const ownerAvatar = asText(profile.avatarUrl) || undefined;

  const years = [...new Set(outings.map((outing) => outing.year))]
    .filter((year): year is number => year !== null)
    .sort((a, b) => b - a);
  const activeYear = selectedYear !== 'all' && years.includes(selectedYear) ? selectedYear : 'all';
  const visibleOutings =
    activeYear === 'all' ? outings : outings.filter((outing) => outing.year === activeYear);

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
        ? highlights.length === 0
        : outings.length === 0;
  const emptyLabel =
    activeLens === 'passport'
      ? 'Aucun lieu validé.'
      : activeLens === 'souvenirs'
        ? 'Aucune story à la une.'
        : 'Aucune sortie enregistrée.';

  const openHighlight = useCallback(
    (highlight: HighlightCardData, trigger: HTMLButtonElement) => {
      triggerRef.current = trigger;
      void open(highlight);
    },
    [open]
  );

  const closeViewer = useCallback(() => {
    close();
    // Restaure le focus sur la carte qui a ouvert la visionneuse.
    triggerRef.current?.focus();
  }, [close]);

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
  } else if (!empty && activeLens === 'souvenirs') {
    content = (
      <div className="space-y-2">
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[length:var(--lkv-text-caption-2,12px)] text-[color:var(--label2)]"
          >
            {error}
          </p>
        ) : null}
        <ul aria-label="Stories à la une" className="space-y-2">
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              opening={openingId === highlight.id}
              onClick={(trigger) => openHighlight(highlight, trigger)}
            />
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
      className={empty ? 'lkdv-slot-state' : 'flex flex-col gap-3'}
      data-state={empty ? 'empty' : 'ready'}
      data-testid="slot-content"
      data-slot="souvenirs"
      data-lens={activeLens}
    >
      {empty ? <EmptyState label={emptyLabel} /> : content}
      {slides ? (
        <StoriesViewer
          users={[
            {
              id: 'souvenirs-highlight',
              name: ownerName,
              avatarUrl: ownerAvatar,
              slides,
            },
          ]}
          startUser={0}
          onClose={closeViewer}
        />
      ) : null}
    </div>
  );
}

export default MemoriesSlot;
