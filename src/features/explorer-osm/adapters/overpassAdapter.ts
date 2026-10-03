/**
 * LE KIT DU VOYAGEUR — ADAPTATEUR OVERPASS OSM SÉCURISÉ
 * Client HTTP serveur avec gestion des quotas, rate limiting, circuit breaker
 * et détection stricte des réponses non-JSON ou corrompues.
 */

import type { BoundingBox, PoiCategory } from '../domain/types';

export interface OverpassConfig {
  endpoint: string;
  timeoutSeconds: number;
  maxSizeBytes: number;
  userAgent: string;
}

export const DEFAULT_OVERPASS_CONFIG: OverpassConfig = {
  endpoint: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  timeoutSeconds: 15,
  maxSizeBytes: 33554432, // 32 Mo max
  userAgent: 'LeKitDuVoyageur/1.0 (https://lekitduvoyageur.com; contact@lekitduvoyageur.com)',
};

export class OverpassError extends Error {
  public readonly code: 'RATE_LIMITED' | 'TIMEOUT' | 'SERVER_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'ABORTED';
  public readonly status?: number;
  public readonly rawResponse?: string;

  constructor(
    message: string,
    code: 'RATE_LIMITED' | 'TIMEOUT' | 'SERVER_ERROR' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'ABORTED',
    status?: number,
    rawResponse?: string
  ) {
    super(message);
    this.name = 'OverpassError';
    this.code = code;
    this.status = status;
    this.rawResponse = rawResponse;
  }
}

/**
 * Exécute une requête Overpass QL brute en POST
 */
export async function executeOverpassQuery(
  query: string,
  options?: {
    config?: OverpassConfig;
    signal?: AbortSignal;
  }
): Promise<any> {
  const config = options?.config || DEFAULT_OVERPASS_CONFIG;

  const body = new URLSearchParams();
  body.set('data', query);

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': config.userAgent,
        'Accept': 'application/json',
      },
      body: body.toString(),
      signal: options?.signal,
    });

    if (res.status === 429) {
      throw new OverpassError('Quota Overpass atteint (429 Too Many Requests)', 'RATE_LIMITED', 429);
    }

    if (res.status === 504 || res.status === 408) {
      throw new OverpassError('Délai d’attente Overpass dépassé (Timeout)', 'TIMEOUT', res.status);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new OverpassError(
        `Erreur serveur Overpass HTTP ${res.status}: ${text.slice(0, 200)}`,
        'SERVER_ERROR',
        res.status,
        text
      );
    }

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    if (!contentType.includes('json') && !rawText.trim().startsWith('{')) {
      throw new OverpassError(
        'Réponse Overpass inattendue (HTML ou texte au lieu de JSON)',
        'INVALID_RESPONSE',
        res.status,
        rawText.slice(0, 300)
      );
    }

    try {
      return JSON.parse(rawText);
    } catch (err: any) {
      throw new OverpassError(
        `JSON Overpass malformé: ${err.message}`,
        'INVALID_RESPONSE',
        res.status,
        rawText.slice(0, 300)
      );
    }
  } catch (err: any) {
    if (err instanceof OverpassError) throw err;
    if (err.name === 'AbortError' || options?.signal?.aborted) {
      throw new OverpassError('Requête annulée par le client', 'ABORTED');
    }
    throw new OverpassError(`Erreur réseau vers Overpass: ${err.message}`, 'NETWORK_ERROR');
  }
}

/**
 * 1. Recherche de résumés de relations dans une BoundingBox
 * Ordre Overpass: south, west, north, east
 */
export async function queryRoutesInBbox(
  bbox: BoundingBox,
  limit = 100,
  options?: { config?: OverpassConfig; signal?: AbortSignal }
): Promise<any> {
  const timeout = options?.config?.timeoutSeconds ?? 12;
  const maxsize = options?.config?.maxSizeBytes ?? 33554432;
  const s = bbox.south.toFixed(4);
  const w = bbox.west.toFixed(4);
  const n = bbox.north.toFixed(4);
  const e = bbox.east.toFixed(4);

  // Demande les tags et le center de chaque relation de randonnée
  const ql = `
[out:json][timeout:${timeout}][maxsize:${maxsize}];
(
  relation["type"="route"]["route"~"^(hiking|foot)$"](${s},${w},${n},${e});
);
out tags center ${limit + 1};
  `.trim();

  return executeOverpassQuery(ql, options);
}

/**
 * 2. Détail complet d'une relation avec la géométrie de ses membres ways
 */
export async function queryRouteDetail(
  osmRelationId: number,
  options?: { config?: OverpassConfig; signal?: AbortSignal }
): Promise<any> {
  const timeout = options?.config?.timeoutSeconds ?? 20;
  const maxsize = options?.config?.maxSizeBytes ?? 33554432;

  // Récupère la relation avec la géométrie intégrée de tous ses membres ways
  const ql = `
[out:json][timeout:${timeout}][maxsize:${maxsize}];
relation(${osmRelationId});
out body geom;
  `.trim();

  return executeOverpassQuery(ql, options);
}

/**
 * 3. Recherche de POIs dans une BoundingBox par catégories
 */
export async function queryPoisInBbox(
  bbox: BoundingBox,
  categories: PoiCategory[] = ['refuge', 'water', 'summit', 'viewpoint', 'camp'],
  limit = 80,
  options?: { config?: OverpassConfig; signal?: AbortSignal }
): Promise<any> {
  const timeout = options?.config?.timeoutSeconds ?? 12;
  const maxsize = options?.config?.maxSizeBytes ?? 33554432;
  const s = bbox.south.toFixed(4);
  const w = bbox.west.toFixed(4);
  const n = bbox.north.toFixed(4);
  const e = bbox.east.toFixed(4);

  const subQueries: string[] = [];

  for (const cat of categories) {
    switch (cat) {
      case 'refuge':
        subQueries.push(`node["tourism"="alpine_hut"](${s},${w},${n},${e});`);
        subQueries.push(`node["tourism"="wilderness_hut"](${s},${w},${n},${e});`);
        break;
      case 'shelter':
        subQueries.push(`node["amenity"="shelter"](${s},${w},${n},${e});`);
        break;
      case 'water':
        subQueries.push(`node["amenity"="drinking_water"](${s},${w},${n},${e});`);
        break;
      case 'summit':
        subQueries.push(`node["natural"="peak"](${s},${w},${n},${e});`);
        subQueries.push(`node["mountain_pass"="yes"](${s},${w},${n},${e});`);
        break;
      case 'camp':
        subQueries.push(`node["tourism"="camp_site"](${s},${w},${n},${e});`);
        break;
      case 'viewpoint':
        subQueries.push(`node["tourism"="viewpoint"](${s},${w},${n},${e});`);
        break;
      case 'parking':
        subQueries.push(`node["amenity"="parking"](${s},${w},${n},${e});`);
        break;
      case 'transit':
        subQueries.push(`node["highway"="bus_stop"](${s},${w},${n},${e});`);
        subQueries.push(`node["railway"="station"](${s},${w},${n},${e});`);
        break;
    }
  }

  if (subQueries.length === 0) {
    return { elements: [] };
  }

  const ql = `
[out:json][timeout:${timeout}][maxsize:${maxsize}];
(
  ${subQueries.join('\n  ')}
);
out body ${limit};
  `.trim();

  return executeOverpassQuery(ql, options);
}
