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
