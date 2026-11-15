import { describe, expect, it, vi } from 'vitest';
import { buildHistoryFacts, suggestHistoryQuestions, type HistoryActivityRow } from '../history/historyContract';
import { askHistoryAssistant, getHistoryQuestions } from '../history/historyAssistant';
import { describeHistoryConnections } from '../history/connections';
import type { AssistantCompletionPort } from '../contracts';

const rows: HistoryActivityRow[] = [
  { id: 'a', started_at: '2026-11-01T08:00:00.000Z', distance_km: 10, duration_seconds: 7200, elevation_gain_m: 500, route_name: 'GR 20', region: 'Corse' },
  { id: 'b', started_at: '2026-10-20T08:00:00.000Z', distance_km: '20', duration_seconds: 14400, elevation_gain_m: '1000', route_name: 'TMB', region: 'Alpes' },
  { id: 'c', started_at: '2026-10-01T08:00:00.000Z', distance_km: null, duration_seconds: 3600, elevation_gain_m: null },
];

function provider(text = 'La distance cumulée vient de tes sorties enregistrées, sans donnée inventée.'): AssistantCompletionPort {
  return {
    id: 'fake',
    isAvailable: () => true,
    complete: vi.fn(async () => ({ text, provider: 'fake', model: 'fake-1' })),
  };
}

describe('S2.38 — historique sportif', () => {
  it('agrège uniquement les champs autorisés et signale les absences', () => {
    const facts = buildHistoryFacts(rows);
    expect(facts.window.activities).toBe(3);
    expect(facts.totals.distanceKm).toMatchObject({ value: 30, status: 'calculated' });
    expect(facts.totals.elevationGainM).toMatchObject({ value: 1500, status: 'calculated' });
    expect(facts.excludedFields).toContain('positions_geojson');
    expect(facts.excludedFields).toContain('notes');
    expect(facts.longest?.id).toBe('b');
    expect(JSON.stringify(facts)).not.toContain('latitude');
  });

  it('propose des questions déterministes à partir des agrégats', () => {
    const facts = buildHistoryFacts(rows);
    const questions = suggestHistoryQuestions(facts);
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.join(' ')).toContain('distance');
    expect(suggestHistoryQuestions(buildHistoryFacts([]))).toEqual([]);
  });

  it('rend les questions déterministes quand le consentement est accordé', async () => {
    const result = await getHistoryQuestions('user-1', {
      consent: { isGranted: async () => true },
      activities: { list: async () => rows },
      providers: {},
    });
    expect(result.status).toBe('ok');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.facts?.window.activities).toBe(3);
  });

  it('refuse avant toute lecture sans consentement', async () => {
    const list = vi.fn(async () => rows);
    const result = await getHistoryQuestions('user-1', {
      consent: { isGranted: async () => false },
      activities: { list },
      providers: {},
    });
    expect(result.status).toBe('consent_required');
    expect(result.facts).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('rend no_data sans sortie, sans appeler l’IA', async () => {
    const complete = vi.fn();
    const result = await askHistoryAssistant('user-1', 'Quelle distance ?', 'claude', {
      consent: { isGranted: async () => true },
      activities: { list: async () => [] },
      providers: { claude: { id: 'claude', isAvailable: () => true, complete } },
    });
    expect(result.status).toBe('no_data');
    expect(result.questions).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });

  it('laisse les questions disponibles quand la clé manque', async () => {
    const result = await askHistoryAssistant('user-1', 'Quelle distance ?', 'gemini', {
      consent: { isGranted: async () => true },
      activities: { list: async () => rows },
      providers: {},
    });
    expect(result.status).toBe('ok');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.answer.status).toBe('unavailable');
    if (result.answer.status === 'unavailable') expect(result.answer.reason).toBe('provider_unconfigured');
  });

  it('refuse une réponse qui contient des coordonnées', async () => {
    const result = await askHistoryAssistant('user-1', 'Où ?', 'claude', {
      consent: { isGranted: async () => true },
      activities: { list: async () => rows },
      providers: { claude: provider('Tu étais à 42.1234, 9.5678 sur ce parcours.') },
    });
    expect(result.answer.status).toBe('unavailable');
    if (result.answer.status === 'unavailable') expect(result.answer.reason).toBe('invalid_response');
  });

  it('accepte une réponse sourcée sans coordonnées', async () => {
    const result = await askHistoryAssistant('user-1', 'Quelle distance ?', 'claude', {
      consent: { isGranted: async () => true },
      activities: { list: async () => rows },
      providers: { claude: provider() },
      now: () => new Date('2026-11-11T12:00:00.000Z'),
    });
    expect(result.answer.status).toBe('available');
    if (result.answer.status === 'available') {
      expect(result.answer.generatedAt).toBe('2026-11-11T12:00:00.000Z');
      expect(result.answer.provider).toBe('fake');
    }
  });

  it('décrit les connexions avec consentement et clés existantes', () => {
    const denied = describeHistoryConnections(false, {});
    expect(denied.consent.status).toBe('denied');
    expect(denied.connections.every((entry) => entry.reason === 'consent_required')).toBe(true);

    const noKeys = describeHistoryConnections(true, {});
    expect(noKeys.connections.every((entry) => entry.reason === 'provider_unconfigured')).toBe(true);

    const configured = describeHistoryConnections(true, {
      ANTHROPIC_API_KEY: 'existing-key',
      GEMINI_API_KEY: 'existing-key',
    });
    expect(configured.connections.every((entry) => entry.status === 'connected')).toBe(true);
  });
});
