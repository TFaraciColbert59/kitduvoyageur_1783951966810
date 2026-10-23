import { isCommunityVideoUrl, usableCommunityMedia } from '@/lib/community/media';
import type { FeedPost } from './useCommunityFeed';

export function firstMedia(post: FeedPost): string | null {
  return usableCommunityMedia(post.media_urls ?? null, post.image_url ?? null)[0] ?? null;
}

export function isVideoMedia(src: string | null): boolean {
  return Boolean(src && isCommunityVideoUrl(src));
}

export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'À l’instant';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

export function authorName(post: FeedPost): string {
  return post.author?.full_name || 'Voyageur LKDV';
}

export function authorHandle(post: FeedPost): string | undefined {
  return post.author?.handle ?? undefined;
}
