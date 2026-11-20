import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { test, expect, type APIRequestContext, type BrowserContext, type Route } from '@playwright/test';
import { signJwt } from './support/jwt.mjs';
import { createTestUser, queryRows } from './support/seed.mjs';

/**
 * PLAN-100 2.12 — le parcours que fait une personne : ouvrir le Compas, écrire sa
 * demande dans « Où », lancer « Préparer mon aventure », voir la préparation aboutir
 * et lire le résultat. Voir `playwright.compas.config.ts` pour l'architecture :
 * base réelle du dépôt + PostgREST, GoTrue simulé, services tiers rejoués ou « en
 * panne », aucun accès au réseau externe.
 */
const DOUBLES = process.env.E2E_DOUBLES_URL!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const NEXT_URL = process.env.E2E_NEXT_URL!;
const DATABASE_URL = process.env.DATABASE_URL!;

const isLocal = (u: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);

type LogEntry = { source: string; host: string; path: string; kind: string; status?: number };

/** Tout ce qui sort du navigateur vers un hôte non local est servi par les doublures. */
async function routeExternalToDoubles(context: BrowserContext) {
  await context.route(
    (u) => !isLocal(u) && (u.protocol === 'http:' || u.protocol === 'https:'),
    async (route: Route) => {
      const req = route.request();
      const u = new URL(req.url());
      const target = `${DOUBLES}/__ext/${u.protocol.slice(0, -1)}/${u.host}${u.pathname}${u.search}`;
      const headers: Record<string, string> = { ...req.headers(), 'x-e2e-source': 'browser' };
      delete headers['host'];
      const res = await context.request.fetch(target, {
        method: req.method(),
        headers,
        data: req.postDataBuffer() ?? undefined,
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
    }
  );
}

async function doublesLog(request: APIRequestContext): Promise<LogEntry[]> {
  return (await (await request.get(`${DOUBLES}/__log`)).json()) as LogEntry[];
}

test.describe('Compas — du texte libre au voyage préparé', () => {
  test('« Où » -> « Préparer mon aventure » -> préparation visible -> résultat', async ({ page, context, request }) => {
    const startedAt = new Date().toISOString();
    const userId = randomUUID();
    const email = `e2e-${userId.slice(0, 8)}@test.local`;
    createTestUser(DATABASE_URL, { id: userId, email });

    // Session : cookie `sb-<projet>-auth-token` (celui de @supabase/ssr), jeton signé que la passerelle reconnaît.
    const nowS = Math.floor(Date.now() / 1000);
    const session = {
      access_token: signJwt({ aud: 'authenticated', role: 'authenticated', sub: userId, email, is_anonymous: false, iat: nowS, exp: nowS + 86_400 }),
      refresh_token: 'e2e-refresh',
      token_type: 'bearer',
      expires_in: 86_400,
      expires_at: nowS + 86_400,
      user: { id: userId, aud: 'authenticated', role: 'authenticated', email, is_anonymous: false },
    };
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    await context.addCookies([
      { name: `sb-${ref}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: NEXT_URL },
    ]);
    // Le bandeau de cookies est refusé comme le ferait la personne (aucun traceur).
    await context.addInitScript(() => {
      window.localStorage.setItem('lkdv_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, version: '1' }));
    });
    await routeExternalToDoubles(context);
    await request.post(`${DOUBLES}/__reset`);

    // 1. « Où veux-tu aller ? » : une phrase suffit, rien d'autre à remplir (écran v5, la carte vivante).
    await page.goto('/compas?nouvelle=1');
    await expect(page.getByRole('heading', { name: 'Où veux-tu aller ?' })).toBeVisible();
    const ask = page.getByRole('textbox', { name: 'Ta destination, en une phrase' });
    await ask.fill('3 jours de randonnée dans le Vercors à 2');

    // 2. « C’est parti » : le voyage est créé, la préparation est visible dans l'îlot.
    await page.getByRole('button', { name: 'C’est parti' }).click();
    const island = page.locator('.v5-island');
    await expect(island).toHaveAttribute('data-s', /live|note/, { timeout: 60_000 });

    // 3. Elle aboutit (jamais « arrêtée ») et dit ce qu'elle a écrit.
    await expect(island).toContainText('Ton aventure est prête', { timeout: 100_000 });
    await expect(island).toContainText(/Budget\s+\d+\s*€/);
    await expect(island).toContainText(/\d+ objets? au kit/);
    await expect(island).not.toContainText('La préparation s’est arrêtée');
    await expect(island).not.toContainText('Préparation arrêtée');

    // 4. Le résultat : la card du voyage s'affiche, un lieu réel par jour.
    await island.getByRole('button', { name: 'Voir', exact: true }).click();
    const card = page.locator('.v5-card');
    await expect(card).toContainText('Vercors');
    await expect(card).toContainText('Randonnée');
    await expect(card.getByRole('button', { name: /^Jour 1,/ })).toBeVisible();
    await expect(card.getByRole('button', { name: /^Jour 2,/ })).toBeVisible();
    await expect(card.getByRole('button', { name: /^Jour 3,/ })).toBeVisible();

    // 5. Relu en base (vraie base du dépôt, RLS en vigueur côté API).
    const trip = queryRows(
      DATABASE_URL,
      `select id, status, metadata->'compas'->'autofill_result'->>'success', estimated_budget is not null
         from public.trips where user_id = '${userId}'`
    );
    expect(trip).toHaveLength(1);
    const [tripId, , success, hasBudget] = trip[0].split('|');
    expect(success).toBe('true');
    expect(hasBudget).toBe('t');
    const steps = queryRows(
      DATABASE_URL,
      `select count(*), count(*) filter (where latitude is not null and longitude is not null)
         from public.trip_steps where trip_id = '${tripId}'`
    )[0].split('|').map(Number);
    expect(steps[0]).toBeGreaterThanOrEqual(3);
    expect(steps[1]).toBe(steps[0]);
    expect(
      queryRows(DATABASE_URL, `select role from public.trip_collaborators where trip_id = '${tripId}' and user_id = '${userId}'`)
    ).toEqual(['owner']);
    // Erreurs serveur seulement : les rapports de la CSP (portée `csp`, lot AE) sont rangés dans la même
    // table et en sont séparés, comme dans le rapport quotidien (doublures sur 127.0.0.1 hors CSP).
    expect(
      queryRows(DATABASE_URL, `select count(*) from public.app_errors where at >= '${startedAt}' and scope <> 'csp'`)
    ).toEqual(['0']);

    // 6. Aucun appel imprévu, nulle part : tout le tiers a été rejoué ou déclaré en panne.
    //    Témoin : un hôte inconnu demandé depuis le navigateur reçoit bien le refus des doublures.
    const control = await page.evaluate(async () => {
      try {
        return (await fetch('https://control.invalid/ping')).status;
      } catch {
        return 'bloqué';
      }
    });
    expect(control).toBe(502);
    const log = await doublesLog(request);
    const unexpected = log.filter((e) => e.kind === 'unhandled' && e.host !== 'control.invalid');
    expect(unexpected, `appels imprévus : ${unexpected.map((e) => e.host + e.path).join(', ')}`).toEqual([]);
    expect(log.filter((e) => e.kind === 'supabase').length).toBeGreaterThan(10);
    // L'IA est éteinte (AI_MODE=off) : aucun fournisseur d'IA n'est joint.
    expect(log.filter((e) => /nvidia|openrouter|anthropic/i.test(e.host))).toEqual([]);
  });

  test('le préchargement réseau du serveur refuse tout hôte non prévu', async () => {
    // Même mécanisme que `next start` : un processus Node avec le préchargement.
    const preload = path.join(process.cwd(), 'tests/e2e/compas/support/preload-fetch.cjs');
    const run = (code: string) =>
      execFileSync(process.execPath, ['--require', preload, '-e', code], {
        encoding: 'utf8',
        env: { ...process.env, E2E_DOUBLES_URL: DOUBLES, FORCE_COLOR: '0' },
      }).trim();
    // fetch : réécrit vers les doublures, qui répondent 502 « non prévu » pour un hôte inconnu.
    expect(run(`fetch('https://control.invalid/serveur').then(r => process.stdout.write(String(r.status)))`)).toBe('502');
    // http/https : une bibliothèque qui contournerait fetch est arrêtée net.
    expect(run(`try { require('https').request('https://control.invalid/'); console.log('ouvert'); } catch (e) { console.log(String(e.message).slice(0, 30)); }`)).toBe(
      '[e2e] sortie réseau interdite'
    );
    // L'hôte local reste joignable : c'est ainsi que PostgREST et les doublures répondent.
    expect(run(`fetch('${DOUBLES}/__health').then(r => process.stdout.write(String(r.status)))`)).toBe('200');
  });
});
