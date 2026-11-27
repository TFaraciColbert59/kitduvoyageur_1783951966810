/**
 * POST /api/explorer/v2/route-plan
 *
 * Hybrid Personalized, Multimodal & Explainable POI Routing BFF:
 * 1. Loads authenticated (or Guest Fail-Safe) `UserCapabilityManifest` from Supabase.
 * 2. Strictly enforces Silent Fail-Safe mode gating (no unproven modes or waterways).
 * 3. Fetches live multi-point environment (Open-Meteo weather/snow/freezing + NOAA daylight + NASA EONET).
 * 4. Executes:
 *    - Local corridor (<= 35 km, non-multimodal): Overpass OSM + AWS Terrarium DEM -> Rust/WASM kernel
 *      (`public/wasm/lkdv_route_core.wasm`) producing 1 Recommended + up to 2 Admissible Alternatives.
 *    - Long-distance (> 35 km) or Multimodal or Overpass fallback: Valhalla FOSSGIS / Geoapify
 *      (with automatic Parking/Transit hub chaining) enriched with DEM & full biomechanical XAI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  routeAttempt,
  routeAttemptForSport,
  type RouteSport,
} from '@/features/adventure-prep/routingService';
import { loadServerCapabilityManifest } from '@/app/api/explorer/v2/capabilities/route';
import {
  buildLocalCorridorGraph,
  fetchRouteEnvironmentSnapshot,
  haversineDistanceM,
} from '@/features/explorer-v2/routing/corridorBuilder';
import {
  assembleItineraryFromExternalLegs,
  assembleItineraryFromKernel,
  modeLabelFr,
} from '@/features/explorer-v2/routing/itineraryAssembler';
import {
  buildKernelParams,
  executeRoutingKernel,
} from '@/features/explorer-v2/routing/wasmBridge';
import type {
  ComputedItinerary,
  ItineraryLeg,
  RoutePlanEndpoint,
  RoutePlanResponse,
  RoutingTravelMode,
} from '@/features/explorer-v2/routing/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EndpointSchema = z.object({
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  label: z.string().max(120).optional(),
  poiId: z.string().max(120).optional(),
});

const RoutePlanRequestSchema = z.object({
  origin: EndpointSchema,
  destination: EndpointSchema,
  mode: z
    .enum([
      'rando',
      'trail',
      'velo',
      'gravel',
      'vtt',
      'vae',
      'ski',
      'raquettes',
      'kayak',
      'multimodal',
    ])
    .optional(),
  kitId: z.string().max(120).nullable().optional(),
  packWeightKg: z.number().min(0).max(40).nullable().optional(),
  departureTimeIso: z.string().nullable().optional(),
});

function toRouteSport(mode: RoutingTravelMode): RouteSport {
  switch (mode) {
    case 'velo':
      return 'route';
    case 'gravel':
      return 'gravel';
    case 'vtt':
    case 'vae':
      return 'vtt';
    case 'rando':
    case 'trail':
    case 'ski':
    case 'raquettes':
    case 'kayak':
    case 'multimodal':
    default:
      return 'marche';
  }
}

function extractLegCoords(
  legs: ReadonlyArray<{ geometry?: readonly (readonly [number, number])[] | { coordinates?: Array<[number, number]> } }>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const l of legs) {
    const raw = Array.isArray(l.geometry)
      ? l.geometry
      : (l.geometry as { coordinates?: Array<[number, number]> } | undefined)?.coordinates ?? [];
    for (const pair of raw) {
      if (Array.isArray(pair) && pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1])) {
        out.push([Number(pair[0]), Number(pair[1])]);
      }
    }
  }
  return out;
}

function decodePolyline6(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e6, lat / 1e6]);
  }
  return coords;
}

interface ValhallaDecodedRoute {
  coordinates: Array<[number, number]>;
  distanceKm: number;
  durationMin: number;
}

function decodeValhallaTrip(trip?: {
  summary?: { length?: number; time?: number };
  legs?: Array<{ shape?: string }>;
}): ValhallaDecodedRoute | null {
  if (!trip?.legs?.length) return null;
  const coordinates: Array<[number, number]> = [];
  for (const leg of trip.legs) {
    if (typeof leg.shape === 'string' && leg.shape.length > 0) {
      const decoded = decodePolyline6(leg.shape);
      for (const c of decoded) coordinates.push(c);
    }
  }
  if (coordinates.length < 2) return null;
  const distanceKm = Math.max(0.1, Number((trip.summary?.length ?? 0).toFixed(2)));
  const durationMin = Math.max(1, Math.round((trip.summary?.time ?? 60) / 60));
  return { coordinates, distanceKm, durationMin };
}

async function queryValhallaWithAlternates(
  points: ReadonlyArray<{ lat: number; lon: number }>,
  costing: 'pedestrian' | 'bicycle' | 'auto',
  snapRadiusM = 5000,
  alternates = 2,
): Promise<ValhallaDecodedRoute[]> {
  try {
    const body = {
      locations: points.map((p) => ({ lon: p.lon, lat: p.lat, radius: snapRadiusM })),
      costing,
      ...(alternates > 0 ? { alternates } : {}),
      ...(costing === 'pedestrian'
        ? {
            costing_options: {
              pedestrian: {
                use_tracks: 1,
                walkway_factor: 0.9,
                max_hiking_difficulty: 3,
              },
            },
          }
        : {}),
      directions_options: { units: 'kilometers' },
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(
      `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`,
      {
        headers: {
          'User-Agent': 'LeKitDuVoyageur-ExplorerV2/2.0 (https://lekitduvoyageur.fr)',
          'X-Client-Id': 'lekitduvoyageur.fr',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      trip?: { summary?: { length?: number; time?: number }; legs?: Array<{ shape?: string }> };
      alternates?: Array<{
        trip?: { summary?: { length?: number; time?: number }; legs?: Array<{ shape?: string }> };
      }>;
    };
    const out: ValhallaDecodedRoute[] = [];
    const main = decodeValhallaTrip(data.trip);
    if (main) out.push(main);
    for (const alt of data.alternates ?? []) {
      const dec = decodeValhallaTrip(alt.trip);
      if (dec) out.push(dec);
    }
    return out;
  } catch {
    return [];
  }
}

async function queryValhallaPermissive(
  points: ReadonlyArray<{ lat: number; lon: number }>,
  costing: 'pedestrian' | 'bicycle' | 'auto',
  snapRadiusM = 5000,
): Promise<ValhallaDecodedRoute | null> {
  const routes = await queryValhallaWithAlternates(points, costing, snapRadiusM, 0);
  return routes[0] ?? null;
}

async function computeExternalSingleItinerary(params: {
  id: string;
  rank: number;
  roleCode: number;
  origin: RoutePlanEndpoint;
  destination: RoutePlanEndpoint;
  mode: RoutingTravelMode;
  viaPoint?: { lat: number; lng: number } | null;
  manifest: Awaited<ReturnType<typeof loadServerCapabilityManifest>>;
  env: Awaited<ReturnType<typeof fetchRouteEnvironmentSnapshot>>;
  departureMs: number;
  cacheOrigin: string;
  primaryReference?: { durationP50Min: number; dplusM: number; distanceKm: number } | null;
}): Promise<ComputedItinerary | null> {
  const t0 = Date.now();
  const points = params.viaPoint
    ? [
        { lat: params.origin.lat, lon: params.origin.lng },
        { lat: params.viaPoint.lat, lon: params.viaPoint.lng },
        { lat: params.destination.lat, lon: params.destination.lng },
      ]
    : [
        { lat: params.origin.lat, lon: params.origin.lng },
        { lat: params.destination.lat, lon: params.destination.lng },
      ];

  const sport = toRouteSport(params.mode);
  const straightM = haversineDistanceM(
    params.origin.lat,
    params.origin.lng,
    params.destination.lat,
    params.destination.lng,
  );
  const attempt =
    straightM <= 180_000
      ? await routeAttemptForSport(points, sport, undefined, undefined, undefined, {
          avoidFerries: true,
        })
      : { legs: null, reason: 'off_network' as const };

  if (!attempt.legs || attempt.legs.length === 0) {
    // 1. Permissive pedestrian snap via routingService (<= 180 km)
    const snap =
      straightM <= 180_000
        ? await routeAttempt(points, 'pieton', undefined, undefined, undefined, {
            snap: true,
          })
        : { legs: null, provider: 'valhalla' as const };

    if (snap.legs && snap.legs.length > 0) {
      const coords = extractLegCoords(snap.legs);
      if (coords.length >= 2) {
        const distKm = snap.legs.reduce((s, l) => s + l.distanceKm, 0);
        const durMin = Math.max(1, Math.round(snap.legs.reduce((s, l) => s + l.durationMin, 0)));
        const leg: ItineraryLeg = {
          id: `${params.id}-leg-0`,
          kind: 'terrain',
          mode: params.mode,
          label: modeLabelFr(params.mode),
          fromLabel: params.origin.label || 'Départ',
          toLabel: params.destination.label || 'Destination',
          distanceKm: Math.round(distKm * 100) / 100,
          durationMin: durMin,
          dplusM: 0,
          dminusM: 0,
          coordinates: coords,
        };
        return assembleItineraryFromExternalLegs({
          id: params.id,
          rank: params.rank,
          roleCode: params.roleCode,
          mode: params.mode,
          engineUsed: snap.provider === 'geoapify' ? 'geoapify_enriched' : 'valhalla_enriched',
          computeTimeMs: Date.now() - t0,
          legs: [leg],
          origin: params.origin,
          destination: params.destination,
          manifest: params.manifest,
          env: params.env,
          departureMs: params.departureMs,
          primaryReference: params.primaryReference,
        });
      }
    }

    // 2. Direct Valhalla permissive trailhead/summit snap (5 km radius) or long-distance transit corridor
    const useLongCorridor = straightM > 120_000;
    const direct = await queryValhallaPermissive(
      points,
      useLongCorridor
        ? 'auto'
        : params.mode === 'velo' || params.mode === 'gravel' || params.mode === 'vtt' || params.mode === 'vae'
          ? 'bicycle'
          : 'pedestrian',
      useLongCorridor ? 10_000 : 5000,
    );
    if (!direct) return null;

    const preferCar = params.manifest.hasCar && params.manifest.allowedApproachModes.includes('car');
    const legKind: ItineraryLeg['kind'] = useLongCorridor
      ? preferCar
        ? 'approach_car'
        : 'approach_transit'
      : 'terrain';
    const durationMin =
      legKind === 'approach_transit'
        ? Math.max(15, Math.round((direct.distanceKm / 72) * 60))
        : direct.durationMin;

    const leg: ItineraryLeg = {
      id: `${params.id}-leg-0`,
      kind: legKind,
      mode: legKind === 'approach_car' ? 'car' : legKind === 'approach_transit' ? 'public_transit' : params.mode,
      label:
        legKind === 'approach_car'
          ? 'Approche voiture'
          : legKind === 'approach_transit'
            ? 'Approche transports'
            : modeLabelFr(params.mode),
      fromLabel: params.origin.label || 'Départ',
      toLabel: params.destination.label || 'Destination',
      distanceKm: direct.distanceKm,
      durationMin,
      dplusM: 0,
      dminusM: 0,
      coordinates: direct.coordinates,
    };
    return assembleItineraryFromExternalLegs({
      id: params.id,
      rank: params.rank,
      roleCode: params.roleCode,
      mode: params.mode,
      engineUsed: useLongCorridor ? 'multimodal_hybrid' : 'valhalla_enriched',
      computeTimeMs: Date.now() - t0,
      legs: [leg],
      origin: params.origin,
      destination: params.destination,
      manifest: params.manifest,
      env: params.env,
      departureMs: params.departureMs,
      primaryReference: params.primaryReference,
    });
  }

  const coords = extractLegCoords(attempt.legs);
  if (coords.length < 2) return null;
  const distKm = attempt.legs.reduce((s, l) => s + l.distanceKm, 0);
  const durMin = Math.max(1, Math.round(attempt.legs.reduce((s, l) => s + l.durationMin, 0)));
  const leg: ItineraryLeg = {
    id: `${params.id}-leg-0`,
    kind: 'terrain',
    mode: params.mode,
    label: modeLabelFr(params.mode),
    fromLabel: params.origin.label || 'Départ',
    toLabel: params.destination.label || 'Destination',
    distanceKm: Math.round(distKm * 100) / 100,
    durationMin: durMin,
    dplusM: 0,
    dminusM: 0,
    coordinates: coords,
  };

  return assembleItineraryFromExternalLegs({
    id: params.id,
    rank: params.rank,
    roleCode: params.roleCode,
    mode: params.mode,
    engineUsed: attempt.provider === 'geoapify' ? 'geoapify_enriched' : 'valhalla_enriched',
    computeTimeMs: Date.now() - t0,
    legs: [leg],
    origin: params.origin,
    destination: params.destination,
    manifest: params.manifest,
    env: params.env,
    departureMs: params.departureMs,
    primaryReference: params.primaryReference,
  });
}

async function findNearestApproachHub(
  dest: RoutePlanEndpoint,
  preferKind: 'parking' | 'transit',
): Promise<{ kind: 'parking' | 'transit'; name: string; lat: number; lon: number } | null> {
  const pad = 0.03; // ~3 km radius around destination
  const bbox = `${(dest.lat - pad).toFixed(4)},${(dest.lng - pad).toFixed(4)},${(dest.lat + pad).toFixed(4)},${(dest.lng + pad).toFixed(4)}`;
  const filter =
    preferKind === 'parking'
      ? `node["amenity"="parking"](${bbox});`
      : `node["highway"="bus_stop"](${bbox});node["railway"~"^(station|halt)$"](${bbox});`;
  const q = `[out:json][timeout:4];(${filter});out body 25;`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `data=${encodeURIComponent(q)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }>;
    };
    let best: { kind: 'parking' | 'transit'; name: string; lat: number; lon: number; d: number } | null = null;
    for (const el of data.elements ?? []) {
      if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
      const d = haversineDistanceM(dest.lat, dest.lng, el.lat, el.lon);
      if (!best || d < best.d) {
        best = {
          kind: preferKind,
          name:
            el.tags?.name ||
            (preferKind === 'parking' ? 'Parking d’accès' : 'Arrêt transports en commun'),
          lat: el.lat,
          lon: el.lon,
          d,
        };
      }
    }
    return best ? { kind: best.kind, name: best.name, lat: best.lat, lon: best.lon } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RoutePlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Paramètres d’itinéraire invalides.' },
        { status: 400 },
      );
    }

    const { origin, destination, kitId, packWeightKg, departureTimeIso } = parsed.data;
    const departureMs =
      departureTimeIso && Number.isFinite(Date.parse(departureTimeIso))
        ? Date.parse(departureTimeIso)
        : Date.now();

    // 1. Load real user capability manifest (or Fail-Safe Guest)
    const manifest = await loadServerCapabilityManifest({
      selectedKitId: kitId ?? null,
      packWeightOverrideKg: packWeightKg ?? null,
    });

    // 2. Enforce strict Silent Fail-Safe mode validation
    const requestedMode = parsed.data.mode;
    const activeMode: RoutingTravelMode =
      requestedMode && manifest.allowedModes.includes(requestedMode)
        ? requestedMode
        : manifest.allowedModes[0] ?? 'rando';

    const straightM = haversineDistanceM(origin.lat, origin.lng, destination.lat, destination.lng);
    if (straightM < 15) {
      return NextResponse.json(
        { ok: false, error: 'Vous êtes déjà au point de destination.' },
        { status: 400 },
      );
    }

    // 3. Fetch live multi-point environment
    const env = await fetchRouteEnvironmentSnapshot(origin, destination, departureMs);
    const cacheOrigin = req.nextUrl.origin;

    const itineraries: ComputedItinerary[] = [];
    let offlineReady = false;

    // 4A. Multimodal automatic chaining (> 35 km or explicit multimodal mode)
    const shouldTryMultimodal =
      activeMode === 'multimodal' || (straightM > 35_000 && manifest.allowedApproachModes.length > 0);

    if (shouldTryMultimodal) {
      const preferCar = manifest.hasCar && manifest.allowedApproachModes.includes('car');
      const hub = await findNearestApproachHub(destination, preferCar ? 'parking' : 'transit');
      if (hub) {
        // Use auto corridor geometry for both car and public-transit long approaches (>25km)
        // so Valhalla never rejects >250km pedestrian walks.
        const [approachDirect, terrainDirect] = await Promise.all([
          queryValhallaPermissive(
            [
              { lat: origin.lat, lon: origin.lng },
              { lat: hub.lat, lon: hub.lon },
            ],
            'auto',
            5000,
          ),
          queryValhallaPermissive(
            [
              { lat: hub.lat, lon: hub.lon },
              { lat: destination.lat, lon: destination.lng },
            ],
            'pedestrian',
            5000,
          ),
        ]);

        if (approachDirect && terrainDirect) {
          const approachDur = preferCar
            ? approachDirect.durationMin
            : Math.max(10, Math.round((approachDirect.distanceKm / 72) * 60));

          const mmItinerary = await assembleItineraryFromExternalLegs({
            id: 'route-mm-0',
            rank: 0,
            roleCode: 0,
            mode: 'rando',
            engineUsed: 'multimodal_hybrid',
            computeTimeMs: 420,
            legs: [
              {
                id: 'leg-approach',
                kind: preferCar ? 'approach_car' : 'approach_transit',
                mode: preferCar ? 'car' : 'public_transit',
                label: preferCar ? 'Approche voiture' : 'Approche transports',
                fromLabel: origin.label || 'Départ',
                toLabel: hub.name,
                distanceKm: approachDirect.distanceKm,
                durationMin: approachDur,
                dplusM: 0,
                dminusM: 0,
                coordinates: approachDirect.coordinates,
              },
              {
                id: 'leg-terrain',
                kind: 'terrain',
                mode: 'rando',
                label: 'Approche à pied',
                fromLabel: hub.name,
                toLabel: destination.label || 'Destination',
                distanceKm: terrainDirect.distanceKm,
                durationMin: terrainDirect.durationMin,
                dplusM: 0,
                dminusM: 0,
                coordinates: terrainDirect.coordinates,
              },
            ],
            origin,
            destination,
            manifest,
            env,
            departureMs,
          });
          itineraries.push(mmItinerary);
        }
      }
    }

    // 4B. Local Corridor Rust/WASM Routing (<= 35 km)
    if (itineraries.length === 0 && straightM <= 35_000) {
      const corridor = await buildLocalCorridorGraph(origin, destination, manifest, env);
      if (corridor) {
        offlineReady = true;
        const kernelParams = buildKernelParams(manifest, env, activeMode);
        const execResult = await executeRoutingKernel(
          corridor.graph,
          corridor.startNode,
          corridor.goalNode,
          kernelParams,
        );

        if (execResult.routes.length > 0) {
          const primaryRaw = execResult.routes[0]!;
          const primary = assembleItineraryFromKernel({
            id: `route-wasm-0`,
            rank: 0,
            kernelRoute: primaryRaw,
            graph: corridor.graph,
            mode: activeMode,
            engineUsed: execResult.engineUsed,
            computeTimeMs: execResult.computeTimeMs,
            origin,
            destination,
            manifest,
            env,
            departureMs,
          });
          itineraries.push(primary);

          for (let i = 1; i < execResult.routes.length; i++) {
            const altRaw = execResult.routes[i]!;
            const alt = assembleItineraryFromKernel({
              id: `route-wasm-${i}`,
              rank: i,
              kernelRoute: altRaw,
              graph: corridor.graph,
              mode: activeMode,
              engineUsed: execResult.engineUsed,
              computeTimeMs: execResult.computeTimeMs,
              origin,
              destination,
              manifest,
              env,
              departureMs,
              primaryReference: {
                durationP50Min: primary.durationP50Min,
                dplusM: primary.dplusM,
                distanceKm: primary.distanceKm,
              },
            });
            itineraries.push(alt);
          }
        }
      }
    }

    // 4C. External Valhalla Native Alternates (100% loop-free, zero artificial via-point U-turn spurs!)
    if (itineraries.length === 0) {
      const tExt0 = Date.now();
      const useLongCorridor = straightM > 120_000;
      const costing: 'pedestrian' | 'bicycle' | 'auto' = useLongCorridor
        ? 'auto'
        : activeMode === 'velo' || activeMode === 'gravel' || activeMode === 'vtt' || activeMode === 'vae'
          ? 'bicycle'
          : 'pedestrian';

      const nativeRoutes = await queryValhallaWithAlternates(
        [
          { lat: origin.lat, lon: origin.lng },
          { lat: destination.lat, lon: destination.lng },
        ],
        costing,
        useLongCorridor ? 10_000 : 5000,
        2,
      );

      if (nativeRoutes.length > 0) {
        const preferCar = manifest.hasCar && manifest.allowedApproachModes.includes('car');
        const legKind: ItineraryLeg['kind'] = useLongCorridor
          ? preferCar
            ? 'approach_car'
            : 'approach_transit'
          : 'terrain';

        let primaryRef: { durationP50Min: number; dplusM: number; distanceKm: number } | null = null;

        for (let idx = 0; idx < nativeRoutes.length; idx++) {
          const nr = nativeRoutes[idx]!;
          const durMin =
            legKind === 'approach_transit'
              ? Math.max(15, Math.round((nr.distanceKm / 72) * 60))
              : nr.durationMin;

          const leg: ItineraryLeg = {
            id: `route-val-${idx}-leg-0`,
            kind: legKind,
            mode:
              legKind === 'approach_car'
                ? 'car'
                : legKind === 'approach_transit'
                  ? 'public_transit'
                  : activeMode,
            label:
              legKind === 'approach_car'
                ? 'Approche voiture'
                : legKind === 'approach_transit'
                  ? 'Approche transports'
                  : modeLabelFr(activeMode),
            fromLabel: origin.label || 'Départ',
            toLabel: destination.label || 'Destination',
            distanceKm: nr.distanceKm,
            durationMin: durMin,
            dplusM: 0,
            dminusM: 0,
            coordinates: nr.coordinates,
          };

          const assembled = await assembleItineraryFromExternalLegs({
            id: `route-val-${idx}`,
            rank: idx,
            roleCode: idx, // 0=recommended, 1=safer, 2=gentler
            mode: activeMode,
            engineUsed: useLongCorridor ? 'multimodal_hybrid' : 'valhalla_enriched',
            computeTimeMs: Date.now() - tExt0,
            legs: [leg],
            origin,
            destination,
            manifest,
            env,
            departureMs,
            primaryReference: primaryRef,
          });
          if (idx === 0) {
            primaryRef = {
              durationP50Min: assembled.durationP50Min,
              dplusM: assembled.dplusM,
              distanceKm: assembled.distanceKm,
            };
          }
          itineraries.push(assembled);
        }
      } else {
        // Final fallback via existing routingService (Geoapify / Valhalla)
        const primaryExt = await computeExternalSingleItinerary({
          id: 'route-ext-0',
          rank: 0,
          roleCode: 0,
          origin,
          destination,
          mode: activeMode,
          manifest,
          env,
          departureMs,
          cacheOrigin,
        });
        if (primaryExt) itineraries.push(primaryExt);
      }
    }

    if (itineraries.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Aucun itinéraire sûr compatible avec votre profil et vos équipements n’a pu être trouvé jusqu’à ce lieu.',
        },
        { status: 422 },
      );
    }

    const [recommended, ...alternatives] = itineraries;
    const response: RoutePlanResponse = {
      ok: true,
      origin,
      destination,
      manifestSummary: {
        authenticated: manifest.authenticated,
        allowedModes: manifest.allowedModes,
        activeMode,
        packWeightKg: manifest.packWeightKg,
        activeKitId: manifest.activeKitId,
        activeKitName: manifest.activeKitName,
        availableKits: manifest.availableKits,
        readinessScore: manifest.readiness.score,
        readinessStatus: manifest.readiness.status,
        calibrationSummary:
          manifest.dataSources[0] ?? 'Allure prudente par défaut (profil non calibré)',
      },
      environment: env,
      recommended: recommended!,
      alternatives,
      offlineReady,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=120',
      },
    });
  } catch (err) {
    console.error('[explorer/v2/route-plan] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Impossible de calculer l’itinéraire pour le moment.' },
      { status: 500 },
    );
  }
}
