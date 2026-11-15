import { gearKindsForSport, normalizeSport } from './gearKind';
import type { GearDefaultCandidate, GearKind, GearRef, GearSportDefault } from './types';

export interface SelectDefaultGearInput {
  sport: string | null | undefined;
  items: ReadonlyArray<GearRef>;
  defaults?: ReadonlyArray<GearSportDefault>;
  /** Objets déjà associés à cette activité : ils priment sur les défauts. */
  activityGearIds?: ReadonlyArray<string>;
  /** Restreint aux objets d'un type précis (facultatif). */
  kinds?: ReadonlyArray<GearKind>;
}

/**
 * Sélectionne le matériel proposé pour un sport et une activité.
 *
 * Trois niveaux, sans jamais masquer un objet :
 * 1. `activity` : déjà associé à cette sortie ;
 * 2. `sport` : défaut explicite enregistré pour ce sport (priorité croissante) ;
 * 3. `available` : objet du bon type, proposé sans être imposé.
 *
 * Un sport sans type de matériel connu (kayak, escalade…) ne propose rien :
 * le moteur ne fabrique pas une chaussure pour remplir la liste.
 */
export function selectDefaultGear(input: SelectDefaultGearInput): GearDefaultCandidate[] {
  const sport = normalizeSport(input.sport);
  if (!sport) return [];

  const acceptedKinds = new Set<GearKind>(
    input.kinds && input.kinds.length > 0 ? input.kinds : gearKindsForSport(sport)
  );
  if (acceptedKinds.size === 0) return [];

  const activity = new Set((input.activityGearIds ?? []).filter((id) => typeof id === 'string' && id.length > 0));
  const explicit = new Map<string, GearSportDefault>();
  for (const entry of input.defaults ?? []) {
    if (normalizeSport(entry.sport) !== sport) continue;
    if (!acceptedKinds.has(entry.kind)) continue;
    const previous = explicit.get(entry.gearItemId);
    if (!previous || entry.priority < previous.priority) explicit.set(entry.gearItemId, entry);
  }

  return input.items
    .filter((item) => acceptedKinds.has(item.kind))
    .map((item) => {
      const isActivity = activity.has(item.id);
      const sportDefault = explicit.get(item.id);
      const source = isActivity ? 'activity' : sportDefault ? 'sport' : 'available';
      return {
        item,
        isDefault: source !== 'available',
        source,
        priority: isActivity ? -1 : sportDefault ? sportDefault.priority : Number.MAX_SAFE_INTEGER,
      } as GearDefaultCandidate & { priority: number };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.item.name.localeCompare(b.item.name, 'fr');
    })
    .map(({ priority: _priority, ...candidate }) => candidate);
}

/** Type de matériel à proposer en premier pour une sortie, ou `null`. */
export function primaryGearKindForSport(sport: string | null | undefined): GearKind | null {
  const kinds = gearKindsForSport(sport);
  return kinds.length > 0 ? kinds[0] : null;
}
