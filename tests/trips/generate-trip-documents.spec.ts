/**
 * Task 11 — `generateTripDocuments` : feuille de route PDF + GPX réels uploadés
 * dans le bucket privé existant puis inscrits dans `trip_documents`.
 *
 *   (a) succès : 2 fichiers, 2 lignes (`booking`/`other`), URLs signées, liste
 *       attendue comptée depuis la checklist (jamais inventée) ;
 *   (b) échec storage → avertissements, aucune ligne, aucune levée ;
 *   (c) signature indisponible → avertissement, chemin stocké en repli ;
 *   (d) voyage introuvable → aucune écriture ;
 *   (e) service indisponible → aucune écriture ;
 *   (f) builder PDF minimal : signature `%PDF`, titre réel, déterminisme.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { serviceHolder } = vi.hoisted(() => ({ serviceHolder: { client: {} as unknown } }));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => serviceHolder.client),
}));

import {
  TRIP_DOCUMENTS_BUCKET,
  buildRoadbookPdf,
  generateTripDocuments,
} from '@/features/trips/server/generateTripDocuments';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRIP_ID = '22222222-2222-4222-8222-222222222222';
const TRIP = {
  id: TRIP_ID,
  title: 'Tour du Lac Blanc',
  description: 'Boucle alpine',
  start_date: '2026-07-01',
  end_date: '2026-07-02',
};
const STEPS = [
  {
    day_number: 1,
    order_index: 0,
    title: 'Tour du Lac Blanc',
    description: 'Étape 1/2',
    latitude: 48.0,
    longitude: 2.0,
    distance_km: 6.2,
    elevation_gain_m: 420,
    accommodation_name: null,
  },
  {
    day_number: 2,
    order_index: 0,
    title: 'Étape 2 — Tour du Lac Blanc',
    latitude: 48.1,
    longitude: 2.1,
  },
];
const POIS = [
  { name: 'Refuge du Lac', category: 'refuge', latitude: 48.05, longitude: 2.05, notes: null },
];
const CHECKLIST = [
  { label: 'Document attendu : pièce d’identité ou passeport en cours de validité' },
  { label: 'Document attendu : attestation d’assurance voyage / rapatriement' },
  { label: 'Réserver un guide officiel' },
];

interface Captures {
  inserts: Array<{ table: string; values: unknown }>;
  uploads: Array<{ bucket: string; path: string; bytes: number; contentType: string }>;
  signed: Array<{ bucket: string; path: string; expiresIn: number }>;
}

interface ServiceOptions {
  trip?: Record<string, unknown> | null;
  tripError?: { message: string } | null;
  steps?: Record<string, unknown>[] | null;
  pois?: Record<string, unknown>[] | null;
  checklist?: Record<string, unknown>[] | null;
  uploadError?: { message: string } | null;
  signError?: { message: string } | null;
  insertError?: { message: string } | null;
}

function createService(options: ServiceOptions): { client: unknown; captures: Captures } {
  const captures: Captures = { inserts: [], uploads: [], signed: [] };
  const client = {
    from(table: string) {
      let op: 'select' | 'insert' = 'select';
      let labelPrefix: string | null = null;
      const builder: Record<string, unknown> = {};
      const settle = () => {
        if (op === 'insert') return { data: null, error: options.insertError ?? null };
        if (table === 'trips') {
          if (options.tripError) return { data: null, error: options.tripError };
          return { data: options.trip ?? null, error: null };
        }
        if (table === 'trip_steps') return { data: options.steps ?? [], error: null };
        if (table === 'trip_pois') return { data: options.pois ?? [], error: null };
        if (table === 'trip_checklist_items') {
          const rows = options.checklist ?? [];
          const filtered =
            labelPrefix === null
              ? rows
              : rows.filter((row) => String(row.label ?? '').startsWith(labelPrefix as string));
          return { data: filtered, error: null };
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
      builder.order = () => builder;
      builder.like = (_column: string, pattern: string) => {
        labelPrefix = pattern.replace(/%$/, '');
        return builder;
      };
      builder.maybeSingle = async () => settle();
      builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject);
      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string, bytes: Uint8Array, opts: { contentType: string }) => {
            captures.uploads.push({
              bucket,
              path,
              bytes: bytes.byteLength,
              contentType: opts.contentType,
            });
            return options.uploadError
              ? { data: null, error: options.uploadError }
              : { data: { path }, error: null };
          },
          createSignedUrl: async (path: string, expiresIn: number) => {
            captures.signed.push({ bucket, path, expiresIn });
            return options.signError
              ? { data: null, error: options.signError }
              : { data: { signedUrl: `https://storage.test/${bucket}/${path}` }, error: null };
          },
        };
      },
    },
  };
  return { client, captures };
}

describe('generateTripDocuments (Task 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceHolder.client = {};
  });

  it('(a) génère PDF + GPX, uploadés et inscrits (catégories réelles, attendus comptés)', async () => {
    const { client, captures } = createService({
      trip: TRIP,
      steps: STEPS,
      pois: POIS,
      checklist: CHECKLIST,
    });
    serviceHolder.client = client;

    const result = await generateTripDocuments(TRIP_ID, USER_ID);

    expect(result.files).toBe(2);
    expect(result.expected).toBe(2);
    expect(result.warnings).toEqual([]);

    expect(captures.uploads.map((entry) => entry.bucket)).toEqual([
      TRIP_DOCUMENTS_BUCKET,
      TRIP_DOCUMENTS_BUCKET,
    ]);
    expect(captures.uploads.map((entry) => entry.contentType)).toEqual([
      'application/pdf',
      'application/gpx+xml',
    ]);
    expect(captures.uploads.every((entry) => entry.bytes > 0)).toBe(true);

    const rows = captures.inserts.find((entry) => entry.table === 'trip_documents')
      ?.values as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      trip_id: TRIP_ID,
      user_id: USER_ID,
      title: 'Feuille de route — Tour du Lac Blanc',
      category: 'booking',
      file_name: 'feuille-de-route.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: captures.uploads[0].bytes,
    });
    expect(rows[1]).toMatchObject({
      title: 'Tracé GPX — Tour du Lac Blanc',
      category: 'other',
      file_name: 'itineraire.gpx',
      mime_type: 'application/gpx+xml',
    });
    expect(String(rows[0].file_url)).toContain('https://storage.test/user-documents/');
    expect(String(rows[0].file_url)).toContain(`${USER_ID}/trips/${TRIP_ID}/`);
  });

  it('(b) échec du stockage → avertissements, aucune ligne, aucune levée', async () => {
    const { client, captures } = createService({
      trip: TRIP,
      steps: STEPS,
      checklist: CHECKLIST,
      uploadError: { message: 'bucket indisponible' },
    });
    serviceHolder.client = client;

    const result = await generateTripDocuments(TRIP_ID, USER_ID);

    expect(result.files).toBe(0);
    expect(result.expected).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes('stockage'))).toBe(true);
    expect(captures.inserts.some((entry) => entry.table === 'trip_documents')).toBe(false);
  });

  it('(c) signature indisponible → fichiers inscrits avec le chemin réel', async () => {
    const { client, captures } = createService({
      trip: TRIP,
      steps: STEPS,
      checklist: CHECKLIST,
      signError: { message: 'signature refusée' },
    });
    serviceHolder.client = client;

    const result = await generateTripDocuments(TRIP_ID, USER_ID);

    expect(result.files).toBe(2);
    expect(result.warnings.some((warning) => warning.includes('non signé'))).toBe(true);
    const rows = captures.inserts.find((entry) => entry.table === 'trip_documents')
      ?.values as Array<Record<string, unknown>>;
    expect(rows[0].file_url).toBe(`${USER_ID}/trips/${TRIP_ID}/feuille-de-route.pdf`);
  });

  it('(d) voyage introuvable → aucune écriture', async () => {
    const { client, captures } = createService({ trip: null });
    serviceHolder.client = client;

    const result = await generateTripDocuments(TRIP_ID, USER_ID);

    expect(result.files).toBe(0);
    expect(result.warnings.some((warning) => warning.includes('introuvable'))).toBe(true);
    expect(captures.uploads).toHaveLength(0);
    expect(captures.inserts).toHaveLength(0);
  });

  it('(e) service indisponible → aucune écriture, identifiants invalides refusés', async () => {
    serviceHolder.client = null;
    const withoutService = await generateTripDocuments(TRIP_ID, USER_ID);
    expect(withoutService.files).toBe(0);
    expect(withoutService.warnings.length).toBeGreaterThan(0);

    serviceHolder.client = createService({ trip: TRIP }).client;
    const invalid = await generateTripDocuments('pas-un-uuid', USER_ID);
    expect(invalid.files).toBe(0);
    expect(invalid.warnings[0]).toContain('Identifiants invalides');
  });

  it('(f) builder PDF : valide, titre réel, déterministe', () => {
    const input = {
      title: 'Tour du Lac Blanc',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      steps: [
        { dayNumber: 1, title: 'Tour du Lac Blanc', distanceKm: 6.2, elevationGainM: 420 },
        { dayNumber: 2, title: 'Étape 2 — Tour du Lac Blanc', distanceKm: null, elevationGainM: null },
      ],
    };
    const first = buildRoadbookPdf(input);
    const second = buildRoadbookPdf(input);

    expect(new TextDecoder('latin1').decode(first.slice(0, 8))).toBe('%PDF-1.4');
    expect(new TextDecoder('latin1').decode(first)).toContain('Feuille de route');
    expect(new TextDecoder('latin1').decode(first)).toContain('Tour du Lac Blanc');
    expect(first.byteLength).toBe(second.byteLength);
    expect(Array.from(first)).toEqual(Array.from(second));
  });
});
