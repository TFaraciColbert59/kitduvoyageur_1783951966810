import 'server-only';
import { appUserAgent } from '@/lib/userAgent';
import { coordKey, readShared, writeShared } from '../../server/sharedCache';
import { commonsGeosearchUrl, parseCommonsGeosearch, type CommonsPoint } from '../engine/commons';
import type { V5Photo } from '../types';

/**
 * Photos géolocalisées de Wikimedia Commons, avec le cache partagé du Compas.
 *
 * Commons n'exige pas de clé, mais sa politique demande un User-Agent qui nomme l'application et donne un
 * contact, des requêtes l'une après l'autre (jamais en parallèle) et une attente si le serveur freine.
 * Une panne n'est jamais gardée : l'appelant le sait (`state: 'failed'`) et dit « photos indisponibles ».
 * Une réponse sans photo acceptable, elle, se garde sept jours (le lieu n'a pas de photo libre, inutile
 * de redemander chaque jour) ; une photo, trente.
 */

const UA = appUserAgent('Compas, photos Wikimedia Commons');

const PHOTO_TTL_S = 30 * 86_400;
const ABSENT_TTL_S = 7 * 86_400;
/** Une requête n'attend jamais plus que cela, quelle que soit l'échéance de l'appelant. */
const REQUEST_TIMEOUT_MS = 4000;
/** Reprise unique après un 429, une erreur du serveur ou une coupure. */
const RETRY_DELAY_MS = 800;
/** Il faut au moins ce temps devant soi pour tenter une reprise. */
const RETRY_MIN_LEFT_MS = 1800;

/** Réglages modifiables par les tests (sans attente réelle). */
export const commonsTuning = { gapMs: 250 };

/** Cache : la clé du plan (`commons:v1:<lat>,<lon>` à 3 décimales), sous la famille « place ». */
const keyOf = (p: CommonsPoint) => `commons:v1:${coordKey(p.lat, p.lon, 3)}`;

/** Le point ramené à la précision de la clé : le résultat ne dépend que d'elle, donc se partage. */
function quantize(p: CommonsPoint): CommonsPoint {
  return { lat: Number(p.lat.toFixed(3)), lon: Number(p.lon.toFixed(3)) };
}

interface CachedPhoto {
  photo: V5Photo | null;
}

/** Requêtes l'une après l'autre sur cette instance, avec un court intervalle entre deux départs. */
let tail: Promise<unknown> = Promise.resolve();
let lastStart = 0;

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const wait = lastStart + commonsTuning.gapMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStart = Date.now();
    return job();
  });
  tail = run.catch(() => undefined);
  return run;
}

type Fetched = { ok: true; json: unknown } | { ok: false; retry: boolean };

async function fetchOnce(url: string, timeoutMs: number): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[compas] photos Commons', res.status);
      return { ok: false, retry: res.status === 429 || res.status >= 500 };
    }
    const json = await res.json();
    // Commons répond parfois 200 avec une erreur d'API (limite, paramètre refusé) : ce n'est pas « aucune photo ».
    if (json && typeof json === 'object' && 'error' in json) {
      console.warn('[compas] photos Commons : erreur d’API');
      return { ok: false, retry: false };
    }
    return { ok: true, json };
  } catch (err) {
    console.warn('[compas] photos Commons injoignable', err instanceof Error ? err.message : 'erreur');
    return { ok: false, retry: true };
  }
}

/** Une requête, une reprise si le temps le permet. Rien d'exploitable : null. */
async function fetchCommons(url: string, deadline: number): Promise<unknown | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const left = deadline - Date.now();
    if (left < 600) return null;
    const r = await fetchOnce(url, Math.min(REQUEST_TIMEOUT_MS, left));
    if (r.ok) return r.json;
    if (!r.retry || deadline - Date.now() < RETRY_MIN_LEFT_MS) return null;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return null;
}

export type CommonsLookup =
  /** Lu du cache : aucune requête. */
  | { state: 'cached'; photo: V5Photo | null }
  /** Demandé à Commons à l'instant (réponse lue, gardée). */
  | { state: 'fetched'; photo: V5Photo | null }
  /** Pas dans le cache et le réseau n'était pas permis : on ne sait pas. */
  | { state: 'skipped'; photo: null }
  /** Commons n'a pas répondu : on ne sait pas, rien n'est gardé. */
  | { state: 'failed'; photo: null };

/**
 * La photo géolocalisée d'un lieu. Le cache d'abord ; Commons seulement si `allowNetwork` (l'appelant
 * compte ses requêtes) et avant `deadline` (instant en ms). Jamais une photo d'un autre lieu.
 */
export async function lookupCommonsPhoto(
  point: CommonsPoint,
  opts: { allowNetwork: boolean; deadline?: number }
): Promise<CommonsLookup> {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180)
    return { state: 'skipped', photo: null };
  const key = keyOf(point);
  const hit = await readShared<CachedPhoto>('place', key);
  if (hit && typeof hit === 'object' && 'photo' in hit) return { state: 'cached', photo: hit.photo ?? null };
  if (!opts.allowNetwork) return { state: 'skipped', photo: null };

  const from = quantize(point);
  const deadline = opts.deadline ?? Date.now() + 8000;
  const json = await serialize(() => fetchCommons(commonsGeosearchUrl(from), deadline));
  if (json == null) return { state: 'failed', photo: null };
  const photo = parseCommonsGeosearch(json, from);
  await writeShared('place', key, { photo } satisfies CachedPhoto, photo ? PHOTO_TTL_S : ABSENT_TTL_S);
  return { state: 'fetched', photo };
}
