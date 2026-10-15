import { describe, expect, it } from 'vitest';
import { matchesCommunityDiscoveryFilter, selectCommunityDiscoveryMedia } from '../../src/lib/community/media';

describe('Community discovery mixed-media galleries', () => {
  const photo = 'https://cdn.example/trip.jpg';
  const video = 'https://cdn.example/trip.mp4';

  it('finds videos even when a photo is the gallery cover', () => {
    expect(matchesCommunityDiscoveryFilter([photo, video], photo, null, 'videos')).toBe(true);
    expect(selectCommunityDiscoveryMedia([photo, video], photo, 'videos')).toBe(video);
  });

  it('finds photos even when a video is the gallery cover', () => {
    expect(matchesCommunityDiscoveryFilter([video, photo], video, null, 'photos')).toBe(true);
    expect(selectCommunityDiscoveryMedia([video, photo], video, 'photos')).toBe(photo);
  });

  it('never treats a query parameter as a video extension', () => {
    expect(matchesCommunityDiscoveryFilter([photo + '?download=trip.mp4'], null, null, 'videos')).toBe(false);
  });

  it('keeps carnet-only entries visible in all and carnets, not media filters', () => {
    const snapshot = { title: 'Tour des lacs' };
    expect(matchesCommunityDiscoveryFilter([], null, snapshot, 'all')).toBe(true);
    expect(matchesCommunityDiscoveryFilter([], null, snapshot, 'carnets')).toBe(true);
    expect(matchesCommunityDiscoveryFilter([], null, snapshot, 'photos')).toBe(false);
    expect(matchesCommunityDiscoveryFilter([], null, snapshot, 'videos')).toBe(false);
  });

  it('does not invent thumbnails or matches for empty or invalid media', () => {
    expect(selectCommunityDiscoveryMedia(['javascript:bad.mp4'], null, 'all')).toBeNull();
    expect(matchesCommunityDiscoveryFilter([], null, null, 'all')).toBe(false);
  });
});
