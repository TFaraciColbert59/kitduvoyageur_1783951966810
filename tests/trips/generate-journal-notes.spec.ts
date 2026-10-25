/**
 * Task 13 — `generateJournalNotes` : 1 note pré-remplie par jour/étape, avec
 * le contexte RÉEL (distance, D+, POI) et 3 questions ouvertes de documentation.
 *
 *   (a) 2 étapes réelles → 2 notes (titres `Jour N — <étape>`, contenu réel) ;
 *   (b) données absentes → aucun fait inventé (pas de km/D+/POI) ;
 *   (c) jour déjà noté → aucune note dupliquée (idempotence) ;
 *   (d) échec d'écriture → avertissement, aucune levée ;
 *   (e) service indisponible / étapes invalides → aucune écriture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { serviceHolder } = vi.hoisted(() => ({ serviceHolder: { client: {} as unknown } }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

import {
  buildJournalNoteContent,
  buildJournalNoteTitle,
  generateJournalNotes,
} from '@/features/trips/server/generateJournalNotes';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
}

function createService(options: {
  existingNotes?: unknown;
  readError?: { message: string } | null;
  insertError?: { message: string } | null;
} = {}): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [] };
  const client = {
    from(table: string) {
      let op: 'select' | 'insert' = 'select';
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (op === 'insert') return { data: null, error: options.insertError ?? null };
        if (table === 'trip_notes') {
          return options.readError
            ? { data: null, error: options.readError }
            : { data: options.existingNotes ?? [], error: null };
        }
        return { data: null, error: null };
      };
      builder.select = () => builder;
      builder.insert = (values: unknown) => {
        op = 'insert';
        captures.inserts.push({ table, values });
        return builder;
      };
      builder.eq = () => builder;
      builder.maybeSingle = async () => settle();
      builder.single = async () => settle();
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject);
      return builder;
    },
  };
  return { client, captures };
}

const STEPS = [
  {
    dayNumber: 1,
    title: 'Tour du Lac Blanc',
    distanceKm: 6.2,
    elevationGainM: 420,
    poiNames: ['Refuge du Lac'],
  },
  {
    dayNumber: 2,
    title: 'Étape 2 — Tour du Lac Blanc',
    distanceKm: 5.75,
    elevationGainM: 310,
    poiNames: ['Belvédère', 'Refuge du Lac'],
  },
];

interface NoteRow {
  trip_id: string;
  author_id: string;
  title: string;
  content: string;
  day_number: number;
  is_pinned: boolean;
}

describe('generateJournalNotes (Task 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
  });

  it('(a) 2 étapes réelles → 2 notes contextualisées (distance, D+, POI)', async () => {
    const { client, captures } = createService({ existingNotes: [] });
    serviceHolder.client = client;

    const result = await generateJournalNotes(TRIP_ID, USER_ID, STEPS);

    expect(result.created).toBe(2);
    expect(result.warnings).toEqual([]);

    const rows = captures.inserts.find((entry) => entry.table === 'trip_notes')
      ?.values as NoteRow[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      trip_id: TRIP_ID,
      author_id: USER_ID,
      title: 'Jour 1 — Tour du Lac Blanc',
      day_number: 1,
      is_pinned: false,
    });
    expect(rows[1].title).toBe('Jour 2 — Étape 2 — Tour du Lac Blanc');
    expect(rows[0].content).toContain('distance prévue 6,2 km');
    expect(rows[0].content).toContain('D+ prévu 420 m');
    expect(rows[0].content).toContain('Refuge du Lac');
    expect(rows[0].content).toContain('À documenter :');
    expect(rows[0].content.split('\n').filter((line) => /^\d\./.test(line))).toHaveLength(3);
  });

  it('(b) données absentes → aucun fait inventé, questions conservées', () => {
    const content = buildJournalNoteContent({ dayNumber: 3, title: 'Étape', poiNames: [] });

    expect(content).not.toContain('km');
    expect(content).not.toContain('D+');
    expect(content).toContain('À documenter :');
    expect(buildJournalNoteTitle({ dayNumber: 3, title: '   ' })).toBe('Jour 3 — Étape');
  });

  it('(c) jour déjà noté → aucune duplication (idempotence)', async () => {
    const { client, captures } = createService({ existingNotes: [{ day_number: 1 }] });
    serviceHolder.client = client;

    const result = await generateJournalNotes(TRIP_ID, USER_ID, STEPS);

    expect(result.created).toBe(1);
    const rows = captures.inserts.find((entry) => entry.table === 'trip_notes')
      ?.values as NoteRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].day_number).toBe(2);
  });

  it('(d) échec d’écriture → avertissement, aucune levée', async () => {
    const { client } = createService({ insertError: { message: 'permission denied' } });
    serviceHolder.client = client;

    const result = await generateJournalNotes(TRIP_ID, USER_ID, STEPS);

    expect(result.created).toBe(0);
    expect(result.warnings.some((warning) => warning.includes('erreur d’écriture'))).toBe(true);
  });

  it('(e) service indisponible / étapes invalides → aucune écriture', async () => {
    serviceHolder.client = null;
    const withoutService = await generateJournalNotes(TRIP_ID, USER_ID, STEPS);
    expect(withoutService.created).toBe(0);
    expect(withoutService.warnings.length).toBeGreaterThan(0);

    serviceHolder.client = createService().client;
    const noSteps = await generateJournalNotes(TRIP_ID, USER_ID, []);
    expect(noSteps.created).toBe(0);
    expect(noSteps.warnings[0]).toContain('Aucune étape réelle');

    const invalid = await generateJournalNotes('pas-un-uuid', USER_ID, STEPS);
    expect(invalid.created).toBe(0);
    expect(invalid.warnings[0]).toContain('Identifiants invalides');
  });
});
