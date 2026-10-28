
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripPermissions } from '../types/trip.types';
import {
  TRIP_SECTION_ORDER,
  type TripProfile,
  type TripSectionId,
} from '../engine/tripProfileEngine';
import type { TripFull } from '../types/trip.types';
import { hubSectionRegistry, hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import type { HubSectionId } from '@/features/hub/engine/hubProfileEngine';
import { lkdvIcon, type LKDVIconComponent } from '@/components/ui/lkdvIconComponent';

/**
 * Y1.3 — Registre des sections du hub voyage (source unique de la navigation).
 * La sidebar, le fil d'Ariane, le sélecteur mobile et les tests lisent TOUS
 * ce registre.
 *
 * Étape 2 — Hub unique : les sections sortie vivent DANS /hub. `tripSectionHref`
 * délègue au registre du hub (mêmes identifiants de section) — les anciennes
 * URLs /voyages/* sont des shims de redirection, plus des destinations.
 */

export interface TripSectionDef {
  id: TripSectionId;
  label: string;
  /** Segment d'URL sous /voyages/[slug] — '' pour la racine (overview). */
  segment: string;
  icon: LKDVIconComponent;
  phases: TripPhase[];
  /** Permission requise (aucune si undefined) — vérifiée à l'affichage ET côté serveur. */
  permission?: keyof TripPermissions;
  /** Compteur affiché dans la navigation (null = pas de compteur). */
  counter: (trip: TripFull) => number | null;
}

export const tripSectionRegistry: readonly TripSectionDef[] = [
  {
    id: 'overview',
    label: 'Aperçu',
    segment: '',
    icon: lkdvIcon('boussole'),
    phases: ['prepare', 'live', 'recount'],
    counter: () => null,
  },
  {
    id: 'itinerary',
    label: 'Itinéraire',
    segment: 'itineraire',
    icon: lkdvIcon('gps'),
    phases: ['prepare', 'live'],
    counter: (trip) => trip.steps?.length ?? 0,
  },
  {
    id: 'gear',
    label: 'Équipement',
    segment: 'kit',
    icon: lkdvIcon('inventaire'),
    phases: ['prepare'],
    counter: (trip) => trip.items?.length ?? 0,
  },
  {
    id: 'team',
    label: 'Équipage',
    segment: 'equipage',
    icon: lkdvIcon('communaute'),
    phases: ['prepare', 'live'],
    counter: (trip) => (trip.collaborators?.length ?? 0) + 1,
  },
  {
    id: 'budget',
    label: 'Budget',
    segment: 'budget',
    icon: lkdvIcon('paiement'),
    phases: ['prepare', 'recount'],
    permission: 'canManageBudget',
    counter: (trip) => trip.expenses?.length ?? 0,
  },
  {
    id: 'docs',
    label: 'Documents',
    segment: 'documents',
    icon: lkdvIcon('facture'),
    phases: ['prepare', 'live'],
    permission: 'canViewDocuments',
    counter: (trip) => trip.documents?.length ?? 0,
  },
  {
    id: 'checklist',
    label: 'Checklist départ',
    segment: 'checklist',
    icon: lkdvIcon('checklist'),
    phases: ['prepare'],
    counter: (trip) => trip.items?.filter((i) => !i.is_packed).length ?? 0,
  },
  {
    id: 'safety',
    label: 'Sécurité',
    segment: 'securite',
    icon: lkdvIcon('securite'),
    phases: ['prepare', 'live'],
    counter: (trip) => trip.safety_checkpoints?.filter((c) => c.status === 'pending').length ?? 0,
  },
  {
    id: 'journal',
    label: 'Journal',
    segment: 'journal',
    icon: lkdvIcon('preparateur'),
    phases: ['live', 'recount'],
    counter: (trip) => trip.notes?.length ?? 0,
  },
  {
    id: 'export',
    label: 'Export',
    segment: 'export',
    icon: lkdvIcon('partager'),
    phases: ['prepare', 'recount'],
    counter: () => null,
  },
] as const;

/** Constructeur d'URL typé — délègue au registre du hub (URLs canoniques /hub).
 *  « team » (registre voyage) est fusionné dans la section hub « groupe ». */
export function tripSectionHref(slug: string, sectionId: TripSectionId): string {
  const hubId = (sectionId === 'team' ? 'groupe' : sectionId) as HubSectionId;
  return hubSectionHref({ nature: 'sortie', slug }, hubId);
}

/**
 * Étape 2 — URL de bascule : active ce voyage comme aventure active puis
 * atterrit sur le hub. L'unique shim /voyages/[slug] restant (rule Y-D80 :
 * littéral écrit uniquement ici).
 */
export function tripSwitchHref(slug: string): string {
  return `/voyages/${slug}`;
}

/**
 * Retrouve la section active depuis un pathname (état actif de la sidebar).
 * Accepte les URLs canoniques /hub/<segment> et l'héritage /voyages/<slug>/<segment>.
 */
export function sectionIdFromPathname(pathname: string | null): TripSectionId | null {
  if (!pathname) return null;
  const clean = pathname.split(/[?#]/)[0];
  const hubMatch = clean.match(/^\/hub(?:\/([^/]+))?\/?$/);
  if (hubMatch) {
    const segment = hubMatch[1] ?? '';
    if (!segment) return 'overview';
    const hubDef = hubSectionRegistry.find((s) => s.segment === segment);
    if (!hubDef) return null;
    return (tripSectionRegistry.find((s) => s.id === hubDef.id)?.id ?? null) as TripSectionId | null;
  }
  const match = clean.match(/^\/voyages\/[^/]+(?:\/([^/?#]+))?/);
  if (!match) return null;
  const segment = match[1] ?? '';
  const def = tripSectionRegistry.find((s) => s.segment === segment);
  return def?.id ?? null;
}

/** Sections visibles pour un profil donné, dans l'ordre du registre. */
export function visibleSections(profile: TripProfile): TripSectionDef[] {
  const shown = new Set<TripSectionId>(profile.sections);
  return tripSectionRegistry.filter((s) => shown.has(s.id));
}

export { TRIP_SECTION_ORDER };
