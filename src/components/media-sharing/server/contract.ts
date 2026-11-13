import { z } from 'zod';
import {
  buildGeolocatedMediaGallery,
  buildPublishableTrackProjection,
  buildShareCard,
  buildTransparentSticker,
  buildWebEmbedPayload,
  detectFlybyCrossings,
  FlyoverRenderQueue,
  generateActivityReplay,
  generateFlyoverTimeline,
  ProtectedPreviewStore,
} from '@/features/media-sharing';
import type {
  ActivityMediaItem,
  ActivityReplayManifest,
  AudienceLevel,
  FlybyActivityCandidate,
  FlybyDetectionResult,
  FlyoverRenderJob,
  FlyoverTimeline,
  GeolocatedGalleryResult,
  PrivacyZone,
  ProtectedPreviewRecord,
  ProtectedPreviewResolution,
  PublishableTrackProjection,
  RawExifMetadata,
  SanitizedMediaItem,
  ShareCardSpec,
  SportKind,
  TrackMediaMarker,
  TransparentStickerSpec,
  ViewerContext,
  WebEmbedPayload,
} from '@/features/media-sharing';

/** Le store et la file vivent sur le globalThis : stables entre requêtes du même runtime. */
interface MediaSharingStores {
  previewStore: ProtectedPreviewStore;
  renderQueue: FlyoverRenderQueue;
  jobsById: Map<string, FlyoverRenderJob>;
}

const globalScope = globalThis as typeof globalThis & {
  __lkdvMediaSharingStores?: MediaSharingStores;
};

export function getMediaSharingStores(): MediaSharingStores {
  if (!globalScope.__lkdvMediaSharingStores) {
    globalScope.__lkdvMediaSharingStores = {
      previewStore: new ProtectedPreviewStore(),
      renderQueue: new FlyoverRenderQueue(3),
      jobsById: new Map<string, FlyoverRenderJob>(),
    };
  }
  return globalScope.__lkdvMediaSharingStores;
}

export const audienceSchema = z.enum(['private', 'followers', 'collective', 'public']);
export const sportSchema = z.enum([
  'hiking',
  'trail_running',
  'cycling',
  'mtb',
  'gravel',
  'ski_touring',
  'alpinism',
  'other',
]);

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

export const geoPointSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  elevationM: z.number().finite().nullable().optional(),
  timestampMs: z.number().finite().nullable().optional(),
});

export const privacyZoneSchema = z.object({
  id: z.string().min(1).max(120),
  center: z.object({ lat: latitudeSchema, lng: longitudeSchema }),
  radiusM: z.number().finite().min(0).max(50_000),
  label: z.string().max(160).optional(),
});

export const trackSchema = z.object({
  trackId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  sport: sportSchema,
  audience: audienceSchema,
  maskVersion: z.string().min(1).max(128),
  points: z.array(geoPointSchema).max(50_000),
  maskedPointCount: z.number().int().min(0).max(100_000),
  totalDistanceM: z.number().finite().min(0),
  elevationGainM: z.number().finite().min(0),
  durationSec: z.number().finite().min(0),
  startedAtMs: z.number().finite().nullable(),
  endedAtMs: z.number().finite().nullable(),
});

const rawExifSchema = z
  .object({
    gpsLat: z.number().finite().nullable().optional(),
    gpsLng: z.number().finite().nullable().optional(),
    gpsAltitudeM: z.number().finite().nullable().optional(),
    deviceModel: z.string().max(200).nullable().optional(),
    deviceSerial: z.string().max(200).nullable().optional(),
    capturedAtIso: z.string().max(80).nullable().optional(),
    ownerUserId: z.string().max(200).nullable().optional(),
  })
  .nullable()
  .optional();

const mediaLocationSchema = z
  .object({
    lat: latitudeSchema,
    lng: longitudeSchema,
    elevationM: z.number().finite().nullable().optional(),
  })
  .nullable()
  .optional();

export const mediaItemSchema = z.object({
  id: z.string().min(1).max(200),
  activityId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  kind: z.enum(['photo', 'video']),
  url: z.string().min(1).max(2048),
  thumbnailUrl: z.string().max(2048).nullable().optional(),
  mimeType: z.string().min(1).max(120),
  caption: z.string().max(500).nullable().optional(),
  orderIndex: z.number().int().min(0).max(10_000),
  capturedAtMs: z.number().finite().nullable(),
  location: mediaLocationSchema,
  durationSec: z.number().finite().min(0).nullable().optional(),
  exif: rawExifSchema,
});

export const viewerSchema = z.object({
  viewerId: z.string().max(200).nullable(),
  isFollower: z.boolean().optional(),
  isCollectiveMember: z.boolean().optional(),
  blockedByOwner: z.boolean().optional(),
});

export const trackMediaMarkerSchema = z.object({
  mediaId: z.string().min(1).max(200),
  kind: z.enum(['photo', 'video']),
  orderIndex: z.number().int().min(0),
  distanceAlongTrackM: z.number().finite().min(0),
  elapsedSec: z.number().finite().nullable(),
  location: z.object({
    lat: latitudeSchema,
    lng: longitudeSchema,
    elevationM: z.number().finite().nullable(),
  }),
  thumbnailUrl: z.string().max(2048).nullable(),
  caption: z.string().max(500).nullable(),
});

export const rawTrackInputSchema = z.object({
  trackId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  sport: sportSchema,
  audience: audienceSchema,
  rawPoints: z.array(geoPointSchema).min(1).max(50_000),
  privacyZones: z.array(privacyZoneSchema).max(200).default([]),
});

export const galleryBodySchema = z.object({
  track: trackSchema,
  mediaItems: z.array(mediaItemSchema).max(5000),
  privacyZones: z.array(privacyZoneSchema).max(200).default([]),
  viewer: viewerSchema,
});

export const flyoverBodySchema = z.object({
  track: trackSchema,
  markers: z.array(trackMediaMarkerSchema).max(5000).default([]),
  options: z
    .object({
      targetDurationSec: z.number().finite().min(5).max(120).optional(),
      fps: z.number().int().min(1).max(60).optional(),
      defaultPitchDeg: z.number().finite().min(0).max(90).optional(),
      defaultZoom: z.number().finite().min(1).max(22).optional(),
      nowMs: z.number().finite().optional(),
    })
    .optional(),
});

export const replayBodySchema = z.object({
  track: trackSchema,
  markers: z.array(trackMediaMarkerSchema).max(5000).default([]),
  durationSec: z.number().finite().min(5).max(60).optional(),
  fallbackPreviewUrl: z.string().max(2048).nullable().optional(),
});

export const flybyCandidateSchema = z.object({
  activityId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  displayName: z.string().min(1).max(160),
  handle: z.string().min(1).max(160),
  avatarUrl: z.string().max(2048).nullable(),
  sport: sportSchema,
  audience: audienceSchema,
  flybyConsent: z.boolean(),
  followerIds: z.array(z.string().max(200)).max(5000).optional(),
  blockedUserIds: z.array(z.string().max(200)).max(5000).optional(),
  privacyZones: z.array(privacyZoneSchema).max(200),
  points: z.array(geoPointSchema).max(50_000),
});

export const flybyBodySchema = z.object({
  primary: flybyCandidateSchema,
  candidates: z.array(flybyCandidateSchema).max(500),
  options: z
    .object({
      maxDistanceM: z.number().finite().min(1).max(1000).optional(),
      maxTimeDeltaSec: z.number().finite().min(1).max(3600).optional(),
    })
    .optional(),
});

export const createPreviewBodySchema = z.object({
  track: trackSchema,
  ownerId: z.string().min(1).max(200),
  expiresInSec: z.number().int().min(60).max(31_536_000),
  toleranceMeters: z.number().finite().min(1).max(500).optional(),
});

export const revokePreviewBodySchema = z.object({
  linkId: z.string().min(1).max(300),
  ownerId: z.string().min(1).max(200),
});

export const externalShareBodySchema = z.object({
  track: trackSchema,
  sanitizedGallery: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        activityId: z.string().min(1).max(200),
        kind: z.enum(['photo', 'video']),
        url: z.string().min(1).max(2048),
        thumbnailUrl: z.string().max(2048).nullable(),
        mimeType: z.string().min(1).max(120),
        caption: z.string().max(500).nullable(),
        orderIndex: z.number().int().min(0),
        capturedAtMs: z.number().finite().nullable(),
        location: z
          .object({
            lat: latitudeSchema,
            lng: longitudeSchema,
            elevationM: z.number().finite().nullable(),
          })
          .nullable(),
        durationSec: z.number().finite().min(0).nullable(),
        exifStripped: z.literal(true),
      }),
    )
    .max(5000)
    .default([]),
  options: z
    .object({
      baseUrl: z.string().max(2048).optional(),
      widthPx: z.number().int().min(200).max(1600).optional(),
      heightPx: z.number().int().min(150).max(1200).optional(),
      theme: z.enum(['dark', 'light', 'outdoor']).optional(),
    })
    .optional(),
});

export const flyoverJobBodySchema = z.object({
  trackId: z.string().min(1).max(200),
  maskVersion: z.string().min(1).max(128),
  audience: audienceSchema,
  preset: z.string().max(60).optional(),
  fallbackImageUrl: z.string().max(2048).nullable().optional(),
});

export const flyoverJobUpdateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    outputUrl: z.string().min(1).max(2048),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.string().min(1).max(500),
  }),
]);

export const revokeTrackBodySchema = z.object({
  trackId: z.string().min(1).max(200),
  ownerId: z.string().min(1).max(200).optional(),
});

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 12).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'body';
    return `${path}: ${issue.message}`;
  });
}

export function buildProjectionFromRaw(
  input: z.infer<typeof rawTrackInputSchema>,
): PublishableTrackProjection {
  return buildPublishableTrackProjection({
    trackId: input.trackId,
    ownerId: input.ownerId,
    title: input.title,
    sport: input.sport as SportKind,
    audience: input.audience as AudienceLevel,
    rawPoints: input.rawPoints,
    privacyZones: input.privacyZones as PrivacyZone[],
  });
}

export function computeGallery(
  input: z.infer<typeof galleryBodySchema>,
): GeolocatedGalleryResult {
  return buildGeolocatedMediaGallery({
    mediaItems: input.mediaItems as ActivityMediaItem[],
    track: input.track as PublishableTrackProjection,
    privacyZones: input.privacyZones as PrivacyZone[],
    viewer: input.viewer as ViewerContext,
  });
}

export function computeFlyover(
  input: z.infer<typeof flyoverBodySchema>,
): FlyoverTimeline {
  return generateFlyoverTimeline(
    input.track as PublishableTrackProjection,
    input.markers as TrackMediaMarker[],
    input.options,
  );
}

export function computeReplay(
  input: z.infer<typeof replayBodySchema>,
): ActivityReplayManifest {
  return generateActivityReplay(
    input.track as PublishableTrackProjection,
    input.markers as TrackMediaMarker[],
    {
      durationSec: input.durationSec,
      fallbackPreviewUrl: input.fallbackPreviewUrl,
    },
  );
}

export function computeFlyby(
  input: z.infer<typeof flybyBodySchema>,
): FlybyDetectionResult {
  return detectFlybyCrossings(
    input.primary as FlybyActivityCandidate,
    input.candidates as FlybyActivityCandidate[],
    input.options,
  );
}

export interface CreatedPreviewLink {
  rawToken: string;
  record: ProtectedPreviewRecord;
}

export function createPreviewLink(
  input: z.infer<typeof createPreviewBodySchema>,
): CreatedPreviewLink {
  const track = input.track as PublishableTrackProjection;
  if (track.ownerId !== input.ownerId) {
    throw new Error('protected_preview_owner_mismatch');
  }
  return getMediaSharingStores().previewStore.createLink({
    track,
    ownerId: input.ownerId,
    expiresInSec: input.expiresInSec,
    toleranceMeters: input.toleranceMeters,
  });
}

export function resolvePreviewLink(
  token: string,
  currentMaskVersion?: string,
): ProtectedPreviewResolution {
  return getMediaSharingStores().previewStore.resolveToken(token, {
    currentMaskVersion,
  });
}

export function revokePreviewLink(input: z.infer<typeof revokePreviewBodySchema>): boolean {
  return getMediaSharingStores().previewStore.revokeLink(input.linkId, input.ownerId);
}

export function previewMetadata(
  record: ProtectedPreviewRecord,
): Omit<ProtectedPreviewRecord, 'simplifiedPoints' | 'elevationProfile' | 'tokenHash'> {
  const {
    simplifiedPoints: _simplifiedPoints,
    elevationProfile: _elevationProfile,
    tokenHash: _tokenHash,
    ...metadata
  } = record;
  return metadata;
}

export interface ExternalSharePayloads {
  embed: WebEmbedPayload;
  card: ShareCardSpec;
  sticker: TransparentStickerSpec;
}

export function computeExternalShare(
  input: z.infer<typeof externalShareBodySchema>,
): ExternalSharePayloads {
  const track = input.track as PublishableTrackProjection;
  const safeGallery = input.sanitizedGallery as SanitizedMediaItem[];
  return {
    embed: buildWebEmbedPayload(track, {
      baseUrl: input.options?.baseUrl,
      widthPx: input.options?.widthPx,
      heightPx: input.options?.heightPx,
    }),
    card: buildShareCard(track, safeGallery, {
      theme: input.options?.theme,
    }),
    sticker: buildTransparentSticker(track),
  };
}

export function enqueueFlyoverJob(
  input: z.infer<typeof flyoverJobBodySchema>,
): { job: FlyoverRenderJob; deduplicated: boolean } {
  const stores = getMediaSharingStores();
  const result = stores.renderQueue.enqueueRender(input);
  stores.jobsById.set(result.job.jobId, result.job);
  return result;
}

export function getFlyoverJob(jobId: string): FlyoverRenderJob | null {
  const stores = getMediaSharingStores();
  const job = stores.renderQueue.getJob(jobId);
  if (job) stores.jobsById.set(jobId, job);
  return job;
}

export function listFlyoverJobs(trackId: string): FlyoverRenderJob[] {
  return Array.from(getMediaSharingStores().jobsById.values())
    .filter((job) => job.trackId === trackId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function updateFlyoverJob(
  jobId: string,
  update: z.infer<typeof flyoverJobUpdateSchema>,
): FlyoverRenderJob | null {
  const stores = getMediaSharingStores();
  const updated =
    update.status === 'ready'
      ? stores.renderQueue.completeRender(jobId, update.outputUrl)
      : stores.renderQueue.failRender(jobId, update.error);
  if (updated) stores.jobsById.set(jobId, updated);
  return updated;
}

export function revokeFlyoverTrack(trackId: string): number {
  const stores = getMediaSharingStores();
  const revoked = stores.renderQueue.revokeAllForTrack(trackId);
  for (const [jobId, job] of stores.jobsById) {
    if (job.trackId === trackId) {
      const current = stores.renderQueue.getJob(jobId);
      if (current) stores.jobsById.set(jobId, current);
    }
  }
  return revoked;
}

export function invalidateFlyoverMasks(
  trackId: string,
  newMaskVersion: string,
): number {
  const stores = getMediaSharingStores();
  const invalidated = stores.renderQueue.invalidateOutdatedMasks(
    trackId,
    newMaskVersion,
  );
  for (const [jobId, job] of stores.jobsById) {
    if (job.trackId === trackId) {
      const current = stores.renderQueue.getJob(jobId);
      if (current) stores.jobsById.set(jobId, current);
    }
  }
  return invalidated;
}

export type {
  ActivityMediaItem,
  ActivityReplayManifest,
  FlybyDetectionResult,
  FlyoverRenderJob,
  FlyoverTimeline,
  GeolocatedGalleryResult,
  PublishableTrackProjection,
  RawExifMetadata,
  SanitizedMediaItem,
  TrackMediaMarker,
  ViewerContext,
};
