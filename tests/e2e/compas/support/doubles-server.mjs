// Serveur de doublures du parcours E2E du Compas (aucune dépendance).
//
// Tout ce qui sort de la machine pendant le test arrive ici, sous
// `/__ext/<schéma>/<hôte>/<chemin>` :
//  - côté serveur Next : le préchargement `preload-fetch.cjs` réécrit chaque
//    `fetch` vers un hôte non local ;
//  - côté navigateur : `page.route` (voir le test) fait la même réécriture.
//
// Trois sortes de réponses :
//  1. l'hôte Supabase du projet -> passerelle : `/auth/v1/user` (GoTrue, jeton
//     signé par le test) et `/rest/v1/*` vers un vrai PostgREST branché sur la vraie
//     base du dépôt (schéma, RLS, déclencheurs, fonctions). Les clés `anon` et
//     `service_role` de l'application sont remplacées par des jetons signés,
//     comme le ferait Kong ;
//  2. un hôte tiers dont le test possède une CAPTURE réelle (dossier
//     `fixtures/captures`) -> la réponse enregistrée telle quelle ;
//  3. un hôte tiers déclaré « en panne » (`DOWN_HOSTS`) -> 503, comme un service
//     gratuit qui ne répond pas : le Compas dit alors son repli ;
//  4. tout autre hôte -> 502 « non prévu » ET une ligne `kind: "unhandled"` dans
//     le journal : le test échoue si un appel imprévu a lieu.
//
// Journal : GET /__log ; remise à zéro : POST /__reset ; santé : GET /__health.
import http from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_JWT_SECRET, signJwt, verifyJwt } from './jwt.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_DOUBLES_PORT ?? 4040);
const POSTGREST = process.env.E2E_POSTGREST_URL ?? 'http://127.0.0.1:3001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ci-build-placeholder.supabase.co';
const SUPABASE_HOST = new URL(SUPABASE_URL).host;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'e2e-service-role-key';

/** Services gratuits que le Compas interroge et que ce test ne rejoue pas : « en panne ». */
const DOWN_HOSTS = new Set([
  'nominatim.openstreetmap.org',
  'overpass-api.de',
  'overpass.private.coffee',
  'overpass.kumi.systems',
  'maps.mail.ru',
  'api.geoapify.com',
  'valhalla1.openstreetmap.de',
  'routing.openstreetmap.de',
  'router.project-osrm.org',
  'brouter.de',
  'api.open-meteo.com',
  'power.larc.nasa.gov',
  'api.frankfurter.dev',
  'api.frankfurter.app',
  'api.frankfurter.com',
  's3.amazonaws.com',
  'ourairports.com',
  'davidmegginson.github.io',
  'api.travelpayouts.com',
  'meteoalarm.org',
  'feeds.meteoalarm.org',
  'api.viator.com',
  'api.bridgeapp.io',
]);

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/** Captures réelles : { host, path, query?, status?, contentType?, body, capturedAt, source }. */
const captures = [];
const capDir = path.join(here, '..', 'fixtures', 'captures');
try {
  for (const f of readdirSync(capDir)) {
    if (f.endsWith('.json')) captures.push({ file: f, ...JSON.parse(readFileSync(path.join(capDir, f), 'utf8')) });
  }
} catch {
  /* aucun dossier : aucune capture */
}

const log = [];
const record = (entry) => log.push({ t: Date.now(), ...entry });

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': '*',
  };
}

function send(res, status, headers, body) {
  res.writeHead(status, { ...corsHeaders(), ...headers });
  res.end(body);
}

const json = (res, status, obj) => send(res, status, { 'content-type': 'application/json' }, JSON.stringify(obj));

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

/* ---------------------------------------------------------------- Supabase */

function bearerOf(req) {
  const auth = req.headers.authorization ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers.apikey ?? '');
}

/** Le jeton que PostgREST doit voir, ou null (refusé), comme le ferait la passerelle. */
function gatewayToken(req) {
  const given = bearerOf(req);
  const nowS = Math.floor(Date.now() / 1000);
  if (given && given === SERVICE_KEY) return signJwt({ role: 'service_role', iss: 'e2e', exp: nowS + 3600 });
  if (!given || given === ANON_KEY) return signJwt({ role: 'anon', iss: 'e2e', exp: nowS + 3600 });
  return verifyJwt(given) ? given : null;
}

function userFrom(claims) {
  return {
    id: claims.sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: claims.email ?? null,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '',
    is_anonymous: claims.is_anonymous === true,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

async function supabase(req, res, rest, url) {
  if (req.method === 'OPTIONS') return send(res, 204, {}, '');
  if (rest === '/auth/v1/user') {
    const claims = verifyJwt(bearerOf(req));
    if (!claims || !claims.sub) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    return json(res, 200, userFrom(claims));
  }
  if (rest.startsWith('/auth/v1/')) {
    // Renouvellement, déconnexion, etc. : hors du parcours ; un refus net, jamais un faux succès.
    return json(res, 400, { code: 400, error_code: 'not_supported', msg: 'non pris en charge par la doublure' });
  }
  if (rest.startsWith('/rest/v1/')) {
    const token = gatewayToken(req);
    if (!token) return json(res, 401, { message: 'Invalid API key', hint: 'jeton inconnu de la doublure' });
    const body = ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : await readBody(req);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (['host', 'connection', 'content-length', 'authorization', 'apikey', 'origin', 'referer', 'x-e2e-source'].includes(k)) continue;
      if (typeof v === 'string') headers[k] = v;
    }
    headers.authorization = `Bearer ${token}`;
    const target = new URL(POSTGREST);
    return new Promise((resolve) => {
      const upstream = http.request(
        { host: target.hostname, port: target.port, method: req.method, path: rest.slice('/rest/v1'.length) + url.search, headers },
        (r) => {
          const out = {};
          for (const [k, v] of Object.entries(r.headers)) if (!['connection', 'transfer-encoding'].includes(k) && v != null) out[k] = v;
          res.writeHead(r.statusCode ?? 502, { ...corsHeaders(), ...out });
          r.pipe(res);
          r.on('end', resolve);
        }
      );
      upstream.on('error', (e) => {
        json(res, 502, { message: `PostgREST injoignable : ${e.message}` });
        resolve();
      });
      if (body && body.length) upstream.write(body);
      upstream.end();
    });
  }
  return json(res, 404, { message: 'chemin Supabase non prévu par la doublure', path: rest });
}

/* ------------------------------------------------------------------ tiers */

function isTileRequest(host, pathname) {
  return /\.(png|jpe?g|webp|pbf|mvt)$/i.test(pathname) || /\/tile\//i.test(pathname) || /tile|basemaps|arcgisonline/i.test(host);
}

function thirdParty(req, res, scheme, host, rest, url) {
  const source = req.headers['x-e2e-source'] === 'browser' ? 'browser' : 'server';
  const cap = captures.find(
    (c) =>
      c.host === host &&
      rest.startsWith(c.path) &&
      Object.entries(c.query ?? {}).every(([k, v]) => url.searchParams.get(k) === v)
  );
  if (cap) {
    record({ source, host, path: rest, kind: 'captured', file: cap.file, status: cap.status ?? 200 });
    return send(res, cap.status ?? 200, { 'content-type': cap.contentType ?? 'application/json; charset=utf-8' }, JSON.stringify(cap.body));
  }
  if (source === 'browser' && isTileRequest(host, rest)) {
    record({ source, host, path: rest, kind: 'tile', status: 200 });
    return send(res, 200, { 'content-type': 'image/png' }, PIXEL_PNG);
  }
  if (DOWN_HOSTS.has(host)) {
    record({ source, host, path: rest, kind: 'down', status: 503 });
    return json(res, 503, { error: 'service indisponible (doublure de test)' });
  }
  record({ source, host, path: rest, query: url.search.slice(0, 200), kind: 'unhandled', status: 502 });
  return json(res, 502, { error: `hôte non prévu par la doublure : ${host}` });
}

/* ----------------------------------------------------------------- serveur */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://doubles.local');
    if (url.pathname === '/__health') return json(res, 200, { ok: true, captures: captures.length });
    if (url.pathname === '/__log') return json(res, 200, log);
    if (url.pathname === '/__reset') {
      log.length = 0;
      return json(res, 200, { ok: true });
    }
    const m = /^\/__ext\/(https?)\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (!m) return json(res, 404, { error: 'chemin inconnu' });
    const [, scheme, host, restRaw] = m;
    const rest = restRaw ?? '/';
    if (host === SUPABASE_HOST) {
      const source = req.headers['x-e2e-source'] === 'browser' ? 'browser' : 'server';
      record({ source, host, path: rest.split('?')[0], method: req.method, kind: 'supabase' });
      return await supabase(req, res, rest, url);
    }
    if (req.method === 'OPTIONS') return send(res, 204, {}, '');
    return thirdParty(req, res, scheme, host, rest, url);
  } catch (e) {
    return json(res, 500, { error: String(e?.message ?? e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.info(`[doubles] http://127.0.0.1:${PORT} — ${captures.length} captures, hôte Supabase ${SUPABASE_HOST}`);
});

export { E2E_JWT_SECRET };
