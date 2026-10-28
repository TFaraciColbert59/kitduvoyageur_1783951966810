import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Cache partagé du Compas : mémoire de l'instance d'abord, puis table
 * `geo_cache` (Supabase, clé service uniquement). Une destination, un trajet
 * ou une altitude cherchés par quelqu'un ne coûtent plus rien aux suivants :
 * c'est ce qui permet de tenir sur des services gratuits à quotas.
 *
 * Tout échec du cache est silencieux et sans effet sur le résultat : on
 * retombe sur l'appel réel. Seules les réponses réussies sont gardées (une
 * panne ne doit pas être servie à tout le monde pendant des heures).
 */

export type CacheKind = 'place' | 'reverse' | 'leg' | 'elevation' | 'stages';

const memory = new Map<string, { at: number; ttlMs: number; value: unknown }>();
const MEMORY_MAX = 3000;
let lastPurge = 0;

function memGet(key: string): unknown | undefined {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > hit.ttlMs) {
    memory.delete(key);
    return undefined;
  }
  return hit.value;
}

function memSet(key: string, value: unknown, ttlMs: number): void {
  if (memory.size >= MEMORY_MAX) memory.clear();
  memory.set(key, { at: Date.now(), ttlMs, value });
}

export async function readShared<T>(kind: CacheKind, key: string): Promise<T | undefined> {
  const full = `${kind}:${key}`;
  const local = memGet(full);
  if (local !== undefined) return local as T;
  const db = getServiceSupabase();
  if (!db) return undefined;
  try {
    const { data } = await db
      .from('geo_cache')
      .select('payload, expires_at')
      .eq('cache_key', full)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return undefined;
    const ttlMs = Math.max(60_000, Date.parse(data.expires_at as string) - Date.now());
    memSet(full, data.payload, ttlMs);
    return data.payload as T;
  } catch {
    return undefined;
  }
}

export async function writeShared(kind: CacheKind, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const full = `${kind}:${key}`;
  memSet(full, value, ttlSeconds * 1000);
  const db = getServiceSupabase();
  if (!db) return;
  try {
    await db.from('geo_cache').upsert({
      cache_key: full,
      kind,
      payload: value as never,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
    // Ménage au plus une fois par heure et par instance.
    if (Date.now() - lastPurge > 3_600_000) {
      lastPurge = Date.now();
      void db.rpc('purge_geo_cache').then(
        () => undefined,
        () => undefined
      );
    }
  } catch {
    /* le cache ne bloque jamais */
  }
}

/**
 * Lit le cache, sinon calcule et garde le résultat. `keep` décide si un
 * résultat mérite d'être partagé (jamais une panne ni une réponse vide).
 */
export async function cached<T>(
  kind: CacheKind,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  keep: (value: T) => boolean = (v) => v != null
): Promise<T> {
  const hit = await readShared<T>(kind, key);
  if (hit !== undefined) return hit;
  const value = await compute();
  if (keep(value)) await writeShared(kind, key, value, ttlSeconds);
  return value;
}

/** Coordonnée arrondie pour la clé : ~100 m, assez pour partager sans confondre. */
export function coordKey(lat: number, lon: number, digits = 3): string {
  return `${lat.toFixed(digits)},${lon.toFixed(digits)}`;
}
