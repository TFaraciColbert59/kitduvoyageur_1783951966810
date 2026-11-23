/**
 * Appels de routage côté navigateur (5.1, 5.5, 5.8) : `/api/route` et `/api/elevation`, avec `fetch` injectable
 * pour les tests. Aucun tracé n'est inventé : sans réponse du routeur, la fonction rend `null` et l'écran le dit.
 *
 * `/api/route` n'accepte que : points, sport, mode, ebike, surfacePref, avoidSteps, avoidFerries, snap
 * (liste blanche côté serveur). Les préférences de surface sont SOUPLES (poids de coût du routeur) : un
 * tronçon peut emprunter une route quand aucun sentier n'existe ; la page le dit.
 */
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';
import { activePoints } from './engine';
import { routingQueryParams, surfaceChoiceOf, SURFACE_CHOICES, type SurfaceChoiceId } from './routingProfiles';
import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteVariant,
  RouteWorkspaceState,
  VariantReplacement,
} from './types';

export interface FetchResponseLike {
  readonly ok: boolean;
  json(): Promise<unknown>;
}
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

export interface RoutedLeg {
  readonly geometry: Array<[number, number]>;
  readonly distanceKm: number;
  readonly durationMin: number | null;
}

type RawLeg = {
  distanceKm?: number;
  durationMin?: number;
  geometry?: Array<[number, number]> | { type: 'LineString'; coordinates: Array<[number, number]> };
};

/** Un tronçon par couple de points consécutifs ; `null` si le routeur n'a pas répondu ou en a oublié un. */
export async function fetchRoutedLegs(
  points: ReadonlyArray<readonly [number, number]>,
  sport: RouteSport,
  options: RouteRoutingOptions | undefined,
  fetchFn: FetchLike = (url) => fetch(url),
): Promise<{ provider: string | null; legs: RoutedLeg[] } | null> {
  if (points.length < 2) return null;
  try {
    const res = await fetchFn(`/api/route?${routingQueryParams(points, sport, options).toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; provider?: string | null; legs?: RawLeg[] };
    if (data.status !== 'ok' || !Array.isArray(data.legs) || data.legs.length !== points.length - 1) return null;
    const legs: RoutedLeg[] = data.legs.map((leg) => {
      const g = Array.isArray(leg.geometry) ? leg.geometry : leg.geometry && 'coordinates' in leg.geometry ? leg.geometry.coordinates : [];
      return {
        geometry: g,
        distanceKm: typeof leg.distanceKm === 'number' ? leg.distanceKm : 0,
        durationMin: typeof leg.durationMin === 'number' ? Math.round(leg.durationMin) : null,
      };
    });
    if (legs.some((l) => l.geometry.length < 2)) return null;
    return { provider: data.provider ?? null, legs };
  } catch {
    return null;
  }
}

export interface ElevationStats {
  readonly ascentM: number;
  readonly descentM: number;
  readonly samples: Array<number | null>;
}

/** D+ et D− d'un tracé par échantillonnage de l'altitude (≤ 32 points). `null` : altitude indisponible. */
export async function fetchElevationStats(
  coords: ReadonlyArray<readonly [number, number]>,
  fetchFn: FetchLike = (url) => fetch(url),
): Promise<ElevationStats | null> {
  if (coords.length < 2) return null;
  try {
    const count = Math.min(32, coords.length);
    const sampled: Array<readonly [number, number]> = [];
    for (let i = 0; i < count; i += 1) sampled.push(coords[Math.round((i / Math.max(1, count - 1)) * (coords.length - 1))]);
    const param = sampled.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';');
    const res = await fetchFn(`/api/elevation?points=${encodeURIComponent(param)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; elevations?: Array<number | null> };
    if (json.status !== 'ok' || !Array.isArray(json.elevations) || json.elevations.length < 2) return null;
    let up = 0;
    let down = 0;
    let measured = 0;
    for (let i = 1; i < json.elevations.length; i += 1) {
      const a = json.elevations[i - 1];
      const b = json.elevations[i];
      if (typeof a === 'number' && typeof b === 'number') {
        measured += 1;
        if (b > a) up += b - a;
        else down += a - b;
      }
    }
    if (measured === 0) return null;
    return { ascentM: Math.round(up), descentM: Math.round(down), samples: json.elevations };
  } catch {
    return null;
  }
}

/* ---------- Variantes (5.8) ---------- */

export type VariantScope = 'section' | 'stage' | 'route';

/** Au-delà, la comparaison n'est pas proposée : trop d'appels au routeur pour une seule demande. */
export const MAX_VARIANT_LEGS = 12;

export interface VariantTarget {
  readonly scope: VariantScope;
  readonly label: string;
  /** Tronçons remplacés, dans l'ordre du tracé. */
  readonly sections: readonly CollaborativeRouteSection[];
  /** Points du début à la fin de ces tronçons (un de plus que de tronçons). */
  readonly points: readonly CollaborativeRoutePoint[];
}

export function variantTarget(
  workspace: RouteWorkspaceState,
  scope: VariantScope,
  id: string | null,
): VariantTarget | { readonly error: string } {
  const pts = activePoints(workspace);
  const secFor = (a: CollaborativeRoutePoint, b: CollaborativeRoutePoint) =>
    workspace.sections.find((s) => s.fromPointId === a.id && s.toPointId === b.id);
  let chain: CollaborativeRoutePoint[] = pts;
  let label = 'tout l’itinéraire';
  if (scope === 'section') {
    const sec = workspace.sections.find((s) => s.id === id);
    if (!sec) return { error: 'Choisissez un tronçon.' };
    const i = pts.findIndex((p) => p.id === sec.fromPointId);
    if (i < 0 || pts[i + 1]?.id !== sec.toPointId) return { error: 'Tronçon introuvable.' };
    chain = pts.slice(i, i + 2);
    label = 'ce tronçon';
  } else if (scope === 'stage') {
    const st = workspace.stages.find((s) => s.id === id);
    if (!st) return { error: 'Choisissez une journée.' };
    if (st.kind === 'rest') return { error: 'Un jour de repos n’a pas de tracé à comparer.' };
    const a = pts.findIndex((p) => p.id === st.startPointId);
    const b = pts.findIndex((p) => p.id === st.endPointId);
    if (a < 0 || b <= a) return { error: 'Le tracé de ce jour est incohérent.' };
    chain = pts.slice(a, b + 1);
    label = `le jour ${st.dayNumber}`;
  }
  const sections: CollaborativeRouteSection[] = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const s = secFor(chain[i], chain[i + 1]);
    if (!s) return { error: 'Un tronçon manque dans cette portée : relancez d’abord le calcul.' };
    sections.push(s);
  }
  if (sections.length === 0) return { error: 'Aucun tronçon dans cette portée.' };
  if (sections.length > MAX_VARIANT_LEGS) {
    return { error: `Plus de ${MAX_VARIANT_LEGS} tronçons : comparez un jour ou un tronçon à la fois.` };
  }
  return { scope, label, sections, points: chain };
}

const sum = (xs: Array<number | null>): number | null => (xs.some((x) => x == null) ? null : (xs as number[]).reduce((a, b) => a + b, 0));

/** Les préférences à essayer : toutes celles du profil sauf celle déjà utilisée par le tracé. */
export function alternativeSurfaces(options: RouteRoutingOptions | undefined): typeof SURFACE_CHOICES {
  const current = surfaceChoiceOf(options);
  return SURFACE_CHOICES.filter((c) => c.id !== current);
}

export interface VariantBuildResult {
  readonly variants: RouteVariant[];
  /** Préférences dont le résultat est le même tracé qu'aujourd'hui, ou que le routeur n'a pas su calculer. */
  readonly notes: string[];
}

/**
 * Jusqu'à trois variantes RÉELLES : la même portée recalculée par le routeur avec une autre préférence de
 * surface. Les écarts (km, D+, durée) viennent des deux calculs ; la surface mesurée n'est pas donnée par le
 * routeur : elle reste « inconnue », seule la préférence demandée est dite.
 */
export async function buildRoutingVariants(args: {
  workspace: RouteWorkspaceState;
  target: VariantTarget;
  createdBy: string;
  nowIso: string;
  idSeed: string;
  fetchFn?: FetchLike;
  surfaces?: ReadonlyArray<{ id: SurfaceChoiceId; label: string; pref: NonNullable<RouteRoutingOptions['surfacePref']> }>;
}): Promise<VariantBuildResult> {
  const { workspace, target } = args;
  const fetchFn = args.fetchFn ?? ((url: string) => fetch(url));
  const coords = target.points.map((p) => [p.lon, p.lat] as const);
  const baseDistance = target.sections.reduce((a, s) => a + s.distanceKm, 0);
  const baseAscent = sum(target.sections.map((s) => s.ascentM));
  const baseDuration = sum(target.sections.map((s) => s.durationMin));
  const candidates = (args.surfaces ?? alternativeSurfaces(workspace.routingOptions)).slice(0, 3);
  const variants: RouteVariant[] = [];
  const notes: string[] = [];
  for (const choice of candidates) {
    const options: RouteRoutingOptions = { ...workspace.routingOptions, surfacePref: choice.pref };
    const routed = await fetchRoutedLegs(coords, workspace.sport, options, fetchFn);
    if (!routed || routed.legs.length !== target.sections.length) {
      notes.push(`« ${choice.label} » : le routeur n’a pas répondu.`);
      continue;
    }
    const replacements: VariantReplacement[] = [];
    for (let i = 0; i < routed.legs.length; i += 1) {
      const leg = routed.legs[i];
      const ele = await fetchElevationStats(leg.geometry, fetchFn);
      replacements.push({
        sectionId: target.sections[i].id,
        geometry: { type: 'LineString', coordinates: leg.geometry },
        distanceKm: Math.round(leg.distanceKm * 100) / 100,
        durationMin: leg.durationMin,
        ascentM: ele ? ele.ascentM : null,
        descentM: ele ? ele.descentM : null,
        surfaceKnownRatio: 0,
        provenance: {
          provider: `${routed.provider ?? 'routeur'} · ${choice.label.toLowerCase()}`,
          calculatedAt: args.nowIso,
          profile: workspace.sport,
          confidence: 'verified',
        },
      });
    }
    const newDistance = replacements.reduce((a, r) => a + r.distanceKm, 0);
    const sameShape = replacements.every((r, i) => Math.abs(r.geometry.coordinates.length - target.sections[i].geometry.coordinates.length) <= 1 && Math.abs(r.distanceKm - target.sections[i].distanceKm) < 0.05);
    if (sameShape) {
      notes.push(`« ${choice.label} » donne le même tracé qu’aujourd’hui.`);
      continue;
    }
    const newAscent = sum(replacements.map((r) => r.ascentM));
    const newDuration = sum(replacements.map((r) => r.durationMin));
    variants.push({
      id: `var-${args.idSeed}-${choice.id}`,
      baseRevisionNo: workspace.publishedRevisionNo ?? 0,
      scope: target.scope,
      title: `${choice.label} · ${target.label}`,
      replacements,
      deltaDistanceKm: Math.round((newDistance - baseDistance) * 100) / 100,
      deltaAscentM: newAscent != null && baseAscent != null ? Math.round(newAscent - baseAscent) : null,
      deltaDurationMin: newDuration != null && baseDuration != null ? Math.round(newDuration - baseDuration) : null,
      status: 'draft',
      createdBy: args.createdBy,
      createdAt: args.nowIso,
    });
  }
  return { variants, notes };
}
