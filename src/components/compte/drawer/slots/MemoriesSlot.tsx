'use client';

import React, { useState } from 'react';
import { OutingCard, type OutingCardData } from '../cards/OutingCard';
import { StampTile, type StampTileData } from '../cards/StampTile';
import { HighlightCard, type HighlightCardData } from '../cards/HighlightCard';
import StoriesViewer, { type StorySlide } from '@/components/communaute/StoriesViewer';
import { createClient } from '@/lib/supabase/client';
import { storyMediaUrl } from '@/lib/stories/media';

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
  /** Injection de la visionneuse (tests / hôte) ; sinon on ouvre l'existante. */
  onOpenHighlight?: (highlight: HighlightCardData) => void;
  [key: string]: unknown;
}

const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((photo): photo is string => typeof photo === 'string' && photo.length > 0);
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function startedAtParts(startedAt: string): {
  year: number | null;
  monthLabel: string;
  dateLabel: string;
} {
  if (!startedAt) return { year: null, monthLabel: 'Sans date', dateLabel: '' };
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    return { year: null, monthLabel: 'Sans date', dateLabel: '' };
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    year,
    monthLabel: `${MONTHS_LONG[month]} ${year}`,
    dateLabel: `${date.getUTCDate()} ${MONTHS_SHORT[month]}`,
  };
}

function normalizeOuting(value: unknown, index: number): OutingCardData | null {
  const row = asRecord(value);
  const title = asText(row.title);
  // Aucun titre inventé : une ligne sans titre réel n'est pas affichée.
  if (!title) return null;

  const startedAt = asText(row.startedAt) || asText(row.started_at);
  const parts = startedAtParts(startedAt);

  return {
    id: asText(row.id) || `outing_${index}`,
    title,
    mass: asText(row.mass) || asText(row.region),
    date: asText(row.date) || parts.dateLabel,
    startedAt,
    km: asNumber(row.km ?? row.distance_km),
    dplus: asNumber(row.dplus ?? row.elevation_gain_m),
    proven: row.proven === true,
    photos: asPhotos(row.photos),
    status: asText(row.status),
    year: parts.year,
    monthLabel: parts.monthLabel,
  };
}

function normalizeStamp(value: unknown, index: number): StampTileData | null {
  const row = asRecord(value);
  const name = asText(row.name);
  // Aucun lieu inventé : seul un massif réellement nommé devient un tampon.
  if (!name) return null;

  return {
    id: asText(row.id) || `stamp_${index}`,
    name,
    kind: asText(row.kind) || 'massif',
    outings: Math.max(0, Math.round(asNumber(row.outings))),
    verified: row.verified === true,
  };
}

function normalizeHighlight(value: unknown, index: number): HighlightCardData | null {
  const row = asRecord(value);
  const title = asText(row.title);
  // Aucun album inventé : un titre réel est requis.
  if (!title) return null;

  return {
    id: asText(row.id) || `highlight_${index}`,
    title,
    items: Math.max(0, Math.round(asNumber(row.items))),
    coverStoryId: asText(row.coverStoryId) || asText(row.cover_story_id) || null,
    cover: asText(row.cover),
    position: asNumber(row.position),
  };
}

function timeValue(outing: OutingCardData): number {
  const value = Date.parse(outing.startedAt);
  return Number.isNaN(value) ? 0 : value;
}

function placeLabel(count: number): string {
  return `${count} lieu${count > 1 ? 'x' : ''} visité${count > 1 ? 's' : ''}`;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="lkdv-slot-state" data-state="empty">
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>{label}</p>
    </div>
  );
}

function YearFilter({
  years,
  active,
  onChange,
}: {
  years: number[];
  active: number | 'all';
  onChange: (year: number | 'all') => void;
}) {
  if (years.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Filtrer par année"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      <button
        type="button"
        aria-pressed={active === 'all'}
        onClick={() => onChange('all')}
        className={`h-11 shrink-0 rounded-full border px-4 text-[length:var(--lkv-text-caption-2,12px)] font-semibold transition-colors motion-reduce:transition-none ${
          active === 'all'
            ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-white'
            : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label2)]'
        }`}
      >
        Toutes
      </button>
      {years.map((year) => (
        <button
          key={year}
          type="button"
          aria-pressed={active === year}
          onClick={() => onChange(year)}
          className={`h-11 shrink-0 rounded-full border px-4 font-mono text-[length:var(--lkv-text-caption-2,12px)] font-semibold transition-colors motion-reduce:transition-none ${
            active === year
              ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-white'
              : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label2)]'
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

/**
 * Slot Souvenirs — Timeline et Passeport (tâche 9), complété par les stories
 * À la une uniquement (tâche 10). Toutes les données viennent du payload du
 * bootstrap ; aucun mock, aucun repli inventé. Un payload vide reste un état
 * vide explicite.
 */
export function MemoriesSlot({
  lens,
  payload,
  outings: outingsProp,
  stamps: stampsProp,
  highlights: highlightsProp,
  onOpenHighlight,
}: MemoriesSlotProps) {
  const activeLens: MemoriesLens =
    lens === 'passport' || lens === 'souvenirs' ? lens : 'timeline';
  const source = asRecord(payload);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [openingHighlightId, setOpeningHighlightId] = useState<string | null>(null);
  const [viewerSlides, setViewerSlides] = useState<StorySlide[] | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const outings = asRows(source.outings ?? outingsProp)
    .map(normalizeOuting)
    .filter((outing): outing is OutingCardData => outing !== null)
    .sort((a, b) => timeValue(b) - timeValue(a) || a.title.localeCompare(b.title));
  const stamps = asRows(source.stamps ?? stampsProp)
    .map(normalizeStamp)
    .filter((stamp): stamp is StampTileData => stamp !== null);
  // Seule source de la lentille Souvenirs : payload.highlights (albums
  // story_highlights + story_highlight_items). `payload.stories` n'est jamais lu.
  const highlights = asRows(source.highlights ?? highlightsProp)
    .map(normalizeHighlight)
    .filter((highlight): highlight is HighlightCardData => highlight !== null)
    .sort((a, b) => a.position - b.position);

  const profile = asRecord(source.profile);
  const ownerName = asText(profile.name) || asText(profile.handle) || 'À la une';
  const ownerAvatar = asText(profile.avatarUrl) || undefined;

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

  /**
   * Ouvre la visionneuse À la une existante. Les slides sont chargées à la
   * demande depuis les seules stories épinglées dans CET album
   * (`story_highlight_items`), jamais depuis le flux général. RLS
   * `can_view_story` filtre ce que la personne n'a pas le droit de voir.
   */
  const openHighlight = async (highlight: HighlightCardData) => {
    if (onOpenHighlight) {
      onOpenHighlight(highlight);
      return;
    }

    setViewerError(null);
    setOpeningHighlightId(highlight.id);
    try {
      const supabase = createClient();
      const { data: links, error: linksError } = await supabase
        .from('story_highlight_items')
        .select('story_id,position')
        .eq('highlight_id', highlight.id)
        .order('position', { ascending: true });
      if (linksError) throw new Error(linksError.message);

      const storyIds = (links ?? [])
        .map((link) => asText(asRecord(link).story_id))
        .filter((id): id is string => id.length > 0);

      if (storyIds.length === 0) {
        setViewerError('Aucune story dans cet album.');
        return;
      }

      const { data: rows, error: storiesError } = await supabase
        .from('post_stories')
        .select('id,image_url,storage_path,media_type,caption')
        .in('id', storyIds);
      if (storiesError) throw new Error(storiesError.message);

      const rowById = new Map<string, Record<string, unknown>>();
      for (const row of rows ?? []) {
        const record = asRecord(row);
        const id = asText(record.id);
        if (id) rowById.set(id, record);
      }

      const slides: StorySlide[] = [];
      for (const storyId of storyIds) {
        const row = rowById.get(storyId);
        if (!row) continue;
        const media = storyMediaUrl({
          id: storyId,
          image_url: asText(row.image_url) || null,
          storage_path: asText(row.storage_path) || undefined,
        });
        if (!media) continue;
        slides.push({
          image: media,
          caption: asText(row.caption) || undefined,
          storyId,
          mediaType: row.media_type === 'video' ? 'video' : 'image',
        });
      }

      if (slides.length === 0) {
        setViewerError('Aucune story visible dans cet album.');
        return;
      }
      setViewerSlides(slides);
    } catch {
      setViewerError('La visionneuse À la une n’a pas pu s’ouvrir.');
    } finally {
      setOpeningHighlightId(null);
    }
  };

  let content: React.ReactNode;

  if (activeLens === 'passport') {
    content =
      stamps.length === 0 ? (
        <EmptyState label="Aucun lieu validé." />
      ) : (
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
  } else if (activeLens === 'souvenirs') {
    content =
      highlights.length === 0 ? (
        <EmptyState label="Aucune story à la une." />
      ) : (
        <div className="space-y-2">
          {viewerError ? (
            <p
              role="alert"
              className="rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2 text-[length:var(--lkv-text-caption-2,12px)] text-[color:var(--label2)]"
            >
              {viewerError}
            </p>
          ) : null}
          <ul aria-label="Stories à la une" className="space-y-2">
            {highlights.map((highlight) => (
              <HighlightCard
                key={highlight.id}
                highlight={highlight}
                opening={openingHighlightId === highlight.id}
                onClick={() => {
                  void openHighlight(highlight);
                }}
              />
            ))}
          </ul>
        </div>
      );
  } else if (outings.length === 0) {
    content = <EmptyState label="Aucune sortie enregistrée." />;
  } else {
    content = (
      <div className="space-y-3">
        <YearFilter years={years} active={activeYear} onChange={setSelectedYear} />
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
      data-testid="slot-content"
      data-slot="souvenirs"
      data-lens={activeLens}
      className="flex flex-col gap-3"
    >
      {content}
      {viewerSlides ? (
        <StoriesViewer
          users={[
            {
              id: 'souvenirs-highlight',
              name: ownerName,
              avatarUrl: ownerAvatar,
              slides: viewerSlides,
            },
          ]}
          startUser={0}
          onClose={() => setViewerSlides(null)}
        />
      ) : null}
    </div>
  );
}

export default MemoriesSlot;
