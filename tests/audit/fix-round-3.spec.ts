import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import * as runtime from '../../scripts/audit/audit_runtime.mjs';
import { extractTextElements, summarizeFullContrastEvidence } from '../../scripts/audit/measure_contrast_v2.mjs';

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
     actualTheme: cell.theme,
     actualIntensity: cell.intensity,
     finalPath: cell.path,
     httpStatus: 200,
     measurementState: 'default',
     scrollY: 0,
     overlayOpen: false,
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

  it('ignore les textes décoratifs marqués aria-hidden', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
      await page.setContent(`
        <span aria-hidden="true">⚡</span>
        <span>Texte visible</span>
      `);
      const nodes = await extractTextElements(page) as TextNode[];

      expect(nodes.map((node) => node.text)).toEqual(['Texte visible']);
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

  it('refuse une matrice avec une cellule vide ou dégradée', () => {
     const cells = completeCells().map((cell, index) => ({
       ...cell,
       measured: true,
       nodes: index === 0 ? [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }] : [],
       degraded: index === 1,
       warnings: index === 2 ? [{ type: 'console', message: 'warning' }] : [],
     }));
     const report = coreApi.buildMatrixAuditReport({ cells, liveVerified: true, errors: [] });

     expect(report.coverageComplete).toBe(false);
     expect(report.measuredCellCount).toBe(1);
     expect(report.warningCellCount).toBe(2);
     expect(report.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });

  it('refuse une preuve unknown ou occluded comme couverture vérifiée', () => {
     const cells = completeCells().map((cell) => ({
       ...cell,
       measured: true,
       nodes: [{ id: 'unknown-node', selector: '#unknown-node', ratio: null, threshold: null, status: 'unknown' }],
     }));
     const report = coreApi.buildMatrixAuditReport({ cells, liveVerified: true, errors: [] });

     expect(report.coverageComplete).toBe(false);
     expect(report.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
  });

   it('refuse une campagne dont la preuve contient unknown ou occluded', () => {
     const report = coreApi.buildCampaignAuditReport({
       findings: [{ counts: { pass: 0, contrast_fail: 0, unknown: 1, occluded: 0 } }],
       errors: [],
       expectedRouteCount: 1,
       completedRouteCount: 1,
       liveVerified: true,
     });

     expect(report.liveEvidence).toBe(false);
     expect(report.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
   });

   it('recalcule les comptes et refuse les preuves de campagne sparses', () => {
     const sparse = coreApi.buildCampaignAuditReport({
       findings: [{ routeId: 'accueil', measured: false, nodes: [], counts: { pass: 99 } }],
       errors: [],
       expectedRouteCount: 1,
       completedRouteCount: 1,
       liveVerified: true,
     });
     const inconsistent = coreApi.buildCampaignAuditReport({
       findings: [{
           routeId: 'accueil',
           path: '/',
           measured: true,
         nodes: [{ id: 'unknown-node', selector: '#unknown-node', ratio: null, threshold: null, status: 'unknown' }],
         counts: { pass: 99, contrast_fail: 0, unknown: 0, occluded: 0 },
       }],
       errors: [],
       expectedRouteCount: 1,
       completedRouteCount: 1,
       liveVerified: true,
     });
    const valid = coreApi.buildCampaignAuditReport({
        findings: [{
            routeId: 'accueil',
            path: '/',
            measured: true,
          nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
          counts: { pass: 99, contrast_fail: 0, unknown: 0, occluded: 0 },
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
         stateEvidenceComplete: true,
         coverageComplete: true,
         liveVerified: true,
    });

      expect(sparse.liveEvidence).toBe(false);
     expect(sparse.totals).toMatchObject({ pass: 0, unknown: 0 });
     expect(inconsistent.totals).toMatchObject({ pass: 0, unknown: 1 });
     expect(inconsistent.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
     expect(valid.totals).toMatchObject({ pass: 1, unknown: 0 });
     expect(valid.verificationStatus).toBe('VERIFIED');
   });

   it('refuse un rapport global limité aux issues attendues sans preuve contrastée', () => {
     const expectedRoutes = [
       { id: 'normal', path: '/compte' },
       { id: 'expected', path: '/dev/glass' },
     ];
     const expectedOnly = {
       normal: { id: 'normal', path: '/compte', measured: false, expected: false, nodes: [] },
       expected: {
         id: 'expected',
         path: '/dev/glass',
         measured: false,
         expected: true,
         status: 'expected_404',
         reason: 'expected_404',
         finalPath: '/dev/glass',
         expectedFinalPath: null,
         httpStatus: 404,
         nodes: [],
       },
     };
    const measured = {
        normal: {
          id: 'normal',
          path: '/compte',
          measured: true,
          nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
          measurementState: 'default',
          scrollY: 0,
          overlayOpen: false,
        },
        expected: expectedOnly.expected,
      };
     const sparse = summarizeFullContrastEvidence(expectedOnly, expectedRoutes);
     const complete = summarizeFullContrastEvidence(measured, expectedRoutes);

     expect(sparse.expectedMeasuredRouteCount).toBe(1);
     expect(sparse.coverageComplete).toBe(false);
     expect(sparse.totals.nodes).toBe(0);
     expect(complete.coverageComplete).toBe(true);
     expect(complete.totals.nodes).toBe(1);
     const wrongPath = {
       normal: { ...measured.normal, path: '/autre' },
       expected: measured.expected,
     };
     const duplicate = {
       normal: measured.normal,
       expected: measured.expected,
       duplicate: { ...measured.normal },
     };
     expect(summarizeFullContrastEvidence(wrongPath, expectedRoutes).coverageComplete).toBe(false);
     expect(summarizeFullContrastEvidence(duplicate, expectedRoutes).coverageComplete).toBe(false);
   });

   it('lie les outcomes attendus à leurs définitions et à leur route canonique', () => {
     const expectedOutcome = {
       routeId: 'expected',
       path: '/dev/glass',
       expected: true,
       measured: false,
       status: 'expected_404',
       reason: 'expected_404',
       finalPath: '/dev/glass',
       expectedFinalPath: null,
       httpStatus: 404,
     };
     const definition = {
       routeId: 'expected',
       path: '/dev/glass',
       kind: 'http',
       status: 404,
       reason: 'expected_404',
     };
    const base = {
        findings: [{
          routeId: 'normal',
          path: '/compte',
          measured: true,
          nodes: [{ id: 'pass-node', selector: '#pass-node', ratio: 4.5, threshold: 4.5, status: 'pass' }],
          measurementState: 'default',
          scrollY: 0,
          overlayOpen: false,
        }],
        errors: [],
        expectedRouteCount: 2,
        expectedRouteIds: ['normal', 'expected'],
        expectedRoutePaths: [
          { routeId: 'normal', path: '/compte' },
          { routeId: 'expected', path: '/dev/glass' },
        ],
        expectedOutcomeDefinitions: [definition],
          manifestCoverageComplete: true,
          stateEvidenceComplete: true,
          coverageComplete: true,
          liveVerified: true,
    };
     const valid = coreApi.buildCampaignAuditReport({ ...base, expectedOutcomes: [expectedOutcome] });
     const wrongOutcome = coreApi.buildCampaignAuditReport({
       ...base,
       expectedOutcomes: [{ ...expectedOutcome, finalPath: '/other' }],
     });
     const missingOutcome = coreApi.buildCampaignAuditReport({ ...base, expectedOutcomes: [] });
     const invalidRatio = coreApi.buildCampaignAuditReport({
       ...base,
       findings: [{
         routeId: 'normal',
         path: '/compte',
         measured: true,
         nodes: [{ id: 'invalid-ratio', selector: '#invalid-ratio', ratio: null, threshold: 4.5, status: 'pass' }],
       }],
       expectedOutcomes: [expectedOutcome],
     });
     const duplicateNodes = coreApi.buildCampaignAuditReport({
       ...base,
        findings: [{

         routeId: 'normal',
         path: '/compte',
         measured: true,
         nodes: [
           { id: 'duplicate-node', selector: '#duplicate-node', ratio: 4.5, threshold: 4.5, status: 'pass' },
           { id: 'duplicate-node', selector: '#duplicate-node-2', ratio: 4.5, threshold: 4.5, status: 'pass' },
         ],
       }],
       expectedOutcomes: [expectedOutcome],
     });

     expect(valid.verificationStatus).toBe('VERIFIED');
     expect(wrongOutcome.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
     expect(missingOutcome.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
     expect(duplicateNodes.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
     expect(invalidRatio.verificationStatus).toBe('PARTIAL / NOT VERIFIED');
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
       text: 'private-user-text',
       html: '<b>private-html</b>',

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
       'private-user-text',
       'private-html',
     ]) {
      expect(serialized).not.toContain(forbidden);
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('ignore le fond fixe derrière le texte et détecte un vrai overlay', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
      await page.setContent(`
        <style>
          body { margin: 0; }
          #background { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: rgb(0, 0, 0); }
          #banner { position: fixed; top: 120px; left: 0; width: 800px; height: 40px; z-index: 10; background: rgb(0, 0, 0); }
          #under { position: absolute; top: 20px; left: 20px; }
          #over { position: absolute; top: 130px; left: 20px; }
        </style>
        <div id="background"></div>
        <div id="banner"></div>
        <p id="under">Texte visible</p>
        <p id="over">Texte masqué</p>
      `);
      const nodes = await extractTextElements(page) as Array<{ text: string; occluded: boolean }>;
      const visible = nodes.find((node) => node.text.includes('visible'));
      const covered = nodes.find((node) => node.text.includes('masqué'));

      expect(visible?.occluded).toBe(false);
      expect(covered?.occluded).toBe(true);
    } finally {
      await browser.close();
    }
  });
});
