'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/** Un album « À la une » normalisé depuis `story_highlights`. */
export interface HighlightCardData {
  id: string;
  title: string;
  items: number;
  coverStoryId: string | null;
  /** Repli direct pour les fixtures historiques ; le contrat est coverStoryId. */
  cover: string;
  position: number;
}

function itemCountLabel(count: number): string {
  return `${count} élément${count > 1 ? 's' : ''}`;
}

export function highlightCoverUrl(highlight: HighlightCardData): string | null {
  if (highlight.coverStoryId) {
    return `/api/stories/${encodeURIComponent(highlight.coverStoryId)}/media`;
  }
  return highlight.cover || null;
}

/**
 * Carte album du slot Souvenirs — 96 px. La couverture est la story
 * `cover_story_id` de l'album, résolue par la route média contrôlée
 * `/api/stories/:id/media` ; aucune autre story n'est affichée ici.
 */
export function HighlightCard({
  highlight,
  opening = false,
  onClick,
}: {
  highlight: HighlightCardData;
  opening?: boolean;
  onClick: (trigger: HTMLButtonElement) => void;
}) {
  const cover = highlightCoverUrl(highlight);

  return (
    <li data-testid="highlight-card">
      <h4 className="m-0">
        <button
          type="button"
          onClick={(event) => onClick(event.currentTarget)}
          disabled={opening}
          aria-busy={opening || undefined}
          aria-label={`Ouvrir l’album ${highlight.title}`}
          className="flex h-24 min-h-[96px] w-full items-center gap-3 overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-2.5 text-left backdrop-blur-[var(--blur-md)] transition-colors motion-reduce:transition-none disabled:opacity-70"
        >
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lkv-radius-sm)] border border-[color:var(--glass-border)] bg-[color:var(--lkv-surface-muted,rgba(236,244,233,.9))]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- couverture servie par la route média contrôlée
              <img
                src={cover}
                alt={`Couverture de ${highlight.title}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <LKDVIcon name="photo" size={28} className="h-7 w-7 text-[color:var(--lkv-primary)]" aria-hidden="true" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[length:var(--lkv-text-subheadline,15px)] font-semibold leading-tight text-[color:var(--label)]">
              {highlight.title}
            </span>
            <span className="mt-1 block font-mono text-[length:var(--lkv-text-caption-2,11px)] text-[color:var(--label2)]">
              {opening ? 'Ouverture…' : itemCountLabel(highlight.items)}
            </span>
          </span>

          <span aria-hidden="true" className="shrink-0 text-lg text-[color:var(--label2)]">
            ›
          </span>
        </button>
      </h4>
    </li>
  );
}

export default HighlightCard;
