// src/features/pays/mappers/geoBbox.ts
// Calcule la bbox d'une géométrie GeoJSON (ou d'une chaîne GeoJSON) pour
// interroger les sentiers du pays. Retourne null si non exploitable.

export interface GeoBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function collectCoordinates(node: unknown, out: Array<[number, number]>): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[0] as number, node[1] as number]);
      return;
    }
    for (const child of node) collectCoordinates(child, out);
    return;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'Feature') {
      collectCoordinates(obj.geometry, out);
      return;
    }
    if (obj.type === 'GeometryCollection') {
      collectCoordinates(obj.geometries, out);
      return;
    }
    if (obj.coordinates) collectCoordinates(obj.coordinates, out);
  }
}

export function computeGeometryBbox(geometry: unknown): GeoBbox | null {
  let input = geometry;

  // Certaines configurations PostgREST renvoient la géométrie en chaîne JSON.
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }

  const coordinates: Array<[number, number]> = [];
  collectCoordinates(input, coordinates);
  if (coordinates.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of coordinates) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return Number.isFinite(minLat) ? { minLat, maxLat, minLng, maxLng } : null;
}
