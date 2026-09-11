/**
 * A14 — Test d'intégration LOCAL du rollback par flags (preuve exécutée).
 *
 * Ce spec ne s'exécute que si `A14_LOCAL_INTEGRATION=1` (sinon il est ignoré :
 * `npm run test` reste vert hors base locale). Il parle EXCLUSIVEMENT à la
 * base Supabase locale (127.0.0.1) — toute URL non locale lève immédiatement.
 *
 * Ce qui est prouvé réellement (pas de mock de base) :
 *   TEST-A14-FLAG-ROLLBACK-01 — utilisateur jetable créé localement ;
 *   TEST-A14-FLAG-ROLLBACK-02 — terrain_live=false en base ⇒ POST route = 503 ;
 *   TEST-A14-FLAG-ROLLBACK-03 — terrain_live=true en base ⇒ route ouverte (201 réel) ;
 *   TEST-A14-FLAG-ROLLBACK-04 — rollback UPDATE enabled=false ⇒ 503 de nouveau ;
 *   TEST-A14-FLAG-ROLLBACK-05 — flags shadow OFF ⇒ cron shadows = zéro échantillon lu ;
 *   TEST-A14-FLAG-ROLLBACK-06 — suppression utilisateur jetable ⇒ aucune donnée résiduelle.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { POST as terrainPOST } from '@/app/api/terrain/reports/route';
import { POST as shadowsPOST } from '@/app/api/cron/run-adventure-shadows/route';

const RUN = process.env.A14_LOCAL_INTEGRATION === '1';
const API_URL = process.env.A14_LOCAL_API_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.A14_LOCAL_SERVICE_ROLE_KEY ?? '';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

const DOMAIN_FLAGS = [
  'performance_profile_v2',
  'route_prediction_v2',
  'collective_intelligence',
  'terrain_live',
  'performance_profile_v2_shadow',
  'route_prediction_v2_shadow',
  'collective_intelligence_shadow',
  'terrain_auto_detection_shadow',
] as const;

type Json = Record<string, unknown>;

let serviceClient: SupabaseClient;
let authenticatedClient: SupabaseClient;
let userId = '';
let accessToken = '';
const email = `a14-rollback-${Date.now()}@example.invalid`;
const password = `A14-${Math.random().toString(36).slice(2)}-local!`;

function assertLocalUrl(url: string): void {
  const hostname = new URL(url).hostname;
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`URL non locale refusée (${hostname}) — test local uniquement, jamais la production.`);
  }
}

async function setFlag(id: string, enabled: boolean): Promise<void> {
  const { error } = await serviceClient
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`mise à jour flag ${id}: ${error.message}`);
}

function terrainRequest(): NextRequest {
  return new NextRequest('http://localhost/api/terrain/reports', {
    method: 'POST',
    body: JSON.stringify({ category: 'obstacle', severity: 'warning', lat: 45.1, lng: 2.8 }),
    headers: { 'content-type': 'application/json' },
  });
}

function shadowsRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/run-adventure-shadows', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  });
}

const suite = RUN ? describe : describe.skip;

suite('A14 — rollback par flags sur base locale (TEST-A14-FLAG-ROLLBACK)', { timeout: 60_000 }, () => {
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
    if (!createResponse.ok) {
      throw new Error(`création utilisateur local: HTTP ${createResponse.status}`);
    }
    const created = (await createResponse.json()) as { id: string };
    userId = created.id;

    const tokenResponse = await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`connexion utilisateur local: HTTP ${tokenResponse.status}`);
    }
    const session = (await tokenResponse.json()) as { access_token: string };
    accessToken = session.access_token;

    authenticatedClient = createSupabaseClient(API_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
      rpc: (fn: string, args?: Json) => authenticatedClient.rpc(fn, args),
    } as never);
    vi.mocked(getServiceSupabase).mockReturnValue(serviceClient);

    process.env.CRON_SECRET = process.env.CRON_SECRET ?? 'a14-local-cron-secret';
    for (const flag of DOMAIN_FLAGS) await setFlag(flag, false);
  });

  afterAll(async () => {
    if (serviceClient) {
      for (const flag of DOMAIN_FLAGS) {
        try {
          await setFlag(flag, false);
        } catch {
          /* nettoyage best effort */
        }
      }
      const { data } = await serviceClient.from('feature_flags').select('id, enabled').eq('enabled', true);
      if ((data ?? []).length > 0) {
        throw new Error(`flags encore actifs: ${JSON.stringify(data)}`);
      }
    }
  });

  it('TEST-A14-FLAG-ROLLBACK-01: utilisateur jetable créé et profil synchronisé', async () => {
    expect(userId).toMatch(/^[0-9a-f-]{36}$/);
    const { data, error } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(userId);
  });

  it('TEST-A14-FLAG-ROLLBACK-02: terrain_live=false en base ⇒ route 503', async () => {
    await setFlag('terrain_live', false);

    const response = await terrainPOST(terrainRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Fonctionnalité non activée' });
  });

  it('TEST-A14-FLAG-ROLLBACK-03: terrain_live=true ⇒ route ouverte et signalement réel inséré', async () => {
    await setFlag('terrain_live', true);

    const response = await terrainPOST(terrainRequest());
    expect(response.status).toBe(201);
    const payload = (await response.json()) as { reportId: string };
    expect(payload.reportId).toMatch(/^[0-9a-f-]{36}$/);

    const { count } = await serviceClient
      .from('terrain_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', userId);
    expect(count).toBe(1);
  });

  it('TEST-A14-FLAG-ROLLBACK-04: rollback UPDATE enabled=false ⇒ 503 de nouveau', async () => {
    await setFlag('terrain_live', false);

    const { data } = await authenticatedClient.rpc('current_feature_flags');
    const terrainFlag = (data as { id: string; enabled: boolean }[]).find(
      (row) => row.id === 'terrain_live'
    );
    expect(terrainFlag?.enabled).toBe(false);

    const response = await terrainPOST(terrainRequest());
    expect(response.status).toBe(503);
  });

  it('TEST-A14-FLAG-ROLLBACK-05: flags shadow OFF ⇒ cron shadows ne lit aucun échantillon', async () => {
    const response = await shadowsPOST(shadowsRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: 0,
      route_prediction: 0,
      collective: 0,
      terrain_auto: 0,
    });
  });

  it('TEST-A14-FLAG-ROLLBACK-06: suppression de l’utilisateur jetable ⇒ données absentes (cascades)', async () => {
    const deleteResponse = await fetch(`${API_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    });
    expect(deleteResponse.ok).toBe(true);

    const [reports, consents, profiles] = await Promise.all([
      serviceClient.from('terrain_reports').select('id', { count: 'exact', head: true }).eq('reporter_id', userId),
      serviceClient.from('adventure_data_consents').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      serviceClient.from('user_profiles').select('id', { count: 'exact', head: true }).eq('id', userId),
    ]);
    expect(reports.count ?? 0).toBe(0);
    expect(consents.count ?? 0).toBe(0);
    expect(profiles.count ?? 0).toBe(0);
    userId = '';
  });
});
