export const MAX_POST_MEDIA = 10;

/** No URL construction or MIME guessing from query params. File extension must be before ?/#. */
export function isCommunityVideoUrl(url: string | null | undefined): boolean {
  if (!url || !/^(https?:\/\/|\/(?!\/))/i.test(url)) return false;
  const pathname = url.split(/[?#]/, 1)[0] ?? '';
  return /\.(mp4|webm|mov|m4v)$/i.test(pathname);
}

export function usableCommunityMedia(urls: unknown, cover: unknown): string[] {
  const candidates = Array.isArray(urls) ? urls : [];
  const media = [...candidates, cover];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of media) {
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!/^(https?:\/\/|\/(?!\/))/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
    if (result.length === MAX_POST_MEDIA) break;
  }
  return result;
}

export function canShowCommunityReproduction(value: unknown): boolean {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}


export type CommunityDiscoveryFilter = 'all' | 'photos' | 'videos' | 'carnets';

/** Match any gallery item, not just the cover. */
export function selectCommunityDiscoveryMedia(urls: unknown, cover: unknown, filter: CommunityDiscoveryFilter): string | null {
  const media = usableCommunityMedia(urls, cover);
  if (filter === 'videos') return media.find(isCommunityVideoUrl) ?? null;
  if (filter === 'photos') return media.find((url) => !isCommunityVideoUrl(url)) ?? null;
  return media[0] ?? null;
}

export function matchesCommunityDiscoveryFilter(urls: unknown, cover: unknown, snapshot: unknown, filter: CommunityDiscoveryFilter): boolean {
  if (filter === 'carnets') return Boolean(snapshot);
  if (filter === 'all') return Boolean(selectCommunityDiscoveryMedia(urls, cover, filter) || snapshot);
  return selectCommunityDiscoveryMedia(urls, cover, filter) !== null;
}
