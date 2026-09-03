import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * E2E léger — endpoint de diagnostic IA /api/ai/ping.
 * - Sans session : 401 toujours (serveur de prod via `npm start`).
 * - Avec session admin : 200 — exécuté uniquement si TEST_ADMIN_EMAIL et
 *   TEST_ADMIN_PASSWORD sont fournis (jamais commités).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

test.describe('GET /api/ai/ping — diagnostic routeur IA', () => {
  test('TEST-E2E-AI-01: 401 sans session', async ({ request }) => {
    const res = await request.get('/api/ai/ping');
    expect(res.status()).toBe(401);

    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('TEST-E2E-AI-02: 200 avec session admin', async () => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'Identifiants admin de test absents (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD)'
    );

    // Login Supabase (password grant) puis injection du cookie @supabase/ssr.
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
    const res = await ctx.get('/api/ai/ping');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ultra).toHaveProperty('ok');
    expect(body.ultra).toHaveProperty('ms');
    expect(body.ultra).toHaveProperty('degraded');
    expect(body.nano).toHaveProperty('ok');
    await ctx.dispose();
  });
});
