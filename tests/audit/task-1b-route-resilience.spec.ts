import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import { attachPageDiagnostics } from '../../scripts/audit/audit_runtime.mjs';
import { buildCampaignAuditReport } from '../../scripts/audit/contrast_audit_core.mjs';
import * as contrast from '../../scripts/audit/measure_contrast_v2.mjs';

type Listener = (...args: any[]) => void;
type RequestOptions = {
  method?: string;
  url?: string;
  failure?: string;
  resourceType?: string;
  headers?: Record<string, string>;
};
type ResponseOptions = {
  method?: string;
  url?: string;
  status?: number;
  resourceType?: string;
};

const baseUrl = 'http://localhost:3000';
const speedInsightsPath = '/_vercel/speed-insights/script.js';
const contrastApi = contrast as typeof contrast & Record<string, any>;
const runtimeApi = runtime as typeof runtime & Record<string, any>;

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function makeRequest({
  method = 'GET',
  url = `${baseUrl}/resource`,
  failure = 'net::ERR_ABORTED',
  resourceType = 'fetch',
  headers = {},
}: RequestOptions = {}) {
  return {
    method: () => method,
    url: () => url,
    failure: () => ({ errorText: failure }),
    resourceType: () => resourceType,
    headers: () => headers,
  };
}

function makeResponse({
  method = 'GET',
  url = `${baseUrl}/missing`,
  status = 404,
  resourceType = 'document',
}: ResponseOptions = {}) {
  return {
    status: () => status,
    url: () => url,
    request: () => makeRequest({ method, url, resourceType }),
  };
}

function makeConsole(text: string, url = '') {
  return {
    type: () => 'error',
    text: () => text,
    location: () => ({ url }),
  };
}

function createPage() {
  const listeners = new Map<string, Listener>();
  const page = {
    on(event: string, listener: Listener) {
      listeners.set(event, listener);
    },
    off(event: string) {
      listeners.delete(event);
    },
  };
  return {
    page,
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.(...args);
    },
  };
}

function navigationPage(finalUrl: string, status: number) {
  let currentUrl = `${baseUrl}/requested`;
  return {
    url: () => currentUrl,
    async goto() {
      currentUrl = finalUrl;
      return { status: () => status };
    },
  };
}

describe('Task 1B — diagnostics runtime', () => {
  it('sépare les erreurs fatales des warnings console et rend visibles les mutations', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('pageerror', new Error('page failure'));
    emitted.emit('requestfailed', makeRequest({ failure: 'net::ERR_CONNECTION_REFUSED' }));
    emitted.emit('console', makeConsole('Uncaught TypeError'));

    expect(diagnostics.errors.map((entry: { type: string }) => entry.type)).toEqual(['pageerror', 'requestfailed']);
    expect(diagnostics.warnings).toHaveLength(1);
    expect(diagnostics.warnings[0]).toMatchObject({ type: 'console' });
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    diagnostics.dispose();
  });

  it('ignore globalement les aborted PrefetchRoutes et Supabase GET/HEAD, jamais les mutations', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/explorer`,
      headers: { 'next-router-prefetch': '1' },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: { rsc: '1', 'next-router-prefetch': '1' },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}${speedInsightsPath}`,
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}${speedInsightsPath}`,
      method: 'HEAD',
    }));
    emitted.emit('requestfailed', makeRequest({
      url: 'https://project.supabase.co/rest/v1/thing',
    }));
    emitted.emit('requestfailed', makeRequest({
      url: 'https://project.supabase.co/rest/v1/thing',
      method: 'POST',
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/prefetch-without-header`,
    }));

    expect(diagnostics.errors).toHaveLength(2);
    expect(diagnostics.errors.map((entry: { type: string }) => entry.type)).toEqual(['requestfailed', 'requestfailed']);
    diagnostics.dispose();
  });

  it('ignore seulement le 404 SpeedInsights exact et laisse les autres statuts, paths et méthodes fatals', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('response', makeResponse({ url: `${baseUrl}${speedInsightsPath}` }));
    emitted.emit('response', makeResponse({ url: `${baseUrl}${speedInsightsPath}`, method: 'HEAD' }));
    emitted.emit('response', makeResponse({ url: `${baseUrl}${speedInsightsPath}.other` }));
    emitted.emit('response', makeResponse({ url: `${baseUrl}${speedInsightsPath}`, status: 500 }));
    emitted.emit('response', makeResponse({ url: `${baseUrl}${speedInsightsPath}`, method: 'POST' }));
    emitted.emit('console', makeConsole('Failed to load resource: 404 (Not Found)', `${baseUrl}${speedInsightsPath}`));

    expect(diagnostics.errors).toHaveLength(3);
    expect(diagnostics.warnings).toHaveLength(0);
    expect(diagnostics.errors.every((entry: { type: string }) => entry.type === 'http')).toBe(true);
    diagnostics.dispose();
  });

  it('laisse le 404 document attendu à la sémantique de route, sans erreur runtime', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, {
      baseUrl,
      expected404Path: '/dev/glass',
    });

    emitted.emit('response', makeResponse({ url: `${baseUrl}/dev/glass`, status: 404 }));
    emitted.emit('console', makeConsole('Failed to load resource: 404 (Not Found)', `${baseUrl}/dev/glass`));

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings).toHaveLength(0);
    diagnostics.dispose();
  });

  it('conserve une erreur console inattendue comme warning sans bloquer la mesure', () => {
    const emitted = createPage();
    const diagnostics = attachPageDiagnostics(emitted.page, { baseUrl });

    emitted.emit('console', makeConsole('Unexpected application error'));

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings).toHaveLength(1);
    expect(() => diagnostics.assertClean()).not.toThrow();
    expect(runtimeApi.isDiagnosticDegraded?.(diagnostics)).toBe(true);
    diagnostics.dispose();
  });
});

describe('Task 1B — route semantics', () => {
  it('expose les métadonnées explicites des redirections et 404 attendus', () => {
    expect(contrastApi.ROUTE_EXPECTATIONS).toMatchObject({
      '/preparer-randonnee': { kind: 'redirect', finalPath: '/hub' },
      '/admin': { kind: 'redirect', finalPath: '/', reason: 'missing_admin_role' },
      '/admin/produits': { kind: 'redirect', finalPath: '/', reason: 'missing_admin_role' },
      '/dev/glass': { kind: 'http', status: 404 },
      '/dev/style': { kind: 'http', status: 404 },
      '/route-inexistante-pour-tester-404': { kind: 'http', status: 404 },
    });
  });

  it('accepte les routes attendues et refuse tout redirect ou statut inconnu', async () => {
    expect(typeof contrastApi.assertRouteNavigation).toBe('function');
    if (typeof contrastApi.assertRouteNavigation !== 'function') return;

    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/hub`, 200),
      baseUrl,
      '/preparer-randonnee',
    )).resolves.toMatchObject({ expected: true, finalPath: '/hub', reason: 'expected_legacy_redirect' });
    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/`, 200),
      baseUrl,
      '/admin/produits',
    )).resolves.toMatchObject({ expected: true, finalPath: '/', reason: 'missing_admin_role' });
    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/dev/glass`, 404),
      baseUrl,
      '/dev/glass',
    )).resolves.toMatchObject({ expected: true, status: 'expected_404' });

    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/inconnu`, 200),
      baseUrl,
      '/preparer-randonnee',
    )).rejects.toThrow(/URL finale|redirection/i);
    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/dev/glass`, 500),
      baseUrl,
      '/dev/glass',
    )).rejects.toThrow(/HTTP 500/);
    await expect(contrastApi.assertRouteNavigation(
      navigationPage(`${baseUrl}/compte?tab=autre`, 200),
      baseUrl,
      '/compte?tab=parametres',
    )).rejects.toThrow(/URL finale/);
  });

  it('conserve les mesures valides lorsqu’une autre route est en erreur', () => {
    expect(typeof runtimeApi.aggregateRouteOutcomes).toBe('function');
    if (typeof runtimeApi.aggregateRouteOutcomes !== 'function') return;

    const aggregate = runtimeApi.aggregateRouteOutcomes([
      { id: 'ok', measured: true, nodes: [{ status: 'pass' }] },
      { id: 'produit', measured: false, error: 'HTTP 500' },
    ]);

    expect(aggregate.measured.map((entry: { id: string }) => entry.id)).toEqual(['ok']);
    expect(aggregate.errors).toEqual([{ id: 'produit', error: 'HTTP 500' }]);

    const report = buildCampaignAuditReport({
      findings: [{ routeId: 'ok', counts: { pass: 1, contrast_fail: 0, unknown: 0, occluded: 0 } }],
      errors: [{ route: 'produit', message: 'HTTP 500' }],
      expectedRouteCount: 2,
      completedRouteCount: 1,
      liveVerified: false,
    });
    expect(report.findings).toHaveLength(1);
    expect(report.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });
});

describe('Task 1B — configuration et contexts', () => {
  it('retire les trois redirections canoniques sans toucher aux legacies', () => {
    const config = source('next.config.mjs');

    expect(config).not.toMatch(/source:\s*['"]\/boutique['"]/);
    expect(config).not.toMatch(/source:\s*['"]\/manifeste['"]/);
    expect(config).not.toMatch(/source:\s*['"]\/carte-interactive['"]/);
    expect(config).toMatch(/source:\s*['"]\/voyage-ia['"]/);
  });

  it('utilise un user agent desktop explicite avec le viewport mobile dans les trois runners', () => {
    for (const file of [
      'scripts/audit/measure_contrast_v2.mjs',
      'scripts/audit/measure_key_screens_matrix.mjs',
      'scripts/audit/run_audit_campaign.mjs',
    ]) {
      const content = source(file);
      expect(content).toContain('userAgent: AUDIT_USER_AGENT');
      expect(content).toContain('viewport: { width: 390, height: 844 }');
    }
  });
});
