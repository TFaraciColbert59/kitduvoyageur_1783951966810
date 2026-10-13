/** Plan 2.11 : les rapports de la CSP sont collectés, sans donnée personnelle, avec limites. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, noClient: false, insertError: false }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: () =>
    h.noClient
      ? null
      : {
          from: (table: string) => ({
            insert: async (row: Record<string, unknown>) => {
              if (h.insertError) return { error: { code: '42501' } };
              h.rows.push({ table, ...row });
              return { error: null };
            },
          }),
        },
}));
// Compteurs en mémoire : le test ne dépend d'aucun serveur.
vi.mock('@/lib/rate-limit/postgresStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/postgresStore')>()),
  readPostgresEnv: () => ({}),
}));
vi.mock('@/lib/rate-limit/upstashStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/upstashStore')>()),
  readUpstashEnv: () => ({}),
}));

import { resetMemoryRateLimits } from '@/lib/rate-limit';
import { POST } from '@/app/api/csp-report/route';
import {
  CSP_MAX_BODY_BYTES,
  cspMessage,
  normalizeBlocked,
  normalizeDirective,
  normalizePage,
  parseCspReports,
} from '@/lib/security/cspReport';

const classic = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    'csp-report': {
      'document-uri': 'https://lekitduvoyageur.fr/voyages/mon-voyage-prive?token=secret#x',
      'violated-directive': "img-src 'self' data: blob: https:",
      'effective-directive': 'img-src',
      'blocked-uri': 'http://cdn.example.org/a/b/c.png?u=jean@example.org',
      disposition: 'report',
      'script-sample': 'jean@example.org',
      'original-policy': "default-src 'self'",
      ...over,
    },
  });

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('https://lekitduvoyageur.fr/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': '203.0.113.7', ...headers },
    body,
  });
}

beforeEach(() => {
  h.rows = [];
  h.noClient = false;
  h.insertError = false;
  resetMemoryRateLimits();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('lecture d’un rapport', () => {
  it('ne garde que la directive, l’hôte bloqué, la première partie de la page et la disposition', () => {
    const [v] = parseCspReports(classic());
    expect(v).toEqual({ directive: 'img-src', disposition: 'report', blocked: 'cdn.example.org', page: '/voyages' });
    expect(cspMessage(v)).toBe('report cdn.example.org /voyages');
    const flat = JSON.stringify(v);
    for (const secret of ['token', 'secret', 'jean', 'mon-voyage-prive', 'c.png']) expect(flat).not.toContain(secret);
  });

  it('lit aussi la forme de la Reporting API', () => {
    const body = JSON.stringify([
      {
        type: 'csp-violation',
        age: 3,
        url: 'https://lekitduvoyageur.fr/compas',
        body: {
          documentURL: 'https://lekitduvoyageur.fr/compas?etape=kit',
          effectiveDirective: 'connect-src',
          blockedURL: 'https://tiles.example.net/style.json',
          disposition: 'enforce',
          sample: 'secret',
        },
      },
      { type: 'deprecation', body: { documentURL: 'https://lekitduvoyageur.fr/' } },
    ]);
    expect(parseCspReports(body)).toEqual([
      { directive: 'connect-src', disposition: 'enforce', blocked: 'tiles.example.net', page: '/compas' },
    ]);
  });

  it('range les cas particuliers sous un mot, jamais sous une valeur libre', () => {
    expect(normalizeBlocked('')).toBe('inline');
    expect(normalizeBlocked('inline')).toBe('inline');
    expect(normalizeBlocked('eval')).toBe('eval');
    expect(normalizeBlocked('data')).toBe('data');
    expect(normalizeBlocked('moz-extension://abc/x.js')).toBe('extension');
    expect(normalizeBlocked('chrome-extension://abc/x.js')).toBe('extension');
    expect(normalizeBlocked('pas une url')).toBe('autre');
    expect(normalizeDirective("script-src-elem 'self'")).toBe('script-src-elem');
    expect(normalizeDirective('Voici du texte libre; drop table')).toBe('autre');
    expect(normalizeDirective(undefined)).toBe('autre');
    expect(normalizePage('https://lekitduvoyageur.fr/')).toBe('/');
    expect(normalizePage('https://lekitduvoyageur.fr/k/AbC123TokenSecret')).toBe('/k');
    expect(normalizePage('n’importe quoi')).toBe('/autre');
  });

  it('refuse ce qui n’a la forme d’aucun rapport', () => {
    expect(parseCspReports('')).toEqual([]);
    expect(parseCspReports('pas du json')).toEqual([]);
    expect(parseCspReports('{"a":1}')).toEqual([]);
    expect(parseCspReports('x'.repeat(CSP_MAX_BODY_BYTES + 1))).toEqual([]);
  });
});

describe('POST /api/csp-report', () => {
  it('range une ligne app_errors (scope csp, code = directive) et répond 204', async () => {
    const res = await POST(request(classic()));
    expect(res.status).toBe(204);
    expect(h.rows).toEqual([
      { table: 'app_errors', scope: 'csp', code: 'img-src', message: 'report cdn.example.org /voyages' },
    ]);
  });

  it('une adresse IP bloquée dans le rapport est rédigée comme dans app_errors', async () => {
    await POST(request(classic({ 'blocked-uri': 'http://192.168.1.20:3000/x' })));
    expect(h.rows[0].message).toBe('report [ip] /voyages');
  });

  it('corps illisible : 400, rien d’écrit ; corps trop gros : 413', async () => {
    expect((await POST(request('pas du json'))).status).toBe(400);
    expect((await POST(request('{}'.padEnd(CSP_MAX_BODY_BYTES + 5, ' ')))).status).toBe(413);
    expect((await POST(request(classic(), { 'content-length': String(CSP_MAX_BODY_BYTES + 1) }))).status).toBe(413);
    expect(h.rows).toEqual([]);
  });

  it('limite par adresse : 60 rapports, puis 429 sans écriture', async () => {
    for (let i = 0; i < 60; i++) expect((await POST(request(classic()))).status).toBe(204);
    const res = await POST(request(classic()));
    expect(res.status).toBe(429);
    expect(h.rows).toHaveLength(60);
    // Une autre adresse n’est pas touchée.
    expect((await POST(request(classic(), { 'x-forwarded-for': '198.51.100.9' }))).status).toBe(204);
  });

  it('plafond du site : au-delà de 2 000 lignes par jour, on laisse tomber (204, rien d’écrit)', async () => {
    for (let i = 0; i < 2_000; i++) {
      // Une adresse publique différente à chaque rapport : seule la limite du site peut les arrêter.
      const res = await POST(request(classic(), { 'x-forwarded-for': `198.51.${Math.floor(i / 250)}.${(i % 250) + 1}` }));
      expect(res.status).toBe(204);
    }
    expect(h.rows).toHaveLength(2_000);
    const res = await POST(request(classic(), { 'x-forwarded-for': '198.51.100.77' }));
    const written = 2_000;
    expect(res.status).toBe(204);
    expect(h.rows).toHaveLength(written);
  });

  it('base injoignable ou écriture refusée : 204 quand même, jamais d’échec visible', async () => {
    h.noClient = true;
    expect((await POST(request(classic()))).status).toBe(204);
    h.noClient = false;
    h.insertError = true;
    expect((await POST(request(classic()))).status).toBe(204);
    expect(h.rows).toEqual([]);
  });
});

describe('la politique vise bien cette route', () => {
  it('report-uri pointe vers /api/csp-report, qui existe, et la CSP reste en observation', async () => {
    const config = (await import('../../next.config.mjs')).default as { headers: () => Promise<Array<{ headers: Array<{ key: string; value: string }> }>> };
    const all = (await config.headers()).flatMap((r) => r.headers);
    const policy = all.find((x) => x.key === 'Content-Security-Policy-Report-Only');
    expect(policy?.value).toContain('report-uri /api/csp-report');
    expect(policy?.value).not.toContain('/api/telemetry/hub');
    expect(existsSync(resolve(__dirname, '../../src/app/api/csp-report/route.ts'))).toBe(true);
    // Le mode appliqué n'est pas en place : il attend une semaine de rapports lue (plan 2.11).
    expect(all.some((x) => x.key === 'Content-Security-Policy')).toBe(false);
  });

  it('la migration garde les violations CSP hors du seuil « erreurs serveur » et expose le résumé', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261013004818_hotfix.sql'), 'utf8');
    expect(sql).toContain("count(*) filter (where a.scope <> 'csp')");
    expect(sql).toContain('csp_report_summary');
    expect(sql).toMatch(/grant execute on function public\.csp_report_summary\(integer\) to service_role/);
    expect(sql).not.toMatch(/\bdelete\b/i);
  });
});
