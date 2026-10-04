import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * E2E — matrice d'accès du back-office reconstruit.
 * - Sans session (@local-web) : APIs 401/403, pages /admin → 307 /connexion.
 * - Avec session admin (@staging-auth) : 200 + garde CSRF active.
 *   Exécuté uniquement si TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD fournis.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

test.describe('Back-office — matrice d’accès', () => {
  test('TEST-E2E-ADM-01: APIs admin sans session → 401', { tag: '@local-web' }, async ({
    request,
  }) => {
    for (const url of ['/api/admin/overview', '/api/admin/users', '/api/admin/audit']) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(401);
    }
    const post = await request.post('/api/admin/rewards', { data: {} });
    expect(post.status()).toBe(401);
  });

  test('TEST-E2E-ADM-02: /admin sans session → 307 vers /connexion', { tag: '@local-web' }, async ({
    request,
  }) => {
    const res = await request.get('/admin', { maxRedirects: 0 });
    expect([307, 308]).toContain(res.status());
    expect(res.headers()['location'] ?? '').toContain('/connexion');
  });

  test('TEST-E2E-ADM-03: session admin → overview 200 + finances verrouillées sans AAL2', { tag: '@staging-auth' }, async () => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'Identifiants admin de test absents (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD)'
    );

    const tokenRes = await pwRequest.newContext();
    const login = await tokenRes.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json' },
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const session = await login.json();
    await tokenRes.dispose();

    const projectRef = new URL(SUPABASE_URL as string).hostname.split('.')[0];
    const cookieValue = encodeURIComponent(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        user: session.user,
      })
    );
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: {
        cookie: `sb-${projectRef}-auth-token=${cookieValue}`,
        apikey: SUPABASE_ANON_KEY as string,
      },
    });

    const overview = await ctx.get('/api/admin/overview');
    expect(overview.status()).toBe(200);
    const body = await overview.json();
    for (const key of ['products', 'orders', 'users', 'pendingWithdrawals']) {
      expect(typeof body[key]).toBe('number');
    }

    // Corps invalide SANS session AAL2 → 403 mfa_required (garde MFA imposée,
    // avant même la validation zod ; le 400 zod est couvert en unitaire).
    const bad = await ctx.post('/api/admin/rewards', { data: { action: 'nope' } });
    expect(bad.status()).toBe(403);
    expect((await bad.json()).code).toBe('mfa_required');

    // Mutation financière sans AAL2 → 403 (garde MFA avant CSRF et métier).
    const noCsrf = await ctx.post('/api/admin/rewards', {
      data: { action: 'finalize_period', period_id: '00000000-0000-4000-8000-000000000000', eligible_revenue: 1 },
    });
    expect(noCsrf.status()).toBe(403);

    await ctx.dispose();
  });
});
