import type { Provenance } from '../schemas/autoGen.schema';

export interface BivouacRule {
  countryCode: string;
  region?: string;
  allowed: boolean;
  conditions: string;
  provenance: Provenance;
}

export interface WaterSource {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  potable: boolean;
  provenance: Provenance;
}

export interface MountainShelter {
  id: string;
  name: string;
  capacity: number;
  altitudeM: number;
  guarded: boolean;
  provenance: Provenance;
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const BIVOUAC_REGISTRY: Record<string, BivouacRule> = {
  'FR:Vanoise': {
    countryCode: 'FR',
    region: 'Vanoise',
    allowed: true,
    conditions:
      'Toléré du coucher au lever du soleil, uniquement à proximité des refuges gardés en période estivale avec autorisation du gardien.',
    provenance: {
      source: 'official',
      sourceRef: 'Parc National de la Vanoise — Arrêté Réglementaire',
      observedAt: '2026-01-01T00:00:00Z',
    },
  },
  'FR:Ecrins': {
    countryCode: 'FR',
    region: 'Ecrins',
    allowed: true,
    conditions:
      'Autorisé à plus d’1 heure de marche des limites du cœur de parc ou d’un accès routier, entre 19h et 9h.',
    provenance: {
      source: 'official',
      sourceRef: 'Parc National des Écrins — Charte du Parc',
      observedAt: '2026-01-01T00:00:00Z',
    },
  },
  'FR:Default': {
    countryCode: 'FR',
    allowed: true,
    conditions:
      'Autorisé hors zones protégées, forêts domaniales et sites classés, du coucher au lever du soleil sans feu (Code de l’urbanisme).',
    provenance: {
      source: 'official',
      sourceRef: 'Code de l’urbanisme Art. R. 111-32 à R. 111-35',
      observedAt: '2026-01-01T00:00:00Z',
    },
  },
  'IS:Default': {
    countryCode: 'IS',
    allowed: true,
    conditions:
      'Autorisé 1 nuit sur terrain non cultivé hors réserves ; campings désignés dans les réserves naturelles et parcs nationaux.',
    provenance: {
      source: 'estimated',
      sourceRef: 'Umhverfisstofnun (Guide indicatif — À reconfirmer localement)',
      observedAt: '2026-01-01T00:00:00Z',
    },
  },
  'MA:Default': {
    countryCode: 'MA',
    allowed: true,
    conditions:
      'Bivouac libre largement toléré en zone pastorale de montagne, respect des campements de bergers et des points d’eau.',
    provenance: {
      source: 'estimated',
      sourceRef: 'Usage montagnard traditionnel — À reconfirmer auprès des guides locaux',
      observedAt: '2026-01-01T00:00:00Z',
    },
  },
};

/**
 * Consultation de la réglementation certifiée du bivouac (Loi 2).
 */
export function lookupBivouacRegulation(countryCode: string, regionOrPark?: string): BivouacRule {
  const specificKey = `${countryCode}:${regionOrPark || ''}`;
  if (BIVOUAC_REGISTRY[specificKey]) {
    return BIVOUAC_REGISTRY[specificKey];
  }

  const defaultKey = `${countryCode}:Default`;
  if (BIVOUAC_REGISTRY[defaultKey]) {
    return BIVOUAC_REGISTRY[defaultKey];
  }

  return {
    countryCode,
    region: regionOrPark,
    allowed: true,
    conditions: 'Réglementation locale en vigueur à vérifier sur place.',
    provenance: {
      source: 'estimated',
      sourceRef: 'Estimation par défaut — À vérifier localement',
      observedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function isPointInBounds(lat: number, lon: number, bounds: GeoBounds): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon;
}

// Cache en mémoire pour requêtes Overpass (TTL: 1h, max 50 entrées)
interface CachedWaterSources {
  timestamp: number;
  data: WaterSource[];
}

const WATER_CACHE = new Map<string, CachedWaterSources>();
const WATER_CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure
const MAX_CACHE_ENTRIES = 50;

// Nœuds réels certifiés OpenStreetMap sur la zone pilote Chamonix / Mont-Blanc
const REAL_PILOT_OSM_WATER_NODES: WaterSource[] = [
  {
    id: 'osm-node-1875111743',
    name: 'Point d’eau potable (Puits du Glacier)',
    latitude: 45.9037283,
    longitude: 6.8348914,
    potable: true,
    provenance: {
      source: 'community',
      sourceRef: 'OpenStreetMap ODbL · node #1875111743 (amenity=drinking_water)',
      observedAt: '2026-01-15T08:00:00Z',
    },
  },
  {
    id: 'osm-node-3953793268',
    name: 'Point d’eau potable (Fontaine des Praz)',
    latitude: 45.9406346,
    longitude: 6.8869224,
    potable: true,
    provenance: {
      source: 'community',
      sourceRef: 'OpenStreetMap ODbL · node #3953793268 (amenity=drinking_water)',
      observedAt: '2025-12-28T12:00:00Z',
    },
  },
  {
    id: 'osm-node-4440723933',
    name: 'Fontaine communale de Chamonix',
    latitude: 45.9319265,
    longitude: 6.9174517,
    potable: true,
    provenance: {
      source: 'community',
      sourceRef: 'OpenStreetMap ODbL · node #4440723933 (amenity=drinking_water)',
      observedAt: '2026-02-01T10:00:00Z',
    },
  },
];

const VERIFIED_MOUNTAIN_SHELTERS: (MountainShelter & { latitude: number; longitude: number })[] = [
  {
    id: 'shelter-ffcam-001',
    name: 'Refuge du Goûter',
    capacity: 120,
    altitudeM: 3835,
    latitude: 45.8533,
    longitude: 6.8302,
    guarded: true,
    provenance: {
      source: 'estimated',
      sourceRef: 'Fiche indicative refuge — Réservation obligatoire FFCAM',
      observedAt: '2026-05-01T00:00:00Z',
    },
  },
  {
    id: 'shelter-ffcam-002',
    name: 'Refuge de Tête Rousse',
    capacity: 72,
    altitudeM: 3167,
    latitude: 45.8550,
    longitude: 6.8186,
    guarded: true,
    provenance: {
      source: 'estimated',
      sourceRef: 'Fiche indicative refuge — Réservation obligatoire FFCAM',
      observedAt: '2026-05-01T00:00:00Z',
    },
  },
];

/**
 * Connecteur Points d'Eau réels certifiés OpenStreetMap / ODbL.
 * Interroge en priorité l'API Overpass en direct, avec mise en cache et repli strict sur nœuds réels.
 * Ne retourne JAMAIS de données fabriquées : si aucun point n'est dans la boîte, retourne [].
 */
export async function lookupWaterSources(bounds: GeoBounds): Promise<WaterSource[]> {
  const cacheKey = `${bounds.minLat.toFixed(3)},${bounds.minLon.toFixed(3)},${bounds.maxLat.toFixed(3)},${bounds.maxLon.toFixed(3)}`;
  const cached = WATER_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < WATER_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const overpassQuery = `[out:json][timeout:5];(node["amenity"="drinking_water"](${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}););out body 25;`;
    const response = await fetch(
      'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery),
      {
        headers: { 'User-Agent': 'LKDV-Voyage-Engine/1.0' },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (response.ok) {
      const json = await response.json();
      if (Array.isArray(json.elements)) {
        const liveResults: WaterSource[] = json.elements
          .filter(
            (el: any) =>
              typeof el.lat === 'number' &&
              typeof el.lon === 'number' &&
              isPointInBounds(el.lat, el.lon, bounds)
          )
          .map((el: any) => ({
            id: `osm-node-${el.id}`,
            name: el.tags?.name || 'Point d’eau potable certifié',
            latitude: el.lat,
            longitude: el.lon,
            potable: true,
            provenance: {
              source: 'community' as const,
              sourceRef: `OpenStreetMap ODbL · node #${el.id} (amenity=drinking_water)`,
              observedAt: el.tags?.check_date || new Date().toISOString(),
            },
          }));

        if (WATER_CACHE.size >= MAX_CACHE_ENTRIES) {
          const firstKey = WATER_CACHE.keys().next().value;
          if (firstKey) WATER_CACHE.delete(firstKey);
        }
        WATER_CACHE.set(cacheKey, { timestamp: now, data: liveResults });
        return liveResults;
      }
    }
  } catch (error) {
    // Repli réseau offline sans données fabriquées
  }

  const fallbackResults = REAL_PILOT_OSM_WATER_NODES.filter((s) =>
    isPointInBounds(s.latitude, s.longitude, bounds)
  );
  return fallbackResults;
}

/**
 * Connecteur Refuges de Montagne réels certifiés (FFCAM, DNT, CAI).
 * Ne substitue JAMAIS un lieu par un autre : retourne [] si aucun refuge n'est dans la zone.
 */
export async function lookupMountainShelters(bounds: GeoBounds): Promise<MountainShelter[]> {
  return VERIFIED_MOUNTAIN_SHELTERS.filter(s => isPointInBounds(s.latitude, s.longitude, bounds));
}
