import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import { extractTextElements } from '../../scripts/audit/measure_contrast_v2.mjs';

const coreApi = core as typeof core & Record<string, any>;
const runtimeApi = runtime as typeof runtime & Record<string, any>;
type TextNode = {
  text: string;
  dataAuditId: string;
  color: string;
  rects: Array<{ x: number; width: number }>;
};

function completeCells() {
  return core.buildMatrixCells().map((cell) => ({
    ...cell,
    actualTheme: 'dark',
    actualIntensity: cell.intensity,
    nodes: [],
    axe: { violations: [], incomplete: [] },
  }));
}

describe('fix round 3 — régressions', () => {
  it('expurge entièrement Authorization Bearer avec espaces et variantes JSON', () => {
    const samples = [
      'Authorization: Bearer token',
      'Authorization:   Bearer   token with spaces',
      '{"Authorization":"Bearer token with spaces"}',
      "{'Authorization': 'Bearer token'}",
    ];

    for (const sample of samples) {
      const safe = runtimeApi.redactDiagnosticText(sample);
      expect(safe).not.toMatch(/Bearer/i);
      expect(safe).not.toMatch(/token/i);
      expect(safe).not.toMatch(/Authorization/i);
    }
  });

  it('sépare parent et enfant imbriqués sans double attribution', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
      await page.setContent(`
        <div data-audit-id="parent" style="display:inline-block;color:rgb(255,0,0)">
          Parent
          <span data-audit-id="child" style="display:inline-block;color:rgb(0,0,255)">Child</span>
        </div>
      `);
      const nodes = await extractTextElements(page) as TextNode[];
      const parent = nodes.find((node) => node.text.includes('Parent'));
      const child = nodes.find((node) => node.text.includes('Child'));

      expect(nodes).toHaveLength(2);
      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      if (!parent || !child) throw new Error('parent ou enfant absent');
      expect(parent.dataAuditId).not.toBe(child.dataAuditId);
      expect(parent.color).toContain('255, 0, 0');
      expect(child.color).toContain('0, 0, 255');
      expect(parent.text).not.toContain('Child');
      expect(child.text).not.toContain('Parent');
      expect(parent.rects[0].x).toBeLessThan(child.rects[0].x);
      expect(parent.rects[0].width).not.toBe(child.rects[0].width);
    } finally {
      await browser.close();
    }
  });

  it('produit des rapports partiels sans preuve live pour matrice et campagne', () => {
    const matrix = coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: false,
    });
    const campaign = coreApi.buildCampaignAuditReport({
      findings: [],
      errors: [],
      expectedRouteCount: 2,
      completedRouteCount: 0,
      liveVerified: false,
    });

    expect(matrix.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(campaign.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.buildCampaignAuditReport({
      findings: [],
      errors: [],
      expectedRouteCount: 2,
      completedRouteCount: 1,
      liveVerified: true,
    }).verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.buildCampaignAuditReport({
      findings: [{ counts: { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 } }],
      errors: [],
      expectedRouteCount: 1,
      completedRouteCount: 1,
      liveVerified: true,
    }).verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(matrix.verificationStatus).not.toBe('VERIFIED');
    expect(coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: true,
    }).verificationStatus).toBe('PARTIAL / NOT VERIFIED');
    expect(coreApi.auditVerificationStatus({
      liveVerified: true,
      coverageComplete: false,
    })).toBe('PARTIAL / NOT VERIFIED');
    expect(campaign.verificationStatus).not.toBe('VERIFIED');
  });

  it('intègre la couverture et les routes manquantes au rapport global', () => {
    const script = readFileSync(path.join(process.cwd(), 'scripts/audit/global-audit.mjs'), 'utf8');

    expect(script).toContain('ROUTE_DEFINITIONS');
    expect(script).toContain('missingRoutes');
    expect(script).toContain('coverage.coverageComplete');
    expect(script).toContain("verificationStatus !== 'VERIFIED'");
  });

  it('calcule la couverture globale et expose les routes manquantes', () => {
    const coverage = coreApi.buildAuditCoverage([
      { name: 'accueil', path: '/', auth: false },
      { name: 'compte', path: '/compte', auth: true },
      { name: 'produit', path: null, expectedPath: '/produit/:slug', auth: false },
    ], [{ route: 'accueil' }, { route: 'produit' }]);

    expect(coverage.coverageComplete).toBe(false);
    expect(coverage.missingRoutes).toEqual([
      { name: 'compte', path: '/compte', auth: true },
      { name: 'produit', path: null, expectedPath: '/produit/:slug', auth: false },
    ]);
  });

  it('ne laisse aucun champ ni valeur sensible dans les rapports sérialisés', () => {
    const matrix = coreApi.buildMatrixAuditReport({
      cells: completeCells(),
      liveVerified: false,
    });
    const campaign = coreApi.buildCampaignAuditReport({
      findings: [{
        routeId: 'demo',
        counts: { pass: 0, contrast_fail: 0, unknown: 0, occluded: 0 },
        text: 'Authorization: Bearer report-secret',
        access_token: 'access-secret',
      }],
      errors: [{ message: 'cookie=sid=cookie-secret password=password-secret' }],
      liveVerified: false,
    });
    const serialized = JSON.stringify(runtimeApi.redactRuntimeValue({ matrix, campaign }));

    for (const forbidden of [
      'access_token',
      'refresh_token',
      'Authorization',
      'cookie',
      'password',
      'Bearer',
      'access-secret',
      'report-secret',
      'cookie-secret',
      'password-secret',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('écrit un rapport JSON sans champ ni valeur sensible', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'lkdv-audit-round3-'));
    const reportPath = path.join(directory, 'error.json');
    runtimeApi.writeAuditErrorReport(reportPath, new Error('Authorization: Bearer report-secret'), {
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      authorization: 'Bearer object-secret',
      cookie: 'sid=cookie-secret',
      password: 'password-secret',
    });
    const serialized = readFileSync(reportPath, 'utf8');

    for (const forbidden of [
      'access_token',
      'refresh_token',
      'Authorization',
      'cookie',
      'password',
      'Bearer',
      'access-secret',
      'refresh-secret',
      'object-secret',
      'cookie-secret',
      'password-secret',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    rmSync(directory, { recursive: true, force: true });
  });
});
