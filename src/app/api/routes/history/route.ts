import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseGeoJsonTrace } from '@/features/community/v2/create/carnet/gpx';

export const dynamic = 'force-dynamic';

export interface ImportableTrackEntry {
  readonly id: string;
  readonly kind: 'sortie' | 'carnet' | 'randonnee' | 'enregistre';
  readonly title: string;
  readonly subtitle: string;
  readonly distanceKm: number | null;
  readonly ascentM: number | null;
  readonly coordinates: readonly [number, number][];
}

function extractCoords(raw: unknown): [number, number][] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return parseGeoJsonTrace(raw);
  }
  if (Array.isArray(raw)) {
    const pts: [number, number][] = [];
    for (const item of raw) {
      if (
        Array.isArray(item) &&
        item.length >= 2 &&
        typeof item[0] === 'number' &&
        typeof item[1] === 'number'
      ) {
        pts.push([item[0], item[1]]);
      }
    }
    return pts;
  }
  if (typeof raw === 'object') {
    const obj = raw as { type?: string; coordinates?: unknown; geometry?: unknown };
    if (obj.type === 'LineString' && Array.isArray(obj.coordinates)) {
      return extractCoords(obj.coordinates);
    }
    if (obj.geometry) return extractCoords(obj.geometry);
  }
  return [];
}

/**
 * GET /api/routes/history
 * Retourne les tracés importables depuis :
 * - Historique personnel (`hike_sessions` sorties GPS, `carnets`, `trips`)
 * - Randonnées & traces enregistrées (`trails`)
 */
export async function GET() {
  const items: ImportableTrackEntry[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [sessionsRes, carnetsRes] = await Promise.allSettled([
        supabase
          .from('hike_sessions')
          .select('id, title, started_at, distance_km, elevation_gain_m, positions_geojson')
          .eq('user_id', user.id)
          .not('positions_geojson', 'is', null)
          .order('started_at', { ascending: false })
          .limit(12),
        supabase
          .from('carnets')
          .select('id, title, created_at, distance_km, denivele_m, trace')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value.data)) {
        for (const s of sessionsRes.value.data as Array<{
          id: string;
          title?: string | null;
          started_at?: string | null;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
          positions_geojson?: unknown;
        }>) {
          const coords = extractCoords(s.positions_geojson);
          if (coords.length < 2) continue;
          items.push({
            id: `sortie-${s.id}`,
            kind: 'sortie',
            title: s.title || 'Sortie enregistrée',
            subtitle: s.started_at ? s.started_at.slice(0, 10) : 'Historique GPS',
            distanceKm: s.distance_km ?? null,
            ascentM: s.elevation_gain_m ?? null,
            coordinates: coords,
          });
        }
      }

      if (carnetsRes.status === 'fulfilled' && Array.isArray(carnetsRes.value.data)) {
        for (const c of carnetsRes.value.data as Array<{
          id: string;
          title?: string | null;
          created_at?: string | null;
          distance_km?: number | null;
          denivele_m?: number | null;
          trace?: unknown;
        }>) {
          const coords = extractCoords(c.trace);
          if (coords.length < 2) continue;
          items.push({
            id: `carnet-${c.id}`,
            kind: 'carnet',
            title: c.title || 'Carnet de voyage',
            subtitle: c.created_at ? c.created_at.slice(0, 10) : 'Carnet',
            distanceKm: c.distance_km ?? null,
            ascentM: c.denivele_m ?? null,
            coordinates: coords,
          });
        }
      }
    }

    // Randonnées & traces enregistrées du catalogue LKDV
    const trailsRes = await supabase
      .from('trails')
      .select('id, name, region, distance_km, elevation_gain_m, geojson')
      .not('geojson', 'is', null)
      .limit(10);

    if (Array.isArray(trailsRes.data)) {
      for (const t of trailsRes.data as Array<{
        id: string;
        name?: string | null;
        region?: string | null;
        distance_km?: number | null;
        elevation_gain_m?: number | null;
        geojson?: unknown;
      }>) {
        const coords = extractCoords(t.geojson);
        if (coords.length < 2) continue;
        items.push({
          id: `trail-${t.id}`,
          kind: 'randonnee',
          title: t.name || 'Randonnée LKDV',
          subtitle: t.region || 'Catalogue LKDV',
          distanceKm: t.distance_km ?? null,
          ascentM: t.elevation_gain_m ?? null,
          coordinates: coords,
        });
      }
    }
  } catch {
    /* retour gracieux si Supabase indisponible */
  }

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
