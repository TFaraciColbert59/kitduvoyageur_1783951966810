/**
 * Task 12 — `generateSafetyCheckpoints` : points de contrôle réels depuis les
 * règles sécurité et les dates RÉELLES du voyage.
 *
 *   (a) dates réelles → calendrier attendu (J-1 18:00, J1 08:00, quotidien
 *       20:00, dernier jour 18:00), statut `pending`, aucun doublon ;
 *   (b) sans dates → 0 point créé + avertissement (jamais de date inventée) ;
 *   (c) échec d'écriture → avertissement, aucune levée ;
 *   (d) service indisponible / identifiant invalide → aucun écrit ;
 *   (e) sortie d'un jour → départ + clôture uniquement (pas de quotidien).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { serviceHolder } = vi.hoisted(() => ({ serviceHolder: { client: {} as unknown } }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

import {
  buildSafetyCheckpointDrafts,
  generateSafetyCheckpoints,
} from '@/features/trips/server/generateSafetyCheckpoints';

const TRIP_ID = '22222222-2222-4222-8222-222222222222';

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
}

function createService(options: { insertError?: { message: string } | null } = {}): {
  client: unknown;
  captures: Captures;
} {
  const captures: Captures = { inserts: [] };
  const client = {
    from(table: string) {
      let op: 'select' | 'insert' = 'select';
      const builder: Record<string, unknown> = {};
      builder.insert = (values: unknown) => {
        op = 'insert';
        captures.inserts.push({ table, values });
        return builder;
      };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(op === 'insert' ? { data: null, error: options.insertError ?? null } : { data: null, error: null }).then(
          resolve,
          reject
        );
      return builder;
    },
  };
  return { client, captures };
}

interface CheckpointRow {
  trip_id: string;
  label: string;
  scheduled_at: string;
  status: string;
  notes: string;
}

const FULL_INPUT = {
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  durationDays: 3,
  activity: 'trekking',
  difficulty: 'hard',
  countryCode: 'FR',
  partySize: 4,
};

describe('generateSafetyCheckpoints (Task 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
  });

  it('(a) dates réelles → calendrier J-1 / J1 / quotidien / dernier jour', async () => {
    const { client, captures } = createService();
    serviceHolder.client = client;

    const result = await generateSafetyCheckpoints(TRIP_ID, FULL_INPUT);

    expect(result.created).toBe(9);
    expect(result.warnings).toEqual([]);

    const rows = captures.inserts.find((entry) => entry.table === 'trip_safety_checkpoints')
      ?.values as CheckpointRow[];
    expect(rows).toHaveLength(9);
    expect(rows.every((row) => row.trip_id === TRIP_ID)).toBe(true);
    expect(rows.every((row) => row.status === 'pending')).toBe(true);
    expect(rows.every((row) => row.notes.length > 0)).toBe(true);

    const byLabel = (fragment: string) => rows.filter((row) => row.label.includes(fragment));
    const byTime = (iso: string) => rows.filter((row) => row.scheduled_at === iso);

    // J-1 18:00 : vérifications de la veille (numéros de secours du pays réel).
    const veille = byTime('2026-06-30T18:00:00.000Z');
    expect(veille.length).toBeGreaterThanOrEqual(3);
    expect(veille.some((row) => row.label.includes('FR'))).toBe(true);

    // J1 08:00 : départ, itinéraire déclaré.
    const departure = byTime('2026-07-01T08:00:00.000Z');
    expect(departure).toHaveLength(1);
    expect(departure[0].label).toContain("Déclarer l'itinéraire");

    // Quotidien 20:00 : jours 1 à 2 (le dernier jour a son point de clôture).
    expect(byTime('2026-07-01T20:00:00.000Z')[0].label).toBe(
      'Point de contact quotidien — Jour 1'
    );
    expect(byTime('2026-07-02T20:00:00.000Z')[0].label).toBe(
      'Point de contact quotidien — Jour 2'
    );
    expect(byTime('2026-07-03T20:00:00.000Z')).toHaveLength(0);

    // Dernier jour 18:00 : fin de sortie.
    const closing = byTime('2026-07-03T18:00:00.000Z');
    expect(closing).toHaveLength(1);
    expect(closing[0].label).toContain('Fin de sortie');

    // Les règles réelles sont citées (traces véritables, pas de libellé inventé).
    expect(byLabel('Partager la trace GPX').length).toBeGreaterThan(0);
    expect(byLabel('passages techniques').length).toBeGreaterThan(0);
  });

  it('(b) sans date de départ réelle → 0 point + avertissement, aucune écriture', async () => {
    const { client, captures } = createService();
    serviceHolder.client = client;

    const result = await generateSafetyCheckpoints(TRIP_ID, {
      startDate: null,
      endDate: '2026-07-03',
      durationDays: 3,
      activity: 'trekking',
      difficulty: null,
      countryCode: 'FR',
      partySize: 2,
    });

    expect(result.created).toBe(0);
    expect(result.warnings.some((warning) => warning.includes('Dates réelles absentes'))).toBe(true);
    expect(captures.inserts).toHaveLength(0);
    expect(buildSafetyCheckpointDrafts({ ...FULL_INPUT, startDate: null })).toEqual([]);
  });

  it('(c) échec d’écriture → avertissement, aucune levée', async () => {
    const { client } = createService({ insertError: { message: 'permission denied' } });
    serviceHolder.client = client;

    const result = await generateSafetyCheckpoints(TRIP_ID, FULL_INPUT);

    expect(result.created).toBe(0);
    expect(result.warnings.some((warning) => warning.includes('erreur d’écriture'))).toBe(true);
  });

  it('(d) service indisponible ou identifiant invalide → aucun écrit', async () => {
    serviceHolder.client = null;
    const withoutService = await generateSafetyCheckpoints(TRIP_ID, FULL_INPUT);
    expect(withoutService.created).toBe(0);
    expect(withoutService.warnings.length).toBeGreaterThan(0);

    serviceHolder.client = createService().client;
    const invalid = await generateSafetyCheckpoints('pas-un-uuid', FULL_INPUT);
    expect(invalid.created).toBe(0);
    expect(invalid.warnings[0]).toContain('invalide');
  });

  it('(e) sortie d’un jour → départ + clôture, aucun quotidien', async () => {
    const { client, captures } = createService();
    serviceHolder.client = client;

    const result = await generateSafetyCheckpoints(TRIP_ID, {
      startDate: '2026-07-01',
      endDate: null,
      durationDays: 1,
      activity: 'hiking',
      difficulty: null,
      countryCode: null,
      partySize: 2,
    });

    expect(result.created).toBe(2);
    const rows = captures.inserts.find((entry) => entry.table === 'trip_safety_checkpoints')
      ?.values as CheckpointRow[];
    expect(rows.map((row) => row.scheduled_at).sort()).toEqual([
      '2026-07-01T08:00:00.000Z',
      '2026-07-01T18:00:00.000Z',
    ]);
    expect(rows.some((row) => row.scheduled_at.includes('T20:00'))).toBe(false);
  });
});
