import 'server-only';
import { parsePositions } from '@/features/compte/map/geometry';
import { haversineDistanceKm } from '@/features/explorer-osm/domain/geometry';
import { appUserAgent } from '@/lib/userAgent';
import type { CarnetDetail, ElevationPoint } from './types';

/**
 * Profil altimétrique d'une fiche carnet, complété côté serveur quand la
 * source réelle manque.
 *
 * `positions_timed[].elevationM` n'est renseigné par aucune sortie en
 * production : le profil de `buildElevationProfile` est donc vide et la carte
 * d'altitude ne s'affiche jamais. Le tracé GPS, lui, existe. On demande donc
 * l'altitude des points du tracé au modèle numérique de terrain d'Open-Meteo
 * (gratuit, sans clé), et **rien d'autre** : aucune altitude n'est interpolée,
 * lissée ni estimée. Une réponse muette ou invalide laisse le profil vide —
 * la fiche affiche alors son état vide honnête.
 *
 * Serveur uniquement : appel réseau sortant, cache mémoire de processus.
 */

/** Altitude ponctuelle Open-Meteo (`GET /v1/elevation`), jusqu'à 100 coordonnées. */
const ELEVATION_ENDPOINT = 'https://api.open-meteo.com/v1/elevation';
/** Plafond de l'API : au-delà, la requête est refusée. */
const MAX_REQUEST_POINTS = 100;
/** Plafond du profil rendu, identique à celui de `buildElevationProfile`. */
const MAX_PROFILE_POINTS = 120;
const FETCH_TIMEOUT_MS = 3_000;
/** Le relief ne change pas d'une heure à l'autre : un aller-retour par heure. */
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Au-delà, les entrées périmées sont balayées : le cache ne gonfle pas. */
const MAX_CACHE_ENTRIES = 200;

interface Coordinate {
  lat: number;
  lng: number;
}

interface CacheEntry {
  expiresAt: number;
  profile: ElevationPoint[];
}

/** Profils déjà obtenus, par carnet et par extrémités de trace. */
const cache = new Map<string, CacheEntry>();
/** Requêtes en cours : deux appels simultanés partagent le même aller-retour. */
const pending = new Map<string, Promise<ElevationPoint[]>>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Réduit une liste à `max` éléments également répartis, extrémités comprises.
 * Aucune coordonnée n'est déplacée : on choisit des points réels.
 */
function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  const sampled: T[] = [];
  for (let index = 0; index < max; index += 1) {
    sampled.push(items[Math.round(index * step)]);
  }
  return sampled;
}

/** Même règle que `buildElevationProfile` : 120 points au plus, extrémités gardées. */
function downsample(points: ElevationPoint[], maxPoints: number): ElevationPoint[] {
  return sampleEvenly(points, Math.max(2, maxPoints));
}

/**
 * Clé de cache : le carnet et les deux extrémités de sa trace. Deux fiches du
 * même carnet partagent donc le profil, et un tracé modifié le renouvelle.
 */
function cacheKey(carnetId: string, points: Coordinate[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  return `${carnetId}:${first.lat},${first.lng}:${last.lat},${last.lng}`;
}

/**
 * URL de la requête : deux listes de coordonnées séparées par des virgules,
 * dans l'ordre des points. Les nombres sont écrits tels quels (`String`), sans
 * arrondi : la coordonnée demandée est exactement celle de la trace.
 */
function buildUrl(points: Coordinate[]): string {
  const latitudes = points.map((point) => String(point.lat)).join(',');
  const longitudes = points.map((point) => String(point.lng)).join(',');
  return `${ELEVATION_ENDPOINT}?latitude=${latitudes}&longitude=${longitudes}`;
}

/**
 * Points du profil : altitude **rendue par l'API** pour chaque coordonnée
 * demandée, distance cumulée haversine sur la trace réelle.
 *
 * La réponse doit couvrir exactement les points demandés et ne contenir que des
 * nombres finis : une liste plus courte, plus longue, ou trouée (Open-Meteo rend
 * `null` en mer) ne peut pas être appariée aux coordonnées sans décaler les
 * altitudes. On la refuse plutôt que de rendre un profil faux.
 */
function toProfile(points: Coordinate[], raw: unknown): ElevationPoint[] {
  if (!Array.isArray(raw) || raw.length !== points.length) return [];
  const elevations: number[] = [];
  for (const value of raw) {
    if (!isFiniteNumber(value)) return [];
    elevations.push(value);
  }

  let distanceKm = 0;
  const profile: ElevationPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0) {
      const previous = points[index - 1];
      const current = points[index];
      distanceKm += haversineDistanceKm(
        [previous.lng, previous.lat],
        [current.lng, current.lat]
      );
    }
    profile.push({
      distanceKm: Math.round(distanceKm * 100) / 100,
      elevationM: elevations[index],
      lat: points[index].lat,
      lng: points[index].lng,
    });
  }
  return downsample(profile, MAX_PROFILE_POINTS);
}

/** Un aller-retour vers Open-Meteo. Ne lève jamais : une panne rend `[]`. */
async function fetchProfile(points: Coordinate[]): Promise<ElevationPoint[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildUrl(points), {
      headers: { 'User-Agent': appUserAgent('Carnet, profil altimetrique') },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn('[carnet] altitude indisponible', response.status);
      return [];
    }
    const payload = (await response.json()) as { elevation?: unknown } | null;
    const profile = toProfile(points, payload?.elevation);
    if (profile.length < 2) {
      console.warn('[carnet] altitude : reponse inexploitable');
    }
    return profile;
  } catch (error) {
    console.warn(
      '[carnet] altitude injoignable',
      error instanceof Error ? error.message : 'erreur'
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Profil du couple clé/points, un seul appel réseau à la fois par clé.
 * Un échec n'entre pas dans le cache : la prochaine fiche retentera.
 */
function loadProfile(key: string, points: Coordinate[]): Promise<ElevationPoint[]> {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const task = fetchProfile(points)
    .then((profile) => {
      if (profile.length >= 2) {
        const now = Date.now();
        if (cache.size >= MAX_CACHE_ENTRIES) {
          for (const [cachedKey, entry] of cache) {
            if (entry.expiresAt <= now) cache.delete(cachedKey);
          }
        }
        cache.set(key, { expiresAt: now + CACHE_TTL_MS, profile });
      }
      return profile;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, task);
  return task;
}

/** Vide le cache mémoire. Réservé aux tests : la fiche ne l'appelle jamais. */
export function resetCarnetElevationCache(): void {
  cache.clear();
  pending.clear();
}

/**
 * Rend la fiche avec un profil altimétrique réel, ou la fiche inchangée.
 *
 * - profil déjà présent (≥ 2 points) : rien à faire ;
 * - trace de moins de deux points : aucun appel réseau ;
 * - API muette, en erreur, en retard (> 3 s) ou réponse inexploitable : profil
 *   vide, fiche rendue telle quelle, aucune exception.
 */
export async function enrichCarnetElevation(detail: CarnetDetail): Promise<CarnetDetail> {
  if (detail.elevationProfile && detail.elevationProfile.length >= 2) return detail;

  const points = parsePositions(detail.trace);
  if (points.length < 2) return detail;

  const sampled = sampleEvenly(points, MAX_REQUEST_POINTS);
  const key = cacheKey(detail.id, sampled);

  const cached = cache.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return { ...detail, elevationProfile: [...cached.profile] };
    }
    cache.delete(key);
  }

  const profile = await loadProfile(key, sampled);
  if (profile.length < 2) return detail;
  return { ...detail, elevationProfile: profile };
}
