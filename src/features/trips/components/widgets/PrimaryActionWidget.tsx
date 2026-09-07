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
  emoji: string;
}

/** CTA de la section active — §Y_HUB_SPEC §3 (primary-action, priorité 95). */
const ACTIONS: Partial<Record<TripSectionId, Action>> = {
  overview: { label: 'Voir le planificateur', section: 'itinerary', emoji: '🗺️' },
  itinerary: { label: 'Ouvrir le planificateur', section: 'itinerary', emoji: '🗺️' },
  gear: { label: 'Composer mon sac', section: 'gear', emoji: '🎒' },
  team: { label: 'Gérer l’équipage', section: 'team', emoji: '👥' },
  budget: { label: 'Gérer le budget', section: 'budget', emoji: '💶' },
  docs: { label: 'Gérer les documents', section: 'docs', emoji: '🗂️' },
  checklist: { label: 'Préparer le départ', section: 'checklist', emoji: '✅' },
  safety: { label: 'Voir la sécurité', section: 'safety', emoji: '🛟' },
  journal: { label: 'Écrire au journal', section: 'journal', emoji: '📖' },
  export: { label: 'Exporter la feuille de route', section: 'export', emoji: '🖨️' },
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
      className="glass-capsule-btn primary w-full !py-3 min-h-[44px] justify-center flex items-center gap-2 text-xs font-bold"
    >
      <span aria-hidden="true">{action.emoji}</span>
      <span>{action.label}</span>
    </Link>
  );
}

export default PrimaryActionWidget;
