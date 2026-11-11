import 'server-only';
/**
 * Effacement des fichiers d'un carnet (droit à l'effacement). Client à clé
 * service créé ICI, côté serveur seulement ; jamais exposé au client. Un
 * échec est journalisé et n'échoue jamais l'action appelante.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { parseMomentMeta, publicMediaPrefix } from './momentTypes';

type Bucket = 'carnet-media' | 'carnet-moments-media';
const BUCKETS: Bucket[] = ['carnet-media', 'carnet-moments-media'];

export interface MomentMediaRow {
  image_url?: string | null;
  moment_meta?: unknown;
  auteur_id?: string | null;
}

export interface MediaRef {
  bucket: Bucket;
  path: string;
}

function refOf(url: unknown, carnetId: string): MediaRef | null {
  if (typeof url !== 'string') return null;
  for (const bucket of BUCKETS) {
    const prefix = publicMediaPrefix(bucket);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(prefix)) continue;
    const path = decodeURIComponent(url.slice(prefix.length).split('?')[0] ?? '');
    /* Ne supprime que sous `<uid>/carnet-moments/<carnetId>/` : une URL forgée
       ne peut pas viser le fichier d'un autre carnet. */
    if (path.includes('..') || !new RegExp(`^[^/]+/carnet-moments/${carnetId}/[^/]+$`).test(path)) return null;
    return { bucket, path };
  }
  return null;
}

/** Fichiers (image/vidéo, note vocale) référencés par des lignes de moments. */
export function mediaRefsOf(rows: MomentMediaRow[], carnetId: string): MediaRef[] {
  const refs: MediaRef[] = [];
  for (const row of rows) {
    const candidates = [row.image_url, parseMomentMeta(row.moment_meta)?.audioUrl];
    for (const url of candidates) {
      const ref = refOf(url, carnetId);
      if (ref) refs.push(ref);
    }
  }
  return refs;
}

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

async function removeRefs(refs: MediaRef[]): Promise<void> {
  const service = serviceClient();
  if (!service) {
    console.error('[carnet/media] suppression ignorée : configuration service_role manquante');
    return;
  }
  for (const bucket of BUCKETS) {
    const paths = [...new Set(refs.filter((r) => r.bucket === bucket).map((r) => r.path))];
    if (paths.length === 0) continue;
    const { error } = await service.storage.from(bucket).remove(paths);
    if (error) console.error('[carnet/media] suppression impossible', { bucket, reason: error.message });
  }
}

/** Efface les fichiers d'un ou plusieurs moments déjà supprimés en base. */
export async function removeMomentFiles(rows: MomentMediaRow[], carnetId: string): Promise<void> {
  try {
    await removeRefs(mediaRefsOf(rows, carnetId));
  } catch (error) {
    console.error('[carnet/media] suppression en échec', { reason: String(error) });
  }
}

/**
 * Carnet entier : fichiers référencés par ses moments, plus tout ce qui reste
 * sous `<uid>/carnet-moments/<carnetId>/` dans les deux seaux (uid = personne
 * qui agit et auteurs des moments).
 */
export async function removeCarnetFiles(
  rows: MomentMediaRow[],
  carnetId: string,
  actorId: string
): Promise<void> {
  try {
    const refs = mediaRefsOf(rows, carnetId);
    const service = serviceClient();
    if (service) {
      const uids = new Set<string>([actorId]);
      for (const row of rows) if (row.auteur_id) uids.add(row.auteur_id);
      for (const bucket of BUCKETS) {
        for (const uid of uids) {
          const folder = `${uid}/carnet-moments/${carnetId}`;
          const { data, error } = await service.storage.from(bucket).list(folder, { limit: 1000 });
          if (error) {
            console.error('[carnet/media] liste impossible', { bucket, reason: error.message });
            continue;
          }
          for (const file of data ?? []) refs.push({ bucket, path: `${folder}/${file.name}` });
        }
      }
    }
    await removeRefs(refs);
  } catch (error) {
    console.error('[carnet/media] suppression du carnet en échec', { reason: String(error) });
  }
}
