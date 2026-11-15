import { describe, expect, it, vi } from 'vitest';
import { buildActivityFacts, type HikeSessionRecord } from '../activity/activityFacts';
import {
  buildDeterministicActivityReading,
  createActivityInsight,
  sanitizeActivityNarrative,
} from '../activity/postActivityInsight';
import type { AssistantCompletionPort } from '../contracts';

function session(overrides: Partial<HikeSessionRecord> = {}): HikeSessionRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    started_at: '2026-11-10T08:00:00.000Z',
    ended_at: '2026-11-10T10:00:00.000Z',
    distance_km: '12.5',
    duration_seconds: 7200,
    elevation_gain_m: 0,
    max_altitude_m: null,
    poi_events: [{ poiName: 'Col', reachedAt: '2026-11-10T09:00:00.000Z' }],
    ...overrides,
  };
}

function cleanProvider(text = 'Une sortie régulière, sans emphase, où le rythme est resté constant.'): AssistantCompletionPort {
  return {
    id: 'fake',
    isAvailable: () => true,
    complete: vi.fn(async () => ({ text, provider: 'fake', model: 'fake-1' })),
  };
}

describe('S2.37 — faits de sortie', () => {
  it('distingue le zéro mesuré de la valeur absente', () => {
    const facts = buildActivityFacts(session());
    expect(facts.metrics.distanceKm).toMatchObject({ value: 12.5, status: 'measured' });
    expect(facts.metrics.elevationGainM).toMatchObject({ value: 0, status: 'measured' });
    expect(facts.metrics.maxAltitudeM.status).toBe('absent');
    expect(facts.metrics.maxAltitudeM.value).toBeNull();
  });

  it('ne fabrique ni cardio, ni calories, ni splits', () => {
    const facts = buildActivityFacts(session());
    expect(facts.metrics.heartRateBpm.status).toBe('absent');
    expect(facts.metrics.heartRateBpm.value).toBeNull();
    expect(facts.metrics.caloriesKcal.status).toBe('absent');
    expect(facts.metrics.splits.status).toBe('absent');
    expect(facts.missing.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(['metrics.heartRateBpm', 'metrics.caloriesKcal', 'metrics.splits'])
    );
  });

  it('calcule l’allure et la vitesse uniquement quand distance et durée existent', () => {
    const facts = buildActivityFacts(session());
    expect(facts.metrics.averagePaceSecondsPerKm).toMatchObject({ value: 576, status: 'calculated' });
    expect(facts.metrics.averageSpeedKmh.value).toBeCloseTo(6.25, 5);
    const missing = buildActivityFacts(session({ distance_km: null }));
    expect(missing.metrics.averagePaceSecondsPerKm.status).toBe('absent');
    expect(missing.metrics.averageSpeedKmh.status).toBe('absent');
  });

  it('rend un bilan déterministe même sans IA', async () => {
    const insight = await createActivityInsight({ session: session(), includeAi: false });
    expect(insight.ai.status).toBe('unavailable');
    if (insight.ai.status === 'unavailable') expect(insight.ai.reason).toBe('not_requested');
    expect(insight.deterministic.facts.join(' ')).toContain('Distance mesurée');
    expect(insight.deterministic.facts.join(' ')).toContain('Dénivelé positif mesuré');
    expect(insight.deterministic.missing.join(' ')).toContain('Fréquence cardiaque');
  });

  it('rend provider_unconfigured sans fournisseur et garde le bilan', async () => {
    const insight = await createActivityInsight({ session: session(), includeAi: true, provider: null });
    expect(insight.ai.status).toBe('unavailable');
    if (insight.ai.status === 'unavailable') expect(insight.ai.reason).toBe('provider_unconfigured');
    expect(insight.deterministic.facts.length).toBeGreaterThan(0);
  });

  it('refuse un texte IA qui contient un chiffre ou du markdown', async () => {
    const numeric = await createActivityInsight({
      session: session(),
      includeAi: true,
      provider: cleanProvider('Tu as parcouru 12,5 km avec 500 m de dénivelé.'),
    });
    expect(numeric.ai.status).toBe('unavailable');
    if (numeric.ai.status === 'unavailable') expect(numeric.ai.reason).toBe('invalid_response');
    expect(sanitizeActivityNarrative('**Trois** points')).toBeNull();
    expect(sanitizeActivityNarrative('Une sortie calme, sans chiffre, avec un rythme régulier.')).toContain(
      'Une sortie calme'
    );
  });

  it('rend provider_unavailable quand le fournisseur échoue, sans perdre le bilan', async () => {
    const failing: AssistantCompletionPort = {
      id: 'fake',
      isAvailable: () => true,
      complete: async () => {
        throw new Error('panne');
      },
    };
    const insight = await createActivityInsight({ session: session(), includeAi: true, provider: failing });
    expect(insight.ai.status).toBe('unavailable');
    if (insight.ai.status === 'unavailable') expect(insight.ai.reason).toBe('provider_unavailable');
    expect(insight.deterministic.facts.length).toBeGreaterThan(0);
  });

  it('accepte une lecture sans chiffre et la date', async () => {
    const insight = await createActivityInsight({
      session: session(),
      includeAi: true,
      provider: cleanProvider(),
      now: () => new Date('2026-11-11T12:00:00.000Z'),
    });
    expect(insight.ai.status).toBe('available');
    if (insight.ai.status === 'available') {
      expect(insight.ai.provider).toBe('fake');
      expect(insight.ai.generatedAt).toBe('2026-11-11T12:00:00.000Z');
    }
  });

  it('expose les faits cités sans coordonnées', () => {
    const facts = buildActivityFacts(session());
    const reading = buildDeterministicActivityReading(facts);
    expect(reading.citations.every((entry) => entry.field !== 'positions_geojson')).toBe(true);
    expect(JSON.stringify(reading)).not.toContain('latitude');
  });
});
