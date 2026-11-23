import type {
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  CollaborativeStage,
  RouteWorkspaceState,
} from './types';

/**
 * Assainit un itinéraire avant de le montrer à un lecteur externe : lien de partage lecture seule
 * (amélioration 8.9) ou membre `external_viewer`.
 *
 * RGPD (CLAUDE.md §2) : aucune coordonnée privée ne sort par un lien partagé. Le masquage est fait
 * D'ABORD dans la base (`route_sanitize_snapshot_for_share`, appelé par `get_shared_route_workspace_tx`
 * et `get_route_external_view_tx`) ; cette fonction applique les mêmes règles côté Next, en défense en
 * profondeur et pour le store mémoire. Elle est idempotente sur une sortie de la base : un point déjà
 * masqué (`masked: true`) n'est jamais pris comme centre de zone privée.
 *
 * Règles (liste blanche de clés à chaque niveau) :
 *  - zone privée = rayon (200 m minimum) autour du départ, et de l'arrivée pour une boucle ; les points
 *    du rayon sont retirés, le départ/l'arrivée déplacés au premier/dernier point du tracé hors du rayon
 *    (absents si aucune coordonnée n'est hors du rayon), les coordonnées de géométrie du rayon retirées ;
 *  - étapes réduites à id / jour / titre / date / distance (ids de points conservés seulement) : jamais de
 *    lieu de nuit (lat/lon), notes, observations d'eau ni dangers ;
 *  - jamais `provenance`, `tripId`, `sourceOrigin.sourceId/sourceUrl/originalGpxXml`, identifiants de
 *    membres, propositions, commentaires, sac, variantes, révisions, packs ni lien de partage.
 *
 * Les champs exigés par les types mais retirés (provenance, tripId, notes…) reçoivent une valeur
 * neutre (`confidence: 'unknown'`, chaîne vide, tableau vide), jamais une valeur réelle.
 */
export const DEFAULT_PRIVATE_START_RADIUS_M = 500;
/** Rayon minimal de la zone privée : aligné sur la base (manage_route_share_link_tx refuse moins). */
export const MIN_PRIVATE_START_RADIUS_M = 200;

type LonLat = [number, number];
type MaskablePoint = CollaborativeRoutePoint & { readonly masked?: boolean };

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidCoord(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function orderedPoints(points: readonly CollaborativeRoutePoint[]): MaskablePoint[] {
  return points
    .filter((p) => p && typeof p.id === 'string' && !p.deletedAt && isValidCoord(p.lat, p.lon))
    .slice()
    .sort((a, b) => cmp(String(a.orderKey), String(b.orderKey)) || cmp(a.id, b.id));
}

function routeCoordinates(
  points: readonly CollaborativeRoutePoint[],
  sections: readonly CollaborativeRouteSection[],
): LonLat[] {
  const byFrom = new Map<string, CollaborativeRouteSection>();
  for (const s of sections) byFrom.set(s.fromPointId, s);
  const coords: LonLat[] = [];
  for (const p of points) {
    const section = byFrom.get(p.id);
    if (!section) continue;
    for (const c of section.geometry?.coordinates ?? []) {
      if (Array.isArray(c) && isValidCoord(c[1], c[0])) coords.push([c[0], c[1]]);
    }
  }
  return coords;
}

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null;
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const NEUTRAL_PROVENANCE = {
  provider: null,
  calculatedAt: null,
  profile: null,
  confidence: 'unknown',
} as const;

export function sanitizeWorkspaceForShareLink(
  state: RouteWorkspaceState,
  radiusM: number = state.shareLink?.hidePrivateStartRadiusM ?? DEFAULT_PRIVATE_START_RADIUS_M,
): RouteWorkspaceState {
  const radius = Number.isFinite(radiusM)
    ? Math.max(MIN_PRIVATE_START_RADIUS_M, radiusM)
    : DEFAULT_PRIVATE_START_RADIUS_M;
  const ordered = orderedPoints(Array.isArray(state.points) ? state.points : []);
  const rawSections = Array.isArray(state.sections) ? state.sections : [];
  const start = ordered.find((p) => p.kind === 'start') ?? ordered[0] ?? null;

  // Centres privés : départ, et arrivée d'une boucle. Un point déjà masqué n'est pas un centre.
  const privateCenters: { lat: number; lon: number }[] = [];
  if (start && !start.masked) privateCenters.push({ lat: start.lat, lon: start.lon });
  const last = ordered[ordered.length - 1];
  if (state.shapeMode === 'loop' && ordered.length >= 2 && last && !last.masked) {
    privateCenters.push({ lat: last.lat, lon: last.lon });
  }

  const inside = (lat: number, lon: number) =>
    privateCenters.some((c) => distanceM(c.lat, c.lon, lat, lon) <= radius);

  const coords = routeCoordinates(ordered, rawSections);
  const firstOutside = coords.find(([lon, lat]) => !inside(lat, lon)) ?? null;
  const lastOutside = [...coords].reverse().find(([lon, lat]) => !inside(lat, lon)) ?? null;

  const points: CollaborativeRoutePoint[] = [];
  ordered.forEach((p, index) => {
    const isLast = index === ordered.length - 1;
    const base = {
      id: p.id,
      workspaceId: state.id,
      kind: p.kind,
      orderKey: p.orderKey,
      entityVersion: num(p.entityVersion) ?? 1,
    };
    if (p.masked || !inside(p.lat, p.lon)) {
      points.push({
        ...base,
        lat: p.lat,
        lon: p.lon,
        eleM: p.masked ? null : num(p.eleM),
        name: text(p.name, 200),
        ...(p.masked ? {} : p.semanticKind ? { semanticKind: p.semanticKind } : {}),
        note: null,
        ...(p.masked ? { masked: true } : {}),
      } as CollaborativeRoutePoint);
      return;
    }
    if (p.kind === 'start' || p.kind === 'finish' || index === 0 || isLast) {
      const anchor = p.kind === 'finish' || (isLast && index !== 0) ? lastOutside : firstOutside;
      // Sans aucune coordonnée hors du rayon, le point n'est pas montré du tout.
      if (!anchor) return;
      points.push({
        ...base,
        lat: anchor[1],
        lon: anchor[0],
        eleM: null,
        name:
          p.kind === 'start' || (index === 0 && p.kind !== 'finish')
            ? 'Départ (zone privée masquée)'
            : 'Arrivée (zone privée masquée)',
        note: null,
        masked: true,
      } as CollaborativeRoutePoint);
    }
    // Les points intermédiaires dans la zone privée sont retirés.
  });

  const keptIds = new Set(points.map((p) => p.id));
  const sections: CollaborativeRouteSection[] = [];
  for (const s of rawSections) {
    if (!s || !keptIds.has(s.fromPointId) || !keptIds.has(s.toPointId)) continue;
    const all: Array<[number, number]> = Array.isArray(s.geometry?.coordinates) ? s.geometry.coordinates : [];
    const kept = all
      .filter((c) => Array.isArray(c) && isValidCoord(c[1], c[0]) && !inside(c[1], c[0]))
      .map((c): [number, number] => [c[0], c[1]]);
    const whole = kept.length === all.length;
    sections.push({
      id: s.id,
      workspaceId: state.id,
      fromPointId: s.fromPointId,
      toPointId: s.toPointId,
      mode: s.mode,
      geometry: { type: 'LineString', coordinates: kept },
      distanceKm: num(s.distanceKm) ?? 0,
      durationMin: num(s.durationMin),
      ascentM: num(s.ascentM),
      descentM: num(s.descentM),
      // Altitudes désalignées dès qu'une coordonnée est retirée : on les enlève.
      ...(whole && Array.isArray(s.elevationSamples) ? { elevationSamples: s.elevationSamples } : {}),
      surfaceSegments: Array.isArray(s.surfaceSegments) ? s.surfaceSegments : [],
      routingInputHash: null,
      provenance: { ...NEUTRAL_PROVENANCE },
      warnings: [],
      entityVersion: num(s.entityVersion) ?? 1,
    });
  }

  const stages: CollaborativeStage[] = (Array.isArray(state.stages) ? state.stages : [])
    .filter((st) => st && typeof st.id === 'string')
    .map((st) => {
      const distanceKm = num((st as { distanceKm?: unknown }).distanceKm);
      return {
        id: st.id,
        workspaceId: state.id,
        orderKey: text(st.orderKey, 40) ?? '',
        dayNumber: num(st.dayNumber) ?? 1,
        ...(st.kind ? { kind: st.kind } : {}),
        title: text(st.title, 160) ?? '',
        dateIso: text(st.dateIso, 32),
        departureTimeLocal: '',
        timezone: '',
        startPointId: keptIds.has(st.startPointId) ? st.startPointId : '',
        endPointId: keptIds.has(st.endPointId) ? st.endPointId : '',
        overnightPlace: null,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: num(st.entityVersion) ?? 1,
        ...(distanceKm !== null ? { distanceKm } : {}),
      } as CollaborativeStage;
    });

  const origin = state.sourceOrigin ?? { kind: 'blank' as const };

  return {
    id: state.id,
    // tripId est exigé par le type mais ne sort jamais : valeur neutre.
    tripId: '',
    title: text(state.title, 160) ?? '',
    status: state.status,
    sport: state.sport,
    ...(state.shapeMode ? { shapeMode: state.shapeMode } : {}),
    routingOptions: {
      ...(state.routingOptions?.ebike ? { ebike: true } : {}),
      ...(state.routingOptions?.avoidSteps ? { avoidSteps: true } : {}),
      ...(state.routingOptions?.avoidFerries ? { avoidFerries: true } : {}),
      ...(typeof state.routingOptions?.surfacePref === 'string'
        ? { surfacePref: state.routingOptions.surfacePref }
        : {}),
    },
    headSeq: state.headSeq,
    reviewedSeq: num(state.reviewedSeq),
    publishedRevisionId: null,
    publishedRevisionNo: num(state.publishedRevisionNo),
    sourceOrigin: {
      kind: origin.kind,
      sourceTitle: text(origin.sourceTitle, 160),
      importedAt: text(origin.importedAt, 40),
      attribution: text(origin.attribution, 300),
    },
    shareLink: null,
    points,
    sections,
    stages,
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    revisions: [],
    packs: [],
    participantPacks: [],
    // Jamais d'identifiant réel : nom affiché et rôle seulement, identifiant opaque pour les clés React.
    members: (Array.isArray(state.members) ? state.members : [])
      .filter((m) => m && !m.revokedAt)
      .map((m, i) => ({ userId: `shared-member-${i + 1}`, displayName: text(m.displayName, 120) ?? '', role: m.role })),
    updatedAt: state.updatedAt,
  };
}
