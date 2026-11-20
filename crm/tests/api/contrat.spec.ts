import { test, expect } from '../support/base';
import { NO_CREDENTIALS_MOTIF, NO_SUPABASE_MOTIF, credentials, hasSupabaseEnv } from '../support/env';

/**
 * Couche 4 — contrat d'API (07_VERIFICATION § 1, ligne 4).
 *
 * On vérifie ce que CONTRACT.md promet : validation zod, erreurs traduites en français
 * (`42501` → phrase métier), aucun secret ni trace technique dans la réponse, aucune
 * action sans session vérifiée en base. Les tests appellent les routes HTTP réelles.
 */

test.describe('Contrat d’API — routes publiques', () => {
  test('GET /api/health répond 200 et ne révèle aucun secret ni donnée personnelle', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok?: boolean;
      bricks?: { id: string; ready: boolean; fallback: string }[];
      summary?: { total: number };
      request_ref?: string;
    };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.bricks)).toBe(true);
    expect(body.bricks!.length).toBeGreaterThan(0);
    for (const brick of body.bricks!) {
      expect(typeof brick.ready).toBe('boolean');
      expect(brick.fallback.length).toBeGreaterThan(10);
    }
    expect(body.summary!.total).toBe(body.bricks!.length);

    const raw = await response.text();
    // Les identifiants de brique (« service_role », « stripe_test ») sont publics ;
    // ce sont les VALEURS de secrets qui ne doivent jamais sortir.
    expect(raw).not.toMatch(/(sk|pk|rk)_(test|live)_[A-Za-z0-9]{8,}/);
    expect(raw).not.toMatch(/whsec_[A-Za-z0-9]{8,}/);
    expect(raw).not.toMatch(/sb_(secret|publishable)?_?[A-Za-z0-9_-]{20,}/);
    expect(raw).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./);
    expect(raw).not.toMatch(/NVIDIA_API_KEY\s*=|RESEND_API_KEY\s*=|CRON_SECRET\s*=/);
    expect(raw).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });

  test('POST /api/mcp sans jeton d’agent est refusé, sans détail interne', async ({ request }) => {
    const response = await request.post('/api/mcp', { data: { jsonrpc: '2.0', method: 'tools/list', id: 1 } });
    expect([400, 401, 403, 415]).toContain(response.status());
    const raw = await response.text();
    expect(raw).not.toMatch(/service_role|SUPABASE_SERVICE|at .*\.ts:|stack/);
  });
});

test.describe('Contrat d’API — aucune action sans session', () => {
  test.beforeEach(() => {
    test.skip(!hasSupabaseEnv(), NO_SUPABASE_MOTIF);
  });

  const endpoints: { path: string; body: unknown; allowed: number[] }[] = [
    { path: '/api/cmd', body: { command: 'post_hide', params: { post_id: 'demo-post', reason_code: 'spam' } }, allowed: [401] },
    { path: '/api/approve', body: { id: '00000000-0000-0000-0000-000000000000', confirmation: 'abcdef12' }, allowed: [401] },
    { path: '/api/reject', body: { id: '00000000-0000-0000-0000-000000000000', reason: 'test' }, allowed: [401] },
    { path: '/api/undo', body: { audit_id: 1 }, allowed: [401] }
  ];

  for (const endpoint of endpoints) {
    test(`${endpoint.path} sans session : ${endpoint.allowed.join('/')} et phrase métier`, async ({ request }) => {
      const response = await request.post(endpoint.path, { data: endpoint.body });
      expect(endpoint.allowed).toContain(response.status());
      const body = (await response.json()) as { error?: { code?: string; message?: string }; request_ref?: string };
      expect(body.error?.code).toBe('unauthenticated');
      expect(body.error?.message).toMatch(/session|reconnect/i);
      expect(body.request_ref).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(/42501|PGRST|service_role|at .*\.ts:/);
    });
  }

  test('GET sur une route POST est refusé avec 405 et l’en-tête Allow', async ({ request }) => {
    const response = await request.get('/api/cmd');
    expect(response.status()).toBe(405);
    expect(response.headers()['allow']).toBe('POST');
  });

  test('un corps JSON invalide ne produit jamais de pile ni de message zod brut', async ({ request }) => {
    const response = await request.post('/api/cmd', { data: '"pas un objet"' });
    expect([400, 401, 422]).toContain(response.status());
    const raw = await response.text();
    expect(raw).not.toMatch(/ZodError|invalid_type|Unrecognized key|at .*\.ts:/);
  });
});

test.describe('Contrat d’API — avec le compte de test', () => {
  test.beforeEach(() => {
    test.skip(!credentials(), NO_CREDENTIALS_MOTIF);
  });

  test('une commande inconnue est refusée en français (400), sans jargon', async ({ request }) => {
    const response = await request.post('/api/cmd', { data: { command: 'commande_inexistante', params: {} } });
    expect([400, 401]).toContain(response.status());
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.message).toMatch(/n’existe pas|n'existe pas|session/i);
    expect(JSON.stringify(body)).not.toMatch(/ZodError|invalid_type/);
  });

  test('un refus de droits (42501) devient une phrase métier, jamais un code', async ({ request }) => {
    const response = await request.post('/api/cmd', {
      data: { command: 'staff_manage', params: { user_id: 'demo-member', role: 'admin', pole: 'CONF' } }
    });
    const raw = await response.text();
    expect(raw).not.toContain('42501');
    if (response.status() === 403) {
      expect(raw).toMatch(/rôle|droits|autorisation/i);
    }
  });
});

test.describe('Contrat d’API — disponibilité de la base de test', () => {
  test('la base Supabase répond pour le projet de test', async ({ request }) => {
    test.skip(!hasSupabaseEnv(), NO_SUPABASE_MOTIF);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const response = await request.get(`${base}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' }
    });
    expect(response.status()).toBeLessThan(500);
  });
});
