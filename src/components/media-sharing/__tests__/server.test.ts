import { describe, expect, it } from 'vitest';
import {
  buildProjectionFromRaw,
  computeExternalShare,
  computeFlyby,
  computeFlyover,
  computeGallery,
  computeReplay,
  createPreviewLink,
  enqueueFlyoverJob,
  externalShareBodySchema,
  flybyBodySchema,
  flyoverBodySchema,
  flyoverJobBodySchema,
  galleryBodySchema,
  getFlyoverJob,
  invalidateFlyoverMasks,
  listFlyoverJobs,
  previewMetadata,
  rawTrackInputSchema,
  replayBodySchema,
  resolvePreviewLink,
  revokePreviewLink,
  updateFlyoverJob,
} from '../server/contract';
import { HOME_ZONE, MEDIA_ITEMS, RAW_POINTS, makeScreenData, makeTrack } from './fixtures';

describe('C04 — contrat serveur médias', () => {
  it('projette une trace en retirant les points des zones protégées', () => {
    const input = rawTrackInputSchema.parse({
      trackId: 'act-proj',
      ownerId: 'owner-c04',
      title: 'Projection',
      sport: 'hiking',
      audience: 'public',
      rawPoints: RAW_POINTS,
      privacyZones: [HOME_ZONE],
    });
    const track = buildProjectionFromRaw(input);
    expect(track.maskedPointCount).toBe(1);
    expect(track.points).toHaveLength(3);
    expect(track.points.some((point) => point.lat === RAW_POINTS[0].lat)).toBe(false);
    expect(track.maskVersion).toHaveLength(16);
  });

  it('galerie : exclut les médias masqués, retire les EXIF et respecte le blocage', () => {
    const track = makeTrack();
    const input = galleryBodySchema.parse({
      track,
      mediaItems: MEDIA_ITEMS,
      privacyZones: [HOME_ZONE],
      viewer: { viewerId: 'reader' },
    });
    const gallery = computeGallery(input);

    expect(gallery.authorized).toBe(true);
    expect(gallery.items).toHaveLength(2);
    expect(gallery.items.map((item) => item.id)).toEqual(['m-summit', 'm-video']);
    expect(gallery.filteredOutCount).toBe(1);
    expect(gallery.markers).toHaveLength(2);
    expect(gallery.markers[0].distanceAlongTrackM).toBeGreaterThan(0);
    expect(gallery.items.every((item) => item.exifStripped)).toBe(true);
    expect(gallery.items.every((item) => !('exif' in item))).toBe(true);

    const blocked = computeGallery(
      galleryBodySchema.parse({
        track,
        mediaItems: MEDIA_ITEMS,
        privacyZones: [HOME_ZONE],
        viewer: { viewerId: 'blocked', blockedByOwner: true },
      }),
    );
    expect(blocked.authorized).toBe(false);
    expect(blocked.reason).toBe('blocked');
    expect(blocked.items).toEqual([]);
  });

  it('flyover et replay : timelines déterministes et manifeste fail-closed', () => {
    const { track, gallery } = makeScreenData();
    const timeline = computeFlyover(
      flyoverBodySchema.parse({
        track,
        markers: gallery.markers,
        options: { targetDurationSec: 12, fps: 24, nowMs: 1_700_002_000_000 },
      }),
    );
    expect(timeline.keyframes).toHaveLength(track.points.length);
    expect(timeline.fps).toBe(24);
    expect(timeline.durationSec).toBe(12);
    expect(timeline.attachedMediaCount).toBe(2);

    const replay = computeReplay(
      replayBodySchema.parse({
        track,
        markers: gallery.markers,
        durationSec: 15,
      }),
    );
    expect(replay.points).toHaveLength(track.points.length);
    expect(replay.highlights.some((highlight) => highlight.kind === 'peak')).toBe(true);

    const privateTrack = makeTrack({ trackId: 'act-private', audience: 'private' });
    const privateReplay = computeReplay(
      replayBodySchema.parse({
        track: privateTrack,
        markers: [],
        fallbackPreviewUrl: 'https://cdn.example.com/leak.png',
      }),
    );
    expect(privateReplay.points).toEqual([]);
    expect(privateReplay.highlights).toEqual([]);
    expect(privateReplay.fallbackPreviewUrl).toBeNull();
  });

  it('flyby : refuse une activité primaire privée et exclut les candidats non consentis', () => {
    const { flyby } = makeScreenData();
    expect(flyby.enabled).toBe(true);
    expect(flyby.crossings).toHaveLength(1);
    expect(flyby.crossings[0].otherHandle).toBe('@bob');

    const disabled = computeFlyby(
      flybyBodySchema.parse({
        primary: {
          activityId: 'act-private',
          userId: 'owner',
          displayName: 'Alice',
          handle: '@alice',
          avatarUrl: null,
          sport: 'hiking',
          audience: 'private',
          flybyConsent: true,
          privacyZones: [],
          points: RAW_POINTS,
        },
        candidates: [],
      }),
    );
    expect(disabled.enabled).toBe(false);
    expect(disabled.reason).toBe('primary_private');
  });

  it('aperçu révocable : ne stocke que le hash, invalide au changement de masque et à la révocation', () => {
    const track = makeTrack({ trackId: 'act-preview', audience: 'private' });
    const { rawToken, record } = createPreviewLink({
      track,
      ownerId: 'owner-c04',
      expiresInSec: 3600,
    });

    expect(rawToken.length).toBeGreaterThan(20);
    expect(record.tokenHash).not.toBe(rawToken);
    expect(record.tokenHash).toHaveLength(64);

    const valid = resolvePreviewLink(rawToken, track.maskVersion);
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.preview.downloadable).toBe(false);
      expect(valid.preview.navigable).toBe(false);
      expect(valid.preview.simplifiedPoints.length).toBeGreaterThanOrEqual(2);
    }

    const mismatched = resolvePreviewLink(rawToken, 'un-autre-masque');
    expect(mismatched).toEqual({ ok: false, reason: 'mask_invalidated', preview: null });

    expect(revokePreviewLink({ linkId: record.linkId, ownerId: 'owner-c04' })).toBe(true);
    expect(resolvePreviewLink(rawToken, track.maskVersion)).toEqual({
      ok: false,
      reason: 'revoked',
      preview: null,
    });
    expect(revokePreviewLink({ linkId: record.linkId, ownerId: 'other-owner' })).toBe(false);

    const metadata = previewMetadata(record);
    expect('tokenHash' in metadata).toBe(false);
    expect('simplifiedPoints' in metadata).toBe(false);
    expect('elevationProfile' in metadata).toBe(false);
  });

  it('partage externe : autorise le public, refuse le privé et ne fuit aucun EXIF', () => {
    const { track, gallery } = makeScreenData();
    const share = computeExternalShare(
      externalShareBodySchema.parse({
        track,
        sanitizedGallery: gallery.items,
        options: { baseUrl: 'https://example.test', theme: 'dark' },
      }),
    );
    expect(share.embed.authorized).toBe(true);
    expect(share.embed.embedHtml).toContain('https://example.test/embed/track/');
    expect(share.embed.noExif).toBe(true);
    expect(share.card.authorized).toBe(true);
    expect(share.card.routeSvgPath.startsWith('M ')).toBe(true);
    expect(share.sticker.authorized).toBe(true);
    expect(share.sticker.svgMarkup).toContain('<svg');

    const privateTrack = makeTrack({ trackId: 'act-private', audience: 'private' });
    const privateShare = computeExternalShare(
      externalShareBodySchema.parse({
        track: privateTrack,
        sanitizedGallery: [],
      }),
    );
    expect(privateShare.embed.authorized).toBe(false);
    expect(privateShare.embed.reason).toBe('audience_not_public');
    expect(privateShare.card.authorized).toBe(false);
    expect(privateShare.sticker.authorized).toBe(false);
  });

  it('file Flyover : idempotence, complétion et invalidation par masque', () => {
    const track = makeTrack({ trackId: 'act-jobs' });
    const body = flyoverJobBodySchema.parse({
      trackId: track.trackId,
      maskVersion: 'mask-v1',
      audience: 'public',
    });
    const first = enqueueFlyoverJob(body);
    const second = enqueueFlyoverJob(body);
    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.job.jobId).toBe(first.job.jobId);

    const ready = updateFlyoverJob(first.job.jobId, {
      status: 'ready',
      outputUrl: 'https://cdn.example.com/flyover.mp4',
    });
    expect(ready?.status).toBe('ready');
    expect(getFlyoverJob(first.job.jobId)?.outputUrl).toContain('flyover.mp4');
    expect(listFlyoverJobs(track.trackId).some((job) => job.jobId === first.job.jobId)).toBe(true);

    expect(invalidateFlyoverMasks(track.trackId, 'mask-v2')).toBeGreaterThanOrEqual(1);
    expect(getFlyoverJob(first.job.jobId)?.status).toBe('revoked');
    expect(getFlyoverJob(first.job.jobId)?.outputUrl).toBeNull();

    const privateJob = enqueueFlyoverJob(
      flyoverJobBodySchema.parse({
        trackId: 'act-private-job',
        maskVersion: 'mask-v1',
        audience: 'private',
      }),
    );
    expect(privateJob.job.status).toBe('cancelled');
    expect(privateJob.job.error).toBe('private_track_not_publishable');
  });
});
