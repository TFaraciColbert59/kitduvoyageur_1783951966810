'use client';

import { createClient } from '@/lib/supabase/client';
import { prepareImage } from '@/lib/media/prepareImage';

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024;

const UPLOAD_CONCURRENCY = 3;

export async function uploadPostMedia(
  files: File[],
  userId: string,
  audience: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  if (files.length === 0) return [];
  if (audience !== 'public') {
    throw new Error('Les médias ne sont autorisés que pour une publication publique.');
  }
  if (files.length > MAX_FILES) throw new Error('10 médias maximum.');
  for (const file of files) {
    if (!/^(image|video)\//.test(file.type)) throw new Error('Format de média non supporté.');
    if (file.size > MAX_SIZE) throw new Error('Média trop volumineux (50 Mo max).');
  }

  const supabase = createClient();
  const urls: string[] = new Array(files.length).fill('');
  let done = 0;
  let cursor = 0;

  // Trois envois en parallèle, l'ordre des médias est conservé par l'index.
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor++;
      const file = files[index] as File;
      const isVideo = file.type.startsWith('video/');
      const prepared = isVideo ? file : await prepareImage(file);
      const ext = (prepared.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${userId}/${crypto.randomUUID()}.${ext || 'bin'}`;
      const { error } = await supabase.storage
        .from('carnet-media')
        .upload(path, prepared, { cacheControl: '3600', upsert: false, contentType: prepared.type || file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('carnet-media').getPublicUrl(path);
      urls[index] = data?.publicUrl ?? '';
      onProgress?.(++done, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
  return urls.filter(Boolean);
}

/** Envoi d'une image de couverture (carnet, kit, club) vers le même bucket public. */
export async function uploadCoverImage(file: File | null, userId: string): Promise<string | null> {
  if (!file) return null;
  const [url] = await uploadPostMedia([file], userId, 'public');
  return url ?? null;
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
