import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn(() => ({ service: true })) }));
vi.mock('@/server/gdprExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/gdprExport')>();
  return { ...actual, createSupabaseGdprExportClient: vi.fn() };
});
vi.mock('@/server/gdprDelete', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/gdprDelete')>();
  return { ...actual, createSupabaseGdprDeleteDeps: vi.fn() };
});

import { createClient } from '@/lib/supabase/server';
import {
  createSupabaseGdprExportClient,
  GDPR_USER_TABLES,
  buildGdprExport,
  type GdprExportClient,
} from '@/server/gdprExport';
import {
  createSupabaseGdprDeleteDeps,
  deleteAccountData,
  DELETE_CONFIRMATION_PHRASE,
  ResidualDataError,
} from '@/server/gdprDelete';
import { GET as exportGET } from '@/app/api/account/export/route';
import { DELETE as deleteDELETE } from '@/app/api/account/delete/route';

const mockedCreateClient = vi.mocked(createClient);
const mockedExportClientFactory = vi.mocked(createSupabaseGdprExportClient);
const mockedDeleteDepsFactory = vi.mocked(createSupabaseGdprDeleteDeps);

const USER_ID = 'a1400000-0000-4000-8000-000000000001';

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function fakeExportClient(rows: Record<string, Record<string, unknown>[]> = {}): GdprExportClient {
  return {
    selectProfile: async () => ({ id: USER_ID, email: 'sujet@example.invalid' }),
    selectByUser: async (table) => rows[table] ?? [],
    selectByColumn: async (table) => rows[table] ?? [],
  };
}

function deleteRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/delete', {
    method: 'DELETE',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('A14 — RGPD export/suppression (TEST-A14-GDPR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExportClientFactory.mockReturnValue(fakeExportClient());
    mockedDeleteDepsFactory.mockReturnValue({
      deleteAuthUser: vi.fn(async () => {}),
      countUserRows: vi.fn(async () => ({})),
    });
  });

  it('TEST-A14-GDPR-EXPORT-01: registre des tables du domaine verrouillé (aucune table santé)', () => {
    const names = GDPR_USER_TABLES.map((entry) => entry.table);

    expect(names).toEqual([
      'adventure_data_consents',
      'adventure_generation_requests',
      'adventure_shadow_runs',
      'performance_observations',
      'route_predictions',
      'segment_predictions',
      'user_performance_profiles',
      'user_performance_profile_versions',
      'hike_sessions',
      'session_segment_passages',
      'terrain_reports',
      'terrain_report_confirmations',
      'terrain_report_contributors',
      'offline_sync_operations',
      'user_entitlements',
      'saved_adventures',
      'saved_trails',
      'adventure_domain_events',
    ]);
    expect(names.some((name) => /sant|health|medical/.test(name))).toBe(false);
  });

  it('TEST-A14-GDPR-EXPORT-02: bundle complet (profil, consentements, plans + enfants)', async () => {
    const client = fakeExportClient({
      adventure_data_consents: [{ user_id: USER_ID, purpose: 'personal_performance', granted: true }],
      adventure_plans: [{ id: 'plan-1', owner_id: USER_ID, title: 'Trek' }],
      adventure_plan_versions: [{ plan_id: 'plan-1', version: 1 }],
      adventure_plan_decisions: [{ plan_id: 'plan-1', decision_type: 'skill' }],
      adventure_engine_runs: [{ plan_id: 'plan-1', engine_id: 'profile' }],
      hike_sessions: [{ id: 'session-1' }],
    });

    const bundle = await buildGdprExport(client, USER_ID, { now: '2026-09-11T20:00:00.000Z' });

    expect(bundle.schemaVersion).toBe('a14-v1');
    expect(bundle.exportedAt).toBe('2026-09-11T20:00:00.000Z');
    expect(bundle.subject).toEqual({ userId: USER_ID });
    expect(bundle.profile?.email).toBe('sujet@example.invalid');
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.plans).toHaveLength(1);
    expect(bundle.plans[0].versions).toHaveLength(1);
    expect(bundle.plans[0].decisions).toHaveLength(1);
    expect(bundle.plans[0].engineRuns).toHaveLength(1);
    expect(bundle.counts.hike_sessions).toBe(1);
    expect(bundle.counts.total).toBe(3);
  });

  it('TEST-A14-GDPR-EXPORT-03: route export sans session ⇒ 401', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await exportGET();

    expect(response.status).toBe(401);
    expect(mockedExportClientFactory).not.toHaveBeenCalled();
  });

  it('TEST-A14-GDPR-EXPORT-04: route export authentifiée ⇒ 200 JSON téléchargeable, no-store', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await exportGET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('x-lkdv-export-schema')).toBe('a14-v1');
    const payload = (await response.json()) as { subject: { userId: string } };
    expect(payload.subject.userId).toBe(USER_ID);
  });

  it('TEST-A14-GDPR-DELETE-01: route suppression sans session ⇒ 401', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient(null));

    const response = await deleteDELETE(deleteRequest({ confirmation: DELETE_CONFIRMATION_PHRASE }));

    expect(response.status).toBe(401);
  });

  it('TEST-A14-GDPR-DELETE-02: confirmation absente/erronée ⇒ 400 sans suppression', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await deleteDELETE(deleteRequest({ confirmation: 'oui' }));

    expect(response.status).toBe(400);
    expect(mockedDeleteDepsFactory).not.toHaveBeenCalled();
  });

  it('TEST-A14-GDPR-DELETE-03: confirmation exacte ⇒ 200 + cascades vérifiées', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    const deleteAuthUser = vi.fn(async () => {});
    mockedDeleteDepsFactory.mockReturnValue({
      deleteAuthUser,
      countUserRows: vi.fn(async () => ({ terrain_reports: 0, hike_sessions: 0 })),
    });

    const response = await deleteDELETE(deleteRequest({ confirmation: DELETE_CONFIRMATION_PHRASE }));

    expect(response.status).toBe(200);
    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
    const payload = (await response.json()) as { deleted: boolean; residual: Record<string, number> };
    expect(payload.deleted).toBe(true);
    expect(payload.residual.terrain_reports).toBe(0);
  });

  it('TEST-A14-GDPR-DELETE-04: données résiduelles ⇒ erreur bloquante (jamais un faux succès)', async () => {
    await expect(
      deleteAccountData(
        { userId: USER_ID, confirmation: DELETE_CONFIRMATION_PHRASE },
        {
          deleteAuthUser: async () => {},
          countUserRows: async () => ({ terrain_reports: 2, hike_sessions: 0 }),
        }
      )
    ).rejects.toBeInstanceOf(ResidualDataError);
  });

  it('TEST-A14-GDPR-DELETE-05: route ⇒ 500 explicite si données résiduelles', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
    mockedDeleteDepsFactory.mockReturnValue({
      deleteAuthUser: vi.fn(async () => {}),
      countUserRows: vi.fn(async () => ({ terrain_reports: 1 })),
    });

    const response = await deleteDELETE(deleteRequest({ confirmation: DELETE_CONFIRMATION_PHRASE }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Suppression incomplète',
      details:
        'Des données résiduelles subsistent — incident traité, aucune donnée n’est réputée supprimée.',
    });
  });

  it('TEST-A14-GDPR-DELETE-06: corps non-JSON ⇒ 400 (pas de suppression)', async () => {
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));

    const response = await deleteDELETE(deleteRequest('pas du json'));

    expect(response.status).toBe(400);
  });
});
