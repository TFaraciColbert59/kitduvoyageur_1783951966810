/**
 * Phase 7 TRIBU — construction de la couche GeoJSON des positions membres.
 * Pur et testable : filtre les coordonnées invalides, jamais d'exception.
 */
export interface MemberPositionInput {
  userId: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MemberPositionFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { userId: string; name: string };
  }>;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function buildMemberPositionsGeoJSON(
  positions: MemberPositionInput[] | null | undefined
): MemberPositionFeatureCollection {
  const features = (positions ?? [])
    .filter((position) => isValidLatLng(position.lat, position.lng))
    .map((position) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(position.lng), Number(position.lat)] as [number, number],
      },
      properties: { userId: position.userId, name: position.name },
    }));
  return { type: 'FeatureCollection', features };
}
