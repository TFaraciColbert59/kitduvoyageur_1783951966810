import { describe, expect, it } from 'vitest';
import {
  buildInstitutionalMetroAggregate,
  estimateAvoidedCarbon,
  evaluateFamilySeatState,
  evaluatePartnerOffers,
  evaluateRightState,
  evaluateStudentEligibility,
  getIosAlternateIconsState,
  resolveGeographicCoverage,
  resolveMapUpdatesAndPremium,
  resolvePrioritySupportTier,
} from '../index';
import {
  authorizeDeveloperRequest,
  createDeveloperKeyRecord,
  isAllowedWebhookCallbackUrl,
  processWebhookDelivery,
  revokeDeveloperKeyRecord,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../domain/developerApi';

describe('O02 K7.09 / K7.10 / S6.22 / S6.23 — matrice des droits (actif, expiré, révoqué)', () => {
  it('gère la région gratuite unique, le Pack Monde actif vs expiré/révoqué (K7.09)', () => {
    const activeWorld = resolveGeographicCoverage({
      freeRegionId: 'fr-chamonix-mont-blanc',
      worldPackRight: {
        granted: true,
        configured: true,
        expiresAtIso: '2027-01-01T00:00:00Z',
        nowIso: '2026-11-14T12:00:00Z',
      },
    });
    expect(activeWorld.freeRegionAllowanceRemaining).toBe(0);
    expect(activeWorld.regions.every((r) => r.unlocked)).toBe(true);

    const expiredWorld = resolveGeographicCoverage({
      freeRegionId: 'fr-chamonix-mont-blanc',
      worldPackRight: {
        granted: true,
        configured: true,
        expiresAtIso: '2026-11-01T00:00:00Z',
        nowIso: '2026-11-14T12:00:00Z',
      },
    });
    expect(expiredWorld.worldPackRight.status).toBe('expired');
    expect(expiredWorld.regions.find((r) => r.id === 'fr-chamonix-mont-blanc')?.unlocked).toBe(true);
    expect(expiredWorld.regions.find((r) => r.id === 'fr-vercors-hauts-plateaux')?.unlocked).toBe(false);
    expect(expiredWorld.regions.find((r) => r.id === 'fr-vercors-hauts-plateaux')?.right.status).toBe('expired');
  });

  it('distingue rafraîchissement de cartes et droits Premium révoqués/expirés (K7.10)', () => {
    const coverage = resolveGeographicCoverage({
      freeRegionId: 'fr-chamonix-mont-blanc',
      installedVersions: { 'fr-chamonix-mont-blanc': '2026.09.1' },
    });
    const revoked = resolveMapUpdatesAndPremium({
      entitlements: {
        configured: true,
        plan: 'expedition',
        activePasses: [],
        entitlements: ['full_generation', 'terrain_live_advanced'],
      },
      premiumRightInput: {
        granted: true,
        configured: true,
        revokedAtIso: '2026-11-12T10:00:00Z',
      },
      coverage,
    });

    expect(revoked.premiumRight.status).toBe('revoked');
    expect(revoked.canUsePremiumRouting).toBe(false);
    expect(revoked.canUseAdvancedTerrain).toBe(false);
    expect(revoked.canRefreshUnlockedMaps).toBe(true);
    expect(revoked.staleUnlockedRegions).toEqual(['fr-chamonix-mont-blanc']);
  });

  it('applique les sièges familiaux, l’éligibilité étudiante, le support et les icônes iOS (S6.22, S6.23)', () => {
    const activeRight = evaluateRightState({ granted: true, configured: true });
    const family = evaluateFamilySeatState(
      [
        { seatId: 's0', email: 'owner@lkdv.fr', role: 'owner', status: 'active', expiresAtIso: null },
        { seatId: 's1', email: 'bob@lkdv.fr', role: 'member', status: 'revoked', expiresAtIso: null },
        { seatId: 's2', email: 'cam@lkdv.fr', role: 'member', status: 'active', expiresAtIso: '2026-11-01T00:00:00Z' },
      ],
      activeRight,
      '2026-11-14T12:00:00Z',
    );
    expect(family.seats[0].effectiveActive).toBe(true);
    expect(family.seats[1].effectiveActive).toBe(false);
    expect(family.seats[2].status).toBe('expired');

    expect(evaluateStudentEligibility({ email: 'alice@univ-grenoble.fr' }).status).toBe('pending');
    expect(
      evaluateStudentEligibility({
        email: 'alice@univ-grenoble.fr',
        verifiedUntilIso: '2027-06-30T00:00:00Z',
        nowIso: '2026-11-14T12:00:00Z',
      }).eligibleForDiscount,
    ).toBe(true);

    expect(resolvePrioritySupportTier(activeRight).level).toBe('priority');
    const expiredRight = evaluateRightState({
      granted: true,
      configured: true,
      expiresAtIso: '2026-10-01T00:00:00Z',
      nowIso: '2026-11-14T12:00:00Z',
    });
    expect(resolvePrioritySupportTier(expiredRight).level).toBe('standard');
    expect(evaluatePartnerOffers(expiredRight).every((o) => !o.right.canUse)).toBe(true);

    const webIcons = getIosAlternateIconsState({ isNativeIos: false, premiumRight: activeRight });
    expect(webIcons.platformSupported).toBe(false);
    expect(webIcons.icons.every((i) => !i.selectable)).toBe(true);
  });
});

describe('O02 S6.24 — API clients scopés, quotas, révocation et webhooks anti-rejeu', () => {
  it('vérifie scopes, expiration, révocation et limite de requêtes', () => {
    const { record, plaintextSecret } = createDeveloperKeyRecord({
      id: 'k1',
      ownerUserId: 'u1',
      clientName: 'GarminBridge',
      scopes: ['read:activities'],
      rateLimitPerMin: 10,
      expiresAtIso: '2027-01-01T00:00:00Z',
      nowIso: '2026-11-14T00:00:00Z',
    });

    expect(
      authorizeDeveloperRequest({
        presentedSecret: plaintextSecret,
        records: [record],
        requiredScope: 'read:activities',
        nowIso: '2026-11-14T12:00:00Z',
      }).ok,
    ).toBe(true);

    expect(
      authorizeDeveloperRequest({
        presentedSecret: plaintextSecret,
        records: [record],
        requiredScope: 'write:activities',
        nowIso: '2026-11-14T12:00:00Z',
      }),
    ).toMatchObject({ ok: false, reason: 'insufficient_scope' });

    expect(
      authorizeDeveloperRequest({
        presentedSecret: plaintextSecret,
        records: [record],
        requiredScope: 'read:activities',
        requestsInCurrentWindow: 10,
        nowIso: '2026-11-14T12:00:00Z',
      }),
    ).toMatchObject({ ok: false, reason: 'rate_limited' });

    const revoked = revokeDeveloperKeyRecord(record, '2026-11-14T11:00:00Z');
    expect(
      authorizeDeveloperRequest({
        presentedSecret: plaintextSecret,
        records: [revoked],
        requiredScope: 'read:activities',
        nowIso: '2026-11-14T12:00:00Z',
      }),
    ).toMatchObject({ ok: false, reason: 'revoked' });
  });

  it('signe et vérifie les webhooks HMAC avec garde anti-rejeu et événements hors ordre', () => {
    expect(isAllowedWebhookCallbackUrl('https://api.partner.org/lkdv')).toBe(true);
    expect(isAllowedWebhookCallbackUrl('http://localhost:3000/hook')).toBe(false);
    expect(isAllowedWebhookCallbackUrl('https://127.0.0.1/hook')).toBe(false);

    const payload = JSON.stringify({ id: 'act-1' });
    const header = signWebhookPayload(payload, 'whsec_test', 1_700_000_000);
    expect(
      verifyWebhookSignature({
        payloadJson: payload,
        signatureHeader: header,
        secret: 'whsec_test',
        nowSec: 1_700_000_050,
      }).valid,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        payloadJson: payload,
        signatureHeader: header,
        secret: 'whsec_test',
        nowSec: 1_700_001_000,
      }),
    ).toMatchObject({ valid: false, reason: 'replay_window_exceeded' });

    const ordering = {
      processedDeliveryIds: new Set<string>(),
      lastOccurredMsByEntity: new Map<string, number>(),
    };
    expect(
      processWebhookDelivery(ordering, {
        deliveryId: 'd1',
        entityId: 'a1',
        eventType: 'activity.updated',
        occurredAtMs: 2000,
      }).status,
    ).toBe('applied');
    expect(
      processWebhookDelivery(ordering, {
        deliveryId: 'd1',
        entityId: 'a1',
        eventType: 'activity.updated',
        occurredAtMs: 2000,
      }).status,
    ).toBe('duplicate_replayed');
    expect(
      processWebhookDelivery(ordering, {
        deliveryId: 'd2',
        entityId: 'a1',
        eventType: 'activity.updated',
        occurredAtMs: 1500,
      }).status,
    ).toBe('stale_out_of_order');
  });
});

describe('O02 S6.25 — Carbone évité et agrégats institutionnels type Metro', () => {
  it('retourne null (jamais 0) sur sortie loisir ou distance absente, et calcule sur vélotaf', () => {
    expect(estimateAvoidedCarbon({ sport: 'rando', distanceKm: 15 }).kgCo2Avoided).toBeNull();
    expect(
      estimateAvoidedCarbon({ sport: 'velo', purpose: 'commute', distanceKm: null }).kgCo2Avoided,
    ).toBeNull();

    const vae = estimateAvoidedCarbon({ sport: 'vae', purpose: 'commute', distanceKm: 10 });
    expect(vae.eligible).toBe(true);
    expect(vae.kgCo2Avoided).toBe(1.82);
  });

  it('bloque les agrégats institutionnels hors audience dédiée et applique k >= 5', () => {
    const observations = [
      ...Array.from({ length: 5 }, (_, i) => ({
        corridorId: 'corr-nord',
        contributorHash: `h-${i}`,
        collectiveConsent: true,
        tripCount: 4,
        commuteTripCount: 3,
        totalDistanceKm: 20,
      })),
      {
        corridorId: 'corr-confidentiel',
        contributorHash: 'h-small',
        collectiveConsent: true,
        tripCount: 2,
        commuteTripCount: 2,
        totalDistanceKm: 10,
      },
      {
        corridorId: 'corr-nord',
        contributorHash: 'h-optout',
        collectiveConsent: false,
        tripCount: 99,
        commuteTripCount: 99,
        totalDistanceKm: 500,
      },
    ];

    expect(
      buildInstitutionalMetroAggregate({
        audience: 'consumer_app',
        licenseActive: true,
        observations,
      }),
    ).toMatchObject({ allowed: false, code: 'forbidden_consumer_surface' });

    const partnerRes = buildInstitutionalMetroAggregate({
      audience: 'institutional_partner',
      licenseActive: true,
      observations,
    });
    expect(partnerRes.allowed).toBe(true);
    if (partnerRes.allowed) {
      expect(partnerRes.corridors).toHaveLength(1);
      expect(partnerRes.corridors[0].corridorId).toBe('corr-nord');
      expect(partnerRes.corridors[0].distinctContributors).toBe(5);
      expect(partnerRes.suppressedCorridors).toBe(1);
    }
  });
});
