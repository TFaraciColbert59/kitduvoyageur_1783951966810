'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { FieldSource } from '../domain/memberProfile';
import type { TripMemberProfile } from '../types/trip.types';

/**
 * Task 19 — Transparence des données de préparation.
 *
 * `MemberProfileBadges` rend la provenance de chaque champ dérivé (Appris /
 * Estimé / Moyenne) en pastilles `glass-pill` compactes, sans couleur hors
 * tokens. `PartyPreparationBanner` signale discrètement que la préparation a
 * été recalculée pour N et qu'elle repose sur les profils, avec un retour
 * haptique léger à l'affichage.
 */

export const FIELD_SOURCE_LABELS: Record<FieldSource, string> = {
  learned: 'Appris',
  estimated: 'Estimé',
  average: 'Moyenne',
};

export const MEMBER_FIELD_LABELS: Record<string, string> = {
  flatSpeedKmH: 'Allure',
  ascentSpeedMPerHour: 'Montée',
  descentSpeedMPerHour: 'Descente',
  packWeightKg: 'Portage',
  maxCarryKg: 'Capacité',
  experienceLevel: 'Expérience',
  limitations: 'Limites',
  isChild: 'Enfant',
};

const SOURCE_TONES: Record<FieldSource, string> = {
  learned: 'text-[var(--lkv-success)]',
  estimated: 'text-[var(--lkv-secondary)]',
  average: 'text-[var(--lkv-text-muted)]',
};

export interface MemberProfileBadgesProps {
  /** Ligne `trip_member_profiles` (prioritaire) ou `sources` brut. */
  profile?: TripMemberProfile | null;
  sources?: Record<string, FieldSource> | null;
  /** Nombre maximal de champs affichés (défaut 8 : exhaustif). */
  maxFields?: number;
  className?: string;
}

export function MemberProfileBadges({
  profile,
  sources,
  maxFields = 8,
  className,
}: MemberProfileBadgesProps) {
  const resolved = sources ?? profile?.sources ?? null;
  if (!resolved) return null;

  const entries = Object.entries(resolved)
    .filter(([field, source]) => field in MEMBER_FIELD_LABELS && source in FIELD_SOURCE_LABELS)
    .slice(0, Math.max(0, maxFields));
  if (entries.length === 0) return null;

  return (
    <ul
      data-member-badges=""
      aria-label="Provenance des données de préparation"
      className={cn('flex flex-wrap gap-1', className)}
    >
      {entries.map(([field, source]) => (
        <li key={field}>
          <span
            className={cn(
              'glass-pill shrink-0 !px-1.5 !py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]',
              SOURCE_TONES[source]
            )}
          >
            {MEMBER_FIELD_LABELS[field]} · {FIELD_SOURCE_LABELS[source]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface PartyPreparationBannerProps {
  partySize?: number | null;
  className?: string;
}

/** Bandeau discret « Préparation recalculée pour N — basée sur les profils ». */
export function PartyPreparationBanner({ partySize, className }: PartyPreparationBannerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const size =
    typeof partySize === 'number' && Number.isFinite(partySize) ? Math.trunc(partySize) : 0;

  useEffect(() => {
    if (size > 1) triggerHaptic('light');
  }, [size, triggerHaptic]);

  if (size <= 1) return null;

  return (
    <p
      data-party-banner=""
      role="status"
      className={cn(
        'glass rounded-2xl px-3 py-2 text-[11px] font-medium text-[var(--lkv-text-primary)]/75',
        className
      )}
    >
      Préparation recalculée pour {size} — basée sur les profils.
    </p>
  );
}

export default MemberProfileBadges;
