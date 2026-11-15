/**
 * Lot C04 — Contrats TypeScript pour le partage média, Flyover 3D / Replay,
 * Flyby croisés, aperçus protégés révocables (K5.28) et partage externe (K5.27 / S5.25).
 *
 * Couvre : K5.05, K5.06, K5.12, K5.27, K5.28, S1.21, S3.20, S3.21, S3.22, S5.25.
 * Invariant transversal : confidentialité fail-closed (respect des zones masquées K7.05 / S6.14).
 */

export type AudienceLevel = 'private' | 'followers' | 'collective' | 'public';

export type SportKind =
  | 'hiking'
  | 'trail_running'
  | 'cycling'
  | 'mtb'
  | 'gravel'
  | 'ski_touring'
  | 'alpinism'
  | 'other';

export interface GeoPoint {
  lat: number;
  lng: number;
  elevationM?: number | null;
  timestampMs?: number | null;
}

export interface PrivacyZone {
  id: string;
  center: { lat: number; lng: number };
  radiusM: number;
  label?: string;
}

export interface PublishableTrackProjection {
  trackId: string;
  ownerId: string;
  title: string;
  sport: SportKind;
  audience: AudienceLevel;
  maskVersion: string;
  points: GeoPoint[];
  maskedPointCount: number;
  totalDistanceM: number;
  elevationGainM: number;
  durationSec: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
}

export type MediaKind = 'photo' | 'video';

export interface RawExifMetadata {
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAltitudeM?: number | null;
  deviceModel?: string | null;
  deviceSerial?: string | null;
  capturedAtIso?: string | null;
  ownerUserId?: string | null;
}

export interface ActivityMediaItem {
  id: string;
  activityId: string;
  ownerId: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl?: string | null;
  mimeType: string;
  caption?: string | null;
  orderIndex: number;
  capturedAtMs: number | null;
  location?: { lat: number; lng: number; elevationM?: number | null } | null;
  durationSec?: number | null;
  exif?: RawExifMetadata | null;
}

export interface SanitizedMediaItem {
  id: string;
  activityId: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  caption: string | null;
  orderIndex: number;
  capturedAtMs: number | null;
  location: { lat: number; lng: number; elevationM: number | null } | null;
  durationSec: number | null;
  exifStripped: true;
}

export interface TrackMediaMarker {
  mediaId: string;
  kind: MediaKind;
  orderIndex: number;
  distanceAlongTrackM: number;
  elapsedSec: number | null;
  location: { lat: number; lng: number; elevationM: number | null };
  thumbnailUrl: string | null;
  caption: string | null;
}

export interface ViewerContext {
  viewerId: string | null;
  isFollower?: boolean;
  isCollectiveMember?: boolean;
  blockedByOwner?: boolean;
}

export interface GeolocatedGalleryResult {
  authorized: boolean;
  reason?: 'unauthorized_audience' | 'blocked';
  maskVersion: string;
  items: SanitizedMediaItem[];
  markers: TrackMediaMarker[];
  filteredOutCount: number;
}

export type RenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'ready'
  | 'failed'
  | 'revoked'
  | 'cancelled';

export interface CameraKeyframe {
  tSec: number;
  progress: number;
  lat: number;
  lng: number;
  elevationM: number;
  bearingDeg: number;
  pitchDeg: number;
  zoom: number;
  speedMps: number;
  attachedMediaId?: string;
  statCallout?: {
    distanceM: number;
    elevationGainM: number;
  };
}

export interface FlyoverTimeline {
  trackId: string;
  maskVersion: string;
  durationSec: number;
  fps: number;
  keyframes: CameraKeyframe[];
  attachedMediaCount: number;
  generatedAtMs: number;
}

export interface FlyoverRenderJob {
  jobId: string;
  idempotencyKey: string;
  trackId: string;
  maskVersion: string;
  audience: AudienceLevel;
  status: RenderJobStatus;
  outputUrl: string | null;
  fallbackImageUrl: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  error?: string;
}

export interface ReplayHighlight {
  id: string;
  tSec: number;
  progress: number;
  kind: 'start' | 'peak' | 'media' | 'split' | 'finish';
  label: string;
  lat: number;
  lng: number;
  elevationM: number | null;
}

export interface ActivityReplayManifest {
  trackId: string;
  maskVersion: string;
  audience: AudienceLevel;
  durationSec: number;
  points: Array<{ lat: number; lng: number; elevationM: number | null; progress: number }>;
  highlights: ReplayHighlight[];
  fallbackPreviewUrl: string | null;
}

export interface FlybyActivityCandidate {
  activityId: string;
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  sport: SportKind;
  audience: AudienceLevel;
  flybyConsent: boolean;
  followerIds?: string[];
  blockedUserIds?: string[];
  privacyZones: PrivacyZone[];
  points: GeoPoint[];
}

export interface FlybyCrossing {
  crossingId: string;
  otherActivityId: string;
  otherUserId: string;
  otherDisplayName: string;
  otherHandle: string;
  otherAvatarUrl: string | null;
  meetingTimeMs: number;
  distanceApartM: number;
  timeDeltaSec: number;
  relativeDirection: 'same_direction' | 'opposite' | 'intersecting';
  meetingPoint: { lat: number; lng: number };
}

export interface FlybyDetectionResult {
  enabled: boolean;
  reason?: 'primary_consent_required' | 'primary_private';
  crossings: FlybyCrossing[];
  excludedCount: number;
}

export interface ProtectedPreviewRecord {
  linkId: string;
  trackId: string;
  ownerId: string;
  tokenHash: string;
  maskVersion: string;
  createdAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  simplifiedPoints: Array<{ lat: number; lng: number }>;
  elevationProfile: Array<{ distanceM: number; elevationM: number | null }>;
  totalDistanceM: number;
  elevationGainM: number;
  title: string;
  sport: SportKind;
}

export interface ProtectedPreviewPublicView {
  linkId: string;
  title: string;
  sport: SportKind;
  totalDistanceM: number;
  elevationGainM: number;
  simplifiedPoints: Array<{ lat: number; lng: number }>;
  elevationProfile: Array<{ distanceM: number; elevationM: number | null }>;
  downloadable: false;
  navigable: false;
  expiresAtMs: number;
}

export type ProtectedPreviewResolution =
  | { ok: true; preview: ProtectedPreviewPublicView }
  | {
      ok: false;
      reason: 'not_found' | 'revoked' | 'expired' | 'mask_invalidated';
      preview: null;
    };

export interface WebEmbedPayload {
  authorized: boolean;
  reason?: 'audience_not_public';
  trackId: string;
  maskVersion: string;
  title: string;
  sport: SportKind;
  totalDistanceM: number;
  elevationGainM: number;
  simplifiedPoints: Array<{ lat: number; lng: number }>;
  elevationProfile: Array<{ distanceM: number; elevationM: number | null }>;
  embedHtml: string;
  noExif: true;
}

export interface ShareCardSpec {
  authorized: boolean;
  reason?: 'audience_not_shareable';
  trackId: string;
  maskVersion: string;
  theme: 'dark' | 'light' | 'outdoor';
  title: string;
  sport: SportKind;
  stats: {
    distanceKm: number;
    elevationGainM: number;
    durationFormatted: string;
  };
  routeSvgPath: string;
  heroPhotoUrl: string | null;
  noExif: true;
}

export interface TransparentStickerSpec {
  authorized: boolean;
  reason?: 'audience_not_shareable';
  trackId: string;
  maskVersion: string;
  width: number;
  height: number;
  routeSvgPath: string;
  svgMarkup: string;
  noExif: true;
}
