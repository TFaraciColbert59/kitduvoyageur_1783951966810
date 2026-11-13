import { describe, expect, it } from 'vitest';
import {
  ProtectedPreviewStore,
  FlyoverRenderQueue,
  addActivityMedia,
  buildGeolocatedMediaGallery,
  buildPublishableTrackProjection,
  buildShareCard,
  buildTransparentSticker,
  buildWebEmbedPayload,
  captureMediaDuringTracking,
  computeMaskVersion,
  detectFlybyCrossings,
  generateActivityReplay,
  generateFlyoverTimeline,
  hashPreviewToken,
  removeActivityMedia,
  reorderActivityMedia,
  type ActivityMediaItem,
  type FlybyActivityCandidate,
  type GeoPoint,
  type PrivacyZone,
} from '../index';

const HOME_ZONE: PrivacyZone = {
  id: 'zone-home',
  center: { lat: 45.8326, lng: 6.8652 },
  radiusM: 250,
  label: 'Maison',
};

const BASE_POINTS: GeoPoint[] = [
  // Point 0 : dans la zone masquée
  { lat: 45.8327, lng: 6.8653, elevationM: 1035, timestampMs: 1_700_000_000_000 },
  // Point 1 : hors zone masquée
  { lat: 45.838, lng: 6.872, elevationM: 1120, timestampMs: 1_700_000_300_000 },
  // Point 2 : sommet
  { lat: 45.844, lng: 6.88, elevationM: 1380, timestampMs: 1_700_000_600_000 },
  // Point 3 : descente
  { lat: 45.85, lng: 6.888, elevationM: 1210, timestampMs: 1_700_000_900_000 },
];

describe('Lot C04 — media-sharing', () => {
  describe('K5.05 / S1.21 / K5.06 — Capture live, médias ordonnés et galerie géolocalisée fail-closed', () => {
    it('K5.05 : capture une photo pendant le suivi sans interrompre le GPS', () => {
      const initial = {
        activityId: 'act-1',
        ownerId: 'user-1',
        gpsTrackingActive: true,
        lastKnownPoint: { lat: 45.838, lng: 6.872, elevationM: 1120 },
        media: [],
      };

      const res = captureMediaDuringTracking(initial, {
        id: 'm-live-1',
        kind: 'photo',
        url: 'https://cdn.example.com/live1.jpg',
        mimeType: 'image/jpeg',
        capturedAtMs: 1_700_000_305_000,
        caption: 'Vue du col',
      });

      expect(res.gpsInterrupted).toBe(false);
      expect(res.session.gpsTrackingActive).toBe(true);
      expect(res.session.media).toHaveLength(1);
      expect(res.capturedItem.location).toEqual({
        lat: 45.838,
        lng: 6.872,
        elevationM: 1120,
      });
    });

    it('S1.21 : rattache photos et vidéos avec réordonnancement et suppression', () => {
      const base: ActivityMediaItem[] = [
        {
          id: 'm1',
          activityId: 'act-1',
          ownerId: 'user-1',
          kind: 'photo',
          url: 'https://cdn.example.com/1.jpg',
          mimeType: 'image/jpeg',
          orderIndex: 0,
          capturedAtMs: 1_700_000_300_000,
        },
      ];

      const withVideo = addActivityMedia(base, {
        id: 'm2',
        activityId: 'act-1',
        ownerId: 'user-1',
        kind: 'video',
        url: 'https://cdn.example.com/2.mp4',
        thumbnailUrl: 'https://cdn.example.com/2-thumb.jpg',
        mimeType: 'video/mp4',
        durationSec: 18,
        capturedAtMs: 1_700_000_600_000,
      });

      expect(withVideo.map((m) => [m.id, m.kind, m.orderIndex])).toEqual([
        ['m1', 'photo', 0],
        ['m2', 'video', 1],
      ]);

      const reordered = reorderActivityMedia(withVideo, ['m2', 'm1']);
      expect(reordered.map((m) => [m.id, m.orderIndex])).toEqual([
        ['m2', 0],
        ['m1', 1],
      ]);

      const afterRemove = removeActivityMedia(reordered, 'm2');
      expect(afterRemove.map((m) => [m.id, m.orderIndex])).toEqual([['m1', 0]]);
    });

    it('K5.06 : exclut les médias situés dans une zone masquée, supprime les EXIF et respecte l audience', () => {
      const track = buildPublishableTrackProjection({
        trackId: 'act-1',
        ownerId: 'user-1',
        title: 'Boucle du Mont-Blanc',
        sport: 'hiking',
        audience: 'public',
        rawPoints: BASE_POINTS,
        privacyZones: [HOME_ZONE],
      });

      expect(track.maskedPointCount).toBe(1);
      expect(track.points).toHaveLength(3);

      const media: ActivityMediaItem[] = [
        {
          id: 'm-masked',
          activityId: 'act-1',
          ownerId: 'user-1',
          kind: 'photo',
          url: 'https://cdn.example.com/home.jpg',
          mimeType: 'image/jpeg',
          orderIndex: 0,
          capturedAtMs: 1_700_000_000_000,
          location: { lat: 45.83265, lng: 6.86525, elevationM: 1035 },
          exif: {
            gpsLat: 45.83265,
            gpsLng: 6.86525,
            deviceSerial: 'SECRET-SERIAL',
          },
        },
        {
          id: 'm-visible',
          activityId: 'act-1',
          ownerId: 'user-1',
          kind: 'photo',
          url: 'https://cdn.example.com/summit.jpg',
          thumbnailUrl: 'https://cdn.example.com/summit-thumb.jpg',
          mimeType: 'image/jpeg',
          orderIndex: 1,
          capturedAtMs: 1_700_000_600_000,
          location: { lat: 45.844, lng: 6.88, elevationM: 1380 },
          exif: {
            gpsLat: 45.844,
            gpsLng: 6.88,
            deviceSerial: 'SECRET-SERIAL',
          },
        },
      ];

      const publicGallery = buildGeolocatedMediaGallery({
        mediaItems: media,
        track,
        privacyZones: [HOME_ZONE],
        viewer: { viewerId: 'other-user' },
      });

      expect(publicGallery.authorized).toBe(true);
      expect(publicGallery.filteredOutCount).toBe(1);
      expect(publicGallery.items).toHaveLength(1);
      expect(publicGallery.items[0].id).toBe('m-visible');
      expect(publicGallery.items[0].exifStripped).toBe(true);
      expect('exif' in publicGallery.items[0]).toBe(false);
      expect(publicGallery.markers).toHaveLength(1);
      expect(publicGallery.markers[0].mediaId).toBe('m-visible');

      // Fail-closed pour un utilisateur bloqué
      const blockedGallery = buildGeolocatedMediaGallery({
        mediaItems: media,
        track,
        privacyZones: [HOME_ZONE],
        viewer: { viewerId: 'blocked-user', blockedByOwner: true },
      });
      expect(blockedGallery.authorized).toBe(false);
      expect(blockedGallery.items).toHaveLength(0);
      expect(blockedGallery.markers).toHaveLength(0);
    });
  });

  describe('K5.12 / S3.20 / S3.21 — Flyover 3D timeline, jobs idempotents et Activity Replay', () => {
    it('génère une timeline Flyover 3D sans points masqués et un Replay pour le fil', () => {
      const track = buildPublishableTrackProjection({
        trackId: 'act-fly',
        ownerId: 'user-1',
        title: 'Crête des Aiguilles',
        sport: 'trail_running',
        audience: 'public',
        rawPoints: BASE_POINTS,
        privacyZones: [HOME_ZONE],
      });

      const gallery = buildGeolocatedMediaGallery({
        mediaItems: [
          {
            id: 'm-peak',
            activityId: 'act-fly',
            ownerId: 'user-1',
            kind: 'photo',
            url: 'https://cdn.example.com/peak.jpg',
            mimeType: 'image/jpeg',
            orderIndex: 0,
            capturedAtMs: 1_700_000_600_000,
            location: { lat: 45.844, lng: 6.88, elevationM: 1380 },
          },
        ],
        track,
        privacyZones: [HOME_ZONE],
        viewer: { viewerId: 'viewer-2' },
      });

      const timeline = generateFlyoverTimeline(track, gallery.markers, {
        targetDurationSec: 20,
        fps: 30,
        nowMs: 1_700_001_000_000,
      });

      expect(timeline.keyframes).toHaveLength(3);
      expect(timeline.attachedMediaCount).toBe(1);
      expect(timeline.keyframes[1].attachedMediaId).toBe('m-peak');
      expect(timeline.maskVersion).toBe(track.maskVersion);

      const replay = generateActivityReplay(track, gallery.markers, {
        durationSec: 15,
        fallbackPreviewUrl: 'https://cdn.example.com/replay-fallback.png',
      });
      expect(replay.points).toHaveLength(3);
      expect(replay.highlights.some((h) => h.kind === 'peak')).toBe(true);
      expect(replay.highlights.some((h) => h.kind === 'media')).toBe(true);
    });

    it('garantit l idempotence du rendu Flyover et l invalidation lors du changement de masque', () => {
      const queue = new FlyoverRenderQueue(2);
      const maskV1 = computeMaskVersion([HOME_ZONE], 'public');
      const maskV2 = computeMaskVersion(
        [HOME_ZONE, { id: 'zone-work', center: { lat: 45.85, lng: 6.888 }, radiusM: 150 }],
        'public',
      );

      const first = queue.enqueueRender({
        trackId: 'act-fly',
        maskVersion: maskV1,
        audience: 'public',
        nowMs: 1000,
      });
      expect(first.deduplicated).toBe(false);

      const replay = queue.enqueueRender({
        trackId: 'act-fly',
        maskVersion: maskV1,
        audience: 'public',
        nowMs: 1100,
      });
      expect(replay.deduplicated).toBe(true);
      expect(replay.job.jobId).toBe(first.job.jobId);

      const completed = queue.completeRender(
        first.job.jobId,
        'https://cdn.example.com/flyover-v1.mp4',
        1200,
      );
      expect(completed?.status).toBe('ready');

      const invalidatedCount = queue.invalidateOutdatedMasks('act-fly', maskV2, 1300);
      expect(invalidatedCount).toBe(1);
      const afterInvalidation = queue.getJob(first.job.jobId);
      expect(afterInvalidation?.status).toBe('revoked');
      expect(afterInvalidation?.outputUrl).toBeNull();
    });
  });

  describe('S3.22 — Flyby croisés avec consentement fail-closed', () => {
    const primary: FlybyActivityCandidate = {
      activityId: 'act-p',
      userId: 'u-p',
      displayName: 'Alice',
      handle: '@alice',
      avatarUrl: null,
      sport: 'trail_running',
      audience: 'public',
      flybyConsent: true,
      privacyZones: [HOME_ZONE],
      points: BASE_POINTS,
    };

    it('détecte un croisement autorisé et exclut privé, sans consentement, bloqué et zone masquée', () => {
      const authorizedCandidate: FlybyActivityCandidate = {
        activityId: 'act-ok',
        userId: 'u-ok',
        displayName: 'Bob',
        handle: '@bob',
        avatarUrl: 'https://cdn.example.com/bob.jpg',
        sport: 'trail_running',
        audience: 'public',
        flybyConsent: true,
        privacyZones: [],
        points: [
          { lat: 45.85, lng: 6.888, timestampMs: 1_700_000_590_000 },
          { lat: 45.84405, lng: 6.88005, timestampMs: 1_700_000_610_000 },
        ],
      };

      const noConsentCandidate: FlybyActivityCandidate = {
        ...authorizedCandidate,
        activityId: 'act-noconsent',
        userId: 'u-noconsent',
        flybyConsent: false,
      };

      const privateCandidate: FlybyActivityCandidate = {
        ...authorizedCandidate,
        activityId: 'act-private',
        userId: 'u-private',
        audience: 'private',
      };

      const maskedZoneOnlyCandidate: FlybyActivityCandidate = {
        ...authorizedCandidate,
        activityId: 'act-masked',
        userId: 'u-masked',
        points: [{ lat: 45.83265, lng: 6.86525, timestampMs: 1_700_000_005_000 }],
      };

      const result = detectFlybyCrossings(primary, [
        authorizedCandidate,
        noConsentCandidate,
        privateCandidate,
        maskedZoneOnlyCandidate,
      ]);

      expect(result.enabled).toBe(true);
      expect(result.excludedCount).toBe(2);
      expect(result.crossings).toHaveLength(1);
      expect(result.crossings[0].otherUserId).toBe('u-ok');
      expect(result.crossings[0].relativeDirection).toBe('opposite');
    });

    it('refuse tout Flyby si l activité primaire n a pas consenti', () => {
      const res = detectFlybyCrossings({ ...primary, flybyConsent: false }, []);
      expect(res.enabled).toBe(false);
      expect(res.reason).toBe('primary_consent_required');
      expect(res.crossings).toHaveLength(0);
    });
  });

  describe('K5.28 — Aperçu protégé et révocable d un tracé privé (SHA-256)', () => {
    it('stocke uniquement le hash SHA-256, refuse après révocation, expiration ou changement de masque', () => {
      const store = new ProtectedPreviewStore();
      const privateTrack = buildPublishableTrackProjection({
        trackId: 'act-priv',
        ownerId: 'owner-1',
        title: 'Reconnaissance secrète',
        sport: 'alpinism',
        audience: 'private',
        rawPoints: BASE_POINTS,
        privacyZones: [HOME_ZONE],
      });

      const { rawToken, record } = store.createLink({
        track: privateTrack,
        ownerId: 'owner-1',
        expiresInSec: 3600,
        nowMs: 1_000_000,
      });

      expect(record.tokenHash).toBe(hashPreviewToken(rawToken));
      expect(record.tokenHash).not.toBe(rawToken);

      // Résolution valide
      const valid = store.resolveToken(rawToken, {
        nowMs: 1_500_000,
        currentMaskVersion: privateTrack.maskVersion,
      });
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.preview.downloadable).toBe(false);
        expect(valid.preview.navigable).toBe(false);
        expect(valid.preview.simplifiedPoints.length).toBeGreaterThanOrEqual(2);
      }

      // Expiration -> aucune coordonnée
      const expired = store.resolveToken(rawToken, {
        nowMs: 1_000_000 + 3600 * 1000,
        currentMaskVersion: privateTrack.maskVersion,
      });
      expect(expired).toEqual({ ok: false, reason: 'expired', preview: null });

      // Changement de masque -> invalidation
      const maskChanged = store.resolveToken(rawToken, {
        nowMs: 1_500_000,
        currentMaskVersion: 'different-mask-version',
      });
      expect(maskChanged).toEqual({ ok: false, reason: 'mask_invalidated', preview: null });

      // Révocation immédiate -> aucune coordonnée
      expect(store.revokeLink(record.linkId, 'owner-1', 1_600_000)).toBe(true);
      const revoked = store.resolveToken(rawToken, {
        nowMs: 1_600_001,
        currentMaskVersion: privateTrack.maskVersion,
      });
      expect(revoked).toEqual({ ok: false, reason: 'revoked', preview: null });
    });
  });

  describe('K5.27 / S5.25 — Partage externe, embed web et sticker transparent', () => {
    it('génère embed web, carte sportive et sticker transparent pour trace publique, et refuse trace privée', () => {
      const publicTrack = buildPublishableTrackProjection({
        trackId: 'act-pub',
        ownerId: 'owner-1',
        title: 'Tour du Lac',
        sport: 'cycling',
        audience: 'public',
        rawPoints: BASE_POINTS,
        privacyZones: [HOME_ZONE],
      });

      const embed = buildWebEmbedPayload(publicTrack);
      expect(embed.authorized).toBe(true);
      expect(embed.embedHtml).toContain('<iframe');
      expect(embed.embedHtml).toContain(`mv=${publicTrack.maskVersion}`);
      expect(embed.elevationProfile).toHaveLength(3);

      const card = buildShareCard(publicTrack, [], { theme: 'dark' });
      expect(card.authorized).toBe(true);
      expect(card.routeSvgPath).toContain('M ');
      expect(card.noExif).toBe(true);

      const sticker = buildTransparentSticker(publicTrack);
      expect(sticker.authorized).toBe(true);
      expect(sticker.svgMarkup).toContain('<svg');
      expect(sticker.svgMarkup).toContain('Tour du Lac');

      const privateTrack = { ...publicTrack, audience: 'private' as const };
      expect(buildWebEmbedPayload(privateTrack).authorized).toBe(false);
      expect(buildShareCard(privateTrack, []).authorized).toBe(false);
      expect(buildTransparentSticker(privateTrack).authorized).toBe(false);
    });
  });
});
