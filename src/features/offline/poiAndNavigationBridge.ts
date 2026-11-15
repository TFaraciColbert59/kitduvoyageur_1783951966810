/**
 * Lot N02 — Photos et POI à venir dans le paquet hors ligne (K4.17) & Pont de
 * lecture de tuiles, parcours et graphe de routage pour le guidage hors ligne
 * (pont N01 <-> N02).
 *
 * Invariants :
 * - Aucune donnée cartographique, tuile ou géométrie de recalcul inventée.
 * - État `unavailable` explicite avec raison typée si aucun paquet vérifié ne
 *   couvre l'emprise, le zoom ou l'itinéraire demandé.
 * - Exclusion stricte des POI/médias privés (`private_user`) des paquets publics
 *   partagés et vérification SHA-256 de chaque vignette média avant affichage.
 */

import { EARTH_RADIUS_M, haversineM, isValidLngLat, routeLines, type LngLat } from '../explorer-v2/geo/track';
import type { ZoneBounds } from '../explorer-v2/offline/zone';
import { normalizeResourceUri, toUtf8Bytes, verifyResourcePayload } from './integrity';
import type { OfflinePackManager } from './packManager';
import { boundsContainsBounds, boundsContainsPoint, boundsIntersect, tileCoordKey } from './regionsAndCoverage';
import type {
  OfflineInstalledPackRecord,
  OfflineLocalRoutingGraphEngine,
  OfflineMediaAsset,
  OfflinePoiRecord,
  OfflineRouteBundleReadResult,
  OfflineRouteNavigationData,
  OfflineRoutingGraphLookupResult,
  OfflineTileReadResult,
  OfflineUpcomingPoiViewItem,
  Sport,
  TileCoordinate,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Conversion tuile XYZ -> boîte englobante géographique
// ─────────────────────────────────────────────────────────────────────────────

export function tileToBounds(tile: TileCoordinate): ZoneBounds {
  const n = 2 ** tile.z;
  const west = (tile.x / n) * 360 - 180;
  const east = ((tile.x + 1) / n) * 360 - 180;
  const latNorthRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n)));
  const latSouthRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 1)) / n)));
  const north = (latNorthRad * 180) / Math.PI;
  const south = (latSouthRad * 180) / Math.PI;
  return { west, south, east, north };
}

// ─────────────────────────────────────────────────────────────────────────────
// K4.17 — Filtrage des droits/licences/confidentialité des POI et photos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtre et normalise les POI, Highlights et aperçus photos à inclure dans un
 * paquet hors ligne (K4.17) :
 * - Rejette les POI non autorisés (`!poi.authorized`).
 * - Si `sharedPublicly` est vrai, exclut strictement tout POI ou média marqué
 *   `private_user` (Recherche 04 : « Les coordonnées ou photos privées n'entrent
 *   pas dans un paquet partagé public »).
 * - Exclut tout média dépourvu de licence explicite et nettoie les URIs de tout
 *   jeton temporaire.
 */
export function filterAndNormalizeOfflinePois(
  pois: readonly OfflinePoiRecord[],
  options: { sharedPublicly: boolean },
): OfflinePoiRecord[] {
  const result: OfflinePoiRecord[] = [];

  for (const poi of pois) {
    if (!poi.authorized) continue;
    if (!isValidLngLat([poi.lng, poi.lat])) continue;
    if (options.sharedPublicly && poi.privacyScope === 'private_user') continue;

    const validMedia: OfflineMediaAsset[] = [];
    for (const media of poi.mediaAssets) {
      if (!media.license || media.license.trim().length === 0) continue;
      if (options.sharedPublicly && media.privacyScope === 'private_user') continue;
      if (media.bytes <= 0 || !media.sha256) continue;
      validMedia.push({
        ...media,
        canonicalUri: normalizeResourceUri(media.canonicalUri),
        sha256: media.sha256.toLowerCase(),
      });
    }

    result.push({
      ...poi,
      mediaAssets: validMedia,
    });
  }

  return result;
}

/**
 * Projette un point `[lng, lat]` sur les lignes d'un tracé pour calculer son
 * abscisse curviligne `alongTrackM` et son écart latéral `lateralOffsetM`.
 */
function projectPointOntoRouteGeoJson(
  point: LngLat,
  geojson: unknown,
): { alongTrackM: number; lateralOffsetM: number } | null {
  const lines = routeLines(geojson);
  if (lines.length === 0) return null;

  let cumulativeM = 0;
  let bestAlongM = 0;
  let bestDistanceM = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1];
      const b = line[i];
      const segLengthM = haversineM(a, b);
      if (!Number.isFinite(segLengthM) || segLengthM <= 0) continue;

      const midLatRad = (((a[1] + b[1]) / 2) * Math.PI) / 180;
      const cosLat = Math.cos(midLatRad);
      const ax = 0;
      const ay = 0;
      const bx = ((b[0] - a[0]) * Math.PI * EARTH_RADIUS_M * cosLat) / 180;
      const by = ((b[1] - a[1]) * Math.PI * EARTH_RADIUS_M) / 180;
      const px = ((point[0] - a[0]) * Math.PI * EARTH_RADIUS_M * cosLat) / 180;
      const py = ((point[1] - a[1]) * Math.PI * EARTH_RADIUS_M) / 180;

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq)) : 0;

      const projLng = a[0] + (b[0] - a[0]) * t;
      const projLat = a[1] + (b[1] - a[1]) * t;
      const distM = haversineM(point, [projLng, projLat]);

      if (distM < bestDistanceM) {
        bestDistanceM = distM;
        bestAlongM = cumulativeM + segLengthM * t;
      }

      cumulativeM += segLengthM;
    }
  }

  if (!Number.isFinite(bestDistanceM)) return null;
  return {
    alongTrackM: Math.round(bestAlongM * 10) / 10,
    lateralOffsetM: Math.round(bestDistanceM * 10) / 10,
  };
}

/**
 * Résout les POI/Highlights à venir le long du parcours à partir d'un paquet
 * hors ligne vérifié, en attachant les vignettes photos locales vérifiées par
 * SHA-256 (K4.17).
 * Aucun bouton, écran ou notification dédié : ces éléments enrichissent
 * directement les vues naturelles (drawer parcours / suivi).
 */
export function resolveUpcomingOfflinePoisWithMedia(params: {
  pack: OfflineInstalledPackRecord;
  routeData: OfflineRouteNavigationData;
  currentAlongTrackM: number;
  sport?: Sport;
  maxLateralOffsetM?: number;
}): OfflineUpcomingPoiViewItem[] {
  if (params.pack.status !== 'available' && params.pack.status !== 'degraded') {
    return [];
  }

  const maxLateralOffsetM = params.maxLateralOffsetM ?? 200;
  const items: OfflineUpcomingPoiViewItem[] = [];

  for (const poi of params.routeData.pois) {
    if (!poi.authorized) continue;
    if (params.pack.manifest.sharedPublicly && poi.privacyScope === 'private_user') continue;
    if (
      params.sport &&
      poi.sports &&
      poi.sports.length > 0 &&
      !poi.sports.includes(params.sport)
    ) {
      continue;
    }

    const projection = projectPointOntoRouteGeoJson([poi.lng, poi.lat], params.routeData.geojson);
    if (!projection || projection.lateralOffsetM > maxLateralOffsetM) continue;

    const distanceRemainingM = Math.round((projection.alongTrackM - params.currentAlongTrackM) * 10) / 10;
    if (distanceRemainingM < -15) continue;

    const verifiedMediaPreviews: OfflineUpcomingPoiViewItem['verifiedMediaPreviews'][number][] = [];

    for (const media of poi.mediaAssets) {
      if (!media.license) continue;
      if (params.pack.manifest.sharedPublicly && media.privacyScope === 'private_user') continue;

      // Recherche la ressource média correspondante dans les ressources vérifiées du paquet
      const matchingDescriptor = params.pack.manifest.resources.find(
        (r) =>
          r.kind === 'media_preview' &&
          (r.id === media.mediaId || r.canonicalUri === normalizeResourceUri(media.canonicalUri)),
      );
      if (!matchingDescriptor) continue;

      const chunk = params.pack.verifiedResources.get(matchingDescriptor.id);
      if (!chunk) continue;

      const check = verifyResourcePayload(matchingDescriptor, chunk.payload);
      if (!check.ok || check.actualSha256.toLowerCase() !== media.sha256.toLowerCase()) {
        continue;
      }

      verifiedMediaPreviews.push({
        mediaId: media.mediaId,
        canonicalUri: matchingDescriptor.canonicalUri,
        caption: media.caption ?? null,
        width: media.width,
        height: media.height,
        payload: chunk.payload,
      });
    }

    items.push({
      poi,
      alongTrackM: projection.alongTrackM,
      distanceRemainingM: Math.max(0, distanceRemainingM),
      lateralOffsetM: projection.lateralOffsetM,
      verifiedMediaPreviews,
    });
  }

  return items.sort((a, b) => a.distanceRemainingM - b.distanceRemainingM);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pont de lecture de tuiles, parcours et graphe pour le guidage hors ligne
// ─────────────────────────────────────────────────────────────────────────────

export class OfflineNavigationBridge {
  private readonly packManager: OfflinePackManager;
  private localRoutingEngine: OfflineLocalRoutingGraphEngine | null;

  constructor(
    packManager: OfflinePackManager,
    localRoutingEngine: OfflineLocalRoutingGraphEngine | null = null,
  ) {
    this.packManager = packManager;
    this.localRoutingEngine = localRoutingEngine;
  }

  setLocalRoutingEngine(engine: OfflineLocalRoutingGraphEngine | null): void {
    this.localRoutingEngine = engine;
  }

  /**
   * Recherche tous les paquets installés et vérifiés (`available` ou `degraded`)
   * qui intersectent ou contiennent `bounds` (et optionnellement `zoom`).
   * Un paquet corrompu ou en cours de téléchargement n'est jamais retourné.
   */
  lookupCoveringPacksForBounds(
    bounds: ZoneBounds,
    zoom?: number,
    requireFullContainment = false,
  ): OfflineInstalledPackRecord[] {
    const installed = this.packManager.listInstalledPacks();
    return installed.filter((pack) => {
      if (pack.status !== 'available' && pack.status !== 'degraded') return false;
      const geoMatch = requireFullContainment
        ? boundsContainsBounds(pack.manifest.bounds, bounds)
        : boundsIntersect(pack.manifest.bounds, bounds);
      if (!geoMatch) return false;
      if (typeof zoom === 'number') {
        return zoom >= pack.manifest.minZoom && zoom <= pack.manifest.maxZoom;
      }
      return true;
    });
  }

  /**
   * Lit une tuile (`vector`, `dem`, `routing_graph`) depuis un paquet hors ligne
   * vérifié.
   * Invariant : aucune tuile n'est jamais inventée. Si aucun paquet ne couvre
   * l'emprise ou le niveau de zoom, retourne `status: 'unavailable'` avec la raison exacte.
   */
  readOfflineTile(
    tile: TileCoordinate,
    layer: 'vector' | 'dem' | 'routing_graph' = 'vector',
  ): OfflineTileReadResult {
    const tileBounds = tileToBounds(tile);
    const tileCenterLng = (tileBounds.west + tileBounds.east) / 2;
    const tileCenterLat = (tileBounds.south + tileBounds.north) / 2;

    const allInstalled = this.packManager.listInstalledPacks();
    const verifiedPacks = allInstalled.filter(
      (p) => p.status === 'available' || p.status === 'degraded',
    );

    const packsCoveringGeo = verifiedPacks.filter(
      (p) =>
        boundsContainsPoint(p.manifest.bounds, tileCenterLng, tileCenterLat) ||
        boundsIntersect(p.manifest.bounds, tileBounds),
    );

    if (packsCoveringGeo.length === 0) {
      const hasUnverifiedOrCorrupted = allInstalled.some((p) =>
        boundsIntersect(p.manifest.bounds, tileBounds),
      );
      return {
        status: 'unavailable',
        reason: hasUnverifiedOrCorrupted ? 'pack_not_verified' : 'no_covering_pack',
        packId: null,
        tile,
        layer,
        payload: null,
      };
    }

    const packsCoveringZoom = packsCoveringGeo.filter(
      (p) => tile.z >= p.manifest.minZoom && tile.z <= p.manifest.maxZoom,
    );

    if (packsCoveringZoom.length === 0) {
      return {
        status: 'unavailable',
        reason: 'zoom_out_of_range',
        packId: packsCoveringGeo[0].manifest.packId,
        tile,
        layer,
        payload: null,
      };
    }

    const targetResourceKind =
      layer === 'vector'
        ? 'vector_tile'
        : layer === 'dem'
          ? 'dem_tile'
          : 'routing_graph_tile';

    const targetKey = tileCoordKey(tile);

    for (const pack of packsCoveringZoom) {
      const descriptor = pack.manifest.resources.find(
        (r) =>
          r.kind === targetResourceKind &&
          r.tile &&
          tileCoordKey(r.tile) === targetKey,
      );
      if (!descriptor) continue;

      const chunk = pack.verifiedResources.get(descriptor.id);
      if (!chunk) {
        return {
          status: 'unavailable',
          reason: 'resource_missing',
          packId: pack.manifest.packId,
          tile,
          layer,
          payload: null,
        };
      }

      const check = verifyResourcePayload(descriptor, chunk.payload);
      if (!check.ok) {
        return {
          status: 'unavailable',
          reason: 'checksum_mismatch',
          packId: pack.manifest.packId,
          tile,
          layer,
          payload: null,
        };
      }

      return {
        status: 'available',
        reason: null,
        packId: pack.manifest.packId,
        tile,
        layer,
        payload: chunk.payload,
      };
    }

    return {
      status: 'unavailable',
      reason: 'resource_missing',
      packId: packsCoveringZoom[0].manifest.packId,
      tile,
      layer,
      payload: null,
    };
  }

  /**
   * Charge les données complètes de navigation d'un itinéraire (`route_geometry`,
   * manœuvres, profil altimétrique, POI et fermetures connues) depuis un paquet
   * hors ligne vérifié.
   */
  readOfflineRouteBundle(routeId: string): OfflineRouteBundleReadResult {
    const installed = this.packManager.listInstalledPacks();
    const candidate = installed.find((p) => p.manifest.routeId === routeId);

    if (!candidate) {
      return {
        status: 'unavailable',
        reason: 'route_not_in_offline_packs',
        packId: null,
        routeData: null,
        capabilities: null,
      };
    }

    if (candidate.status !== 'available' && candidate.status !== 'degraded') {
      return {
        status: 'unavailable',
        reason: 'pack_corrupted',
        packId: candidate.manifest.packId,
        routeData: null,
        capabilities: candidate.capabilities,
      };
    }

    const routeDescriptor = candidate.manifest.resources.find(
      (r) => r.kind === 'route_geometry',
    );
    if (!routeDescriptor) {
      return {
        status: 'unavailable',
        reason: 'missing_route_geometry',
        packId: candidate.manifest.packId,
        routeData: null,
        capabilities: candidate.capabilities,
      };
    }

    const chunk = candidate.verifiedResources.get(routeDescriptor.id);
    if (!chunk || !verifyResourcePayload(routeDescriptor, chunk.payload).ok) {
      return {
        status: 'unavailable',
        reason: 'pack_corrupted',
        packId: candidate.manifest.packId,
        routeData: null,
        capabilities: candidate.capabilities,
      };
    }

    try {
      const jsonText =
        typeof chunk.payload === 'string'
          ? chunk.payload
          : new TextDecoder().decode(toUtf8Bytes(chunk.payload));
      const parsed = JSON.parse(jsonText) as OfflineRouteNavigationData;
      return {
        status: candidate.status,
        reason: null,
        packId: candidate.manifest.packId,
        routeData: parsed,
        capabilities: candidate.capabilities,
      };
    } catch {
      return {
        status: 'unavailable',
        reason: 'pack_corrupted',
        packId: candidate.manifest.packId,
        routeData: null,
        capabilities: candidate.capabilities,
      };
    }
  }

  /**
   * Vérifie si un graphe de routage hors ligne vérifié et un moteur local
   * compatible sont disponibles pour l'emprise et le sport demandés.
   */
  lookupOfflineRoutingGraph(
    bounds: ZoneBounds,
    sport: Sport,
  ): OfflineRoutingGraphLookupResult {
    const coveringPacks = this.lookupCoveringPacksForBounds(bounds);
    if (coveringPacks.length === 0) {
      return {
        status: 'unavailable',
        reason: 'no_covering_pack',
        packId: null,
        graphTiles: [],
      };
    }

    for (const pack of coveringPacks) {
      const graphDescriptors = pack.manifest.resources.filter(
        (r) => r.kind === 'routing_graph_tile',
      );
      if (graphDescriptors.length === 0) continue;

      const graphPayloads: (Uint8Array | string)[] = [];
      let allValid = true;
      for (const desc of graphDescriptors) {
        const chunk = pack.verifiedResources.get(desc.id);
        if (!chunk || !verifyResourcePayload(desc, chunk.payload).ok) {
          allValid = false;
          break;
        }
        graphPayloads.push(chunk.payload);
      }

      if (!allValid || graphPayloads.length === 0) continue;

      if (!this.localRoutingEngine) {
        return {
          status: 'unavailable',
          reason: 'engine_not_configured',
          packId: pack.manifest.packId,
          graphTiles: [],
        };
      }

      if (!this.localRoutingEngine.supportsSport(sport)) {
        return {
          status: 'unavailable',
          reason: 'sport_not_supported',
          packId: pack.manifest.packId,
          graphTiles: [],
        };
      }

      return {
        status: 'available',
        reason: null,
        packId: pack.manifest.packId,
        graphTiles: graphPayloads,
      };
    }

    return {
      status: 'unavailable',
      reason: 'no_routing_graph_in_pack',
      packId: coveringPacks[0].manifest.packId,
      graphTiles: [],
    };
  }

  /**
   * Crée un adaptateur de recalcul compatible avec le contrat `RerouteProviderAdapter`
   * du lot N01 (`K4.05`) :
   * - Si un graphe de routage local vérifié couvre l'emprise `(from, to)` et
   *   qu'un moteur local compatible est branché, calcule le détour hors réseau.
   * - Sinon, échoue proprement (`leg: null, reason: 'provider_unavailable'`)
   *   sans jamais inventer de géométrie, permettant à N01 d'afficher le mode
   *   `offline_return_only` (cap et distance de retour vers la trace).
   */
  createOfflineRerouteAdapter(): (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    sport: Sport,
    signal?: AbortSignal,
  ) => Promise<{
    leg: {
      distanceM: number;
      durationS: number;
      geometry: readonly [number, number][];
      provider: string;
    } | null;
    reason: 'off_network' | 'provider_unavailable' | 'rate_limited' | null;
  }> {
    return async (from, to, sport, signal) => {
      if (signal?.aborted) {
        return { leg: null, reason: 'provider_unavailable' };
      }

      const bounds: ZoneBounds = {
        west: Math.min(from.lng, to.lng) - 0.005,
        east: Math.max(from.lng, to.lng) + 0.005,
        south: Math.min(from.lat, to.lat) - 0.005,
        north: Math.max(from.lat, to.lat) + 0.005,
      };

      const lookup = this.lookupOfflineRoutingGraph(bounds, sport);
      if (lookup.status !== 'available' || !this.localRoutingEngine) {
        return { leg: null, reason: 'provider_unavailable' };
      }

      const detour = await this.localRoutingEngine.computeDetour({
        from,
        to,
        sport,
        graphTiles: lookup.graphTiles,
      });

      if (!detour || detour.geometry.length < 2) {
        return { leg: null, reason: 'off_network' };
      }

      return {
        leg: {
          distanceM: detour.distanceM,
          durationS: detour.durationS,
          geometry: detour.geometry,
          provider: 'offline-local-graph',
        },
        reason: null,
      };
    };
  }
}
