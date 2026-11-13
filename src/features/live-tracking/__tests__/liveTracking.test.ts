import { describe, expect, it } from 'vitest';
import {
  hashTokenSha256,
  InMemoryLiveTrackingStore,
  InMemorySafetyContactStore,
  LiveTrackingTokenService,
  MAX_SAFETY_CONTACTS,
  SafetyContactService,
  WatchLiveTrackingAdapter,
  type LiveTrackingClock,
  type SafetyNotificationPayload,
  type SafetyNotifier,
  type WatchDeviceInfo,
} from '../index';

class FakeClock implements LiveTrackingClock {
  constructor(private currentMs: number) {}
  nowMs(): number {
    return this.currentMs;
  }
  advanceMs(deltaMs: number): void {
    this.currentMs += deltaMs;
  }
}

class RecordingNotifier implements SafetyNotifier {
  public readonly sent: SafetyNotificationPayload[] = [];
  async send(payload: SafetyNotificationPayload): Promise<{ ok: boolean }> {
    this.sent.push(payload);
    return { ok: true };
  }
}

const BASE_TIME_MS = Date.UTC(2026, 10, 13, 10, 0, 0);

describe('P02 Live Tracking & Beacon (K7.01, K7.02, K7.03, S6.11)', () => {
  describe('Jetons de partage, hachage SHA-256 et fail-closed (K7.01 / S6.11)', () => {
    it('persiste uniquement le hash SHA-256 et jamais le token brut en clair', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
      });

      const service = new LiveTrackingTokenService(store, clock);
      const res = await service.createShareLink({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        durationMinutes: 60,
        label: 'Sortie Vercors',
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.link.rawToken.length).toBeGreaterThanOrEqual(32);
      expect(res.link.record.tokenHash).toBe(hashTokenSha256(res.link.rawToken));
      expect(res.link.record.tokenHash).not.toBe(res.link.rawToken);
      expect(JSON.stringify(res.link.record)).not.toContain(res.link.rawToken);
    });

    it('refuse une durée hors bornes ou un accès sans jeton valide', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
      });

      const service = new LiveTrackingTokenService(store, clock);
      const tooShort = await service.createShareLink({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        durationMinutes: 2,
      });
      expect(tooShort).toEqual({ ok: false, error: 'invalid_duration' });

      const emptyRead = await service.readGuestView('   ');
      expect(emptyRead).toEqual({ ok: false, reason: 'invalid_token' });

      const unknownRead = await service.readGuestView('forged-token-123');
      expect(unknownRead).toEqual({ ok: false, reason: 'invalid_token' });
    });

    it('coupe immédiatement l’accès à la révocation et indique la fraîcheur avant révocation', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
      });

      const service = new LiveTrackingTokenService(store, clock);
      const created = await service.createShareLink({
        sessionId: 'sess-1',
        ownerUserId: 'user-1',
        durationMinutes: 30,
        includeTrail: true,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await service.publishPosition(
        { sessionId: 'sess-1', lat: 45.188529, lng: 5.724524, recordedAtMs: BASE_TIME_MS },
        'user-1',
      );

      // Lecture immédiate : fraîcheur 'live'
      const freshRead = await service.readGuestView(created.link.rawToken);
      expect(freshRead.ok).toBe(true);
      if (freshRead.ok) {
        expect(freshRead.latestPosition?.freshness).toBe('live');
        expect(freshRead.latestPosition?.isStale).toBe(false);
        expect(freshRead.trail).toHaveLength(1);
      }

      // Perte de réseau simulée : 90s sans nouvelle position -> 'stale'
      clock.advanceMs(90_000);
      const staleRead = await service.readGuestView(created.link.rawToken);
      expect(staleRead.ok).toBe(true);
      if (staleRead.ok) {
        expect(staleRead.latestPosition?.freshness).toBe('stale');
        expect(staleRead.latestPosition?.isStale).toBe(true);
      }

      // Révocation instantanée -> aucune coordonnée ni historique
      const revoked = await service.revokeShareLink(created.link.record.id, 'user-1', 'sess-1');
      expect(revoked).toEqual({ ok: true });

      const afterRevoke = await service.readGuestView(created.link.rawToken);
      expect(afterRevoke).toEqual({ ok: false, reason: 'revoked' });
    });

    it('coupe l’accès après expiration du jeton et après fin de séance avec purge des positions', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-exp',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
      });

      const service = new LiveTrackingTokenService(store, clock);
      const link1 = await service.createShareLink({
        sessionId: 'sess-exp',
        ownerUserId: 'user-1',
        durationMinutes: 10,
      });
      const link2 = await service.createShareLink({
        sessionId: 'sess-exp',
        ownerUserId: 'user-1',
        durationMinutes: 60,
      });
      expect(link1.ok && link2.ok).toBe(true);
      if (!link1.ok || !link2.ok) return;

      await service.publishPosition(
        { sessionId: 'sess-exp', lat: 45.2, lng: 5.7, recordedAtMs: BASE_TIME_MS },
        'user-1',
      );

      // Expiration de link1 après 10 min
      clock.advanceMs(10 * 60_000);
      const expiredRead = await service.readGuestView(link1.link.rawToken);
      expect(expiredRead).toEqual({ ok: false, reason: 'expired' });

      // link2 toujours actif avant fin de séance
      const stillValid = await service.readGuestView(link2.link.rawToken);
      expect(stillValid.ok).toBe(true);

      // Fin de séance -> purge des positions + révocation de tous les liens
      const ended = await service.endSession('sess-exp', 'user-1');
      expect(ended).toEqual({ ok: true });
      expect(await store.getPositions('sess-exp')).toHaveLength(0);

      const afterEnd = await service.readGuestView(link2.link.rawToken);
      expect(afterEnd.ok).toBe(false);

      const publishAfterEnd = await service.publishPosition(
        { sessionId: 'sess-exp', lat: 45.21, lng: 5.71, recordedAtMs: clock.nowMs() },
        'user-1',
      );
      expect(publishAfterEnd).toEqual({ ok: false, error: 'session_not_active' });
    });

    it('applique les règles de confidentialité P01 (tiers bloqué, refus P01, floutage)', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-p01',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
        blockedViewerIds: ['blocked-user'],
      });

      const service = new LiveTrackingTokenService(store, clock);
      const created = await service.createShareLink({
        sessionId: 'sess-p01',
        ownerUserId: 'user-1',
        durationMinutes: 30,
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await service.publishPosition(
        { sessionId: 'sess-p01', lat: 45.188529, lng: 5.724524, recordedAtMs: BASE_TIME_MS },
        'user-1',
      );

      const blockedRead = await service.readGuestView(created.link.rawToken, {
        liveSharingAllowed: true,
        viewerId: 'blocked-user',
      });
      expect(blockedRead).toEqual({ ok: false, reason: 'privacy_denied' });

      const disabledByP01 = await service.readGuestView(created.link.rawToken, {
        liveSharingAllowed: false,
      });
      expect(disabledByP01).toEqual({ ok: false, reason: 'privacy_denied' });

      const maskedRead = await service.readGuestView(created.link.rawToken, {
        liveSharingAllowed: true,
        obfuscationRadiusM: 500,
      });
      expect(maskedRead.ok).toBe(true);
      if (maskedRead.ok && maskedRead.latestPosition) {
        expect(maskedRead.latestPosition.lat).not.toBe(45.188529);
      }
    });
  });

  describe('Contacts de sécurité (K7.02)', () => {
    it('gère le consentement, le seuil max et ne notifie que les contacts consentants', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const contactStore = new InMemorySafetyContactStore();
      const notifier = new RecordingNotifier();
      const service = new SafetyContactService(contactStore, notifier, clock);

      // Ajout jusqu'au seuil max (5)
      const createdIds: string[] = [];
      for (let i = 0; i < MAX_SAFETY_CONTACTS; i++) {
        const res = await service.addContact({
          ownerUserId: 'user-1',
          displayName: `Contact ${i + 1}`,
          channel: 'sms',
          destination: `+3360000000${i}`,
        });
        expect(res.ok).toBe(true);
        if (res.ok) createdIds.push(res.contact.id);
      }

      const overflow = await service.addContact({
        ownerUserId: 'user-1',
        displayName: 'Contact 6',
        channel: 'sms',
        destination: '+33600000009',
      });
      expect(overflow).toEqual({ ok: false, error: 'max_contacts_reached' });

      // Seul le contact 0 accepte ; le contact 1 est révoqué ; les autres restent en pending
      await service.setConsent(createdIds[0], 'user-1', 'accepted');
      await service.setConsent(createdIds[1], 'user-1', 'revoked');

      const startBroadcast = await service.broadcastEvent({
        ownerUserId: 'user-1',
        sessionId: 'sess-1',
        event: 'live_share_started',
        shareUrl: 'https://lkdv.app/live/secret-once',
      });

      expect(startBroadcast.notifiedContactIds).toEqual([createdIds[0]]);
      expect(startBroadcast.skippedUnconsentedIds).toHaveLength(4);
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0].shareUrl).toBe('https://lkdv.app/live/secret-once');

      // À l'arrêt, l'URL n'est plus incluse
      await service.broadcastEvent({
        ownerUserId: 'user-1',
        sessionId: 'sess-1',
        event: 'live_share_stopped',
        shareUrl: 'https://lkdv.app/live/secret-once',
      });
      expect(notifier.sent[1].shareUrl).toBeUndefined();
    });
  });

  describe('Adaptateur montres compatibles Apple Watch & Wear OS (K7.03)', () => {
    const validAppleWatch: WatchDeviceInfo = {
      deviceId: 'aw-1',
      platform: 'apple_watch',
      osVersion: '10.4',
      appVersion: '2.1.0',
      isPaired: true,
      hasLocationPermission: true,
      hasBackgroundPermission: true,
    };

    const validWearOs: WatchDeviceInfo = {
      deviceId: 'wear-1',
      platform: 'wear_os',
      osVersion: '4.1',
      appVersion: '2.1.0',
      isPaired: true,
      hasLocationPermission: true,
      hasBackgroundPermission: true,
    };

    it('refuse une montre non appairée ou sans permissions requises', async () => {
      const store = new InMemoryLiveTrackingStore();
      const tokenService = new LiveTrackingTokenService(store);
      const adapter = new WatchLiveTrackingAdapter(store, tokenService);

      const unpaired = await adapter.handleCommand(
        { ...validAppleWatch, isPaired: false },
        { type: 'sync_status', sessionId: 'sess-1', ownerUserId: 'user-1' },
      );
      expect(unpaired).toMatchObject({ ok: false, error: 'watch_not_paired' });

      const noBg = await adapter.handleCommand(
        { ...validWearOs, hasBackgroundPermission: false },
        { type: 'start_live_share', sessionId: 'sess-1', ownerUserId: 'user-1', durationMinutes: 30 },
      );
      expect(noBg).toMatchObject({ ok: false, error: 'missing_background_permission' });

      const oldOs = await adapter.handleCommand(
        { ...validWearOs, osVersion: '3.5' },
        { type: 'sync_status', sessionId: 'sess-1', ownerUserId: 'user-1' },
      );
      expect(oldOs).toMatchObject({ ok: false, error: 'unsupported_os_version' });
    });

    it('permet l’activation et l’arrêt du partage depuis Apple Watch et Wear OS', async () => {
      const clock = new FakeClock(BASE_TIME_MS);
      const store = new InMemoryLiveTrackingStore();
      await store.saveSession({
        sessionId: 'sess-watch',
        ownerUserId: 'user-1',
        status: 'active',
        startedAtMs: BASE_TIME_MS,
        endedAtMs: null,
      });

      const tokenService = new LiveTrackingTokenService(store, clock);
      const contactStore = new InMemorySafetyContactStore();
      const notifier = new RecordingNotifier();
      const safetyService = new SafetyContactService(contactStore, notifier, clock);
      const added = await safetyService.addContact({
        ownerUserId: 'user-1',
        displayName: 'Proche 1',
        channel: 'push',
        destination: 'push-token-1',
      });
      if (added.ok) {
        await safetyService.setConsent(added.contact.id, 'user-1', 'accepted');
      }

      const adapter = new WatchLiveTrackingAdapter(store, tokenService, safetyService, clock);

      const started = await adapter.handleCommand(validAppleWatch, {
        type: 'start_live_share',
        sessionId: 'sess-watch',
        ownerUserId: 'user-1',
        durationMinutes: 45,
        notifySafetyContacts: true,
      });

      expect(started.ok).toBe(true);
      if (started.ok) {
        expect(started.shareCreated).toBe(true);
        expect(started.snapshot.platform).toBe('apple_watch');
        expect(started.snapshot.isSharingActive).toBe(true);
        expect(started.snapshot.activeLinkCount).toBe(1);
      }
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0].event).toBe('live_share_started');

      // Arrêt depuis Wear OS
      const stopped = await adapter.handleCommand(validWearOs, {
        type: 'stop_live_share',
        sessionId: 'sess-watch',
        ownerUserId: 'user-1',
      });

      expect(stopped.ok).toBe(true);
      if (stopped.ok) {
        expect(stopped.snapshot.platform).toBe('wear_os');
        expect(stopped.snapshot.isSharingActive).toBe(false);
        expect(stopped.snapshot.activeLinkCount).toBe(0);
      }
      expect(notifier.sent).toHaveLength(2);
      expect(notifier.sent[1].event).toBe('live_share_stopped');
    });
  });
});
