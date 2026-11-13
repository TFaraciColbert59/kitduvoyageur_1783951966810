import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Audit 13/11 (suite) : durée maximale unique, lieu + date, date impossible dite à voix haute,
 * restes du lot précédent (moyen de venir dans le nom du lieu, texte de la note « sans voiture »,
 * libellés du moyen de venir traduits).
 */
const h = vi.hoisted(() => ({ locale: 'fr' as 'fr' | 'en' }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/i18n/serverLocale', () => ({ getRequestLocale: async () => h.locale }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { MAX_TRIP_DAYS as INTENT_MAX, actionLabel, parseIntentRules, validateActions, type CompasIntentAction } from '../engine/intent';
import { MAX_TRIP_DAYS as CONTEXT_MAX } from '../engine/tripContext';
import { understandRequest } from '../engine/request';
import { localizeStoredNote } from '../engine/storedText';
import { compasSetDatesAction } from '../server/compasActions';
import { resplitSteps } from '../server/compasServer';

const TODAY = '2026-11-13';
const read = (text: string) => parseIntentRules(text, TODAY);
const readEn = (text: string) => parseIntentRules(text, TODAY, 'en');
const destOf = (actions: CompasIntentAction[]) => {
  const a = actions.find((x) => x.type === 'set_destination');
  return a && a.type === 'set_destination' ? a.place : null;
};
const ctx = { today: TODAY, startDate: null, endDate: null, engaged: 0, currency: 'EUR', avoid: [], wishes: [] };
const proposals = (text: string) => validateActions(read(text).map((action) => ({ action, source: 'regles' as const })), ctx);

beforeEach(() => {
  h.locale = 'fr';
});

describe('1 · une seule durée maximale', () => {
  it('intent.ts reprend la constante de tripContext (60)', () => {
    expect(CONTEXT_MAX).toBe(60);
    expect(INTENT_MAX).toBe(CONTEXT_MAX);
  });

  it('« HRP 45 jours » n’est plus refusé', () => {
    const list = proposals('HRP 45 jours');
    const duration = list.find((p) => p.action.type === 'set_duration');
    expect(duration?.action).toMatchObject({ days: 45 });
    expect(duration?.ok).toBe(true);
  });

  it('du 1er juillet au 15 août (46 jours) : dates gardées', () => {
    const list = validateActions(
      read('rando du 1er décembre 2026 au 15 janvier 2027').map((action) => ({ action, source: 'regles' as const })),
      ctx
    );
    const dates = list.find((p) => p.action.type === 'set_dates');
    expect(dates?.ok).toBe(true);
  });

  it('compasSetDatesAction refuse au-delà de la durée maximale, message clair', async () => {
    const input = {
      tripId: '11111111-1111-4111-8111-111111111111',
      tripSlug: 'rando',
      startDate: '2027-01-01',
      endDate: '2027-03-15',
      durationHours: null,
    };
    const res = await compasSetDatesAction(input);
    expect(res.success).toBe(false);
    expect(!res.success && res.error).toMatch(/60 jours/);
    h.locale = 'en';
    const en = await compasSetDatesAction(input);
    expect(!en.success && en.error).toMatch(/60 days/);
  });

  /** Faux client : `compas_route_stages` plafonne à 30 jours ; 45 étapes existent déjà. */
  function fakeSupabase(requested: number) {
    const ops: Array<{ kind: string; table: string; id?: unknown; payload?: unknown }> = [];
    const stages = Array.from({ length: Math.min(requested, 30) }, (_, i) => ({
      day: i + 1,
      start_lat: 45,
      start_lng: 6,
      distance_km: 10,
      elevation_gain_m: 100,
      elevation_loss_m: 100,
    }));
    const existing = Array.from({ length: 45 }, (_, i) => ({
      id: `s${i + 1}`,
      day_number: i + 1,
      order_index: 0,
      source: 'compas',
      accommodation_name: null,
    }));
    const from = (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.order = () => q;
      q.eq = (_c: string, v: unknown) => {
        if (pending) ops.push({ ...pending, id: v });
        pending = null;
        return q;
      };
      q.maybeSingle = async () => ({ data: { name: 'HRP' } });
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: table === 'trip_steps' ? existing : null });
      q.update = (payload: unknown) => ((pending = { kind: 'update', table, payload }), q);
      q.delete = () => ((pending = { kind: 'delete', table }), q);
      q.insert = (payload: unknown) => (ops.push({ kind: 'insert', table, payload }), Promise.resolve({}));
      let pending: { kind: string; table: string; payload?: unknown } | null = null;
      return q;
    };
    return { ops, client: { rpc: async () => ({ data: stages, error: null }), from } as never };
  }

  it('resplitSteps au-delà de 30 : aucune étape supprimée, le manque est dit', async () => {
    const { ops, client } = fakeSupabase(45);
    const res = await resplitSteps(client, 'trip', 1, 45);
    expect(ops.filter((o) => o.kind === 'delete')).toEqual([]);
    expect(res).toMatchObject({ covered: 30, requested: 45, truncated: true });
  });

  it('resplitSteps jusqu’à 30 : pas de note', async () => {
    const { client } = fakeSupabase(20);
    const res = await resplitSteps(client, 'trip', 1, 20);
    expect(res).toMatchObject({ truncated: false });
  });
});

describe('2 · lieu + date sans durée', () => {
  it.each([
    ['Rome du 1er au 5 janvier', 'Rome'],
    ['Rome le 20 décembre pour 3 jours', 'Rome'],
    ['Lisbonne du 3 au 7 mars', 'Lisbonne'],
  ])('« %s » lit la destination', (text, place) => {
    const actions = read(text);
    expect(actions.map((a) => a.type)).toContain('set_dates');
    expect(destOf(actions)).toBe(place);
  });

  it('en anglais', () => {
    expect(destOf(readEn('Rome from 1 to 5 January'))).toBe('Rome');
  });

  it.each(['Randonnée du 5 au 7 mai', 'Week-end du 5 au 7 mai', 'Samedi le 5 mai', 'Noël du 24 au 26 décembre'])(
    '« %s » n’est pas un lieu',
    (text) => {
      expect(destOf(read(text))).toBeNull();
    }
  );
});

describe('3 · date reconnue mais impossible : refusée avec une raison', () => {
  it.each(['Rome le 29 février', 'Rome du 30 février au 3 mars', 'rando le 31 avril'])('« %s »', (text) => {
    const list = proposals(text);
    expect(list.find((p) => p.action.type === 'set_dates')).toBeUndefined();
    const refused = list.find((p) => p.action.type === 'invalid_dates');
    expect(refused?.ok).toBe(false);
    expect(refused?.reason).toMatch(/ignorée/);
    expect(refused?.reason).toMatch(/n’existe pas/);
  });

  it('« en 2020 » : année passée, refusée', () => {
    const refused = proposals('trek Népal en 2020').find((p) => p.action.type === 'invalid_dates');
    expect(refused?.ok).toBe(false);
    expect(refused?.reason).toMatch(/passée/);
  });

  it('anglais', () => {
    const list = validateActions(readEn('trip to Rome on February 30').map((action) => ({ action, source: 'regles' as const })), ctx);
    expect(list.find((p) => p.action.type === 'invalid_dates')?.ok).toBe(false);
  });

  it('une date valide ou un budget en 2020 euros ne déclenche rien', () => {
    expect(read('Rome le 29 février 2028').map((a) => a.type)).not.toContain('invalid_dates');
    expect(read('rando budget 2020 euros').map((a) => a.type)).not.toContain('invalid_dates');
    expect(read('Rome le 20 décembre').map((a) => a.type)).not.toContain('invalid_dates');
  });

  it('un 29 février existant l’année suivante est lu (2028)', () => {
    const dates = read('Rome le 29 février').find((a) => a.type === 'set_dates');
    expect(dates).toBeUndefined();
    const later = parseIntentRules('Rome le 29 février', '2027-11-13').find((a) => a.type === 'set_dates');
    expect(later).toMatchObject({ start: '2028-02-29' });
  });
});

describe('4 · restes du lot précédent', () => {
  it.each([
    ['Lisbon by train', 'Lisbon'],
    ['a city-break in Lisbon by train', 'Lisbon'],
    ['Lisbon by plane for 3 days', 'Lisbon'],
  ])('(a) « %s » : le moyen de venir n’est pas dans le nom du lieu', (text, place) => {
    expect(destOf(readEn(text))).toBe(place);
  });

  it.each([
    ['city-break Lisbonne en train', 'Lisbonne'],
    ['week-end à Lisbonne en avion', 'Lisbonne'],
    ['Séjour à Porto par le train', 'Porto'],
    ['trip à Lyon en voiture', 'Lyon'],
    ['3 jours à Vienne en bus', 'Vienne'],
  ])('(a) français « %s »', (text, place) => {
    expect(destOf(read(text))).toBe(place);
  });

  it.each(['Voyage en train', 'Vacances en avion', 'Trip by train', 'Road trip by car', 'Sejour en voiture'])(
    '(a) « %s » : le moyen seul n’est pas un lieu',
    (text) => {
      expect(destOf(read(text))).toBeNull();
      expect(destOf(readEn(text))).toBeNull();
    }
  );

  const OLD =
    'Sans voiture : le trajet d’approche (environ 210 km à vol d’oiseau) n’est pas chiffré, aucune ligne de train ou de bus n’est évaluée sur ce trajet ; cherche-la dans Résa · Trajets.';
  const NEW =
    'Sans voiture : le trajet d’approche (environ 210 km à vol d’oiseau) n’est pas chiffré, aucune ligne de train ou de bus n’est évaluée sur ce trajet ; cherche-la dans « À prévoir ».';

  it('(b) ancienne et nouvelle notes se traduisent', () => {
    const fromOld = localizeStoredNote(OLD, 'en');
    expect(fromOld).toMatch(/^Without a car: the approach/);
    expect(localizeStoredNote(NEW, 'en')).toBe(fromOld);
    expect(fromOld).not.toMatch(/Journeys/);
    expect(fromOld).toMatch(/To plan/);
    expect(localizeStoredNote(OLD, 'fr')).toBe(OLD);
    for (const loc of ['es', 'it', 'de'] as const) expect(localizeStoredNote(NEW, loc)).toBe(localizeStoredNote(OLD, loc));
  });

  it('(b) la note produite par le moteur est la nouvelle', async () => {
    const { CAR_FREE_NO_LEG_PREFIX } = await import('../engine/travel');
    expect(CAR_FREE_NO_LEG_PREFIX).toBe('Sans voiture :');
    const src = (await import('node:fs')).readFileSync(new URL('../engine/travel.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Résa · Trajets/);
    expect(src).toMatch(/« À prévoir »/);
  });

  it('(c) le moyen de venir est traduit dans « Compris »', () => {
    const lineOf = (loc: 'fr' | 'en' | 'es' | 'it' | 'de') =>
      understandRequest('city-trip Lisbonne en train', TODAY, {}, loc).lines.find((l) => l.key === 'deplacements')?.value;
    expect(lineOf('fr')).toBe('en train');
    expect(lineOf('en')).toBe('by train');
    expect(lineOf('es')).toBe('en tren');
    expect(lineOf('it')).toBe('in treno');
    expect(lineOf('de')).toBe('mit dem Zug');
  });

  it('(c) le libellé de proposition suit la langue', () => {
    const action = { type: 'set_transport_mode', mode: 'flight' } as const;
    expect(actionLabel(action)).toBe('Pour venir : en avion');
    expect(actionLabel(action, 'EUR', 'en')).toMatch(/by plane/);
    expect(actionLabel(action, 'EUR', 'de')).toMatch(/Flugzeug/);
  });
});
