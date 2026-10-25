import { createClient } from '@/lib/supabase/server';
import type {
  CountryDensityRow,
  RegionDensityCell,
} from '@/components/map/layers/densityLayers';

/**
 * CHANTIER ATLAS — Phase 4
 * Lecture SSR des vues matérialisées de densité (Phase 1) :
 *   - country_trail_density  (palier continent)
 *   - trail_density_geohash5 (palier région)
 * ATLAS-R9 : en cas d'erreur, on retourne une liste vide (jamais de donnée inventée).
 */

export interface AtlasDensity {
  countries: CountryDensityRow[];
  cells: RegionDensityCell[];
}

interface CacheEntry {
  data: AtlasDensity;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

export async function getAtlasDensity(): Promise<AtlasDensity> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const supabase = await createClient();
  const [countriesResult, cellsResult] = await Promise.all([
    supabase
      .from('country_trail_density')
      .select('iso_a2, name, trail_count, centroid_lat, centroid_lng')
      .gt('trail_count', 0)
      .order('trail_count', { ascending: false })
      .limit(300),
    supabase
      .from('trail_density_geohash5')
      .select('geohash, trail_count, center_lat, center_lng')
      .gt('trail_count', 0)
      .order('trail_count', { ascending: false })
      .limit(2000),
  ]);

  if (countriesResult.error || cellsResult.error) {
    // Chaque source est traitée indépendamment : une matview en échec ne fait pas
    // disparaître l'autre. Jamais de résultat partiel mis en cache.
    console.error('[getAtlasDensity] erreurs matviews', {
      countries: countriesResult.error?.message ?? null,
      cells: cellsResult.error?.message ?? null,
    });
    if (countriesResult.error && cellsResult.error) {
      return cache?.data ?? { countries: [], cells: [] };
    }
    return {
      countries: (countriesResult.data ?? []) as CountryDensityRow[],
      cells: (cellsResult.data ?? []) as RegionDensityCell[],
    };
  }

  const data: AtlasDensity = {
    countries: (countriesResult.data ?? []) as CountryDensityRow[],
    cells: (cellsResult.data ?? []) as RegionDensityCell[],
  };
  cache = { data, timestamp: now };
  return data;
}
