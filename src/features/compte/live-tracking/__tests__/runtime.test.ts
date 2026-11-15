import { describe, expect, it } from 'vitest';

import {
  LiveTrackingRuntime,
  RecordingSafetyNotifier,
  type StartSessionResult,
} from '../server/runtime';

const BASE_TIME_MS = Date.UTC(2026, 10, 13, 10, 0, 0);

class FakeClock {
  constructor(private currentMs: number) {}
  nowMs(): number {
    return this.currentMs;
  }
  advanceMs(deltaMs: number): void {
    this.currentMs += deltaMs;
  }
}

function started(result: StartSessionResult) {
  if (!result.ok) throw new Error(`startSession failed: ${result.error}`);
  return result.session;
}

describe('Runtime serveur P02 — orchestration propriétaire', () => {
  it('crée une séance, un lien, et ne sort jamais l’empreinte du jeton vers la vue propriétaire', async () => {
    const clock = new FakeClock(BASE_TIME_MS);
    const runtime = new LiveTrackingRuntime({ clock, shareBaseUrl: 'https://exemple.test/live/' });
    const session = started(await runtime.startSession('user-1', { sessionId: 'sess-1' }));

    expect(session).toMatchObject({ sessionId: 'sess-1', ownerUserId: 'user-1', status: 'active' });

    const created = await runtime.createShareLink('user-1', {
      sessionId: 'sess-1',
      durationMinutes: 60,
      label: 'Vercors',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.link.shareUrl.startsWith('https://exemple.test/live/')).toBe(true);
    expect(created.record.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.link.link).not.toHaveProperty('tokenHash');
    expect(created.link.link).not.toHaveProperty('ownerUserId');
    expect(JSON.stringify(created.link.link)).not.toContain(created.record.tokenHash);
    expect(created.link.link.status).toBe('active');
    expect(created.link.expiresAtIso).toBe(new Date(BASE_TIME_MS + 3_600_000).toISOString());

    const status = await runtime.getStatus('user-1');
    expect(status.activeSessionId).toBe('sess-1');
    expect(status.links).toHaveLength(1);
    expect(status.links[0].id).toBe(created.link.link.id);
    expect(status.shareBaseUrl).toBe('https://exemple.test/live/');
  });

  it('retourne une position fraîche à l’invité puis coupe tout à la révocation', async () => {
    const clock = new FakeClock(BASE_TIME_MS);
    const runtime = new LiveTrackingRuntime({ clock });
    started(await runtime.startSession('user-1', { sessionId: 'sess-guest' }));

    const created = await runtime.createShareLink('user-1', {
      sessionId: 'sess-guest',
      durationMinutes: 30,
      includeTrail: true,
    });
    if (!created.ok) throw new Error('link');

    const rawToken = created.link.shareUrl.split('/').pop() ?? '';
    expect(rawToken).not.toBe('');
    expect(await runtime.readGuestView('forged-token')).toEqual({
      ok: false,
      reason: 'invalid_token',
    });

    await runtime.publishPosition('user-1', {
      sessionId: 'sess-guest',
      lat: 45.188529,
      lng: 5.724524,
      recordedAtMs: BASE_TIME_MS,
      accuracyM: 8,
    });

    const guest = await runtime.readGuestView(rawToken);
    expect(guest.ok).toBe(true);
    if (!guest.ok) return;
    expect(guest.status).toBe('active');
    expect(guest.latestPosition).toMatchObject({
      lat: 45.188529,
      lng: 5.724524,
      freshness: 'live',
      isStale: false,
      accuracyM: 8,
    });
    expect(guest.trail).toHaveLength(1);

    expect(await runtime.revokeShareLink('user-1', created.link.link.id)).toEqual({ ok: true });
    expect(await runtime.readGuestView(rawToken)).toEqual({ ok: false, reason: 'revoked' });
  });

  it('expire, termine et purge : aucune position ne survit à la séance', async () => {
    const clock = new FakeClock(BASE_TIME_MS);
    const runtime = new LiveTrackingRuntime({ clock });
    started(await runtime.startSession('user-1', { sessionId: 'sess-end' }));

    const created = await runtime.createShareLink('user-1', {
      sessionId: 'sess-end',
      durationMinutes: 5,
    });
    if (!created.ok) throw new Error('link');
    const rawToken = created.link.shareUrl.split('/').pop() ?? '';

    await runtime.publishPosition('user-1', {
      sessionId: 'sess-end',
      lat: 45.2,
      lng: 5.7,
      recordedAtMs: BASE_TIME_MS,
    });

    clock.advanceMs(5 * 60_000);
    expect(await runtime.readGuestView(rawToken)).toEqual({ ok: false, reason: 'expired' });

    const ended = await runtime.setSessionStatus('user-1', 'sess-end', 'ended');
    expect(ended.ok).toBe(true);
    expect(await runtime.listPositions('user-1', 'sess-end')).toEqual({
      ok: true,
      points: [],
    });

    const afterEnd = await runtime.readGuestView(rawToken);
    expect(afterEnd.ok).toBe(false);
  });

  it('isole les séances et les liens entre propriétaires', async () => {
    const runtime = new LiveTrackingRuntime();
    started(await runtime.startSession('user-a', { sessionId: 'sess-a' }));
    started(await runtime.startSession('user-b', { sessionId: 'sess-b' }));

    expect(await runtime.listSessions('user-a')).toHaveLength(1);
    expect(await runtime.getStatus('user-a', 'sess-b')).toMatchObject({ activeSessionId: null });

    const crossCreate = await runtime.createShareLink('user-b', {
      sessionId: 'sess-a',
      durationMinutes: 30,
    });
    expect(crossCreate).toEqual({ ok: false, error: 'unauthorized' });

    const created = await runtime.createShareLink('user-a', {
      sessionId: 'sess-a',
      durationMinutes: 30,
    });
    if (!created.ok) throw new Error('link');

    expect(await runtime.revokeShareLink('user-b', created.link.link.id)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await runtime.endSession('user-b', 'sess-a')).toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });

  it('applique les règles de contact : max 5, consentement explicite, notifications tracées', async () => {
    const clock = new FakeClock(BASE_TIME_MS);
    const notifier = new RecordingSafetyNotifier();
    const runtime = new LiveTrackingRuntime({ clock, notifier });
    started(await runtime.startSession('user-1', { sessionId: 'sess-safety' }));

    const accepted = await runtime.addContact('user-1', {
      displayName: 'Camille',
      channel: 'sms',
      destination: '+33612345678',
    });
    if (!accepted.ok) throw new Error('contact');
    await runtime.addContact('user-1', {
      displayName: 'Alex',
      channel: 'email',
      destination: 'alex@exemple.fr',
    });

    const broadcastBeforeConsent = await runtime.broadcast('user-1', {
      sessionId: 'sess-safety',
      event: 'safety_ping',
    });
    expect(broadcastBeforeConsent.ok).toBe(true);
    if (broadcastBeforeConsent.ok) {
      expect(broadcastBeforeConsent.result.notifiedContactIds).toHaveLength(0);
      expect(broadcastBeforeConsent.result.skippedUnconsentedIds).toHaveLength(2);
    }

    await runtime.setContactConsent('user-1', accepted.contact.id, 'accepted');
    const broadcast = await runtime.broadcast('user-1', {
      sessionId: 'sess-safety',
      event: 'live_share_started',
      shareUrl: 'https://exemple.test/live/secret',
    });
    expect(broadcast.ok).toBe(true);
    if (broadcast.ok) {
      expect(broadcast.result.notifiedContactIds).toEqual([accepted.contact.id]);
    }
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].shareUrl).toBe('https://exemple.test/live/secret');
    expect((await runtime.getStatus('user-1')).notifications).toHaveLength(1);

    for (let index = 0; index < 3; index++) {
      const result = await runtime.addContact('user-1', {
        displayName: `Contact ${index}`,
        channel: 'push',
        destination: `push-${index}`,
      });
      expect(result.ok).toBe(true);
    }
    const overflow = await runtime.addContact('user-1', {
      displayName: 'Contact 6',
      channel: 'in_app',
      destination: 'compte-6',
    });
    expect(overflow).toEqual({ ok: false, error: 'max_contacts_reached' });
  });

  it('refuse les coordonnées hors bornes et une montre non autorisée', async () => {
    const runtime = new LiveTrackingRuntime();
    started(await runtime.startSession('user-1', { sessionId: 'sess-watch' }));

    expect(
      await runtime.publishPosition('user-1', {
        sessionId: 'sess-watch',
        lat: 91,
        lng: 5,
        recordedAtMs: BASE_TIME_MS,
      })
    ).toEqual({ ok: false, error: 'invalid_position' });

    const result = await runtime.handleWatchCommand(
      'user-2',
      {
        deviceId: 'watch-1',
        platform: 'apple_watch',
        osVersion: '10.4',
        appVersion: '1.0.0',
        isPaired: true,
        hasLocationPermission: true,
        hasBackgroundPermission: true,
      },
      {
        type: 'sync_status',
        sessionId: 'sess-watch',
        ownerUserId: 'user-1',
      }
    );
    expect(result).toMatchObject({ ok: false, error: 'unauthorized' });
  });
});
