import type { TripFull } from '../types/trip.types';

/**
 * Y1.2 — Moteur de profil de voyage (chantier Y).
 *
 * Fonction PURE : zéro import React, aucun accès window, aucune lecture de
 * l'horloge système — `now` est INJECTÉ (déterminisme des tests et captures).
 * Source de vérité : docs/Y_HUB_SPEC.md §2-§4 et unification.md §2.3.
 *
 * Le champ `reason` trace la décision (présence OU absence) de chaque section.
 * Les permissions ne filtrent PAS ici : elles filtrent à l'affichage (Y2.3).
 */

// ── Types (miroir dans trip.types.ts) ───────────────────────────────────────

export type TripScale = 'day' | 'short' | 'long' | 'expedition';
export type TripParty = 'solo' | 'duo' | 'group';
export type TripAutonomy = 'serviced' | 'semi' | 'autonomous';

export type TripSectionId =
  | 'overview'
  | 'itinerary'
  | 'gear'
  | 'team'
  | 'budget'
  | 'docs'
  | 'checklist'
  | 'safety'
  | 'journal'
  | 'export';

export type TripWidgetId =
  | 'countdown'
  | 'primary-action'
  | 'alerts'
  | 'next-step'
  | 'safety-next'
  | 'kit-balance'
  | 'budget-burn'
  | 'group-presence'
  | 'trip-context'
  | 'country-card'
  | 'docs-expiry'
  | 'offline-toggle';

export interface TripProfile {
  scale: TripScale; // day ≤1j | short 2-4j | long 5-14j | expedition >14j
  party: TripParty; // solo | duo (2 participants) | group (≥3)
  autonomy: TripAutonomy; // dérivé de primary_activity + difficulty
  activity: TripFull['primary_activity'];
  hasDates: boolean;
  hasBudget: boolean;
  isCollaborative: boolean; // group_id != null || collaborators.length > 0
  sections: TripSectionId[];
  widgets: TripWidgetId[];
  density: 'compact' | 'comfortable';
  reason: Record<TripSectionId, string>;
}

// ── Ordre canonique (registre §Y_HUB_SPEC §2) ───────────────────────────────

export const TRIP_SECTION_ORDER: TripSectionId[] = [
  'overview',
  'itinerary',
  'gear',
  'team',
  'budget',
  'docs',
  'checklist',
  'safety',
  'journal',
  'export',
];

// ── Aides purs ──────────────────────────────────────────────────────────────

/** Durée civile inclusive en jours, ou null si dates absentes/invalides. */
function civilDays(
  start?: string | null,
  end?: string | null
): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function scaleFromDays(days: number | null): TripScale {
  if (days === null) return 'short'; // défaut prudent sans dates valides
  if (days <= 1) return 'day';
  if (days <= 4) return 'short';
  if (days <= 14) return 'long';
  return 'expedition';
}

function autonomyFrom(activity: string, difficulty: string): TripAutonomy {
  if (activity === 'cultural' || difficulty === 'easy') return 'serviced';
  if (
    activity === 'bivouac' ||
    activity === 'bushcraft' ||
    difficulty === 'hard' ||
    difficulty === 'expert'
  ) {
    return 'autonomous';
  }
  return 'semi';
}

// ── Matrice profil → sections (§Y_HUB_SPEC §4) ─────────────────────────────

const MATRIX_LONG: Record<'solo' | 'group', TripSectionId[]> = {
  solo: ['overview', 'itinerary', 'gear', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export'],
  group: ['overview', 'itinerary', 'gear', 'team', 'budget', 'docs', 'checklist', 'safety', 'journal', 'export'],
};

const MATRIX: Record<TripScale, Record<'solo' | 'group', TripSectionId[]>> = {
  day: {
    solo: ['overview', 'itinerary', 'gear', 'safety'],
    group: ['overview', 'itinerary', 'gear', 'team', 'checklist', 'safety', 'export'],
  },
  short: {
    solo: ['overview', 'itinerary', 'gear', 'checklist', 'safety', 'export'],
    group: ['overview', 'itinerary', 'gear', 'team', 'budget', 'checklist', 'safety', 'export'],
  },
  long: MATRIX_LONG,
  expedition: MATRIX_LONG,
};

const SECTION_LABELS: Record<TripSectionId, string> = {
  overview: 'Aperçu',
  itinerary: 'Itinéraire',
  gear: 'Équipement',
  team: 'Équipage',
  budget: 'Budget',
  docs: 'Documents',
  checklist: 'Checklist départ',
  safety: 'Sécurité',
  journal: 'Journal',
  export: 'Export',
};

// ── Widgets (priorités §Y_HUB_SPEC §3) ──────────────────────────────────────

interface WidgetDef {
  id: TripWidgetId;
  priority: number;
  included: (ctx: ProfileContext) => boolean;
  motive: string;
}

interface ProfileContext {
  scale: TripScale;
  party: TripParty;
  autonomy: TripAutonomy;
  activity: string;
  hasDates: boolean;
  hasBudget: boolean;
  cancelled: boolean;
  stepsCount: number;
  itemsCount: number;
  docsCount: number;
  hasCountry: boolean;
}

const WIDGETS: WidgetDef[] = [
  { id: 'countdown', priority: 100, included: (c) => c.hasDates, motive: 'dates définies' },
  { id: 'primary-action', priority: 95, included: () => true, motive: 'toujours' },
  { id: 'alerts', priority: 90, included: () => true, motive: 'toujours' },
  { id: 'next-step', priority: 85, included: (c) => c.stepsCount > 0, motive: 'étapes présentes' },
  { id: 'safety-next', priority: 84, included: (c) => c.autonomy !== 'serviced', motive: 'autonomie ≠ serviced' },
  { id: 'kit-balance', priority: 80, included: (c) => c.itemsCount > 0, motive: 'objets présents' },
  { id: 'budget-burn', priority: 75, included: (c) => c.hasBudget, motive: 'budget défini' },
  { id: 'group-presence', priority: 70, included: (c) => c.party !== 'solo', motive: 'équipage présent' },
  { id: 'trip-context', priority: 65, included: (c) => c.scale !== 'day' && c.activity !== 'cultural', motive: 'échelle ≠ day et activité ≠ cultural' },
  { id: 'country-card', priority: 60, included: (c) => c.hasCountry, motive: 'code pays défini' },
  { id: 'docs-expiry', priority: 58, included: (c) => c.docsCount > 0, motive: 'documents présents' },
  { id: 'offline-toggle', priority: 20, included: () => true, motive: 'toujours' },
];

// ── Moteur ──────────────────────────────────────────────────────────────────

export function deriveTripProfile(trip: TripFull, now: Date): TripProfile {
  const days = civilDays(trip.start_date, trip.end_date);
  const scale = scaleFromDays(days);
  const collaboratorsCount = trip.collaborators?.length ?? 0;
  const party: TripParty =
    collaboratorsCount === 0 ? 'solo' : collaboratorsCount === 1 ? 'duo' : 'group';
  const activity = (trip.primary_activity ?? 'hiking') as string;
  const difficulty = (trip.difficulty ?? 'moderate') as string;
  const autonomy = autonomyFrom(activity, difficulty);
  const hasDates = days !== null;
  const hasBudget = trip.estimated_budget != null && Number(trip.estimated_budget) > 0;
  const isCollaborative = trip.group_id != null || collaboratorsCount > 0;
  const cancelled = trip.status === 'cancelled';

  // Sections : matrice + modulations d'activité, en ordre de registre.
  // (la matrice n'a que les colonnes solo/group ; duo suit la colonne group —
  // deux participants planifient ensemble.)
  let sections: TripSectionId[] = cancelled
    ? ['overview']
    : [...MATRIX[scale][party === 'solo' ? 'solo' : 'group']];

  if (!cancelled && activity === 'roadtrip' && !sections.includes('budget')) {
    sections.push('budget'); // carburant, péages — arbitrage §4.4
    sections = TRIP_SECTION_ORDER.filter((id) => sections.includes(id));
  }

  const includedSet = new Set<TripSectionId>(sections);

  const reason = {} as Record<TripSectionId, string>;
  for (const id of TRIP_SECTION_ORDER) {
    if (cancelled && id !== 'overview') {
      reason[id] = 'masqué : voyage annulé (aperçu seul)';
      continue;
    }
    if (includedSet.has(id)) {
      reason[id] = `affiché : matrice ${scale}/${party}${activity === 'roadtrip' && id === 'budget' ? ' + modulation roadtrip (carburant, péages)' : ''}`;
    } else {
      const reasons: Partial<Record<TripSectionId, string>> = {
        team: `masqué : ${collaboratorsCount} collaborateur(s) (solo)`,
        budget: `masqué : échelle ${scale} en solo${hasBudget ? '' : ' et sans budget défini'}`,
        docs: `masqué : échelle ${scale} en solo`,
        checklist: 'masqué : escalade tardive inutile pour ce profil',
        journal: `masqué : échelle ${scale} (< 5 jours)`,
        export: 'masqué : export non pertinent pour ce profil court',
      };
      reason[id] = reasons[id] ?? 'masqué : profil';
    }
  }

  // Widgets
  const ctx: ProfileContext = {
    scale,
    party,
    autonomy,
    activity,
    hasDates,
    hasBudget,
    cancelled,
    stepsCount: trip.steps?.length ?? 0,
    itemsCount: trip.items?.length ?? 0,
    docsCount: trip.documents?.length ?? 0,
    hasCountry: Boolean(trip.destination_country_code),
  };
  const widgets = cancelled
    ? []
    : WIDGETS.filter((w) => w.included(ctx))
        .sort((a, b) => b.priority - a.priority)
        .map((w) => w.id);

  return {
    scale,
    party,
    autonomy,
    activity: trip.primary_activity,
    hasDates,
    hasBudget,
    isCollaborative,
    sections,
    widgets,
    density: scale === 'day' ? 'compact' : 'comfortable',
    reason,
  };
}

export { SECTION_LABELS as tripSectionLabels };
