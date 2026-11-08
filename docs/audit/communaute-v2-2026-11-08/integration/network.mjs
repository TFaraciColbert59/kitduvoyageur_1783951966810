/**
 * Réseau simulé de la recette d'intégration Communauté v2.
 *
 * `page.route` intercepte TOUT : PostgREST (`/rest/v1/**`), Auth
 * (`/auth/v1/**`), Storage (`/storage/v1/**`) et les origines externes
 * (polices, analytics, tuiles). Aucune requête ne quitte la machine, aucune
 * donnée réelle n'est lue ni écrite.
 *
 * Session synthétique : cookie `sb-<ref>-auth-token` encodé comme le fait
 * `@supabase/ssr` (`base64-` + base64url du JSON de session), posé pour
 * l'origine du serveur local. `AuthContext` lit ce cookie via `getSession()`,
 * puis `user_profiles` est servi par les fixtures : aucun appel réseau réel.
 *
 * ATTENTION ordre des routes : Playwright applique **la dernière route
 * enregistrée en premier** (LIFO). Les routes les plus spécifiques (`rpc/`)
 * doivent donc être enregistrées APRÈS la route générique des tables.
 */

import { SESSION, SESSION_USER, buildFixtures, rpcFixtures } from './fixtures.mjs';

/** URL Supabase compilée dans le build de recette (voir README). */
export const FIXTURE_SUPABASE_URL = 'https://fixture.supabase.co';

export function storageKeyFor(url = FIXTURE_SUPABASE_URL) {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/** Cookie de session conforme à `@supabase/ssr` `cookieEncoding: 'base64url'`. */
export function sessionCookieFor(origin, session = SESSION) {
  const value = `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`;
  return { name: storageKeyFor(), value, url: origin, sameSite: 'Lax' };
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
  'access-control-max-age': '600',
};

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { ...CORS_HEADERS, 'content-profile': 'public', 'content-range': '0-0/*' },
    body: JSON.stringify(body),
  });
}

/** Réponse au préflight CORS (Supabase fictif = origine différente de la page). */
function preflight(route) {
  return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
}

function wantsSingle(request) {
  return (request.headers()['accept'] ?? '').includes('application/vnd.pgrst.object+json');
}

function errorBody(message = 'fixture_error') {
  return { code: 'XX000', message, details: null, hint: null };
}

/**
 * Installe toutes les routes de fixtures.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{mode?: 'normal'|'empty'|'error'|'skeleton', delayMs?: number}} options
 * @returns {{requests: string[]}}
 */
export async function installFixtures(page, options = {}) {
  const mode = options.mode ?? 'normal';
  const delayMs = options.mode === 'skeleton' ? (options.delayMs ?? 2500) : (options.delayMs ?? 0);
  const fixtures = buildFixtures();
  const rpc = rpcFixtures(fixtures);
  const requests = [];

  const delay = async () => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  };

  // 1) Origines externes : jamais de vrai réseau (polices, analytics, tuiles).
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
  });

  // 2) Tables PostgREST (enregistrée avant `rpc/` : la plus spécifique gagne).
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return preflight(route);
    const url = new URL(request.url());
    const table = url.pathname.replace('/rest/v1/', '').split('/')[0] ?? '';
    requests.push(`${request.method()} ${table}`);
    await delay();
    if (mode === 'error') return json(route, 500, errorBody(`fixture:${table}`));
    const rows = fixtures.tables[table];
    if (mode === 'empty' && Array.isArray(rows) && table !== 'user_profiles') {
      return json(route, 200, []);
    }
    if (request.method() === 'GET' || request.method() === 'HEAD') {
      if (rows == null) return json(route, 200, wantsSingle(request) ? {} : []);
      if (wantsSingle(request)) {
        const single = Array.isArray(rows) ? rows[0] : rows;
        return json(route, 200, single ?? {});
      }
      return json(route, 200, Array.isArray(rows) ? rows : [rows]);
    }
    if (request.method() === 'DELETE') return json(route, 204, null);
    if (wantsSingle(request)) {
      return json(route, 201, Array.isArray(rows) ? (rows[0] ?? {}) : rows);
    }
    return json(route, 201, Array.isArray(rows) ? rows : [rows]);
  });

  // 3) Auth Supabase.
  await page.route('**/auth/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const url = new URL(route.request().url());
    requests.push(`auth ${url.pathname}`);
    if (url.pathname.endsWith('/user')) return json(route, 200, SESSION_USER);
    if (url.pathname.includes('/token')) return json(route, 200, SESSION);
    if (url.pathname.endsWith('/logout')) return json(route, 204, null);
    return json(route, 200, {});
  });

  // 4) RPC PostgREST (doit précéder la route générique des tables).
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return preflight(route);
    const name = new URL(request.url()).pathname.split('/').pop() ?? '';
    requests.push(`rpc ${name}`);
    await delay();
    if (mode === 'error') return json(route, 500, errorBody(`fixture:${name}`));
    const value = rpc[name];
    if (value === undefined) return json(route, 200, []);
    if (mode === 'empty' && Array.isArray(value)) return json(route, 200, []);
    if (mode === 'empty' && name === 'community_events_agenda') {
      return json(
        route,
        200,
        fixtures.agendaRows.map((row) => ({ ...row, events_count: 0 })),
      );
    }
    return json(route, 200, value);
  });

  // 5) Storage : aucune image réelle (les composants retombent sur leur repli).
  await page.route('**/storage/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    return json(route, 404, errorBody('no_object'));
  });

  return { requests, fixtures };
}
