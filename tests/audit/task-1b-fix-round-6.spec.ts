import { readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import { installCredentialEgressGuard } from '../../scripts/audit/create_test_session.mjs';
import {
  isCanonicalMeasurementReady,
  readCanonicalMeasurementState,
} from '../../scripts/audit/measure_contrast_v2.mjs';

const coreApi = core as typeof core & Record<string, any>;
const baseUrl = 'http://localhost:3000';
const supabaseUrl = 'https://project.supabase.co';

function completeCells() {
  return core.buildMatrixCells().map((cell) => ({
    ...cell,
    actualTheme: cell.theme,
    actualIntensity: cell.intensity,
    finalPath: cell.path,
    httpStatus: 200,
    measurementState: 'default',
    scrollY: 0,
    overlayOpen: false,
    measured: true,
    degraded: false,
    warnings: [],
    nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
    axe: { violations: [], incomplete: [] },
  }));
}

function validCampaignFixture(overrides: Record<string, any> = {}) {
  return {
    findings: [{
      routeId: 'accueil',
      path: '/',
      measured: true,
      nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
      counts: { pass: 1, contrast_fail: 0, unknown: 0, occluded: 0 },
      measurementState: 'default',
      scrollY: 0,
      overlayOpen: false,
    }],
    errors: [],
    expectedRouteCount: 1,
    completedRouteCount: 1,
    expectedRouteIds: ['accueil'],
    expectedRoutePaths: [{ routeId: 'accueil', path: '/' }],
    expectedOutcomes: [],
    expectedOutcomeDefinitions: [],
    manifestCoverageComplete: true,
    liveVerified: true,
    stateEvidenceComplete: true,
    ...overrides,
  };
}

function validCampaign(overrides: Record<string, any> = {}) {
  return coreApi.buildCampaignAuditReport(validCampaignFixture(overrides));
}

function makeGuardHarness() {
  const state: Array<{ pattern: string; handler: (route: any) => Promise<void> }> = [];
  const unrouted: Array<{ pattern: string; handler: (route: any) => Promise<void> }> = [];
  const listeners = new Map<string, (payload: any) => void>();
  const wsRoutes: Array<[(url: URL) => boolean, (route: any) => Promise<void>]> = [];
  const context = {
    route: async (pattern: string, handler: (route: any) => Promise<void>) => {
      state.push({ pattern, handler });
    },
    unroute: async (pattern: string, handler: (route: any) => Promise<void>) => {
      unrouted.push({ pattern, handler });
    },
    routeWebSocket: async (
      matcher: (url: URL) => boolean,
      handler: (route: any) => Promise<void>,
    ) => {
      wsRoutes.push([matcher, handler]);
    },
  };
  return {
    page: {
      context: () => context,
      on(event: string, listener: (payload: any) => void) {
        listeners.set(event, listener);
      },
      off(event: string) {
        listeners.delete(event);
      },
    },
    listeners,
    wsRoutes,
    state,
    unrouted,
  };
}

function makeRoute(url: string, method: string, postData: string) {
  const calls: string[] = [];
  return {
    calls,
    request: () => ({
      url: () => url,
      method: () => method,
      postData: () => postData,
    }),
    abort: async (reason: string) => {
      calls.push(`abort:${reason}`);
    },
    continue: async () => {
      calls.push('continue');
    },
  };
}

const credentials = { email: 'audit.user+tag@example.com', password: 'p@ss w0rd"quote\\slash' };

describe('Task 1B fix round 6 — preuve d’état de mesure', () => {
  it('refuse la matrice vérifiée quand la preuve d’état est incomplète', () => {
    const verified = coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: true,
      stateEvidenceComplete: true,
    });
    const unproven = coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: true,
      stateEvidenceComplete: false,
    });

    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(unproven.coverageComplete).toBe(false);
    expect(unproven.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });

  it('refuse la campagne vérifiée quand la preuve d’état est incomplète', () => {
    const verified = validCampaign();
    const unproven = validCampaign({ stateEvidenceComplete: false });

    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(unproven.liveEvidence).toBe(false);
    expect(unproven.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });

  it('refuse une campagne sans option de preuve d’état (fail-closed)', () => {
    const { stateEvidenceComplete: _omitted, ...withoutGate } = validCampaignFixture();

    expect(coreApi.buildCampaignAuditReport(withoutGate).verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: true,
    }).verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });

  it('refuse une campagne dont une finding est mesurée en état non default', () => {
    for (const [label, finding] of [
      ['modal', { measurementState: 'modal', scrollY: 0, overlayOpen: true }],
      ['scroll-end', { measurementState: 'scroll-end', scrollY: 800, overlayOpen: false }],
      ['absent', {}],
    ] as const) {
      const report = validCampaign({
        findings: [{
          routeId: 'accueil',
          path: '/',
          measured: true,
          nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
          counts: { pass: 1, contrast_fail: 0, unknown: 0, occluded: 0 },
          ...finding,
        }],
      });

      expect(report.verificationStatus, label).toBe('PARTIAL / NOT VERIFIED');
    }
  });

  it('dérive l’état de mesure depuis l’état observé et pas depuis une constante', async () => {
    const matrix = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_key_screens_matrix.mjs'), 'utf8');
    const campaign = readFileSync(path.join(process.cwd(), 'scripts/audit/run_audit_campaign.mjs'), 'utf8');
    const measure = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_contrast_v2.mjs'), 'utf8');

    expect(matrix).toContain("measurementState: 'unknown'");
    expect(matrix).toMatch(/result\.measurementState = 'default'/);
    expect(matrix).toMatch(/stateEvidenceComplete: results\.length > 0 && results\.every/);
    expect(campaign).toMatch(/const stateEvidenceComplete = safeFindings\.length > 0/);
    expect(campaign).toMatch(/safeFindings\.every\(\(finding\) => \(/);
    expect(measure).toContain('readCanonicalMeasurementState');
    expect(measure).toMatch(/État de contraste non canonical/);
  });

  it('considère la page hydratée sans exiger d’attribut data-audit-id', () => {
    const stub = (innerText: string, readyState = 'complete') => ({
      readyState,
      querySelector: () => ({ innerText }),
      body: { innerText },
    });

    expect(isCanonicalMeasurementReady(stub('contenu hydraté '.repeat(20)))).toBe(true);
    expect(isCanonicalMeasurementReady(stub('x'.repeat(81)))).toBe(true);
    expect(isCanonicalMeasurementReady(stub('contenu hydraté '.repeat(20), 'loading'))).toBe(false);
    expect(isCanonicalMeasurementReady(stub('Chargement en cours'))).toBe(false);
    expect(isCanonicalMeasurementReady(stub('x'.repeat(80)))).toBe(false);
  });

  it('lit l’état de mesure réel sur une page hydratée avec et sans overlay', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(`<main>${'contenu hydraté '.repeat(20)}</main>`);

      const clean = await readCanonicalMeasurementState(page);
      expect(clean.scrollY).toBe(0);
      expect(clean.overlayOpen).toBe(false);

      await page.setContent(`
        <main>${'contenu hydraté '.repeat(20)}</main>
        <div role="dialog" style="position:fixed;inset:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>
      `);
      expect((await readCanonicalMeasurementState(page)).overlayOpen).toBe(true);
    } finally {
      await browser.close();
    }
  }, 20000);
});

describe('Task 1B fix round 6 — modal de campagne optionnel', () => {
  const source = readFileSync(path.join(process.cwd(), 'scripts/audit/run_audit_campaign.mjs'), 'utf8');

  it('cible uniquement les déclencheurs de dialogue et absorbe les échecs de clic', () => {
    expect(source).toContain('[aria-haspopup="dialog"]');
    expect(source).not.toContain('page.click(\'button:has-text("Aperçu")\')');
    expect(source).toMatch(/modalTrigger\.click\(\{ timeout: 1000 \}\)\.then\(\(\) => true\)\.catch\(\(\) => false\)/);
  });

  it('n’enregistre la capture modale que si un dialogue est réellement visible', () => {
    const modalBlock = source.slice(source.indexOf('if (modalOpen) {'), source.indexOf('const finalCaptureNavigation'));

    expect(modalBlock).toContain('states.push(modalName)');
    expect(modalBlock).toContain('modalArtifact = fileDigest(modalFile)');
    expect(modalBlock.indexOf('if (modalOpen) {')).toBeLessThan(modalBlock.indexOf('states.push(modalName)'));
  });
});

describe('Task 1B fix round 6 — garde d’éjection des credentials', () => {
  it('installe la garde de façon awaited et la retire proprement', async () => {
    const harness = makeGuardHarness();
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    try {
      const remove = await installCredentialEgressGuard(harness.page, credentials, baseUrl);

      expect(harness.state).toHaveLength(1);
      expect(harness.state[0].pattern).toBe('**/*');

      await remove();
      expect(harness.unrouted).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('autorise uniquement le POST de formulaire et le POST du token endpoint', async () => {
    const harness = makeGuardHarness();
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    try {
      await installCredentialEgressGuard(harness.page, credentials, baseUrl);
      const handler = harness.state[0].handler;

      const formPost = makeRoute(
        `${baseUrl}/connexion`,
        'POST',
        `email=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}`,
      );
      await handler(formPost);
      expect(formPost.calls).toEqual(['continue']);

      const formGet = makeRoute(
        `${baseUrl}/connexion?email=${encodeURIComponent(credentials.email)}`,
        'GET',
        '',
      );
      await handler(formGet);
      expect(formGet.calls).toEqual(['abort:blockedbyclient']);

      const tokenPost = makeRoute(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        'POST',
        JSON.stringify({ email: credentials.email, password: credentials.password }),
      );
      await handler(tokenPost);
      expect(tokenPost.calls).toEqual(['continue']);

      const refreshPost = makeRoute(
        `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        'POST',
        JSON.stringify({ password: credentials.password }),
      );
      await handler(refreshPost);
      expect(refreshPost.calls).toEqual(['abort:blockedbyclient']);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('bloque toute fuite de credentials par encodage, corps JSON, base64 ou URL', async () => {
    const harness = makeGuardHarness();
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    const { email, password } = credentials;
    const base64 = Buffer.from(password, 'utf8').toString('base64');
    const leaked = [
      makeRoute(`${baseUrl}/api/collect?email=${encodeURIComponent(email)}`, 'GET', ''),
      makeRoute(`${baseUrl}/api/collect`, 'POST', JSON.stringify({ email })),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `email=${encodeURIComponent(email).replace(/%20/g, '+')}`),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `data=${Buffer.from(password, 'utf8').toString('base64')}`),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `data=${base64.replace(/=+$/, '')}`),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `data=${base64.replace(/\+/g, '-').replace(/\//g, '_')}`),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `{"email":"\\u0061udit.user+tag@example.com"}`),
      makeRoute(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, 'POST', `{"password":${JSON.stringify(password)}}`),
    ];
    try {
      await installCredentialEgressGuard(harness.page, credentials, baseUrl);
      const handler = harness.state[0].handler;

      for (const [index, route] of leaked.entries()) {
        await handler(route);
        expect(route.calls, `cas ${index}`).toEqual(['abort:blockedbyclient']);
      }
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('inspecte aussi les en-têtes de requête', async () => {
    const harness = makeGuardHarness();
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    const calls: string[] = [];
    const route = {
      request: () => ({
        url: () => `${baseUrl}/api/collect`,
        method: () => 'POST',
        postData: () => '{}',
        headers: () => ({ 'x-audit-user': credentials.email }),
      }),
      abort: async (reason: string) => {
        calls.push(`abort:${reason}`);
      },
      continue: async () => {
        calls.push('continue');
      },
    };
    try {
      await installCredentialEgressGuard(harness.page, credentials, baseUrl);

      await harness.state[0].handler(route);
      expect(calls).toEqual(['abort:blockedbyclient']);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('bloque la poignée de main WebSocket portant des credentials sans toucher les autres', async () => {
    const harness = makeGuardHarness();
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    try {
      await installCredentialEgressGuard(harness.page, credentials, baseUrl);
      const [matcher, handler] = harness.wsRoutes[0];

      expect(typeof matcher).toBe('function');
      expect(matcher(new URL(`wss://attacker.example/?e=${encodeURIComponent(credentials.email)}`))).toBe(true);
      expect(matcher(new URL('ws://localhost:3000/_next/webpack-hmr'))).toBe(false);

      const closed: unknown[] = [];
      await handler({
        close: async (options: unknown) => {
          closed.push(options);
        },
        connectToServer: () => {
          throw new Error('connectToServer ne doit jamais être appelé');
        },
      });
      expect(closed).toEqual([{ code: 1008 }]);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('n’appelle aucune API Playwright inexistante dans la garde', () => {
    const source = readFileSync(path.join(process.cwd(), 'scripts/audit/create_test_session.mjs'), 'utf8');

    expect(source).toContain('context.routeWebSocket(');
    expect(source).not.toContain('webSocket.evaluate');
    expect(source).not.toContain('request.abort');
    expect(source).not.toMatch(/page\.on\('request'/);
  });

  it('échoue explicitement sans interception de contexte', async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    try {
      await expect(installCredentialEgressGuard({} as any, credentials, baseUrl))
        .rejects.toThrow(/interception de contexte indisponible/);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('aligne la détection d’hydratation sur les scripts frères', () => {
    const measure = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_contrast_v2.mjs'), 'utf8');
    const campaign = readFileSync(path.join(process.cwd(), 'scripts/audit/run_audit_campaign.mjs'), 'utf8');
    const matrix = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_key_screens_matrix.mjs'), 'utf8');

    for (const source of [measure, campaign, matrix]) {
      expect(source).toContain('text.trim().length > 80');
      expect(source).toMatch(/Connexion requise\|Chargement\|Initialisation/);
    }
  });

  it('installe la garde avant toute navigation dans tous les appelants', () => {
    const scopes: Array<[string, string]> = [
      ['scripts/audit/probe-errors.mjs', ''],
      ['scripts/audit/probe-hydration.mjs', ''],
      [
        'scripts/audit/create_test_session.mjs',
        'export async function createAuthenticatedStorageState',
      ],
    ];

    for (const [file, scope] of scopes) {
      const full = readFileSync(path.join(process.cwd(), file), 'utf8');
      const start = scope ? full.indexOf(scope) : 0;
      expect(start, file).toBeGreaterThanOrEqual(0);
      const source = full.slice(start);
      const install = source.indexOf('await installCredentialEgressGuard(');
      const navigate = source.indexOf('.goto(');

      expect(install, file).toBeGreaterThanOrEqual(0);
      expect(navigate, file).toBeGreaterThanOrEqual(0);
      expect(install, file).toBeLessThan(navigate);
    }
  });
});
