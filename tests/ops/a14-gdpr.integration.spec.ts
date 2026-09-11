/**
 * A14 — Test d'intégration LOCAL export + suppression RGPD via les routes
 * réelles (`GET /api/account/export`, `DELETE /api/account/delete`), sur un
 * utilisateur jetable de la base Supabase locale.
 *
 * Exécution : `A14_LOCAL_INTEGRATION=1` + clé service locale (sinon ignoré).
 * Garde-fou : toute URL non locale lève immédiatement (jamais la production).
 *
 * Preuves :
 *   TEST-A14-GDPR-LOCAL-01 — export réel complet (profil, consentements, plans, sorties) ;
 *   TEST-A14-GDPR-LOCAL-02 — confirmation erronée ⇒ 400 et données intactes ;
 *   TEST-A14-GDPR-LOCAL-03 — suppression réelle ⇒ 200 et données absentes ensuite ;
 *   TEST-A14-GDPR-LOCAL-04 — export post-suppression ⇒ profil null, compteurs zéro.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { GET as exportGET } from '@/app/api/account/export/route';
import { DELETE as deleteDELETE } from '@/app/api/account/delete/route';
import { DELETE_CONFIRMATION_PHRASE } from '@/server/gdprDelete';

const RUN = process.env.A14_LOCAL_INTEGRATION === '1';
const API_URL = process.env.A14_LOCAL_API_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.A14_LOCAL_SERVICE_ROLE_KEY ?? '';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

type Json = Record<string, unknown>;

let serviceClient: SupabaseClient;
let userId = '';
let planId = '';
const email = `a14-gdpr-${Date.now()}@example.invalid`;
const password = `A14-${Math.random().toString(36).slice(2)}-local!`;

function assertLocalUrl(url: string): void {
  const hostname = new URL(url).hostname;
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`URL non locale refusée (${hostname}) — test local uniquement, jamais la production.`);
  }
}

async function insert(table: string, row: Json): Promise<Json> {
  const { data, error } = await serviceClient.from(table).insert(row).select('*').single();
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return data as Json;
}

async function countUserRows(table: string, column: string): Promise<number> {
  const { count, error } = await serviceClient
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, userId);
  if (error) throw new Error(`comptage ${table}: ${error.message}`);
  return count ?? 0;
}

function deleteRequest(confirmation: unknown): NextRequest {
  return new NextRequest('http://localhost/api/account/delete', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation }),
    headers: { 'content-type': 'application/json' },
  });
}

const suite = RUN ? describe : describe.skip;

suite('A14 — RGPD export/suppression sur base locale (TEST-A14-GDPR-LOCAL)', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    assertLocalUrl(API_URL);
    if (!SERVICE_KEY) throw new Error('A14_LOCAL_SERVICE_ROLE_KEY requise pour le test local.');

    serviceClient = createSupabaseClient(API_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const createResponse = await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!createResponse.ok) throw new Error(`création utilisateur local: HTTP ${createResponse.status}`);
    const created = (await createResponse.json()) as { id: string };
    userId = created.id;

    // Le trigger auth crée user_profiles : petite attente bornée.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { data } = await serviceClient.from('user_profiles').select('id').eq('id', userId).maybeSingle();
      if (data) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await insert('adventure_data_consents', {
      user_id: userId,
      purpose: 'personal_performance',
      granted: true,
    });
    await insert('hike_sessions', {
      user_id: userId,
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      ended_at: new Date().toISOString(),
      distance_km: 8.4,
      duration_seconds: 3600,
    });
    await insert('performance_observations', {
      user_id: userId,
      observed_at: new Date().toISOString(),
      distance_m: 8400,
      duration_s: 3600,
      processor_version: 'a14-test',
    });
    await insert('terrain_reports', {
      reporter_id: userId,
      category: 'obstacle',
      lat: 45.1,
      lng: 2.8,
    });
    await insert('saved_adventures', {
      user_id: userId,
      title: 'A14 test adventure',
      adventure_data: { steps: 3 },
    });
    await insert('user_entitlements', { user_id: userId });

    const plan = await insert('adventure_plans', { owner_id: userId, title: 'Plan A14' });
    planId = String(plan.id);
    await insert('adventure_plan_versions', {
      plan_id: planId,
      version: 1,
      snapshot: { step: 'depart' },
      reason: 'test A14',
      generated_by: 'a14-local',
    });
    await insert('adventure_plan_decisions', {
      plan_id: planId,
      decision_type: 'other',
      proposal: 'adapter',
    });
    await insert('adventure_engine_runs', {
      plan_id: planId,
      engine_id: 'profile',
      engine_version: 'a14-test',
      status: 'succeeded',
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    } as never);
    vi.mocked(getServiceSupabase).mockReturnValue(serviceClient);
  });

  afterAll(async () => {
    if (userId && serviceClient) {
      await fetch(`${API_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      }).catch(() => {});
    }
  });

  it('TEST-A14-GDPR-LOCAL-01: export réel complet avec auth requise', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);

    const response401 = await exportGET();
    expect(response401.status).toBe(401);

    const response = await exportGET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    const bundle = (await response.json()) as {
      profile: { id: string } | null;
      consents: unknown[];
      counts: Record<string, number>;
      plans: {
        plan: { id: string };
        versions: unknown[];
        decisions: unknown[];
        engineRuns: unknown[];
      }[];
    };
    expect(bundle.profile?.id).toBe(userId);
    expect(bundle.consents).toHaveLength(1);
    expect(bundle.counts.terrain_reports).toBe(1);
    expect(bundle.counts.hike_sessions).toBe(1);
    expect(bundle.counts.performance_observations).toBe(1);
    expect(bundle.plans).toHaveLength(1);
    expect(bundle.plans[0].plan.id).toBe(planId);
    expect(bundle.plans[0].versions).toHaveLength(1);
    expect(bundle.plans[0].decisions).toHaveLength(1);
    expect(bundle.plans[0].engineRuns).toHaveLength(1);
  });

  it('TEST-A14-GDPR-LOCAL-02: confirmation erronée ⇒ 400 et données intactes', async () => {
    const response = await deleteDELETE(deleteRequest('supprime'));

    expect(response.status).toBe(400);
    expect(await countUserRows('terrain_reports', 'reporter_id')).toBe(1);
    expect(await countUserRows('adventure_data_consents', 'user_id')).toBe(1);
  });

  it('TEST-A14-GDPR-LOCAL-03: suppression réelle ⇒ 200 et données absentes (cascades)', async () => {
    const response = await deleteDELETE(deleteRequest(DELETE_CONFIRMATION_PHRASE));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { deleted: boolean; residual: Record<string, number> };
    expect(payload.deleted).toBe(true);
    expect(Object.values(payload.residual).every((count) => count === 0)).toBe(true);

    expect(await countUserRows('user_profiles', 'id')).toBe(0);
    expect(await countUserRows('terrain_reports', 'reporter_id')).toBe(0);
    expect(await countUserRows('adventure_data_consents', 'user_id')).toBe(0);
    expect(await countUserRows('hike_sessions', 'user_id')).toBe(0);
    expect(await countUserRows('performance_observations', 'user_id')).toBe(0);
    expect(await countUserRows('saved_adventures', 'user_id')).toBe(0);
    expect(await countUserRows('adventure_plans', 'owner_id')).toBe(0);
    expect(await countUserRows('adventure_plan_versions', 'plan_id')).toBe(0);
    // engine_runs : FK plan_id ON DELETE SET NULL — plus aucun lien vers le plan supprimé.
    const { count: runLinks } = await serviceClient
      .from('adventure_engine_runs')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', planId);
    expect(runLinks ?? 0).toBe(0);
  });

  it('TEST-A14-GDPR-LOCAL-04: export post-suppression ⇒ profil null, compteurs zéro', async () => {
    const response = await exportGET();

    expect(response.status).toBe(200);
    const bundle = (await response.json()) as {
      profile: unknown;
      counts: Record<string, number>;
    };
    expect(bundle.profile).toBeNull();
    expect(bundle.counts.terrain_reports).toBe(0);
    expect(bundle.counts.adventure_plans).toBe(0);
    expect(bundle.counts.total).toBe(0);
  });
});
