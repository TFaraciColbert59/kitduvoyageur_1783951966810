import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import * as contrast from '../../scripts/audit/measure_contrast_v2.mjs';
import * as matrix from '../../scripts/audit/measure_key_screens_matrix.mjs';
import * as campaign from '../../scripts/audit/run_audit_campaign.mjs';

type Listener = (...args: any[]) => void;

const baseUrl = 'http://localhost:3000';
const speedInsightsPath = '/_vercel/speed-insights/script.js';
const contrastApi = contrast as typeof contrast & Record<string, any>;
const matrixApi = matrix as typeof matrix & Record<string, any>;
const campaignApi = campaign as typeof campaign & Record<string, any>;
const matrixSource = readFileSync('scripts/audit/measure_key_screens_matrix.mjs', 'utf8');
const contrastSource = readFileSync('scripts/audit/measure_contrast_v2.mjs', 'utf8');

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
  it('exige la signature PrefetchRoutes exacte et retient les aborted incomplets', () => {
    const emitted = createPage();
    const diagnostics = runtime.attachPageDiagnostics(emitted.page, { baseUrl, sessionMode: true });

    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: {
        rsc: '1',
        'next-router-state-tree': 'state',
        'next-url': '/hub',
        referer: `${baseUrl}/hub`,
      },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: { rsc: '1' },
    }));
    emitted.emit('requestfailed', makeRequest({ url: `${baseUrl}/plain-abort` }));
    emitted.emit('requestfailed', makeRequest({
      method: 'POST',
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: {
        rsc: '1',
        'next-router-state-tree': 'state',
        'next-url': '/hub',
        referer: `${baseUrl}/hub`,
      },
    }));
    emitted.emit('requestfailed', makeRequest({
      url: `${baseUrl}/hub?_rsc=cache-key`,
      headers: {
        rsc: '0',
        'next-router-state-tree': 'state',
        'next-url': '/hub',
        referer: `${baseUrl}/hub`,
      },
    }));

    expect(diagnostics.errors).toHaveLength(1);
    expect(diagnostics.errors.every((entry: { type: string }) => entry.type === 'requestfailed')).toBe(true);
    expect(diagnostics.warnings).toHaveLength(3);
    expect(diagnostics.warnings.every((entry: { type: string }) => entry.type === 'requestfailed')).toBe(true);
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
  it('attend le contenu rendu avant de mesurer une cellule', async () => {
    expect(typeof matrixApi.waitForRenderedContent).toBe('function');
    expect(typeof matrixApi.isRenderedContentReady).toBe('function');
    if (typeof matrixApi.waitForRenderedContent !== 'function' || typeof matrixApi.isRenderedContentReady !== 'function') return;
    expect(matrixApi.isRenderedContentReady('Chargement de votre tableau de bord...')).toBe(false);
    expect(matrixApi.isRenderedContentReady('Carnet Personnel Ma progression et classements')).toBe(false);
    expect(matrixApi.isRenderedContentReady('Carnet Personnel Ma progression et classements et contenus récents pour le voyageur')).toBe(true);
    let called = false;
    await matrixApi.waitForRenderedContent({
      waitForFunction: async () => {
        called = true;
      },
    });
    expect(called).toBe(true);
  });

  it('attend la fin des animations de rendu avant la mesure', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
      await page.setContent(`
        <style>
          main { animation: settle 80ms linear both; }
          @keyframes settle { from { opacity: 0.4; } to { opacity: 1; } }
        </style>
        <main>${'Contenu rendu sufficiently long pour la mesure de contraste. '.repeat(4)}</main>
      `);
      await matrixApi.waitForRenderedContent(page, 1000);
      expect(await page.evaluate(() => document.getAnimations().every((animation) => animation.playState === 'finished'))).toBe(true);
    } finally {
      await browser.close();
    }
  });

  it('segmente les emojis décoratifs des nombres mesurables', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent('<main><p>📍2</p><p>Texte visible</p></main>');
      const elements = await contrast.extractTextElements(page);
      expect(elements[0]).toMatchObject({ text: '2' });
      expect(elements[0].rects.length).toBeGreaterThan(0);
    } finally {
      await browser.close();
    }
  });

  it('limite Axe aux nœuds texte visibles mesurés', () => {
    expect(matrixSource).toContain(".include('[data-audit-id]')");
    expect(contrastSource).toContain(".include('[data-audit-id]')");
  });

  it('attend la navigation mobile chargee dynamiquement avant la mesure', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
      await page.setContent(`
        <nav aria-label="Chargement de la navigation"></nav>
        <main>${'Contenu rendu sufficiently long pour la mesure de contraste. '.repeat(4)}</main>
        <script>
          setTimeout(() => {
            document.querySelector('nav').setAttribute('aria-label', 'Navigation principale');
          }, 50);
        </script>
      `);
      await matrixApi.waitForRenderedContent(page, 1000);
      expect(await page.locator('nav[aria-label="Navigation principale"]').count()).toBe(1);
    } finally {
      await browser.close();
    }
  });

  it('refuse un rapport partiel ou incomplet comme preuve vérifiée', () => {
     expect(typeof matrixApi.isMatrixAuditVerified).toBe('function');
     if (typeof matrixApi.isMatrixAuditVerified !== 'function') return;
     const cells = core.buildMatrixCells().map((cell, index) => ({
       ...cell,
        requestedIntensity: cell.intensity,
        actualTheme: cell.theme,
        actualIntensity: cell.intensity,
        finalPath: cell.path,
        httpStatus: 200,
        measurementState: 'default',
        scrollY: 0,
        overlayOpen: false,
        measured: true,
       nodeCount: 1,
       counts: { pass: 1, contrast_fail: 0, unknown: 0, occluded: 0 },
       nodes: [{ id: `matrix-node-${index}`, selector: `#matrix-node-${index}`, ratio: 4.5, threshold: 4.5, status: 'pass' }],
       degraded: false,
       warnings: [],
     }));
     const base = {
       cellCount: 60,
       expectedCellCount: 60,
       coverageComplete: true,
       totals: { pass: 60, contrast_fail: 0, error: 0, unknown: 0, occluded: 0, nodes: 60 },
       cells,
     };
     expect(matrixApi.isMatrixAuditVerified({ ...base, verificationStatus: 'PARTIAL / NOT VERIFIED' })).toBe(false);
     expect(matrixApi.isMatrixAuditVerified({ ...base, verificationStatus: 'VERIFIED', coverageComplete: false })).toBe(false);
       expect(matrixApi.isMatrixAuditVerified({ ...base, verificationStatus: 'VERIFIED' })).toBe(true);
       expect(matrixApi.isMatrixAuditVerified({
         ...base,
         verificationStatus: 'VERIFIED',
         cells: base.cells.map((cell: any, index: number) => index === 0 ? { ...cell, actualTheme: cell.theme === 'light' ? 'dark' : 'light' } : cell),
       })).toBe(false);
  });

  it('redige les textes de contenu avant la persistance du rapport', () => {
     const serialized = runtime.redactRuntimeValue({
         cells: [{
           nodes: [{
             text: 'Voyageur Y',
             html: '<span>Voyageur Y</span>',
             target: ['/profil/private-user-id'],
             relatedNodes: [{ target: ['/profil/private-user-id'] }],
             failureSummary: 'private-user-id',
           }],
         }],
       warnings: [{ message: 'HTTP 403 https://example.test/resource' }],
     }, { redactContent: true });

      expect(serialized.cells[0].nodes[0]).toEqual({
        text: '[redacted]',
        html: '[redacted]',
        target: '[redacted]',
        relatedNodes: '[redacted]',
        failureSummary: '[redacted]',
      });
     expect(serialized.warnings[0].message).toBe('HTTP 403 https://example.test/resource');
  });

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
     expect(markdown).toContain('Statut de vérification : PARTIAL / NOT VERIFIED');
     expect(markdown).toContain('Portée : premier viewport 390×844');

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

  it('compte les outcomes attendus sans les confondre avec les routes mesurées', () => {
    const expectedMeasuredRouteIds = Array.from({ length: 68 }, (_, index) => `route-${index}`);
    const observedMeasuredRouteIds = expectedMeasuredRouteIds.slice(0, 68);
    const manifestRouteIds = expectedMeasuredRouteIds.slice(0, 68);
    expect(campaignApi.campaignIsLiveVerified({
      errorCount: 0,
      completedRouteCount: 68,
      expectedRouteCount: 70,
      expectedOutcomeCount: 2,
      expectedMeasuredRouteIds,
      observedMeasuredRouteIds,
      manifestRouteIds,
      manifestCoverageComplete: true,
      warnings: [],
      degradedRoutes: [],
    })).toBe(true);
    expect(campaignApi.campaignIsLiveVerified({
      errorCount: 0,
      completedRouteCount: 67,
      expectedRouteCount: 70,
      expectedOutcomeCount: 2,
      expectedMeasuredRouteIds,
      observedMeasuredRouteIds: expectedMeasuredRouteIds.slice(0, 67),
      manifestRouteIds,
      warnings: [],
      degradedRoutes: [],
    })).toBe(false);
  });
});
