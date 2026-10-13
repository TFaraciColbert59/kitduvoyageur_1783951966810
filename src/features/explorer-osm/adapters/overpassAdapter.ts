/**
 * LE KIT DU VOYAGEUR — ADAPTATEUR OVERPASS OSM SÉCURISÉ
 * Client HTTP serveur avec gestion des quotas, rate limiting, circuit breaker
 * et détection stricte des réponses non-JSON ou corrompues.
 */

import type { BoundingBox, PoiCategory } from '../domain/types';
import { overpassPost, serializeOverpass } from '@/lib/overpass';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Un seul serveur Overpass (private.coffee), une requête à la fois (plan 1.4) :
 * la règle du site vit dans `@/lib/overpass`. L'ancien repli entre instances
 * publiques et la variable d'environnement qui choisissait le serveur sont
 * retirés : un serveur choisi par configuration contournerait la règle.
 */
export interface OverpassConfig {
  timeoutSeconds: number;
  maxSizeBytes: number;
  userAgent: string;
}

export const DEFAULT_OVERPASS_CONFIG: OverpassConfig = {
  timeoutSeconds: 20,
  maxSizeBytes: 33554432, // 32 Mo max
  userAgent: appUserAgent('explorateur OSM'),
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
 * Exécute une requête Overpass QL brute en POST : un seul serveur, une requête
 * à la fois (file du site, `serializeOverpass`). Une requête restée en file plus
 * longtemps que son délai n'est pas envoyée (code `TIMEOUT`). Toute erreur est
 * une `OverpassError` ; aucun repli sur un autre serveur.
 */
/** Marge au-delà du délai Overpass du serveur avant d'abandonner une requête déjà partie. */
const EXECUTION_MARGIN_MS = 5_000;

export async function executeOverpassQuery(
  query: string,
  options?: {
    config?: OverpassConfig;
    signal?: AbortSignal;
    /** Réservé aux tests. */
    fetchImpl?: typeof fetch;
    /** Réservé aux tests : marge au-delà du délai Overpass avant d'abandonner (5 s par défaut). */
    executionMarginMs?: number;
  }
): Promise<any> {
  const config = options?.config || DEFAULT_OVERPASS_CONFIG;
  const signal = options?.signal;
  if (signal?.aborted) throw new OverpassError('Requête annulée par le client', 'ABORTED');
  let executionSignal: AbortSignal | null = null;

  try {
    return await serializeOverpass(
      async () => {
        // Annulée pendant l'attente dans la file : rien ne part.
        if (signal?.aborted) throw new OverpassError('Requête annulée par le client', 'ABORTED');
        // Délai d'exécution propre, armé quand le tour vient (constat Codex, PR #93) : il couvre l'envoi
        // ET la lecture du corps, même quand l'appelant ne donne aucun signal ; le délai Overpass du
        // serveur (`[timeout:…]`) plus une marge. Combiné au signal de l'appelant s'il y en a un.
        const execution = AbortSignal.timeout(config.timeoutSeconds * 1000 + (options?.executionMarginMs ?? EXECUTION_MARGIN_MS));
        executionSignal = execution;
        const bounded = signal ? AbortSignal.any([signal, execution]) : execution;
        const res = await overpassPost(query, { fetchImpl: options?.fetchImpl, userAgent: config.userAgent, signal: bounded });

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
      },
      { maxWaitMs: config.timeoutSeconds * 1000 }
    );
  } catch (err: any) {
    if (err instanceof OverpassError) throw err;
    if (err?.code === 'OVERPASS_BUSY') {
      throw new OverpassError('Overpass occupé : file d’attente trop longue', 'TIMEOUT');
    }
    // Affecté dans la tâche (TypeScript ne suit pas l'affectation faite dans la fermeture).
    if ((executionSignal as AbortSignal | null)?.aborted && !signal?.aborted) {
      throw new OverpassError('Délai d’attente Overpass dépassé (Timeout)', 'TIMEOUT');
    }
    if (err?.name === 'AbortError' || signal?.aborted) {
      throw new OverpassError('Requête annulée par le client', 'ABORTED');
    }
    throw new OverpassError(`Erreur réseau vers Overpass: ${err?.message ?? 'inconnue'}`, 'NETWORK_ERROR');
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
  const timeout = options?.config?.timeoutSeconds ?? 20;
  const maxsize = options?.config?.maxSizeBytes ?? 33554432;
  const s = bbox.south.toFixed(4);
  const w = bbox.west.toFixed(4);
  const n = bbox.north.toFixed(4);
  const e = bbox.east.toFixed(4);

  // Demande les tags et le center de chaque relation de randonnée (itinéraires locaux et Grands GR / superroutes)
  const ql = `
[out:json][timeout:${timeout}][maxsize:${maxsize}];
(
  relation["route"~"^(hiking|foot)$"](${s},${w},${n},${e});
  relation["type"="superroute"]["route"~"^(hiking|foot)$"](${s},${w},${n},${e});
  relation["route_master"~"^(hiking|foot)$"](${s},${w},${n},${e});
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
  const timeout = options?.config?.timeoutSeconds ?? 25;
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
  const timeout = options?.config?.timeoutSeconds ?? 20;
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
