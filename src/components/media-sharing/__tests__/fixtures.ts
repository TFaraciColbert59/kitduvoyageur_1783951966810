import {
  buildGeolocatedMediaGallery,
  buildPublishableTrackProjection,
  buildShareCard,
  buildTransparentSticker,
  buildWebEmbedPayload,
  detectFlybyCrossings,
  generateActivityReplay,
  generateFlyoverTimeline,
  type ActivityMediaItem,
  type AudienceLevel,
  type FlybyActivityCandidate,
  type GeoPoint,
  type PrivacyZone,
  type SportKind,
} from '@/features/media-sharing';

export const HOME_ZONE: PrivacyZone = {
  id: 'zone-home',
  center: { lat: 45.8326, lng: 6.8652 },
  radiusM: 250,
  label: 'Maison',
};

export const RAW_POINTS: GeoPoint[] = [
  { lat: 45.8327, lng: 6.8653, elevationM: 1035, timestampMs: 1_700_000_000_000 },
  { lat: 45.838, lng: 6.872, elevationM: 1120, timestampMs: 1_700_000_300_000 },
  { lat: 45.844, lng: 6.88, elevationM: 1380, timestampMs: 1_700_000_600_000 },
  { lat: 45.85, lng: 6.888, elevationM: 1210, timestampMs: 1_700_000_900_000 },
];

export function makeTrack(options: {
  trackId?: string;
  ownerId?: string;
  audience?: AudienceLevel;
  sport?: SportKind;
  zones?: PrivacyZone[];
} = {}) {
  return buildPublishableTrackProjection({
    trackId: options.trackId ?? 'act-c04',
    ownerId: options.ownerId ?? 'owner-c04',
    title: 'Boucle du Mont-Blanc',
    sport: options.sport ?? 'hiking',
    audience: options.audience ?? 'public',
    rawPoints: RAW_POINTS,
    privacyZones: options.zones ?? [HOME_ZONE],
  });
}

export const MEDIA_ITEMS: ActivityMediaItem[] = [
  {
    id: 'm-home',
    activityId: 'act-c04',
    ownerId: 'owner-c04',
    kind: 'photo',
    url: 'https://cdn.example.com/home.jpg',
    mimeType: 'image/jpeg',
    orderIndex: 0,
    capturedAtMs: 1_700_000_010_000,
    location: { lat: 45.83265, lng: 6.86525, elevationM: 1035 },
    exif: { deviceSerial: 'SERIAL-SECRET', gpsLat: 45.83265, gpsLng: 6.86525 },
  },
  {
    id: 'm-summit',
    activityId: 'act-c04',
    ownerId: 'owner-c04',
    kind: 'photo',
    url: 'https://cdn.example.com/summit.jpg',
    thumbnailUrl: 'https://cdn.example.com/summit-thumb.jpg',
    mimeType: 'image/jpeg',
    caption: 'Au sommet',
    orderIndex: 1,
    capturedAtMs: 1_700_000_600_000,
    location: { lat: 45.844, lng: 6.88, elevationM: 1380 },
    exif: { deviceSerial: 'SERIAL-SECRET' },
  },
  {
    id: 'm-video',
    activityId: 'act-c04',
    ownerId: 'owner-c04',
    kind: 'video',
    url: 'https://cdn.example.com/descent.mp4',
    thumbnailUrl: 'https://cdn.example.com/descent-thumb.jpg',
    mimeType: 'video/mp4',
    caption: 'La descente',
    orderIndex: 2,
    capturedAtMs: 1_700_000_900_000,
    durationSec: 24,
    location: { lat: 45.85, lng: 6.888, elevationM: 1210 },
  },
];

export function makeGallery(options: { audience?: AudienceLevel; blocked?: boolean } = {}) {
  const track = makeTrack({ audience: options.audience ?? 'public' });
  return buildGeolocatedMediaGallery({
    mediaItems: MEDIA_ITEMS,
    track,
    privacyZones: [HOME_ZONE],
    viewer: options.blocked
      ? { viewerId: 'blocked-user', blockedByOwner: true }
      : { viewerId: 'follower-user', isFollower: true },
  });
}

export function makeScreenData() {
  const track = makeTrack();
  const gallery = buildGeolocatedMediaGallery({
    mediaItems: MEDIA_ITEMS,
    track,
    privacyZones: [HOME_ZONE],
    viewer: { viewerId: 'follower-user', isFollower: true },
  });
  const timeline = generateFlyoverTimeline(track, gallery.markers, {
    targetDurationSec: 20,
    fps: 30,
    nowMs: 1_700_001_000_000,
  });
  const replay = generateActivityReplay(track, gallery.markers, {
    durationSec: 15,
    fallbackPreviewUrl: 'https://cdn.example.com/replay.png',
  });

  const primary: FlybyActivityCandidate = {
    activityId: 'act-c04',
    userId: 'owner-c04',
    displayName: 'Alice',
    handle: '@alice',
    avatarUrl: null,
    sport: 'hiking',
    audience: 'public',
    flybyConsent: true,
    privacyZones: [HOME_ZONE],
    points: RAW_POINTS,
  };
  const candidate: FlybyActivityCandidate = {
    activityId: 'act-bob',
    userId: 'bob',
    displayName: 'Bob',
    handle: '@bob',
    avatarUrl: null,
    sport: 'trail_running',
    audience: 'public',
    flybyConsent: true,
    privacyZones: [],
    points: [
      { lat: 45.84405, lng: 6.88005, timestampMs: 1_700_000_610_000 },
      { lat: 45.85, lng: 6.888, timestampMs: 1_700_000_890_000 },
    ],
  };
  const flyby = detectFlybyCrossings(primary, [candidate]);

  return {
    track,
    gallery,
    timeline,
    replay,
    flyby,
    externalShare: {
      embed: buildWebEmbedPayload(track, { baseUrl: 'https://example.test' }),
      card: buildShareCard(track, gallery.items, { theme: 'outdoor' }),
      sticker: buildTransparentSticker(track),
    },
  };
}
