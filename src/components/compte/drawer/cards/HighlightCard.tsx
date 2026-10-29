'use client';

import React from 'react';

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
 * Carte album du slot Souvenirs — couverture pleine, titre sur verre. La couverture est la story
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
          className="relative block aspect-[4/5] w-full overflow-hidden rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--lkv-surface-muted,rgba(236,244,233,.9))] text-left transition-transform active:scale-[.98] motion-reduce:transition-none disabled:opacity-70"
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- couverture servie par la route média contrôlée
            <img
              src={cover}
              alt={`Couverture de ${highlight.title}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-8 w-8 text-[color:var(--lkv-primary)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <circle cx="8.5" cy="10" r="1.5" />
                <path d="m4 17 5-4.5 3.5 3 3-2.5L20 17" strokeLinejoin="round" />
              </svg>
            </span>
          )}

          {/* Titre sur verre : la couverture reste visible en entier. */}
          <span className="absolute inset-x-1.5 bottom-1.5 block rounded-[var(--lkv-radius-sm)] border border-white/60 bg-white/60 px-2.5 py-1.5 backdrop-blur-[14px] backdrop-saturate-150">
            <span className="block truncate text-[13px] font-semibold leading-tight text-[color:var(--label)]">
              {highlight.title}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] text-[color:var(--label2)]">
              {opening ? 'Ouverture…' : itemCountLabel(highlight.items)}
            </span>
          </span>
        </button>
      </h4>
    </li>
  );
}

export default HighlightCard;
