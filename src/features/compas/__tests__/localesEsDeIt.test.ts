import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN-100 6.1 « Langues suivantes : ES, DE, IT » : ce que le code (et pas seulement le
 * dictionnaire) écrit dans ces langues. Prépositions devant un lieu, virgule décimale,
 * abréviation du jour ; l'IA, qui n'écrit encore que le français et l'anglais (6.2), se tait
 * plutôt que de mêler deux langues à l'écran. Le français et l'anglais ne changent pas.
 */
const h = vi.hoisted(() => ({ locale: 'de' as 'fr' | 'en' | 'es' | 'de' | 'it' }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: () => undefined,
}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: async () => h.locale }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/observability/appErrors', () => ({ reportServerError: vi.fn(async () => undefined) }));
vi.mock('../server/getCompasData', () => ({
  getCompasData: vi.fn(async () => ({
    model: { tripId: '11111111-1111-4111-8111-111111111111', verdict: { level: 'vigilance', reasons: [] } },
    danger: {
      signals: [],
      axes: {
        physique: { level: 'ok', note: '' },
        technique: { level: 'ok', note: '' },
        conjoncturel: { level: 'non_evalue', note: 'Aucune source.' },
      },
    },
  })),
}));
vi.mock('@/lib/ai/askAI', () => ({
  askAI: vi.fn(async () => ({
    text: 'Vigilance sur ce voyage.',
    model: 'x',
    degraded: false,
    cached: false,
    provider: 'nvidia',
  })),
}));

import { askAI } from '@/lib/ai/askAI';
import { compasAiLocale } from '@/lib/ai/features/compasAutofill';
import { compasExplainVerdictAction } from '../server/compasActions';
import { serverMessage, serverTFor } from '../server/serverText';
import { formatHours } from '../engine/format';
import { compasFormat, compasT } from '../engine/compasI18n';
import { engineT } from '../engine/engineI18n';

describe('ES / DE / IT : textes écrits par le code', () => {
  it('prépositions devant un lieu et virgule décimale ; FR et EN inchangés', () => {
    const de = serverTFor('de');
    expect([de.from('Lyon'), de.to('Annecy'), de.at('Chamonix')]).toEqual([
      'von Lyon',
      'bis Annecy',
      'in Chamonix',
    ]);
    const es = serverTFor('es');
    expect([es.from('Lyon'), es.to('Annecy'), es.at('Chamonix')]).toEqual([
      'desde Lyon',
      'hasta Annecy',
      'en Chamonix',
    ]);
    const it_ = serverTFor('it');
    expect([it_.from('Lione'), it_.to('Annecy'), it_.at('Chamonix')]).toEqual([
      'da Lione',
      'a Annecy',
      'a Chamonix',
    ]);
    for (const t of [de, es, it_]) expect(t.decimal(4.5)).toBe('4,5');
    expect(serverTFor('en').decimal(4.5)).toBe('4.5');
    expect(serverTFor('en').from('Lyon')).toBe('from Lyon');
    expect(serverTFor('fr').decimal(4.5)).toBe('4,5');
  });

  it('abréviation du jour dans une durée : j, d, T, g', () => {
    expect(formatHours(50, 'fr')).toBe('2 j 2 h');
    expect(formatHours(50, 'en')).toBe('2 d 2 h');
    expect(formatHours(50, 'es')).toBe('2 d 2 h');
    expect(formatHours(50, 'de')).toBe('2 T 2 h');
    expect(formatHours(48, 'it')).toBe('2 g');
    expect(compasFormat('de').hours(50)).toBe('2 T 2 h');
    expect(compasFormat('it').decimal(1.5)).toBe('1,5');
  });

  it('les traducteurs lisent le bon dictionnaire', () => {
    expect(compasT('es')('compas.steps.ou')).toBe('Dónde');
    expect(compasT('de')('compas.steps.ou')).toBe('Wo');
    expect(compasT('it')('compas.steps.ou')).toBe('Dove');
    expect(engineT('de')('compas.engine.format.weather.storm')).toBe('Gewitter');
    expect(serverMessage('it', 'compas.server.common.accessDenied')).toBe('Accesso negato');
  });

  it('l’IA écrit les cinq langues de l’interface (6.2)', () => {
    for (const l of ['fr', 'en', 'es', 'de', 'it']) expect(compasAiLocale(l)).toBe(l);
    expect(compasAiLocale('pt')).toBeNull();
  });
});

describe('verdict expliqué : l’IA écrit dans la langue (6.2)', () => {
  const TRIP = '11111111-1111-4111-8111-111111111111';
  beforeEach(() => vi.clearAllMocks());

  it('espagnol, allemand, italien : l’IA est demandée avec la consigne de la langue', async () => {
    const seen: string[] = [];
    for (const locale of ['es', 'de', 'it'] as const) {
      h.locale = locale;
      await compasExplainVerdictAction({ tripId: TRIP });
      seen.push((askAI as unknown as { mock: { calls: Array<[{ system: string; locale?: string }]> } }).mock.calls.at(-1)![0].system);
    }
    expect(askAI).toHaveBeenCalledTimes(3);
    expect(seen[0]).toContain('en español');
    expect(seen[1]).toContain('auf Deutsch');
    expect(seen[2]).toContain('in italiano');
  });

  it('toutes les langues : l’IA est toujours demandée', async () => {
    for (const locale of ['fr', 'en', 'es', 'de', 'it'] as const) {
      h.locale = locale;
      await compasExplainVerdictAction({ tripId: TRIP });
    }
    expect(askAI).toHaveBeenCalledTimes(5);
  });
});
