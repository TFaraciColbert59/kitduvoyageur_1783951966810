import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkInvariants,
  compareRun,
  evaluateExpect,
  formatReport,
  judgeItem,
  main,
  matchTrips,
  normaliseRow,
  parseArgs,
  parseCsv,
  parseTimestamp,
  readCheckRows,
  readResults,
  summarise,
} from '../../scripts/compas/validation/compare.mjs';
import { loadSet } from '../../scripts/compas/validation/sets.mjs';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

type Row = Record<string, any>;

/** Une ligne de check.sql d'un voyage réussi et propre ; chaque test n'en change que ce qu'il éprouve. */
const good = (over: Row = {}): Row =>
  normaliseRow({
    trip_id: 't1',
    created_at: '2026-10-14 10:00:00+00',
    country: 'FR',
    activity: 'hiking',
    start_date: '2026-11-04',
    end_date: '2026-11-06',
    days: 3,
    party_size: null,
    origin_name: null,
    car_free: null,
    nights: null,
    estimated_budget: 300,
    budget_currency: 'EUR',
    anchor_lat: 45,
    anchor_lon: 6,
    anchor_radius_km: 60,
    step_count: 3,
    steps_no_place: 0,
    steps_no_coords: 0,
    steps_dup_consecutive: 0,
    steps_beyond_radius: 0,
    steps_ai_proposed: 0,
    steps_lat_min: 45,
    steps_lat_max: 45.2,
    kit_items: 5,
    budget_lines: 4,
    prep_ok: true,
    prep_seconds: 30,
    app_errors_during: 0,
    ...over,
  });

const item = (expectation: Row = {}, id = 'x01', phrase = 'rando 3 jours') => ({
  id,
  phrase,
  expect: expectation,
});

describe('lecture', () => {
  it('lit les horodatages de PostgreSQL et l’ISO 8601', () => {
    const t = Date.UTC(2026, 9, 14, 10, 2, 5);
    expect(parseTimestamp('2026-10-14 10:02:05+00')).toBe(t);
    expect(parseTimestamp('2026-10-14T10:02:05Z')).toBe(t);
    expect(parseTimestamp('2026-10-14T10:02:05.000+00:00')).toBe(t);
    expect(parseTimestamp('2026-10-14 12:02:05+02')).toBe(t);
    expect(parseTimestamp('2026-10-14 10:02:05.123456+00')).toBe(t + 123);
    expect(parseTimestamp(t)).toBe(t);
    expect(parseTimestamp('hier')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
  });

  it('lit le CSV de psql : guillemets, virgules, retours à la ligne, CRLF', () => {
    expect(parseCsv('a,b\r\n1,"x, ""y"""\n"deux\nlignes",\n')).toEqual([
      ['a', 'b'],
      ['1', 'x, "y"'],
      ['deux\nlignes', ''],
    ]);
    expect(parseCsv('')).toEqual([]);
  });

  it('lit la sortie réelle de check.sql (CSV) avec ses types', () => {
    const rows = readCheckRows(fixture('check-sample.csv'));
    expect(rows).toHaveLength(3);
    const [a, b, c] = rows;
    expect(a).toMatchObject({
      country: 'FR',
      activity: 'water',
      days: 3,
      party_size: 2,
      origin_name: 'Lyon',
      car_free: true,
      nights: 'refuge',
      estimated_budget: 450,
      step_count: 3,
      steps_ai_proposed: 1,
      kit_items: 5,
      budget_lines: 4,
      prep_ok: true,
      prep_seconds: 42,
      app_errors_during: 2,
      app_error_scopes: 'compas.metno:503',
      ops_event_kind: 'ok',
    });
    expect(a.created_ms).toBe(Date.UTC(2026, 9, 14, 10, 0, 0));
    expect(b).toMatchObject({
      prep_ok: false,
      start_say_pending: 'trek en Patagonie, 10 jours',
      start_date: null,
      party_size: 4,
    });
    expect(b.car_free).toBeNull();
    expect(c).toMatchObject({
      party_size: null,
      prep_ok: true,
      prep_seconds: 31,
      app_errors_during: 0,
    });
  });

  it('lit aussi un export JSON (types variables, nombres en texte)', () => {
    const rows = readCheckRows(
      JSON.stringify([
        {
          trip_id: 't',
          created_at: '2026-10-14T10:00:00+00:00',
          days: '3',
          estimated_budget: '450.00',
          prep_ok: 'true',
          car_free: false,
          origin_name: '',
        },
      ])
    );
    expect(rows[0]).toMatchObject({
      days: 3,
      estimated_budget: 450,
      prep_ok: true,
      car_free: false,
      origin_name: null,
    });
    expect(readCheckRows('')).toEqual([]);
  });

  it('lit results.jsonl et dit la ligne fautive', () => {
    expect(readResults('{"i":1}\n\n{"i":2}\n')).toEqual([{ i: 1 }, { i: 2 }]);
    expect(() => readResults('{"i":1}\nnon')).toThrow(/ligne 2/);
  });
});

describe('appariement demande ↔ voyage', () => {
  const items = loadSet(path.join(FIXTURES, 'set-sample.json'));
  const results = readResults(fixture('results-sample.jsonl'));
  const rows = readCheckRows(fixture('check-sample.csv'));

  it('range chaque voyage sous la demande qui l’a fait naître, par l’heure', () => {
    const m = matchTrips(items, results, rows);
    expect(m.perItem.get('s01')?.row?.trip_id).toBe('aaaaaaaa-1111-4000-8000-000000000001');
    expect(m.perItem.get('s02')?.row?.trip_id).toBe('aaaaaaaa-2222-4000-8000-000000000002');
    expect(m.perItem.get('s03')?.row?.trip_id).toBe('aaaaaaaa-3333-4000-8000-000000000003');
    expect(m.perItem.has('s04')).toBe(false);
    expect(m.orphans).toEqual([]);
  });

  it('un voyage né hors de toute demande reste orphelin', () => {
    const stray = normaliseRow({ trip_id: 'zzz', created_at: '2026-10-14 11:30:00+00' });
    const m = matchTrips(items, results, [...rows, stray]);
    expect(m.orphans.map((r: Row) => r.trip_id)).toEqual(['zzz']);
  });

  it('tient compte d’une petite avance d’horloge, pas d’une grande', () => {
    const early = normaliseRow({ trip_id: 'e', created_at: '2026-10-14 09:59:40+00' }); // 15 s avant s01
    expect(matchTrips(items, results, [early]).perItem.get('s01')?.row?.trip_id).toBe('e');
    expect(matchTrips(items, results, [early], { skewMs: 5_000 }).orphans).toHaveLength(1);
  });

  it('range un voyage par sa phrase de départ encore rangée, même sans journal', () => {
    const lone = normaliseRow({
      trip_id: 'p',
      created_at: '2026-10-14 03:00:00+00',
      start_say_pending: 'Week-end à Rome · 2 jours',
    });
    const m = matchTrips(items, [], [lone]);
    expect(m.perItem.get('s04')).toMatchObject({ result: null });
    expect(m.perItem.get('s04')?.row?.trip_id).toBe('p');
  });

  it('garde le premier voyage d’une demande et signale les autres', () => {
    const second = normaliseRow({ trip_id: 'double', created_at: '2026-10-14 10:00:30+00' });
    const m = matchTrips(items, results, [...rows, second]);
    expect(m.perItem.get('s01')?.row?.trip_id).toBe('aaaaaaaa-1111-4000-8000-000000000001');
    expect(m.perItem.get('s01')?.extraRows.map((r: Row) => r.trip_id)).toEqual(['double']);
  });

  it('prend la dernière tentative quand le passage est rejoué dans le même journal', () => {
    const replay = [
      ...results,
      {
        i: 1,
        id: 's01',
        say: items[0].phrase,
        seconds: 30,
        startedAt: '2026-10-14T13:00:00.000Z',
        endedAt: '2026-10-14T13:00:40.000Z',
      },
    ];
    const retry = normaliseRow({
      trip_id: 'retry',
      created_at: '2026-10-14 13:00:05+00',
      prep_ok: true,
    });
    const m = matchTrips(items, replay, [...rows, retry]);
    expect(m.perItem.get('s01')?.row?.trip_id).toBe('retry');
  });

  it('demande rejouée, phrase de départ gardée par les deux voyages : chacun à sa tentative', () => {
    const phrase = items[0].phrase;
    const first = {
      i: 1,
      id: 's01',
      say: phrase,
      seconds: 30,
      startedAt: '2026-10-14T12:00:00.000Z',
      endedAt: '2026-10-14T12:00:40.000Z',
    };
    const again = { ...first, startedAt: '2026-10-14T13:00:00.000Z', endedAt: '2026-10-14T13:00:40.000Z' };
    const older = normaliseRow({
      trip_id: 'ancien',
      created_at: '2026-10-14 12:00:05+00',
      start_say_pending: phrase,
    });
    const newer = normaliseRow({
      trip_id: 'nouveau',
      created_at: '2026-10-14 13:00:05+00',
      start_say_pending: phrase,
    });
    const m = matchTrips(items, [first, again], [newer, older]);
    expect(m.perItem.get('s01')?.row?.trip_id).toBe('nouveau');
  });

  it('retrouve la demande par son rang ou sa phrase quand l’identifiant manque (ancien journal)', () => {
    const old = [
      {
        i: 1,
        say: items[0].phrase,
        seconds: 50,
        startedAt: '2026-10-14T09:59:55.000Z',
        endedAt: '2026-10-14T10:01:00.000Z',
      },
    ];
    expect(matchTrips(items, old, rows).perItem.get('s01')?.row?.trip_id).toBe(
      'aaaaaaaa-1111-4000-8000-000000000001'
    );
    const byPhrase = [
      {
        say: items[2].phrase,
        startedAt: '2026-10-14T10:04:55.000Z',
        endedAt: '2026-10-14T10:05:35.000Z',
      },
    ];
    expect(matchTrips(items, byPhrase, rows).perItem.get('s03')?.row?.trip_id).toBe(
      'aaaaaaaa-3333-4000-8000-000000000003'
    );
  });

  it('une ligne de journal inconnue du jeu est comptée, et ses voyages restent orphelins', () => {
    const strange = [
      {
        i: 99,
        say: 'autre chose',
        seconds: 9,
        startedAt: '2026-10-14T09:59:55.000Z',
        endedAt: '2026-10-14T10:01:00.000Z',
      },
    ];
    const m = matchTrips(items, strange, rows.slice(0, 1));
    expect(m.unknownResults).toHaveLength(1);
    expect(m.orphans).toHaveLength(1);
  });
});

describe('attentes (evaluateExpect)', () => {
  it('ne dit rien quand tout est tenu', () => {
    const row = good({
      party_size: 4,
      origin_name: 'Bourg-en-Bresse',
      car_free: true,
      nights: 'refuge',
    });
    expect(
      evaluateExpect(
        {
          country: ['FR', 'CH'],
          activity: ['hiking', 'trekking'],
          days: [2, 4],
          party: 4,
          origin: 'Bourg en Bresse',
          carFree: true,
          nights: 'refuge',
          startMonth: 11,
          startMonthDay: '11-04',
          startOffsetDays: [20, 22],
          linearRoute: true,
        },
        row
      )
    ).toEqual([]);
  });

  it('dit chaque attente manquée, en français', () => {
    const misses = evaluateExpect(
      {
        country: 'IT',
        activity: 'cycling',
        days: 5,
        party: 2,
        origin: 'Lyon',
        carFree: true,
        nights: 'bivouac',
      },
      good({ country: 'FR', days: 3, party_size: null, origin_name: 'Annecy', nights: 'refuge' })
    );
    expect(misses).toEqual([
      'pays : attendu IT, obtenu FR',
      'activité : attendu cycling, obtenu hiking',
      'durée : attendu 5 jours, obtenu 3',
      'groupe : attendu 2 personnes, obtenu non renseigné',
      'départ : attendu « Lyon », obtenu « Annecy »',
      'sans voiture : non rangé sur le voyage',
      'nuits : attendu bivouac, obtenu refuge',
    ]);
  });

  it('pays, activité et durée absents de la base sont des manques, pas des réussites', () => {
    expect(evaluateExpect({ country: 'FR', days: 3 }, good({ country: null, days: null }))).toEqual(
      ['pays : attendu FR, obtenu non renseigné', 'durée : attendu 3 jours, obtenu non renseigné']
    );
    expect(evaluateExpect({ days: [2, 10] }, good({ days: 11 }))).toEqual([
      'durée : attendu 2 à 10 jours, obtenu 11',
    ]);
  });

  it('origine : null attend qu’aucun départ ne soit rangé', () => {
    expect(evaluateExpect({ origin: null }, good())).toEqual([]);
    expect(evaluateExpect({ origin: null }, good({ origin_name: 'Annecy' }))).toEqual([
      'départ : aucun dit, mais « Annecy » est rangé',
    ]);
    expect(evaluateExpect({ origin: 'Québec' }, good({ origin_name: 'Quebec' }))).toEqual([]);
    expect(evaluateExpect({ origin: 'Lyon' }, good())).toEqual([
      'départ : attendu « Lyon », obtenu aucun',
    ]);
  });

  it('budget : exact dans la devise du voyage, ordre de grandeur dans une autre', () => {
    expect(
      evaluateExpect({ budget: { amount: 500, currency: 'EUR' } }, good({ estimated_budget: 500 }))
    ).toEqual([]);
    expect(
      evaluateExpect({ budget: { amount: 500, currency: 'EUR' } }, good({ estimated_budget: 300 }))
    ).toEqual(['budget : attendu 500 EUR, obtenu 300 EUR']);
    // Par personne : multiplié par le groupe dit.
    const pp = {
      budget: { amount: 500, currency: 'EUR' },
      perPersonBudget: true as const,
      party: 3,
    };
    expect(evaluateExpect(pp, good({ party_size: 3, estimated_budget: 1500 }))).toEqual([]);
    expect(evaluateExpect(pp, good({ party_size: 3, estimated_budget: 500 }))).toEqual([
      'budget : attendu 1500 EUR (500 par personne × 3), obtenu 500 EUR',
    ]);
    // Autre devise : seul l’ordre de grandeur est vérifié (taux du jour inconnu ici).
    const usd = {
      budget: { amount: 50, currency: 'USD' },
      perPersonBudget: true as const,
      party: 4,
    };
    expect(evaluateExpect(usd, good({ party_size: 4, estimated_budget: 185 }))).toEqual([]);
    expect(evaluateExpect(usd, good({ party_size: 4, estimated_budget: 20 }))).toHaveLength(1);
    expect(evaluateExpect(usd, good({ party_size: 4, estimated_budget: null }))).toHaveLength(1);
  });

  it('dates : mois, jour, décalage depuis la création', () => {
    expect(evaluateExpect({ startMonth: 1 }, good({ start_date: '2027-01-01' }))).toEqual([]);
    expect(evaluateExpect({ startMonth: 1 }, good({ start_date: '2026-11-04' }))).toEqual([
      'départ : attendu en mois 1, obtenu 2026-11-04',
    ]);
    expect(evaluateExpect({ startMonthDay: '11-12' }, good({ start_date: '2026-11-12' }))).toEqual(
      []
    );
    expect(
      evaluateExpect({ startMonthDay: '11-12' }, good({ start_date: '2026-11-13' }))
    ).toHaveLength(1);
    expect(
      evaluateExpect({ startOffsetDays: [19, 23] }, good({ start_date: '2026-11-04' }))
    ).toEqual([]);
    expect(
      evaluateExpect({ startOffsetDays: [19, 23] }, good({ start_date: '2026-10-17' }))
    ).toEqual(['départ : attendu dans 19 à 23 jours, obtenu 3 jours (2026-10-17)']);
    expect(evaluateExpect({ startMonth: 11 }, good({ start_date: null }))).toEqual([
      'départ : aucune date de départ rangée',
    ]);
  });

  it('hémisphère sud : toutes les étapes au sud, sinon l’ancre', () => {
    expect(
      evaluateExpect({ hemisphere: 'S' }, good({ steps_lat_min: -53, steps_lat_max: -50 }))
    ).toEqual([]);
    expect(
      evaluateExpect({ hemisphere: 'S' }, good({ steps_lat_min: -53, steps_lat_max: 40.4 }))
    ).toEqual(['hémisphère sud : une étape est au nord de l’équateur (latitude max 40.4)']);
    expect(
      evaluateExpect(
        { hemisphere: 'S' },
        good({ step_count: 0, steps_lat_min: null, steps_lat_max: null, anchor_lat: -16.8 })
      )
    ).toEqual([]);
    expect(
      evaluateExpect(
        { hemisphere: 'S' },
        good({ step_count: 0, steps_lat_min: null, steps_lat_max: null, anchor_lat: null })
      )
    ).toEqual(['hémisphère sud : aucune coordonnée à vérifier']);
  });

  it('parcours linéaire : aucune étape au même lieu que la précédente', () => {
    expect(evaluateExpect({ linearRoute: true }, good())).toEqual([]);
    expect(evaluateExpect({ linearRoute: true }, good({ steps_dup_consecutive: 2 }))).toEqual([
      'parcours linéaire : 2 étape(s) au même lieu que la précédente',
    ]);
  });
});

describe('invariants (checkInvariants)', () => {
  it('rien à dire d’un voyage propre', () => {
    expect(checkInvariants(good())).toEqual({ misses: [], warnings: [] });
  });

  it('relève les défauts de l’audit : sans étape, sans coordonnées, sans nom, sans kit, sans budget, erreurs serveur', () => {
    const { misses } = checkInvariants(
      good({
        step_count: 0,
        steps_no_coords: 1,
        steps_no_place: 2,
        kit_items: 0,
        budget_lines: 0,
        app_errors_during: 3,
        app_error_scopes: 'compas.metno:503',
      })
    );
    expect(misses).toEqual([
      '[invariant] aucune étape',
      '[invariant] 1 étape(s) sans coordonnées',
      '[invariant] 2 étape(s) sans nom de lieu',
      '[invariant] aucun objet de kit',
      '[invariant] aucune ligne de budget',
      '[invariant] 3 erreur(s) serveur pendant la préparation (compas.metno:503)',
    ]);
  });

  it('les hors-rayon, l’absence d’ancre, l’IA et la phrase restée rangée sont des mises en garde', () => {
    const { misses, warnings } = checkInvariants(
      good({
        steps_beyond_radius: 1,
        anchor_lat: null,
        steps_ai_proposed: 2,
        start_say_pending: 'rando',
      })
    );
    expect(misses).toEqual([]);
    expect(warnings).toHaveLength(4);
  });
});

describe('verdict (judgeItem)', () => {
  it('prête : tout est tenu en moins de 60 s', () => {
    const j = judgeItem(
      item({ country: 'FR', days: 3 }),
      { seconds: 90 },
      good({ prep_seconds: 59 })
    );
    expect(j).toMatchObject({ verdict: 'prête', seconds: 59, reasons: [] });
  });

  it('partielle : préparée mais une attente manquée, ou trop lente, ou un invariant tombé', () => {
    const a = judgeItem(item({ country: 'IT' }), null, good());
    expect(a.verdict).toBe('partielle');
    expect(a.reasons).toEqual(['pays : attendu IT, obtenu FR']);
    const slow = judgeItem(item({}), null, good({ prep_seconds: 60 }));
    expect(slow).toMatchObject({
      verdict: 'partielle',
      reasons: ['durée : 60 s, au-delà de 60 s'],
    });
    expect(judgeItem(item({}), null, good({ prep_seconds: 75 }), { maxSeconds: 90 }).verdict).toBe(
      'prête'
    );
    const inv = judgeItem(item({}), null, good({ kit_items: 0 }));
    expect(inv).toMatchObject({
      verdict: 'partielle',
      reasons: ['[invariant] aucun objet de kit'],
    });
  });

  it('une base fixe peut dormir deux fois au même lieu : mise en garde, sauf parcours linéaire', () => {
    const dup = good({ steps_dup_consecutive: 1 });
    const base = judgeItem(item({}), null, dup);
    expect(base.verdict).toBe('prête');
    expect(base.warnings).toContain('1 étape(s) au même lieu que la précédente');
    expect(judgeItem(item({ linearRoute: true }), null, dup).verdict).toBe('partielle');
  });

  it('échec : pas de voyage, préparation en échec, ou jamais finie', () => {
    expect(judgeItem(item(), { error: 'TimeoutError: waitFor', seconds: 330 }, null)).toMatchObject(
      {
        verdict: 'échec',
        seconds: 330,
        reasons: ['le passage a échoué avant la fin : TimeoutError: waitFor'],
      }
    );
    expect(judgeItem(item(), { seconds: 10 }, null).reasons).toEqual([
      'aucun voyage en base pour cette demande',
    ]);
    expect(
      judgeItem(item(), null, good({ prep_ok: false, prep_error: 'Trop de préparations' }))
    ).toMatchObject({
      verdict: 'échec',
      reasons: ['préparation en échec : Trop de préparations'],
    });
    expect(judgeItem(item(), null, good({ prep_ok: null }))).toMatchObject({
      verdict: 'échec',
      reasons: ['préparation non terminée : aucune issue écrite sur le voyage'],
    });
  });

  it('non joué : ni ligne du journal ni voyage', () => {
    expect(judgeItem(item(), null, null)).toMatchObject({ verdict: 'non joué', reasons: [] });
  });

  it('la base fait foi : une erreur du passage sur une préparation réussie n’est qu’une mise en garde', () => {
    const j = judgeItem(item(), { error: 'TimeoutError', seconds: 335 }, good());
    expect(j.verdict).toBe('prête');
    expect(j.warnings[0]).toMatch(/TimeoutError/);
  });

  it('sans durée en base, la durée vue par le passage sert', () => {
    expect(judgeItem(item(), { seconds: 45 }, good({ prep_seconds: null }))).toMatchObject({
      verdict: 'prête',
      seconds: 45,
    });
    expect(judgeItem(item(), { seconds: 80 }, good({ prep_seconds: null })).verdict).toBe(
      'partielle'
    );
    expect(judgeItem(item(), null, good({ prep_seconds: null })).warnings).toContain(
      'durée inconnue'
    );
  });

  it('signale les voyages en double pour une même demande', () => {
    expect(judgeItem(item(), null, good(), { extraRows: [good()] }).warnings).toContain(
      '1 autre(s) voyage(s) créé(s) pour la même demande'
    );
  });
});

describe('totaux et rapport', () => {
  const judged = (verdicts: Array<[string, number | null]>) =>
    verdicts.map(([verdict, seconds], i) => ({
      id: `x${i}`,
      phrase: 'p',
      verdict,
      seconds,
      reasons: [],
      warnings: [],
    }));

  it('le taux de réussite est prêtes / jouées ; les non jouées sont à part', () => {
    const s = summarise(
      judged([
        ['prête', 20],
        ['prête', 40],
        ['prête', 30],
        ['partielle', 70],
        ['échec', 90],
        ['non joué', null],
      ])
    );
    expect(s).toMatchObject({
      total: 6,
      played: 5,
      ready: 3,
      partial: 1,
      failed: 1,
      notPlayed: 1,
      successRate: 60,
      preparedRate: 80,
      medianSeconds: 35, // 20, 30, 40, 70 : moyenne des deux du milieu
      p90Seconds: 70,
    });
  });

  it('sans demande jouée, pas de taux inventé', () => {
    expect(summarise(judged([['non joué', null]]))).toMatchObject({
      played: 0,
      successRate: null,
      preparedRate: null,
      medianSeconds: null,
    });
  });

  it('compareRun sur la sortie réelle de check.sql : partielle, échec, prête, non joué', () => {
    const report = compareRun({
      items: loadSet(path.join(FIXTURES, 'set-sample.json')),
      results: readResults(fixture('results-sample.jsonl')),
      rows: readCheckRows(fixture('check-sample.csv')),
    });
    expect(report.items.map((j: Row) => [j.id, j.verdict])).toEqual([
      ['s01', 'partielle'],
      ['s02', 'échec'],
      ['s03', 'prête'],
      ['s04', 'non joué'],
    ]);
    expect(report.items[0].reasons).toEqual([
      '[invariant] 2 erreur(s) serveur pendant la préparation (compas.metno:503)',
    ]);
    expect(report.summary).toMatchObject({
      played: 3,
      ready: 1,
      partial: 1,
      failed: 1,
      notPlayed: 1,
      successRate: 33.3,
      preparedRate: 66.7,
    });
    expect(report.orphanTrips).toEqual([]);
  });

  it('formatReport liste les manques, les mises en garde et les totaux (virgule décimale)', () => {
    const report = compareRun({
      items: loadSet(path.join(FIXTURES, 'set-sample.json')),
      results: readResults(fixture('results-sample.jsonl')),
      rows: readCheckRows(fixture('check-sample.csv')),
    });
    const text = formatReport(report, { setName: 'set-sample.json' });
    expect(text).toContain('s01   partielle  42 s');
    expect(text).toContain('        - [invariant] 2 erreur(s) serveur');
    expect(text).toContain('        ! 1 étape(s) proposée(s) par l’IA');
    expect(text).toContain('s04   non joué   —');
    expect(text).toContain('set-sample.json : prêtes 1/3 · partielles 1 · échecs 1 · non jouées 1');
    expect(text).toContain('Taux de réussite (prêtes / jouées) : 33,3 %');
    expect(text).toContain('médiane 37 s, 90e centile 42 s'); // 31 s et 42 s : (31 + 42) / 2 = 36,5
  });
});

describe('ligne de commande', () => {
  it('lit les options et refuse les inconnues', () => {
    expect(
      parseArgs([
        '--run',
        'd',
        '--check',
        'c.csv',
        '--set',
        's.json',
        '--max-seconds',
        '90',
        '--min-rate',
        '95',
      ])
    ).toMatchObject({
      run: 'd',
      check: 'c.csv',
      set: 's.json',
      maxSeconds: 90,
      skewSeconds: 20,
      minRate: 95,
    });
    expect(() => parseArgs(['--bizarre'])).toThrow(/option inconnue/);
    expect(() => parseArgs(['--run'])).toThrow(/demande une valeur/);
    expect(() => parseArgs(['--max-seconds', 'x'])).toThrow(/numérique/);
  });

  it('main rend 0, 1 sous le seuil, 2 sans option, et écrit le rapport JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compas-compare-'));
    try {
      const out: string[] = [];
      const log = (line: string) => out.push(line);
      const args = [
        '--run',
        path.join(FIXTURES, 'results-sample.jsonl'),
        '--check',
        path.join(FIXTURES, 'check-sample.csv'),
        '--set',
        path.join(FIXTURES, 'set-sample.json'),
      ];
      const jsonFile = path.join(dir, 'rapport.json');
      expect(main([...args, '--json', jsonFile], log)).toBe(0);
      expect(out.join('\n')).toContain('prêtes 1/3');
      expect(JSON.parse(fs.readFileSync(jsonFile, 'utf8')).summary.successRate).toBe(33.3);
      expect(main([...args, '--min-rate', '95'], log)).toBe(1);
      expect(main([...args, '--min-rate', '30'], log)).toBe(0);
      expect(main([], log)).toBe(2);
      expect(main(['--help'], log)).toBe(0);
      // Un dossier de passage : results.jsonl y est cherché.
      fs.copyFileSync(path.join(FIXTURES, 'results-sample.jsonl'), path.join(dir, 'results.jsonl'));
      expect(
        main(
          [
            '--run',
            dir,
            '--check',
            path.join(FIXTURES, 'check-sample.csv'),
            '--set',
            path.join(FIXTURES, 'set-sample.json'),
          ],
          log
        )
      ).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
