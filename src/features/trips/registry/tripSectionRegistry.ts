import {
  Compass,
  Navigation,
  Package,
  Users,
  CreditCard,
  FileText,
  CheckSquare,
  Shield,
  BookOpen,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripPermissions } from '../types/trip.types';
import {
  TRIP_SECTION_ORDER,
  type TripProfile,
  type TripSectionId,
} from '../engine/tripProfileEngine';
import type { TripFull } from '../types/trip.types';

/**
 * Y1.3 — Registre des sections du hub voyage (source unique de la navigation).
 * La sidebar, le fil d'Ariane, le sélecteur mobile et les tests lisent TOUS
 * ce registre. Aucune route /voyages littérale hors d'ici (règle Y-D80 n°11).
 */

export interface TripSectionDef {
  id: TripSectionId;
  label: string;
  /** Segment d'URL sous /voyages/[slug] — '' pour la racine (overview). */
  segment: string;
  icon: LucideIcon;
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
    icon: Compass,
    phases: ['prepare', 'live', 'recount'],
    counter: () => null,
  },
  {
    id: 'itinerary',
    label: 'Itinéraire',
    segment: 'itineraire',
    icon: Navigation,
    phases: ['prepare', 'live'],
    counter: (trip) => trip.steps?.length ?? 0,
  },
  {
    id: 'gear',
    label: 'Équipement',
    segment: 'kit',
    icon: Package,
    phases: ['prepare'],
    counter: (trip) => trip.items?.length ?? 0,
  },
  {
    id: 'team',
    label: 'Équipage',
    segment: 'equipage',
    icon: Users,
    phases: ['prepare', 'live'],
    counter: (trip) => (trip.collaborators?.length ?? 0) + 1,
  },
  {
    id: 'budget',
    label: 'Budget',
    segment: 'budget',
    icon: CreditCard,
    phases: ['prepare', 'recount'],
    permission: 'canManageBudget',
    counter: (trip) => trip.expenses?.length ?? 0,
  },
  {
    id: 'docs',
    label: 'Documents',
    segment: 'documents',
    icon: FileText,
    phases: ['prepare', 'live'],
    permission: 'canViewDocuments',
    counter: (trip) => trip.documents?.length ?? 0,
  },
  {
    id: 'checklist',
    label: 'Checklist départ',
    segment: 'checklist',
    icon: CheckSquare,
    phases: ['prepare'],
    counter: (trip) => trip.items?.filter((i) => !i.is_packed).length ?? 0,
  },
  {
    id: 'safety',
    label: 'Sécurité',
    segment: 'securite',
    icon: Shield,
    phases: ['prepare', 'live'],
    counter: (trip) => trip.safety_checkpoints?.filter((c) => c.status === 'pending').length ?? 0,
  },
  {
    id: 'journal',
    label: 'Journal',
    segment: 'journal',
    icon: BookOpen,
    phases: ['live', 'recount'],
    counter: (trip) => trip.notes?.length ?? 0,
  },
  {
    id: 'export',
    label: 'Export',
    segment: 'export',
    icon: Share2,
    phases: ['prepare', 'recount'],
    counter: () => null,
  },
] as const;

/** Constructeur d'URL typé — LE seul point du code qui écrit /voyages/. */
export function tripSectionHref(slug: string, sectionId: TripSectionId): string {
  const def = tripSectionRegistry.find((s) => s.id === sectionId);
  if (!def) throw new Error(`Section inconnue : ${sectionId}`);
  const base = `/voyages/${slug}`;
  return def.segment ? `${base}/${def.segment}` : base;
}

/** Retrouve la section active depuis un pathname (état actif de la sidebar). */
export function sectionIdFromPathname(pathname: string | null): TripSectionId | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/voyages\/[^/]+(?:\/([^/?#]+))?/);
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
