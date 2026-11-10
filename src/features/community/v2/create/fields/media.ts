'use client';

import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { compressVideoV2 } from './videoCompress';
import {
  IMAGE_MAX_BYTES,
  STORY_MEDIA_MAX_BYTES,
  type MediaCropV2,
  type MediaItemV2,
} from '../engine/createSchemasV2';

/**
 * Médias V2 — limites exactes de `03 § 7`, refus **dès la sélection**, EXIF
 * retiré, recadrage réel (canvas) et téléversement dans les buckets existants.
 *
 * - Publication / Sortie / Club / Kit / Carnet : `carnet-media`, images seules
 *   ≤ 10 Mo (le bucket n'accepte que des images) ;
 * - Story : `stories-private`, images ou vidéos ≤ 25 Mo, ≤ 60 s (la durée est
 *   lue côté éditeur) ;
 * - en cas d'échec de la RPC, le formulaire supprime les objets qu'il vient
 *   d'envoyer (`03 § 5`).
 */

export type MediaBucketV2 = 'carnet-media' | 'stories-private';

export interface MediaFileLimitsV2 {
  allowVideo: boolean;
  maxBytes: number;
}

export const IMAGE_LIMITS: MediaFileLimitsV2 = { allowVideo: false, maxBytes: IMAGE_MAX_BYTES };
export const STORY_LIMITS: MediaFileLimitsV2 = { allowVideo: true, maxBytes: STORY_MEDIA_MAX_BYTES };

export interface MediaValidationV2 {
  ok: boolean;
  message?: string;
}

function humanMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} Mo`;
}

/** Refus immédiat, message clair (`Publication#5`, `Carnet#2`). */
export function validateMediaFile(file: File, limits: MediaFileLimitsV2): MediaValidationV2 {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !(limits.allowVideo && isVideo)) {
    return {
      ok: false,
      message: limits.allowVideo
        ? `Format non accepté : ${file.name}. Photos et vidéos seulement.`
        : `Format non accepté : ${file.name}. Photos seulement.`,
    };
  }
  if (file.size > limits.maxBytes) {
    return {
      ok: false,
      message: `${file.name} dépasse ${humanMb(limits.maxBytes)}.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: `${file.name} est vide.` };
  }
  return { ok: true };
}

const RATIOS: Record<Exclude<MediaCropV2, 'original'>, number> = {
  '4:5': 4 / 5,
  '1:1': 1,
  '9:16': 9 / 16,
  '3:1': 3,
};

/**
 * Recadrage réel centré au format demandé (canvas). Retourne le fichier
 * d'origine si le navigateur ne peut pas décoder l'image ; l'EXIF est retiré
 * au passage (ré-encodage JPEG).
 */
export async function cropImageToRatio(file: File, crop: MediaCropV2): Promise<File> {
  if (!file.type.startsWith('image/') || crop === 'original' || typeof document === 'undefined') {
    return stripImageMetadata(file);
  }
  const target = RATIOS[crop];
  try {
    const bitmap = await createImageBitmap(file);
    const sourceRatio = bitmap.width / bitmap.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;
    if (sourceRatio > target) {
      sourceWidth = Math.round(bitmap.height * target);
      sourceX = Math.round((bitmap.width - sourceWidth) / 2);
    } else {
      sourceHeight = Math.round(bitmap.width / target);
      sourceY = Math.round((bitmap.height - sourceHeight) / 2);
    }
    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return stripImageMetadata(file);
    }
    ctx.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return stripImageMetadata(file);
    const name = `${file.name.replace(/\.[a-z0-9]+$/i, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return stripImageMetadata(file);
  }
}

export interface UploadedMediaV2 {
  url: string;
  bucket: MediaBucketV2;
  path: string;
}

function safeExtension(file: File, fallback: string): string {
  const fromName = file.name.split('.').pop() ?? '';
  const clean = fromName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean || fallback;
}

/**
 * Téléverse un média déjà validé et recadré. Story : URL signée 24 h pour
 * l'aperçu et le brouillon ; les autres : URL publique du bucket `carnet-media`.
 */
export async function uploadMediaV2(
  file: File,
  options: {
    userId: string;
    bucket: MediaBucketV2;
    onProgress?: (percent: number) => void;
    storyId?: string;
  },
): Promise<UploadedMediaV2> {
  const { userId, bucket, onProgress, storyId } = options;
  const isVideo = file.type.startsWith('video/');
  const supabase = createClient();
  onProgress?.(8);
  // Story#15 : une vidéo lourde est ré-encodée côté client (MP4 plus léger) ;
  // sans support, sans gain ou en cas d'erreur, l'original part tel quel.
  const prepared = isVideo
    ? await compressVideoV2(file, {
        onProgress: (fraction) => onProgress?.(8 + Math.round(fraction * 22)),
      })
    : await stripImageMetadata(file);
  onProgress?.(32);
  const contentType = prepared.type || (isVideo ? 'video/mp4' : 'image/jpeg');
  const ext = safeExtension(prepared, isVideo ? 'mp4' : 'jpg');
  const folder = bucket === 'stories-private' ? `${userId}/${storyId ?? crypto.randomUUID()}` : userId;
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, prepared, { cacheControl: '3600', upsert: false, contentType });
  if (error) throw new Error(error.message || 'Envoi du média impossible.');
  onProgress?.(88);
  if (bucket === 'stories-private') {
    const { data, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24);
    if (signError || !data?.signedUrl) {
      try {
        await supabase.storage.from(bucket).remove([path]);
      } catch {
        /* le cron purge-stories nettoiera */
      }
      throw new Error(signError?.message || 'URL d’aperçu indisponible.');
    }
    onProgress?.(100);
    return { url: data.signedUrl, bucket, path };
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    try {
      await supabase.storage.from(bucket).remove([path]);
    } catch {
      /* rien à faire */
    }
    throw new Error('URL publique indisponible.');
  }
  onProgress?.(100);
  return { url: data.publicUrl, bucket, path };
}

/** Supprime des objets Storage (échec de RPC, retrait d'un média, recadrage). */
export async function deleteMediaObjectsV2(
  objects: readonly { bucket: MediaBucketV2; path: string }[],
): Promise<void> {
  if (objects.length === 0) return;
  const supabase = createClient();
  const byBucket = new Map<MediaBucketV2, string[]>();
  for (const object of objects) {
    if (!object.path) continue;
    const list = byBucket.get(object.bucket) ?? [];
    list.push(object.path);
    byBucket.set(object.bucket, list);
  }
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      try {
        await supabase.storage.from(bucket).remove(paths);
      } catch {
        /* le nettoyage Storage ne bloque jamais l'UI */
      }
    }),
  );
}

/** Déplace un élément (réordonnancement au doigt, testé unitairement). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Progression agrégée des médias d'un formulaire (pied « Envoi des médias… 45 % »). */
export function mediaProgress(items: readonly MediaItemV2[]): { pending: number; percent: number } {
  if (items.length === 0) return { pending: 0, percent: 100 };
  let total = 0;
  let pending = 0;
  for (const item of items) {
    total += item.status === 'uploaded' ? 100 : Math.min(99, Math.max(0, item.progress));
    if (item.status !== 'uploaded') pending += 1;
  }
  return { pending, percent: Math.round(total / items.length) };
}

/** Collecte des objets envoyés (nettoyage si la RPC échoue). */
export function uploadedObjectsOf(items: readonly MediaItemV2[]): { bucket: MediaBucketV2; path: string }[] {
  return items
    .filter((item) => item.status === 'uploaded' && item.storagePath && item.storageBucket)
    .map((item) => ({ bucket: item.storageBucket as MediaBucketV2, path: item.storagePath }));
}
