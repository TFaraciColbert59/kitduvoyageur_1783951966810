'use client';

import React from 'react';

export interface BadgeItem {
  id: string;
  name: string;
  rarity?: string;
  earned: boolean;
  earnedAt?: string;
  requirementValue?: number;
  points?: number;
  /** Progression 0..1 quand une source la fournit ; jamais inventée. */
  progress?: number;
  /** Valeur courante quand une source la fournit ; jamais inventée. */
  currentValue?: number;
}

export type BadgeVariant = 'shelf' | 'grid' | 'next';

export interface BadgeTileProps {
  badge: BadgeItem;
  variant?: BadgeVariant;
  /** Masque le nom quand la carte parente l'affiche déjà (prochain badge). */
  showName?: boolean;
}

function rarityKey(rarity?: string): string {
  return (rarity || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatEarnedAt(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' as const } : {}),
  }).format(date);
}

const MEDAL_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="9" r="5.2" />
    <path d="m8.6 13.2-2.1 7.3 5.5-2.9 5.5 2.9-2.1-7.3" />
  </svg>
);

/**
 * Tuile de trophée : anneau de rareté (token du runtime), nom, rareté et date
 * d'obtention. L'état verrouillé reste lisible et annoncé aux lecteurs
 * d'écran ; aucune progression n'est calculée ici.
 */
export function BadgeTile({ badge, variant = 'shelf', showName = true }: BadgeTileProps) {
  const rarity = badge.rarity?.trim() || '';
  const earnedAt = badge.earned ? formatEarnedAt(badge.earnedAt) : '';
  const stateLabel = badge.earned ? 'obtenu' : 'à débloquer';
  const label = [badge.name, rarity, stateLabel].filter(Boolean).join(', ');

  return (
    <div
      className={`lkdv-badge lkdv-badge-${variant}`}
      data-testid="badge-tile"
      data-earned={badge.earned ? 'true' : 'false'}
      data-rarity={rarityKey(rarity)}
      data-variant={variant}
      aria-label={label}
      title={label}
    >
      <span className="lkdv-badge-medal" aria-hidden="true">
        {MEDAL_ICON}
      </span>
      {showName ? <b className="lkdv-badge-name">{badge.name}</b> : null}
      {rarity ? <span className="lkdv-badge-rarity">{rarity}</span> : null}
      {earnedAt ? <small className="lkdv-badge-date">{earnedAt}</small> : null}
      {badge.earned ? null : <span className="lkdv-badge-lock">À débloquer</span>}
    </div>
  );
}

export default BadgeTile;
