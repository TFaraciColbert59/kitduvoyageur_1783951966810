import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import { installCredentialEgressGuard } from '../../scripts/audit/create_test_session.mjs';

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

function validCampaign(overrides: Record<string, any> = {}) {
  return coreApi.buildCampaignAuditReport({
    findings: [{
      routeId: 'accueil',
      path: '/',
      measured: true,
      nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
      counts: { pass: 1, contrast_fail: 0, unknown: 0, occluded: 0 },
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
  });
}

function makeGuardHarness() {
  const state: Array<{ pattern: string; handler: (route: any) => Promise<void> }> = [];
  const unrouted: Array<{ pattern: string; handler: (route: any) => Promise<void> }> = [];
  const context = {
    route: async (pattern: string, handler: (route: any) => Promise<void>) => {
      state.push({ pattern, handler });
    },
    unroute: async (pattern: string, handler: (route: any) => Promise<void>) => {
      unrouted.push({ pattern, handler });
    },
  };
  return { page: { context: () => context }, state, unrouted };
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

  it('dérive l’état de mesure depuis l’état observé et pas depuis une constante', () => {
    const matrix = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_key_screens_matrix.mjs'), 'utf8');
    const campaign = readFileSync(path.join(process.cwd(), 'scripts/audit/run_audit_campaign.mjs'), 'utf8');
    const measure = readFileSync(path.join(process.cwd(), 'scripts/audit/measure_contrast_v2.mjs'), 'utf8');

    expect(matrix).toContain("measurementState: 'unknown'");
    expect(matrix).toMatch(/result\.measurementState = 'default'/);
    expect(campaign).toMatch(/const stateEvidenceComplete = contrastFindings\.every/);
    expect(measure).toContain('readCanonicalMeasurementState');
    expect(measure).toMatch(/measurementState: 'default'/);
    expect(measure).toMatch(/État de contraste non canonical/);
  });
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

      const formPost = makeRoute(`${baseUrl}/connexion`, 'POST', 'email=x&password=y');
      await handler(formPost);
      expect(formPost.calls).toEqual(['continue']);

      const formGet = makeRoute(`${baseUrl}/connexion`, 'GET', '');
      await handler(formGet);
      expect(formGet.calls).toEqual(['continue']);

      const tokenPost = makeRoute(`${supabaseUrl}/auth/v1/token?grant_type=password`, 'POST', '{}');
      await handler(tokenPost);
      expect(tokenPost.calls).toEqual(['continue']);
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
    const leaked = [
      makeRoute(`${baseUrl}/api/collect?email=${encodeURIComponent(email)}`, 'GET', ''),
      makeRoute(`${baseUrl}/api/collect`, 'POST', JSON.stringify({ email })),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `email=${encodeURIComponent(email).replace(/%20/g, '+')}`),
      makeRoute(`${baseUrl}/api/collect`, 'POST', `data=${Buffer.from(password, 'utf8').toString('base64')}`),
      makeRoute(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, 'POST', `{"password":${JSON.stringify(password)}}`),
    ];
    try {
      await installCredentialEgressGuard(harness.page, credentials, baseUrl);
      const handler = harness.state[0].handler;

      for (const route of leaked) {
        await handler(route);
        expect(route.calls).toEqual(['abort:blockedbyclient']);
      }
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it('attend l’installation de la garde avant toute navigation dans tous les appelants', () => {
    for (const file of [
      'scripts/audit/create_test_session.mjs',
      'scripts/audit/probe-errors.mjs',
      'scripts/audit/probe-hydration.mjs',
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');

      expect(source).toMatch(/await installCredentialEgressGuard\(/);
    }
  });
});
