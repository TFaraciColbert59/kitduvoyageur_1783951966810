'use server';

import { createClient } from '@/lib/supabase/server';

export interface CorridorPoi {
  osmId: string;
  subtype: string;
  name: string | null;
  lat: number;
  lon: number;
  eleM: number | null;
  potable: boolean | null;
  seenOn: string;
}

const USEFUL_SUBTYPES = [
  'drinking_water',
  'spring',
  'alpine_hut',
  'wilderness_hut',
  'shelter',
  'camp_site',
];

export async function readCorridorPois(input: {
  lat: number;
  lon: number;
  radiusDeg?: number;
}): Promise<{ ok: true; pois: CorridorPoi[]; caveat: string } | { ok: false; pois: CorridorPoi[]; caveat: string }> {
  const caveat = 'Source OpenStreetMap : ne prouve ni la potabilité de l’eau ni l’ouverture actuelle.';
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    return { ok: false, pois: [], caveat };
  }
  const delta = Math.min(0.25, Math.max(0.02, input.radiusDeg ?? 0.08));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('geo_pois')
    .select('osm_id,subtype,name,lat,lon,ele_m,potable,seen_on')
    .in('subtype', USEFUL_SUBTYPES)
    .gte('lat', input.lat - delta)
    .lte('lat', input.lat + delta)
    .gte('lon', input.lon - delta)
    .lte('lon', input.lon + delta)
    .limit(20);

  if (error || !Array.isArray(data)) {
    return { ok: false, pois: [], caveat };
  }

  return {
    ok: true,
    caveat,
    pois: data.map((row) => ({
      osmId: String(row.osm_id),
      subtype: String(row.subtype),
      name: row.name ? String(row.name) : null,
      lat: Number(row.lat),
      lon: Number(row.lon),
      eleM: row.ele_m == null ? null : Number(row.ele_m),
      potable: row.potable == null ? null : Boolean(row.potable),
      seenOn: String(row.seen_on ?? ''),
    })),
  };
}
