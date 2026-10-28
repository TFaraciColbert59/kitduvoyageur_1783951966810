'use client';

import React from 'react';
import Link from 'next/link';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull } from '../../types/trip.types';
import type { TripSectionId } from '../../engine/tripProfileEngine';
import { tripSectionHref } from '../../registry/tripSectionRegistry';

export interface PrimaryActionWidgetProps {
  trip: TripFull;
  /** Section active du hub (le CTA dépend de la section). */
  activeSection: TripSectionId;
}

interface Action {
  label: string;
  section: TripSectionId;
}

/** CTA de la section active — §Y_HUB_SPEC §3 (primary-action, priorité 95). */
const ACTIONS: Partial<Record<TripSectionId, Action>> = {
  overview: { label: 'Voir le planificateur', section: 'itinerary' },
  itinerary: { label: 'Ouvrir le planificateur', section: 'itinerary' },
  gear: { label: 'Composer mon sac', section: 'gear' },
  team: { label: 'Gérer le groupe', section: 'team' },
  budget: { label: 'Gérer le budget', section: 'budget' },
  docs: { label: 'Gérer les documents', section: 'docs' },
  checklist: { label: 'Préparer le départ', section: 'checklist' },
  safety: { label: 'Voir la sécurité', section: 'safety' },
  journal: { label: 'Écrire au journal', section: 'journal' },
  export: { label: 'Exporter la feuille de route', section: 'export' },
};

/**
 * Widget `primary-action` — action principale de la section active. §Y_HUB_SPEC §3.
 */
export function PrimaryActionWidget({ trip, activeSection }: PrimaryActionWidgetProps) {
  const { haptic } = useHapticFeedback();
  const action = ACTIONS[activeSection] ?? ACTIONS.overview!;

  return (
    <Link
      href={tripSectionHref(trip.slug, action.section)}
      onClick={() => haptic('light')}
      className="flex min-h-[44px] w-full items-center justify-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn py-[var(--space-3)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] transition-colors hover:brightness-[1.05]"
    >
      <span>{action.label}</span>
    </Link>
  );
}

export default PrimaryActionWidget;
