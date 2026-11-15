import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as projectionPOST } from '@/app/api/media-sharing/projection/route';
import { POST as galleryPOST } from '@/app/api/media-sharing/gallery/route';
import { POST as flyoverPOST } from '@/app/api/media-sharing/flyover/route';
import { POST as replayPOST } from '@/app/api/media-sharing/replay/route';
import { POST as flybyPOST } from '@/app/api/media-sharing/flyby/route';
import { POST as previewPOST } from '@/app/api/media-sharing/preview/route';
import { GET as previewGET } from '@/app/api/media-sharing/preview/[token]/route';
import { POST as revokePOST } from '@/app/api/media-sharing/preview/revoke/route';
import { POST as externalSharePOST } from '@/app/api/media-sharing/external-share/route';
import { POST as jobsPOST } from '@/app/api/media-sharing/flyover/jobs/route';
import {
  GET as jobGET,
  PATCH as jobPATCH,
} from '@/app/api/media-sharing/flyover/jobs/[jobId]/route';
import { GET as serviceGET } from '@/app/api/media-sharing/route';
import { HOME_ZONE, MEDIA_ITEMS, RAW_POINTS, makeScreenData, makeTrack } from '@/components/media-sharing/__tests__/fixtures';

const URL_BASE = 'http://localhost:3000/api/media-sharing';

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`${URL_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patch(path: string, body: unknown): NextRequest {
  return new NextRequest(`${URL_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('C04 — routes API media-sharing', () => {
  it('sert la carte de service sans donnée utilisateur', async () => {
    const response = await serviceGET();
    const body = (await response.json()) as {
      ok: boolean;
      features: Record<string, string>;
    };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.features.protectedPreview).toBe('K5.28');
    expect(body).not.toHaveProperty('points');
    expect(body).not.toHaveProperty('mediaItems');
  });

  it('projection puis galerie : refus fail-closed et validation zod', async () => {
    const projection = await projectionPOST(
      post('/projection', {
        trackId: 'act-route',
        ownerId: 'owner-c04',
        title: 'Route',
        sport: 'hiking',
        audience: 'public',
        rawPoints: RAW_POINTS,
        privacyZones: [HOME_ZONE],
      }),
    );
    expect(projection.status).toBe(200);
    const track = (await projection.json()) as ReturnType<typeof makeTrack>;
    expect(track.maskedPointCount).toBe(1);

    const gallery = await galleryPOST(
      post('/gallery', {
        track,
        mediaItems: MEDIA_ITEMS,
        privacyZones: [HOME_ZONE],
        viewer: { viewerId: 'reader' },
      }),
    );
    expect(gallery.status).toBe(200);
    const galleryBody = (await gallery.json()) as { items: unknown[] };
    expect(galleryBody.items).toHaveLength(2);

    const invalid = await galleryPOST(post('/gallery', { track: { nope: true } }));
    expect(invalid.status).toBe(400);
    const invalidBody = (await invalid.json()) as { code: string; issues: string[] };
    expect(invalidBody.code).toBe('invalid_body');
    expect(invalidBody.issues.length).toBeGreaterThan(0);
  });

  it('flyover, replay et flyby répondent avec le contrat', async () => {
    const { track, gallery, flyby } = makeScreenData();

    const flyover = await flyoverPOST(
      post('/flyover', {
        track,
        markers: gallery.markers,
        options: { targetDurationSec: 10, fps: 24 },
      }),
    );
    expect(flyover.status).toBe(200);
    const timeline = (await flyover.json()) as { keyframes: unknown[]; fps: number };
    expect(timeline.fps).toBe(24);
    expect(timeline.keyframes.length).toBeGreaterThan(0);

    const replay = await replayPOST(
      post('/replay', { track, markers: gallery.markers }),
    );
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { points: unknown[] }).points.length).toBeGreaterThan(0);

    const crossings = await flybyPOST(
      post('/flyby', {
        primary: {
          activityId: 'act-c04',
          userId: 'owner-c04',
          displayName: 'Alice',
          handle: '@alice',
          avatarUrl: null,
          sport: 'hiking',
          audience: 'public',
          flybyConsent: true,
          privacyZones: [],
          points: RAW_POINTS,
        },
        candidates: [
          {
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
            ],
          },
        ],
      }),
    );
    expect(crossings.status).toBe(200);
    expect(((await crossings.json()) as { crossings: unknown[] }).crossings).toHaveLength(
      flyby.crossings.length,
    );
  });

  it('aperçu : création, résolution, révocation puis refus 410', async () => {
    const track = makeTrack({ trackId: 'act-route-preview', audience: 'private' });
    const createdResponse = await previewPOST(
      post('/preview', { track, ownerId: 'owner-c04', expiresInSec: 3600 }),
    );
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as {
      token: string;
      url: string;
      record: { linkId: string; tokenHash?: string; simplifiedPoints?: unknown };
    };
    expect(created.url).toContain('/apercu/');
    expect(created.record.tokenHash).toBeUndefined();
    expect(created.record.simplifiedPoints).toBeUndefined();

    const resolveRequest = new NextRequest(
      `${URL_BASE}/preview/${created.token}?mv=${track.maskVersion}`,
    );
    const resolved = await previewGET(resolveRequest, {
      params: Promise.resolve({ token: created.token }),
    });
    expect(resolved.status).toBe(200);
    expect(((await resolved.json()) as { ok: boolean }).ok).toBe(true);

    const revoked = await revokePOST(
      post('/preview/revoke', {
        linkId: created.record.linkId,
        ownerId: 'owner-c04',
      }),
    );
    expect(revoked.status).toBe(200);

    const after = await previewGET(
      new NextRequest(`${URL_BASE}/preview/${created.token}`),
      { params: Promise.resolve({ token: created.token }) },
    );
    expect(after.status).toBe(410);
    expect(await after.json()).toEqual({
      ok: false,
      reason: 'revoked',
      preview: null,
    });

    const forbidden = await previewPOST(
      post('/preview', { track, ownerId: 'other-owner', expiresInSec: 3600 }),
    );
    expect(forbidden.status).toBe(403);
  });

  it('partage externe refuse une trace privée', async () => {
    const privateTrack = makeTrack({ trackId: 'act-route-share', audience: 'private' });
    const response = await externalSharePOST(
      post('/external-share', { track: privateTrack, sanitizedGallery: [] }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      embed: { authorized: boolean; reason?: string };
      card: { authorized: boolean };
    };
    expect(payload.embed.authorized).toBe(false);
    expect(payload.embed.reason).toBe('audience_not_public');
    expect(payload.card.authorized).toBe(false);
  });

  it('jobs Flyover : création, statut, complétion et invalidation', async () => {
    const trackId = `act-jobs-route-${Date.now()}`;
    const created = await jobsPOST(
      post('/flyover/jobs', {
        trackId,
        maskVersion: 'mask-route-1',
        audience: 'public',
      }),
    );
    expect(created.status).toBe(201);
    const job = (await created.json()) as { job: { jobId: string } };

    const status = await jobGET(
      new NextRequest(`${URL_BASE}/flyover/jobs/${job.job.jobId}`),
      { params: Promise.resolve({ jobId: job.job.jobId }) },
    );
    expect(status.status).toBe(200);

    const completed = await jobPATCH(
      patch(`/flyover/jobs/${job.job.jobId}`, {
        status: 'ready',
        outputUrl: 'https://cdn.example.com/out.mp4',
      }),
      { params: Promise.resolve({ jobId: job.job.jobId }) },
    );
    expect(completed.status).toBe(200);
    expect(((await completed.json()) as { status: string }).status).toBe('ready');
  });
});
