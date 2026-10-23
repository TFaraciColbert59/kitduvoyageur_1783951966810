import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeMassifName,
  type GeoMassifRow,
} from '@/features/compas/engine/geoMassifs';
import { mapStats } from '@/features/compte/data/accountBootstrap';
import {
  boundsOf,
  mergeBounds,
  parsePositions,
  simplifyTrack,
} from '../geometry';
import type {
  CompteMapPayload,
  MapCarnet,
  MapMassif,
  MapPoi,
  MapTrack,
} from '../types';

export interface MapSessionRow {
  id: string;
  title: string | null;
  route_id: number | null;
  started_at: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
  max_altitude_m: number | null;
  positions_geojson: unknown;
  visibility: string | null;
  kit_id: string | null;
  carnet_id: string | null;
  poi_events: unknown;
}

export interface MapStatsSessionRow {
  id: string;
  route_id: number | null;
  started_at: string | null;
  distance_km: number | string | null;
  elevation_gain_m: number | string | null;
}

export interface MapRouteRow {
  id: number;
  name: string | null;
  region: string | null;
}

export interface MapCarnetRow {
  id: string;
  title: string | null;
  cover_image: string | null;
}

export interface CompteMapSourceRows {
  sessions: MapSessionRow[];
  statsSessions: MapStatsSessionRow[];
  routes: MapRouteRow[];
  geoMassifs: GeoMassifRow[];
  photoCounts: Map<string, number>;
  participantCounts: Map<string, number>;
  carnets: MapCarnetRow[];
  kitNames: Map<string, string>;
}

const MAX_TRACKS = 80;
const MAX_POINTS = 120;

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function yearOf(value: string | null): number | null {
  if (!value) return null;
  const year = new Date(value).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

function visibility(value: string | null): MapTrack['visibility'] {
  return value === 'collective_anonymized' ? 'collective_anonymized' : 'private';
}

function poisFor(session: MapSessionRow): MapPoi[] {
  if (!Array.isArray(session.poi_events)) return [];
  return session.poi_events.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label) return [];
    const day = Number(row.day);
    return [
      {
        id: `poi_${session.id}_${index}`,
        outingId: session.id,
        label,
        day: Number.isFinite(day) ? day : null,
        position: { lat, lng },
      },
    ];
  });
}

export function buildCompteMapPayload(rows: CompteMapSourceRows): CompteMapPayload {
  const routeById = new Map(rows.routes.map((route) => [route.id, route]));
  const geoByKey = new Map(
    rows.geoMassifs
      .map((massif) => [massif.name_plain, massif] as const)
      .filter(([key]) => Boolean(key))
  );
  const carnetById = new Map(rows.carnets.map((carnet) => [carnet.id, carnet]));

  const tracks: MapTrack[] = [];
  const massifCounts = new Map<
    string,
    { massif: GeoMassifRow; outings: number; verified: boolean }
  >();
  const carnets: MapCarnet[] = [];
  const pois: MapPoi[] = [];

  // Les massifs sont comptés sur toutes les sorties, pas seulement les 80
  // traces affichées : un massif visité il y a deux ans reste visité.
  for (const session of rows.statsSessions) {
    const route = session.route_id ? routeById.get(session.route_id) : undefined;
    const key = normalizeMassifName(route?.region);
    if (!key) continue;
    const massif = geoByKey.get(key);
    if (!massif) continue;
    const current = massifCounts.get(key) ?? { massif, outings: 0, verified: false };
    current.outings += 1;
    massifCounts.set(key, current);
  }

  for (const session of rows.sessions.slice(0, MAX_TRACKS)) {
    const route = session.route_id ? routeById.get(session.route_id) : undefined;
    const region = route?.region?.trim() || '';
    const key = normalizeMassifName(region);
    const massifRow = key ? geoByKey.get(key) : undefined;
    const points = simplifyTrack(parsePositions(session.positions_geojson), MAX_POINTS);
    const verified = points.length >= 2;

    if (massifRow && key && verified) {
      const current = massifCounts.get(key);
      if (current) current.verified = true;
    }

    if (!verified) {
      for (const poi of poisFor(session)) pois.push(poi);
      continue;
    }

    const start = points[0];
    const end = points[points.length - 1];
    const track: MapTrack = {
      id: session.id,
      title:
        session.title?.trim() ||
        route?.name?.trim() ||
        (session.started_at ? `Sortie du ${session.started_at.slice(0, 10)}` : 'Sortie'),
      startedAt: session.started_at,
      year: yearOf(session.started_at),
      km: number(session.distance_km),
      dplus: number(session.elevation_gain_m),
      maxAlt: session.max_altitude_m,
      verified,
      visibility: visibility(session.visibility),
      massif: massifRow?.name || region || null,
      massifId: massifRow ? `massif_${massifRow.geoname_id}` : null,
      kitId: session.kit_id,
      kitName: session.kit_id ? rows.kitNames.get(session.kit_id) ?? null : null,
      carnetId: session.carnet_id,
      photosCount: rows.photoCounts.get(session.id) ?? 0,
      participantsCount: rows.participantCounts.get(session.id) ?? 0,
      coordinates: points,
      bounds: boundsOf(points)!,
      start,
      end,
    };
    tracks.push(track);

    for (const poi of poisFor(session)) pois.push(poi);

    const carnet = session.carnet_id ? carnetById.get(session.carnet_id) : undefined;
    if (carnet && !carnets.some((entry) => entry.id === carnet.id)) {
      carnets.push({
        id: carnet.id,
        title: carnet.title?.trim() || 'Carnet',
        coverUrl: carnet.cover_image?.trim() || null,
        outingId: session.id,
        position: start,
      });
    }
  }

  const massifs: MapMassif[] = [...massifCounts.values()].map((entry) => ({
    id: `massif_${entry.massif.geoname_id}`,
    name: entry.massif.name,
    countryCode: entry.massif.country_code,
    center: { lng: entry.massif.lon, lat: entry.massif.lat },
    outings: entry.outings,
    verified: entry.verified,
  }));

  const stats = mapStats(
    rows.statsSessions as never,
    rows.routes as never,
    rows.geoMassifs as never
  );
  const bounds = mergeBounds([
    ...tracks.map((track) => track.bounds),
    ...massifs.map(
      (massif): [number, number, number, number] => [
        massif.center.lng,
        massif.center.lat,
        massif.center.lng,
        massif.center.lat,
      ]
    ),
    ...pois.map(
      (poi): [number, number, number, number] => [
        poi.position.lng,
        poi.position.lat,
        poi.position.lng,
        poi.position.lat,
      ]
    ),
  ]);

  return {
    tracks,
    massifs,
    carnets,
    pois,
    stats: {
      outings: stats.outings,
      km: stats.km,
      dplus: stats.dplus,
      massifs: massifs.length,
      countries: stats.countries,
    },
    bounds,
    truncated: rows.statsSessions.length > rows.sessions.length,
    generatedAt: new Date().toISOString(),
  };
}

export async function loadCompteMap(
  supabase: SupabaseClient,
  userId: string
): Promise<CompteMapPayload> {
  const [sessionRes, statsRes] = await Promise.all([
    supabase
      .from('hike_sessions')
      .select(
        'id,title,route_id,started_at,distance_km,elevation_gain_m,max_altitude_m,positions_geojson,visibility,kit_id,carnet_id,poi_events'
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(MAX_TRACKS),
    supabase
      .from('hike_sessions')
      .select('id,route_id,started_at,distance_km,elevation_gain_m')
      .eq('user_id', userId),
  ]);

  const sessions = (sessionRes.data ?? []) as unknown as MapSessionRow[];
  const statsSessions = (statsRes.data ?? []) as unknown as MapStatsSessionRow[];
  const sessionIds = sessions.map((session) => session.id);
  const routeIds = [
    ...new Set(
      statsSessions
        .map((session) => session.route_id)
        .filter((id): id is number => typeof id === 'number')
    ),
  ];
  const kitIds = [
    ...new Set(sessions.map((session) => session.kit_id).filter((id): id is string => Boolean(id))),
  ];
  const carnetIds = [
    ...new Set(
      sessions.map((session) => session.carnet_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const [photoRes, participantRes, routeRes, kitRes, carnetRes] = await Promise.all([
    sessionIds.length
      ? supabase.from('hike_session_photos').select('session_id').in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: string }> }),
    sessionIds.length
      ? supabase
          .from('hike_session_participants')
          .select('session_id,role')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ session_id: string; role: string | null }> }),
    routeIds.length
      ? supabase.from('hiking_routes').select('id,name,region').in('id', routeIds)
      : Promise.resolve({ data: [] as MapRouteRow[] }),
    kitIds.length
      ? supabase.from('materiel_kits').select('id,name').in('id', kitIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    carnetIds.length
      ? supabase.from('carnets').select('id,title,cover_image').in('id', carnetIds)
      : Promise.resolve({ data: [] as MapCarnetRow[] }),
  ]);

  const routes = (routeRes.data ?? []) as MapRouteRow[];
  const massifKeys = [
    ...new Set(
      routes
        .map((route) => normalizeMassifName(route.region))
        .filter((key): key is string => Boolean(key))
    ),
  ];
  const massifRes = massifKeys.length
    ? await supabase
        .from('geo_massifs')
        .select('geoname_id,feature_code,name,name_plain,country_code,lat,lon,elevation_m')
        .in('name_plain', massifKeys)
    : { data: [] as GeoMassifRow[] };

  const photoCounts = new Map<string, number>();
  for (const row of (photoRes.data ?? []) as Array<{ session_id: string }>) {
    photoCounts.set(row.session_id, (photoCounts.get(row.session_id) ?? 0) + 1);
  }

  const participantCounts = new Map<string, number>();
  for (const row of (participantRes.data ?? []) as Array<{
    session_id: string;
    role: string | null;
  }>) {
    // Le propriétaire est aussi une ligne `owner` : on ne compte que les
    // compagnons réels, sinon toutes les sorties seraient « partagées ».
    if (row.role === 'guest') {
      participantCounts.set(row.session_id, (participantCounts.get(row.session_id) ?? 0) + 1);
    }
  }

  const kitNames = new Map(
    ((kitRes.data ?? []) as Array<{ id: string; name: string | null }>).map((kit) => [
      kit.id,
      kit.name?.trim() || 'Kit',
    ])
  );

  return buildCompteMapPayload({
    sessions,
    statsSessions,
    routes,
    geoMassifs: (massifRes.data ?? []) as GeoMassifRow[],
    photoCounts,
    participantCounts,
    carnets: (carnetRes.data ?? []) as MapCarnetRow[],
    kitNames,
  });
}
