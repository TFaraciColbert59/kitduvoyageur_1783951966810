/**
 * Phase 5 — Chemins d'upload Storage et politique d'URL.
 *
 * Le bucket `user-documents` est PRIVÉ (policies : `auth.uid() = dossier[1]`).
 * Toute URL publique y est inutilisable : le flux doit produire une URL signée
 * COURTE et le chemin doit être préfixé par l'identifiant du propriétaire.
 */

export const PRIVATE_MEDIA_BUCKETS = ['user-documents'] as const;

/** Durée volontairement courte d'une URL signée (1 h). */
export const SIGNED_URL_TTL_SECONDS = 3600;

export function isPrivateMediaBucket(bucket: string): boolean {
  return (PRIVATE_MEDIA_BUCKETS as readonly string[]).includes(bucket);
}

export interface MediaUploadPathInput {
  bucket: string;
  folder?: string;
  userId: string;
  fileName: string;
}

/**
 * Construit le chemin de l'objet :
 *   • bucket privé  ⇒ `<userId>/<fileName>` (le dossier fourni est ignoré :
 *     la policy RLS impose le propriétaire en première segment) ;
 *   • bucket public ⇒ `<folder>/<fileName>` inchangé.
 */
export function buildMediaUploadPath(input: MediaUploadPathInput): {
  path: string;
  isPrivate: boolean;
} {
  const fileName = input.fileName.replace(/^\/+/, '');
  if (isPrivateMediaBucket(input.bucket)) {
    return { path: `${input.userId}/${fileName}`, isPrivate: true };
  }
  const folder = (input.folder ?? '').replace(/^\/+|\/+$/g, '');
  return { path: folder ? `${folder}/${fileName}` : fileName, isPrivate: false };
}
