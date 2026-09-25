import { describe, expect, it } from 'vitest';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import * as contrast from '../../scripts/audit/measure_contrast_v2.mjs';
import * as matrix from '../../scripts/audit/measure_key_screens_matrix.mjs';
import * as campaign from '../../scripts/audit/run_audit_campaign.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';
const speedInsightsPath = '/_vercel/speed-insights/script.js';
const contrastApi = contrast as typeof contrast & Record<string, any>;
const matrixApi = matrix as typeof matrix & Record<string, any>;
const campaignApi = campaign as typeof campaign & Record<string, any>;

function makeRequest({
  method = 'GET',
  url = `${baseUrl}/resource`,
  failure = 'net::ERR_ABORTED',
  resourceType = 'fetch',
  headers = {},
}: {
  method?: string;
  url?: string;
  failure?: string;
  resourceType?: string;
  headers?: Record<string, string>;
} = {}) {
  return {
    method: () => method,
    url: () => url,
    failure: () => ({ errorText: failure }),
    resourceType: () => resourceType,
    headers: () => headers,
  };
}

function makeConsole(text: string, url: string) {
  return {
    type: () => 'error',
    text: () => text,
    location: () => ({ url }),
  };
}

function createPage() {
  const listeners = new Map<string, Listener>();
  return {
    page: {
      on(event: string, listener: Listener) {
        listeners.set(event, listener);
      },
      off(event: string) {
        listeners.delete(event);
      },
    },
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.(...args);
    },
  };
}

function adminSettlingPage() {
  let currentUrl = `${baseUrl}/admin`;
  return {
    url: () => currentUrl,
    async goto() {
      currentUrl = `${baseUrl}/admin`;
      return { status: () => 200 };
    },
    async waitForTimeout() {
      currentUrl = `${baseUrl}/`;
    },
  };
}

describe('Task 1B fix round 1 — diagnostics et routes', () => {
  it('exige un marqueur PrefetchRoutes explicite et refuse le fallback session', () => {
    const emitted = createPage();
    const diagnostics = runtime.attachPageDiagnostics(emitted.page, { baseUrl, sessionMode: true });

    const explicitPrefetchHeaders: Array<Record<string, string>> = [
      { 'next-router-prefetch': '1' },
      { purpose: 'prefetch' },
      { 'sec-purpose': 'prefetch' },
      { 'x-middleware-prefetch': '1' },
    ];
    for (const headers of explicitPrefetchHeaders) {
      emitted.emit('requestfailed', makeRequest({ headers }));
    }

    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: { rsc: '1' },
    }));
    emitted.emit('requestfailed', makeRequest({ url: `${baseUrl}/plain-abort` }));
    emitted.emit('requestfailed', makeRequest({
      method: 'POST',
      headers: { 'next-router-prefetch': '1' },
    }));
    emitted.emit('requestfailed', makeRequest({
      headers: { 'next-router-prefetch': '0' },
    }));

    expect(diagnostics.errors).toHaveLength(4);
    expect(diagnostics.errors.every((entry: { type: string }) => entry.type === 'requestfailed')).toBe(true);
    diagnostics.dispose();
  });

  it('évalue l’URL admin après le settle', async () => {
    expect(typeof contrastApi.assertRouteNavigation).toBe('function');
    if (typeof contrastApi.assertRouteNavigation !== 'function') return;

    await expect(contrastApi.assertRouteNavigation(
      adminSettlingPage(),
      baseUrl,
      '/admin',
    )).resolves.toMatchObject({
      expected: true,
      finalPath: '/',
      reason: 'missing_admin_role',
    });
  });

  it('exige SpeedInsights console same-origin exact', () => {
    const emitted = createPage();
    const diagnostics = runtime.attachPageDiagnostics(emitted.page, { baseUrl });
    const mime = `Refused to execute script from '${baseUrl}${speedInsightsPath}' because its MIME type ('text/html') is not executable, and strict MIME type checking is enabled.`;
    const externalMime = mime.replace(baseUrl, 'https://speed.example.test');

    emitted.emit('console', makeConsole(mime, `${baseUrl}${speedInsightsPath}`));
    emitted.emit('console', makeConsole(externalMime, 'https://speed.example.test'));
    emitted.emit('console', makeConsole('Unexpected SpeedInsights failure', `${baseUrl}${speedInsightsPath}.evil`));
    emitted.emit('console', makeConsole('Failed to load resource: 404 (Not Found)', 'https://speed.example.test'));

    expect(diagnostics.errors).toHaveLength(0);
    expect(diagnostics.warnings).toHaveLength(3);
    diagnostics.dispose();
  });
});

describe('Task 1B fix round 1 — agrégats', () => {
  it('conserve les métadonnées de chaque cellule et les affiche dans le Markdown', () => {
    expect(typeof matrixApi.attachMatrixCellMetadata).toBe('function');
    expect(typeof matrixApi.buildMarkdown).toBe('function');
    if (typeof matrixApi.attachMatrixCellMetadata !== 'function' || typeof matrixApi.buildMarkdown !== 'function') return;

    const result = {
      routeId: 'accueil',
      path: '/',
      theme: 'light',
      intensity: 0.2,
      measured: false,
      expected: true,
      status: 'expected_404',
      warnings: [{ type: 'console', message: 'warningVisible' }],
      degraded: true,
      finalPath: '/dev/glass',
      httpStatus: 404,
      nodes: [],
    };
    const report = matrixApi.attachMatrixCellMetadata({
      cellCount: 1,
      cells: [{
        routeId: 'accueil',
        path: '/',
        theme: 'light',
        requestedIntensity: 0.2,
        actualTheme: 'light',
        actualIntensity: 0.2,
        nodeCount: 0,
        passRate: 0,
        counts: { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0, error: 0 },
        error: null,
      }],
      totals: { nodes: 0, pass: 0, contrast_fail: 0, unknown: 0, occluded: 0, error: 0 },
      weightedPassRate: 0,
    }, [result]);
    const markdown = matrixApi.buildMarkdown(report);

    expect(report.cells[0]).toMatchObject({
      measured: false,
      expected: true,
      status: 'expected_404',
      warnings: [{ type: 'console', message: 'warningVisible' }],
      degraded: true,
      finalPath: '/dev/glass',
      httpStatus: 404,
    });
    expect(markdown).toContain('Attendu');
    expect(markdown).toContain('Degraded');
    expect(markdown).toContain('warningVisible');
  });

  it('agrège un warning de manifeste 1440 uniquement, dégrade sa route et interdit VERIFIED', () => {
    expect(typeof campaignApi.aggregateManifestDiagnostics).toBe('function');
    if (typeof campaignApi.aggregateManifestDiagnostics !== 'function') return;

    const aggregate = campaignApi.aggregateManifestDiagnostics([
      { route: 'hub', viewport: '1440x900', requestedTheme: 'dark', warnings: [{ type: 'console', message: 'desktopOnly' }], degraded: true },
      { route: 'hub', viewport: '390x844', requestedTheme: 'light', warnings: [], degraded: false },
    ]);

    expect(aggregate.warnings).toHaveLength(1);
    expect(aggregate.warnings[0]).toMatchObject({
      route: 'hub',
      viewport: '1440x900',
      requestedTheme: 'dark',
      message: 'desktopOnly',
    });
    expect(aggregate.degradedRoutes).toEqual(['hub']);
    expect(typeof campaignApi.campaignIsLiveVerified).toBe('function');
    if (typeof campaignApi.campaignIsLiveVerified !== 'function') return;
    expect(campaignApi.campaignIsLiveVerified({
      errorCount: 0,
      completedRouteCount: 70,
      expectedRouteCount: 70,
      warnings: aggregate.warnings,
      degradedRoutes: aggregate.degradedRoutes,
      expectedOutcomeCount: 0,
    })).toBe(false);
  });

  it('sépare les 70 routes attendues du nombre d’outcomes attendus', () => {
    expect(typeof campaignApi.campaignExpectedCounts).toBe('function');
    if (typeof campaignApi.campaignExpectedCounts !== 'function') return;

    expect(campaignApi.campaignExpectedCounts({
      admin: { expected: true },
      '404': { expected: true },
      accueil: { expected: false },
    }, 70)).toEqual({
      expectedRouteCount: 70,
      expectedOutcomeCount: 2,
    });
  });
});
