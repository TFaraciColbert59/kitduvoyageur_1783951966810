/**
 * CHANTIER ATLAS — Phase 4
 * Construction pure des couches de densité (matviews Phase 1) :
 *   - palier continent : un point pondéré par pays (country_trail_density) ;
 *   - palier région : un point pondéré par cellule geohash-5 (trail_density_geohash5).
 * Aucune donnée inventée : les lignes invalides sont écartées (ATLAS-R9).
 */

export interface CountryDensityRow {
  iso_a2: string;
  name: string;
  trail_count: number;
  centroid_lat: number;
  centroid_lng: number;
}

export interface RegionDensityCell {
  geohash: string;
  trail_count: number;
  center_lat: number;
  center_lng: number;
}

interface DensityFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, string | number>;
}

export interface DensityFeatureCollection {
  type: 'FeatureCollection';
  features: DensityFeature[];
}

function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

export function buildCountryDensityFC(rows: CountryDensityRow[]): DensityFeatureCollection {
  const features: DensityFeature[] = [];
  for (const row of rows) {
    if (!isValidCoordinate(row.centroid_lat, row.centroid_lng)) continue;
    if (!Number.isFinite(Number(row.trail_count)) || Number(row.trail_count) <= 0) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(row.centroid_lng), Number(row.centroid_lat)] },
      properties: {
        iso: String(row.iso_a2 ?? '').toUpperCase(),
        name: String(row.name ?? ''),
        count: Number(row.trail_count),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function buildRegionDensityFC(cells: RegionDensityCell[]): DensityFeatureCollection {
  const features: DensityFeature[] = [];
  for (const cell of cells) {
    if (!isValidCoordinate(cell.center_lat, cell.center_lng)) continue;
    if (!Number.isFinite(Number(cell.trail_count)) || Number(cell.trail_count) <= 0) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(cell.center_lng), Number(cell.center_lat)] },
      properties: {
        geohash: String(cell.geohash ?? ''),
        count: Number(cell.trail_count),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
