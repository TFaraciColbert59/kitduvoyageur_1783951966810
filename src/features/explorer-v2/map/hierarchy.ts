import type { Level, PoiKind } from '../state/types';

/**
 * Hiérarchie d'affichage de la carte (04_CARTE.md §1).
 *
 * P0 = toujours visible (toi, le point ouvert, les dangers)
 * P1 = repères majeurs du niveau
 * P2 = secondaires
 * P3 = seulement à zoom proche / masqués en activité
 *
 * Règles : collision → priorité la plus haute gagne ; à priorité égale, le
 * repère le plus proche de l'utilisateur ; jamais plus de 6 repères par
 * 100×100 px ; rien sous le tiroir ni sous l'Island.
 */

export type Priority = 0 | 1 | 2 | 3;

const PRIORITY_TABLE: Record<PoiKind, Priority[]> = {
  //                monde  pays  région  lieu
  danger: [0, 0, 0, 0],
  summit: [3, 1, 1, 1],
  water: [3, 2, 2, 1],
  refuge: [3, 2, 1, 1],
  bivouac: [3, 3, 3, 3],
  viewpoint: [3, 3, 3, 3],
  access: [3, 3, 3, 3],
  friend: [2, 2, 2, 2],
  trail: [1, 0, 0, 0],
};

/** Priorité d'un repère pour un niveau donné. */
export function poiPriority(kind: PoiKind, level: Level): Priority {
  const row = PRIORITY_TABLE[kind];
  if (!row) return 3;
  return row[level] ?? 3;
}

export interface ProjectedPin {
  id: string;
  kind: PoiKind;
  x: number;
  y: number;
  distanceKm?: number;
}

export interface SelectOptions {
  level: Level;
  /** Hauteur en pixels occupée par le tiroir et la barre basse. */
  sheetTop: number;
  /** Largeur de la fenêtre, pour écarter ce qui est hors champ. */
  viewport: { width: number; height: number };
  /** En activité, les repères secondaires sont masqués (04_CARTE §1). */
  activity?: boolean;
  /** Profil de bienvenue : réordonne P1/P2 (famille : eau d'abord). */
  profile?: string | null;
  /** Densité maximale par cellule de 100×100 px. */
  maxPerCell?: number;
}

const CELL = 100;

/**
 * Sélectionne et ordonne les repères visibles.
 * Fonction pure : aucune dépendance à MapLibre, testable telle quelle.
 */
export function selectVisiblePins<T extends ProjectedPin>(
  pins: T[],
  options: SelectOptions,
): T[] {
  const { level, sheetTop, viewport, activity = false, profile = null, maxPerCell = 6 } = options;

  const scored = pins
    .filter((pin) => pin.x >= -40 && pin.x <= viewport.width + 40)
    .filter((pin) => pin.y >= 0 && pin.y <= sheetTop - 8)
    .map((pin) => {
      let priority = poiPriority(pin.kind, level);
      // « ski de rando garde les sommets », « bivouac de nuit garde les spots » :
      // en activité, tout ce qui n'est pas P0 est repoussé d'un cran.
      if (activity && priority > 0) priority = Math.min(3, priority + 1) as Priority;
      // Profil famille : l'eau et les accès passent devant.
      if (profile === 'famille' || profile === 'enfants') {
        if (pin.kind === 'water' || pin.kind === 'access') priority = Math.max(0, priority - 1) as Priority;
      }
      return { pin, priority };
    })
    // Priorité d'abord, puis proximité (le plus proche gagne).
    .sort((a, b) => a.priority - b.priority || (a.pin.distanceKm ?? 0) - (b.pin.distanceKm ?? 0));

  const cells = new Map<string, number>();
  const kept: T[] = [];
  for (const { pin } of scored) {
    const cell = `${Math.floor(pin.x / CELL)}:${Math.floor(pin.y / CELL)}`;
    const count = cells.get(cell) ?? 0;
    if (count >= maxPerCell) continue;
    cells.set(cell, count + 1);
    kept.push(pin);
  }
  return kept;
}

export interface PinCluster {
  /** Centroïde de la cellule, en pixels écran. */
  x: number;
  y: number;
  /** Nombre de repères agrégés. */
  count: number;
  /** Repère le plus prioritaire de la cellule (pour l'icône). */
  kind: PoiKind;
  ids: string[];
}

/**
 * Agrégation des repères (04_CARTE §1) : au-delà de `maxPerCell` repères dans
 * une cellule de 100×100 px, la cellule devient **une pastille chiffrée** qui
 * zoome au toucher. En dessous, les repères restent individuels et la règle de
 * priorité de `selectVisiblePins` s'applique.
 */
export function clusterPins<T extends ProjectedPin>(
  pins: T[],
  options: { maxPerCell?: number; cell?: number; top?: number } = {},
): { pins: T[]; clusters: PinCluster[] } {
  const maxPerCell = options.maxPerCell ?? 6;
  const cell = options.cell ?? CELL;
  const top = options.top ?? 0;

  const buckets = new Map<string, T[]>();
  for (const pin of pins) {
    // Rien sous le chrome haut (capsule, boutons) : même règle que les repères.
    if (pin.y < top) continue;
    const key = `${Math.floor(pin.x / cell)}:${Math.floor(pin.y / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(pin);
    else buckets.set(key, [pin]);
  }

  const clusters: PinCluster[] = [];
  const crowded = new Set<string>();
  for (const [key, bucket] of buckets) {
    if (bucket.length <= maxPerCell) continue;
    crowded.add(key);
    const x = bucket.reduce((sum, pin) => sum + pin.x, 0) / bucket.length;
    const y = bucket.reduce((sum, pin) => sum + pin.y, 0) / bucket.length;
    clusters.push({
      x,
      y,
      count: bucket.length,
      kind: bucket[0].kind,
      ids: bucket.map((pin) => pin.id),
    });
  }

  if (crowded.size === 0) return { pins, clusters: [] };
  return {
    pins: pins.filter((pin) => !crowded.has(`${Math.floor(pin.x / cell)}:${Math.floor(pin.y / cell)}`)),
    clusters,
  };
}

/**
 * Clé de tri MapLibre (`symbol-sort-key`) : priorité × 1e6 + distance.
 * Plus la valeur est petite, plus le repère passe devant.
 */
export function symbolSortKey(kind: PoiKind, level: Level, distanceKm: number): number {
  return poiPriority(kind, level) * 1_000_000 + Math.min(999_999, Math.round(distanceKm * 1000));
}
