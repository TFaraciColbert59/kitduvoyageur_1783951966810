'use client';

import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;

export async function uploadPostMedia(files: File[], userId: string, audience: string): Promise<string[]> {
  if (files.length === 0) return [];
  if (audience !== 'public') {
    throw new Error('Les médias ne sont autorisés que pour une publication publique.');
  }
  if (files.length > MAX_FILES) throw new Error('10 médias maximum.');
  const supabase = createClient();
  const urls: string[] = [];
  for (const file of files) {
    if (!/^(image|video)\//.test(file.type)) throw new Error('Format de média non supporté.');
    if (file.size > MAX_SIZE) throw new Error('Média trop volumineux (50 Mo max).');
    const isVideo = file.type.startsWith('video/');
    const cleaned = isVideo ? file : await stripImageMetadata(file);
    const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${userId}/${crypto.randomUUID()}.${ext || 'bin'}`;
    const { error } = await supabase.storage
      .from('carnet-media')
      .upload(path, cleaned, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('carnet-media').getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

export interface PostBridgeInput {
  authorId: string;
  content: string;
  postType: 'post' | 'question' | 'share';
  imageUrl?: string | null;
  mediaUrls?: string[];
  audience?: 'public' | 'abonnies' | 'club';
  clubId?: string | null;
  linkedCarnetId?: string | null;
  linkedKitId?: string | null;
  title?: string | null;
  /**
   * Métadonnées de publication (options, sondage, planification) écrites dans
   * `community_posts.creation_meta`, indépendamment du snapshot carnet.
   */
  snapshotPayload?: Record<string, unknown> | null;
}

export async function insertCommunityPost(input: PostBridgeInput): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: input.authorId,
      content: input.content,
      post_type: input.postType,
      image_url: input.imageUrl ?? input.mediaUrls?.[0] ?? null,
      image_alt: input.title ?? '',
      media_urls: input.mediaUrls ?? [],
      audience: input.audience ?? 'public',
      club_id: input.audience === 'club' ? input.clubId ?? null : null,
      linked_carnet_id: input.linkedCarnetId ?? null,
      linked_kit_id: input.linkedKitId ?? null,
      snapshot_payload: input.snapshotPayload ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Publication refusée.');
  return data.id;
}

/**
 * Adapte `uploadPostMedia` au contrat `MediaUploader` du MediaPicker partagé.
 * Un seul fichier à la fois, pour une progression et un réessai par média.
 */
export function createPostMediaUploader(
  userId: string,
  audience: 'public' | 'abonnies' | 'club' = 'public',
) {
  return async (file: File, onProgress?: (percent: number) => void): Promise<string> => {
    onProgress?.(10);
    const urls = await uploadPostMedia([file], userId, audience);
    const url = urls[0];
    if (!url) throw new Error('Upload du média impossible.');
    onProgress?.(100);
    return url;
  };
}

export interface StoryMediaUpload {
  url: string;
  bucket: string;
  path: string;
}

/**
 * Téléverse le média d’une story dès la sélection, dans le bucket privé.
 *
 * Le chemin est conservé dans `MediaItem.storagePath` pour que la publication
 * insère la story sans re-téléverser. L’URL signée (24 h) sert à l’aperçu et
 * au brouillon restauré ; l’affichage public passe par `/api/stories/:id/media`.
 */
export async function uploadStoryMedia(
  file: File,
  userId: string,
  onProgress?: (percent: number) => void,
): Promise<StoryMediaUpload> {
  if (!/^(image|video)\//.test(file.type)) {
    throw new Error('Format de média non supporté.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Média trop volumineux (50 Mo max).');
  }
  const isVideo = file.type.startsWith('video/');
  const storyId = crypto.randomUUID();
  onProgress?.(8);
  const cleaned = isVideo ? file : await stripImageMetadata(file);
  onProgress?.(28);
  const contentType = cleaned.type || (isVideo ? 'video/mp4' : 'image/jpeg');
  const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg'))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const path = `${userId}/${storyId}/${Date.now()}.${ext || 'bin'}`;

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from('stories-private')
    .upload(path, cleaned, { cacheControl: '3600', upsert: false, contentType });
  if (uploadError) throw new Error(uploadError.message);
  onProgress?.(92);

  try {
    const { data, error } = await supabase.storage
      .from('stories-private')
      .createSignedUrl(path, 60 * 60 * 24);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'URL d’aperçu indisponible.');
    }
    onProgress?.(100);
    return { url: data.signedUrl, bucket: 'stories-private', path };
  } catch (error) {
    // Sans URL d’aperçu, le média n’est pas exploitable : on ne laisse pas
    // d’objet orphelin derrière un échec.
    try {
      await supabase.storage.from('stories-private').remove([path]);
    } catch {
      /* le cron purge-stories nettoiera */
    }
    throw error instanceof Error ? error : new Error('Upload de la story impossible.');
  }
}

/** Adapte `uploadStoryMedia` au contrat `MediaUploader` du MediaPicker. */
export function createStoryMediaUploader(userId: string) {
  return (file: File, onProgress?: (percent: number) => void) =>
    uploadStoryMedia(file, userId, onProgress);
}
