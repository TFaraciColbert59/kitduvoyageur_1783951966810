import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import {
  hubSectionHref,
  hubSectionRegistry,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import type { HubSectionId } from '../engine/hubProfileEngine';

/**
 * H2.1 — Helpers purs du sélecteur d'aventure (toute la logique testable de
 * l'AdventureSwitcher ; le composant reste une coquille fine).
 * La liste affiche TOUJOURS les 3 natures — l'IA peut suggérer, jamais restreindre.
 */

export interface TripEntry {
  nature: 'sortie';
  id: string;
  slug: string;
  title: string;
  status?: string;
  primary_activity?: string;
}

export interface GroupEntry {
  nature: 'collectif';
  kind: 'groupe' | 'equipage';
  id: string;
  title: string;
  membersCount: number;
  subtitle: string;
  linkedTripSlug: string | null;
}

export interface PossessionEntry {
  nature: 'possession';
  itemsCount: number;
  loansCount: number;
  alertsCount: number;
}

export type AdventureEntry = TripEntry | GroupEntry | PossessionEntry;

export interface AdventureGroups {
  possession: PossessionEntry[];
  sorties: TripEntry[];
  collectifs: GroupEntry[];
}

export interface GroupLite {
  id: string;
  name: string;
  member_count: number;
  my_role?: string | null;
}

export interface CrewLite {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  active_trips_count?: number;
  next_trip?: { slug: string; title: string } | null;
}

export interface PossessionSummary {
  itemsCount: number;
  loansCount: number;
  alertsCount: number;
}

const PER_GROUP_CAP = 8;

/** Identité stable d'une aventure (persistance + mémoire de section). */
export function adventureKey(entry: AdventureEntry): string {
  switch (entry.nature) {
    case 'possession':
      return 'possession';
    case 'sortie':
      return `sortie:${entry.slug}`;
    case 'collectif':
      return `collectif:${entry.kind}:${entry.id}`;
  }
}

/** Regroupe les aventures par nature avec sous-titres de contexte. */
export function groupAdventures(
  trips: Array<{ id: string; slug: string; title: string; status?: string; primary_activity?: string }>,
  groups: GroupLite[],
  crews: CrewLite[],
  possession: PossessionSummary,
): AdventureGroups {
  const collectifs: GroupEntry[] = [
    ...groups.map((g) => ({
      nature: 'collectif' as const,
      kind: 'groupe' as const,
      id: g.id,
      title: g.name,
      membersCount: g.member_count,
      subtitle: `${g.member_count} membre(s)${g.my_role && g.my_role !== 'member' ? ` · ${g.my_role}` : ''}`,
      linkedTripSlug: null,
    })),
    ...crews.map((c) => ({
      nature: 'collectif' as const,
      kind: 'equipage' as const,
      id: c.id,
      title: c.name,
      membersCount: c.member_count,
      subtitle: `${c.member_count} membre(s)${(c.active_trips_count ?? 0) > 0 ? ` · ${c.active_trips_count} voyage(s)` : ''}`,
      linkedTripSlug: c.next_trip?.slug ?? null,
    })),
  ];
  return {
    possession: [{ nature: 'possession', ...possession }],
    sorties: trips.map((t) => ({ nature: 'sortie' as const, ...t })),
    collectifs,
  };
}

/** Recherche insensible à la casse, plafonnée à 8 résultats par groupe. */
export function filterAdventures(groups: AdventureGroups, query: string): AdventureGroups {
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!q) return groups;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const possession =
    norm('mon matériel').includes(q) || norm('materiel').includes(q) || q.includes('materiel')
      ? groups.possession
      : [];
  return {
    possession,
    sorties: groups.sorties
      .filter((t) => norm(`${t.title} ${t.status ?? ''} ${t.primary_activity ?? ''}`).includes(q))
      .slice(0, PER_GROUP_CAP),
    collectifs: groups.collectifs
      .filter((c) => norm(`${c.title} ${c.subtitle}`).includes(q))
      .slice(0, PER_GROUP_CAP),
  };
}

/** La section mémorisée est-elle valide pour cette nature ? */
function validSectionFor(section: string, nature: 'possession' | 'sortie' | 'collectif'): HubSectionId | null {
  const def = hubSectionRegistry.find((s) => s.id === section);
  if (!def || !def.natures.includes(nature)) return null;
  return def.id;
}

/**
 * URL de reprise d'une aventure : dernière section mémorisée si valide pour
 * la nature, sinon racine de la nature. Jamais d'URL cassée (fallback silencieux).
 */
export function resolveAdventureHref(
  entry: AdventureEntry,
  getLastSection: (key: string) => string | null,
): string {
  const last = getLastSection(adventureKey(entry));
  if (entry.nature === 'sortie') {
    const section = (last && validSectionFor(last, 'sortie')) || 'overview';
    return tripSectionHref(entry.slug, section as Parameters<typeof tripSectionHref>[1]);
  }
  const ref: HubAdventureRef =
    entry.nature === 'possession' ? { nature: 'possession' } : { nature: 'collectif' };
  const fallback: HubSectionId = entry.nature === 'possession' ? 'inventaire' : 'groupe';
  const section = (last && validSectionFor(last, ref.nature)) || fallback;
  return hubSectionHref(ref, section);
}

/** Raccourci conservé du switcher voyage : Ctrl/Cmd+K ou J. */
export function shouldToggleSwitcher(e: { metaKey: boolean; ctrlKey: boolean; key: string }): boolean {
  if (!e.metaKey && !e.ctrlKey) return false;
  const key = e.key.toLowerCase();
  return key === 'k' || key === 'j';
}
