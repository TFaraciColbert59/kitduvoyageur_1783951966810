#!/usr/bin/env node
/** Real GoTrue + PostgREST, bound to loopback, exclusively on the isolated clone. */
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const container = 'lkdv-v2-test';
const database = 'lkdv_producers';
const network = 'lkdv-v2-test-net';
const dir = '/tmp/lkdv-v2-db';
const stateFile = `${dir}/local-api-state.json`;
const authImage = 'supabase/gotrue@sha256:6a916b47af0386b7e0152ca84f3d45d050bf056e449a75a5460b48742fd67822';
const restImage = 'postgrest/postgrest@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2';
fs.mkdirSync(dir, { recursive: true });
const state = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  : { secret: crypto.randomBytes(48).toString('hex') };
fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
const command = (args, input) => {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`Docker ${args[0]} failed: ${r.stderr}`);
  return r.stdout;
};
const sql = (text, db = database) => command([
  'exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-At',
], text);
const jwt = (role) => {
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase', exp: Math.floor(Date.now() / 1000) + 86400 })}`;
  return `${data}.${crypto.createHmac('sha256', state.secret).update(data).digest('base64url')}`;
};
const start = (name, image, port, env) => {
  const existing = spawnSync('docker', ['inspect', name], { encoding: 'utf8' });
  if (existing.status === 0) {
    const info = JSON.parse(existing.stdout)[0];
    if (info.Config.Labels?.['lkdv.local-api'] !== 'producers') throw new Error(`Refusing unmanaged container ${name}`);
    if (Object.entries(env).some(([key, value]) => !info.Config.Env.includes(`${key}=${value}`))) {
      throw new Error(`Managed local container configuration mismatch: ${name}`);
    }
    command(['start', name]);
    return;
  }
  command(['run', '-d', '--name', name, '--label', 'lkdv.local-api=producers', '--network', network,
    '-p', `127.0.0.1:${port}:${port}`, ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), image]);
};
const ready = async (url) => {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch { /* bounded startup retry */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Local API not ready: ${url}`);
};

// Never read the project's production environment. These credentials are local fixtures.
if (sql("SELECT datname FROM pg_database WHERE datname='lkdv_producers'", 'postgres').trim() !== database) {
  throw new Error('Dedicated empty database lkdv_producers must be provisioned by the local DB workflow');
}
sql('CREATE SCHEMA IF NOT EXISTS auth;');
sql('ALTER DATABASE lkdv_producers SET search_path=auth,public,extensions;');
start('lkdv-v2-auth', authImage, 54382, {
  GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '54382',
  GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://postgres:lkdv-local-only@${container}:5432/${database}?sslmode=disable`,
  GOTRUE_DB_NAMESPACE: 'auth', API_EXTERNAL_URL: 'http://127.0.0.1:54381/auth/v1',
  GOTRUE_SITE_URL: 'http://127.0.0.1:54381', GOTRUE_JWT_SECRET: state.secret,
  GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated',
  GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_DISABLE_SIGNUP: 'false',
  GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true',
});
await ready('http://127.0.0.1:54382/health');

// pg_dump --schema omits extension declarations. Match the source's public
// extensions so its actual column types and index operator classes exist.
  const extensions = command(['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
    "SELECT extname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='public' ORDER BY extname"])
    .trim().split('\n').filter(Boolean);
  for (const extension of extensions) {
    if (!/^[a-z_][a-z0-9_-]*$/.test(extension)) throw new Error('Unexpected extension identifier');
    sql(`CREATE EXTENSION IF NOT EXISTS "${extension}" WITH SCHEMA public;`);
  }
if (sql("SELECT to_regclass('public.progression_rules') IS NOT NULL").trim() !== 't') {
  // GoTrue first creates its complete official auth schema. Restore the application's
  // actual public schema, grants, RLS, source triggers and seeded rules unchanged.
  const helpers = command(['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
    "SELECT pg_get_functiondef(p.oid)||';' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname IN ('uid','role','jwt')"]);
  sql(helpers);
  const dumpFile = `${dir}/producers-public.sql`;
  if (!fs.existsSync(dumpFile)) throw new Error('Missing isolated schema-and-seed dump producers-public.sql');
  const dump = fs.readFileSync(dumpFile, 'utf8').replace(/^CREATE SCHEMA public;$/m, '');
  sql(`BEGIN;\n${dump}\nCOMMIT;`);
  const authTriggers = command(['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-c',
    "SELECT pg_get_triggerdef(t.oid)||';' FROM pg_trigger t WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal"]);
  sql(authTriggers);
}
// The isolated --no-acl dump omits Supabase's infrastructure service grants.
// This suite uses service_role only; user grants/RLS are not widened here.
sql('GRANT USAGE ON SCHEMA public,auth TO service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role; GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;');
start('lkdv-v2-rest', restImage, 54383, {
  PGRST_DB_URI: `postgres://authenticator:lkdv-local-api-only@${container}:5432/${database}`,
  PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: state.secret,
  PGRST_SERVER_PORT: '54383', PGRST_LOG_LEVEL: 'warn',
});
await ready('http://127.0.0.1:54383/');

// A transport-only local gateway preserves normal Supabase client paths.
// JWT verification and user creation are performed by the official services.
const gateway = http.createServer((request, response) => {
  const isAuth = request.url.startsWith('/auth/v1/');
  const prefix = isAuth ? '/auth/v1' : '/rest/v1';
  if (!request.url.startsWith(prefix)) { response.writeHead(404); response.end(); return; }
  const upstream = http.request({ hostname: '127.0.0.1', port: isAuth ? 54382 : 54383,
    method: request.method, path: request.url.slice(prefix.length) || '/', headers: request.headers,
  }, (result) => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
  upstream.on('error', () => { response.writeHead(502); response.end('local upstream unavailable'); });
  request.pipe(upstream);
});
await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(54381, '127.0.0.1', resolve); });
console.log('Real local API: localhost:54381 → GoTrue:54382 / PostgREST:54383 → lkdv_producers');
try {
  const auth = await fetch('http://127.0.0.1:54381/auth/v1/health');
  if (!auth.ok) throw new Error('Gateway auth health failed');
  const rules = await fetch('http://127.0.0.1:54381/rest/v1/progression_rules?active=eq.true&select=version', {
    headers: { Authorization: `Bearer ${jwt('service_role')}` },
  });
  if (!rules.ok) throw new Error(`Real REST rules query failed: ${rules.status} ${await rules.text()}`);
  console.log('Real Auth health and authenticated SQL REST query verified');
  const resultFile = `${dir}/producers-http-tests.json`;
  const child = spawn('node_modules/.bin/vitest', ['run', 'tests/phase1/producers.integration.spec.ts',
    '--reporter=default', '--reporter=json', `--outputFile=${resultFile}`], {
    stdio: 'inherit', env: { ...process.env, PHASE1_PRODUCERS_E2E: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54381', SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
    },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code) => resolve(code ?? 1)); });
  console.log(`Real HTTP test report: ${resultFile}; exit ${process.exitCode}`);
} finally {
  await new Promise((resolve) => gateway.close(resolve));
}
