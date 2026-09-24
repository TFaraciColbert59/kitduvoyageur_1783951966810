import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as core from '../../scripts/audit/contrast_audit_core.mjs';
import {
  attachPageDiagnostics,
  defaultAuditStorageStatePath,
  invalidateAuditReportDirectory,
  invalidateAuditReports,
  writeAuditErrorReport,
} from '../../scripts/audit/audit_runtime.mjs';

const root = process.cwd();
const api = core as typeof core & Record<string, (...args: any[]) => any>;
const now = 1_800_000_000_000;
const validState = {
  cookies: [{
    name: 'sb-project-auth-token',
    value: JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
    domain: 'localhost',
    path: '/',
    expires: -1,
  }],
  origins: [{
    origin: 'http://localhost:3000',
    localStorage: [{
      name: 'sb-project-auth-token',
      value: JSON.stringify({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_at: now / 1000 + 3600,
      }),
    }],
  }],
};

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('fix round 1 — régressions', () => {
  it('rejette origine, cookie, valeur et expiration de storageState non valides', () => {
    expect(() => core.validateStorageState(validState, now, 'http://localhost:3000')).not.toThrow();
    expect(() => core.validateStorageState({
      ...validState,
      origins: [{ ...validState.origins[0], origin: 'http://example.invalid' }],
    }, now, 'http://localhost:3000')).toThrow(/origine/i);
    expect(() => core.validateStorageState({
      ...validState,
      cookies: [{ ...validState.cookies[0], value: '' }],
    }, now, 'http://localhost:3000')).toThrow(/cookie/i);
    expect(() => core.validateStorageState({
      ...validState,
      cookies: [{ ...validState.cookies[0], value: 'opaque' }],
      origins: [{ ...validState.origins[0], localStorage: [] }],
    }, now, 'http://localhost:3000')).toThrow(/cookie|authentifi/i);
    expect(() => core.validateStorageState({
      ...validState,
      cookies: [{ ...validState.cookies[0], value: '{malformed' }],
    }, now, 'http://localhost:3000')).toThrow(/malform/i);
    expect(() => core.validateStorageState({
      ...validState,
      origins: [{
        ...validState.origins[0],
        localStorage: [{ name: 'sb-project-auth-token', value: '{malformed' }],
      }],
    }, now, 'http://localhost:3000')).toThrow(/malform|authentifi/i);
    expect(() => core.validateStorageState({
      ...validState,
      origins: [{
        ...validState.origins[0],
        localStorage: [{
          name: 'sb-project-auth-token',
          value: JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
        }],
      }],
    }, now, 'http://localhost:3000')).toThrow(/expir/i);
  });

  it('mesure un pixel dangereux hors des trois anciens points et compose alpha/opacité', () => {
    const data = new Uint8Array(10 * 3);
    data.set([255, 255, 255], 9 * 3);
    const result = core.analyzeDecodedPixels({
      data,
      info: { width: 10, height: 1, channels: 3 },
      textElements: [{
        id: 'danger',
        selector: '#danger',
        text: 'Danger',
        color: 'rgba(255, 255, 255, 0.5)',
        ancestorOpacities: [0.5],
        isLarge: false,
        occluded: false,
        rects: [{ x: 0, y: 0, width: 10, height: 1 }],
      }],
    });

    expect(result[0]).toMatchObject({ status: 'contrast_fail', ratio: 1 });
    const alphaResult = core.analyzeDecodedPixels({
      data: new Uint8Array([0, 0, 0]),
      info: { width: 1, height: 1, channels: 3 },
      textElements: [{
        id: 'alpha',
        selector: '#alpha',
        text: 'Alpha',
        color: 'rgba(255, 255, 255, 0.5)',
        ancestorOpacities: [0.5],
        isLarge: false,
        occluded: false,
        rects: [{ x: 0, y: 0, width: 1, height: 1 }],
      }],
    });
    expect(alphaResult[0].effectiveTextColor).toContain('63.75');
  });

  it('utilise des rectangles de texte direct et évite les descendants mélangés', () => {
    const script = source('scripts/audit/measure_contrast_v2.mjs');

    expect(script).toContain('selectNode(textNode)');
    expect(script).toContain('NodeFilter.SHOW_TEXT');
    expect(script).toContain('textNode.parentElement');
    expect(script).not.toContain('selectNodeContents');
  });

  it('détecte une intersection fixed/sticky même étroite, partielle ou hors écran', () => {
    expect(typeof api.hasFixedOverlayIntersection).toBe('function');
    const rects = [{ x: 0, y: 0, width: 10, height: 10 }];
    const viewport = { width: 100, height: 100 };
    expect(api.hasFixedOverlayIntersection(rects, [{ rects: [{ x: 9, y: 1, width: 1, height: 1 }], containsTarget: false }], viewport)).toBe(true);
    expect(api.hasFixedOverlayIntersection(rects, [{ rects: [{ x: 20, y: 20, width: 1, height: 1 }], containsTarget: false }], viewport)).toBe(false);
    expect(api.hasFixedOverlayIntersection([{ x: 95, y: 0, width: 20, height: 2 }], [{ rects: [{ x: 0, y: 0, width: 1, height: 1 }], containsTarget: false }], viewport)).toBe(false);
    expect(api.parseStrictNumber('0.5oops')).toBeNull();
    expect(() => core.assertRenderedAuditSettings({
      requestedTheme: 'dark',
      requestedIntensity: 0.5,
      actualTheme: 'dark',
      actualIntensity: null,
    })).toThrow(/intensit/i);
  });

  it('fusionne Axe par data-audit-id exact et remet ratio à null', () => {
    const axeResults = {
      violations: [],
      incomplete: [{
        id: 'color-contrast',
        nodes: [{ target: ['[data-audit-id="audit-2"]'] }],
      }],
    };
    const nodes = core.mergeAxeContrastEvidence([
      { dataAuditId: 'audit-1', selector: '[data-audit-id="audit-1"]', status: 'pass', ratio: 21 },
      { dataAuditId: 'audit-2', selector: '[data-audit-id="audit-2"]', status: 'pass', ratio: 21 },
    ], axeResults);

    expect(nodes[0]).toMatchObject({ status: 'pass', ratio: 21 });
    expect(nodes[1]).toMatchObject({ status: 'unknown', ratio: null });
  });

  it('ne fusionne pas un identifiant Axe avec un identifiant préfixé', () => {
    const nodes = core.mergeAxeContrastEvidence([
      { dataAuditId: 'audit-2', selector: '[data-audit-id="audit-2"]', status: 'pass', ratio: 21 },
      { dataAuditId: 'audit-20', selector: '[data-audit-id="audit-20"]', status: 'pass', ratio: 21 },
    ], {
      violations: [{ id: 'color-contrast', nodes: [{ target: ['[data-audit-id="audit-20"]'] }] }],
      incomplete: [],
    });

    expect(nodes[0]).toMatchObject({ dataAuditId: 'audit-2', status: 'pass', ratio: 21 });
    expect(nodes[1]).toMatchObject({ dataAuditId: 'audit-20', status: 'contrast_fail', ratio: null });
  });

  it('agrège à zéro dès qu’une cellule est en erreur', () => {
    const cells = core.buildMatrixCells().map((cell, index) => ({
      ...cell,
      actualTheme: 'dark',
      actualIntensity: cell.intensity,
      nodes: index === 0 ? [{ status: 'pass' }] : [],
      error: index === 1 ? 'runtime failure' : null,
      axe: { violations: [], incomplete: [] },
    }));

    expect(core.aggregateContrastMatrix(cells).weightedPassRate).toBe(0);
  });

  it('paramètre les deux themes admin comme redirection missing_admin_role', () => {
    const script = source('scripts/audit/measure_contrast_v2.mjs');

    expect(script).toContain("routePath === '/admin' || routePath === '/admin/produits'");
    expect(core.describeAdminNavigation({
      requestedPath: '/admin/produits',
      finalUrl: 'http://localhost:3000/',
      status: 200,
    })).toMatchObject({ redirected: true, reason: 'missing_admin_role' });
  });

  it('n’injecte thème et intensité que par localStorage', () => {
    const matrix = source('scripts/audit/measure_key_screens_matrix.mjs');
    const campaign = source('scripts/audit/run_audit_campaign.mjs');
    const auditFiles = execFileSync('git', ['ls-files', 'scripts/audit'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((file) => /\.(?:mjs|js|ts|tsx)$/.test(file));

    expect(matrix).toContain("localStorage.setItem('lkdv_theme'");
    expect(campaign).toContain("localStorage.setItem('lkdv_theme'");
    for (const file of auditFiles) {
      const content = source(file);
      expect(content).not.toMatch(/document\.documentElement\.(?:classList|setAttribute|style)/);
      expect(content).not.toContain("style.setProperty('--glass-intensity'");
    }
  });

  it('scan tous les scripts suivis pour les credentials littéraux du compte audit', () => {
    const tracked = execFileSync('git', ['ls-files', 'scripts'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((file) => /\.(?:mjs|js|ts|tsx)$/.test(file));
    const forbidden = [
      ['y-demo', '@lekitduvoyageur.fr'].join(''),
      ['Ydemo', '!2026'].join(''),
      ['demo@', 'lkdv.app'].join(''),
      ['DemoPass', '!2026'].join(''),
      ['password', '123'].join(''),
      ['Str0ngPass', '!lkdv'].join(''),
      ['Password', '!2026'].join(''),
      ['demo.bot', '@example.com'].join(''),
      ['icxyvwzfjbflcbqukpfz', '.supabase.co'].join(''),
    ];
    const jwt = /eyJ[A-Za-z0-9_-]{20,}\./;
    const violations = tracked.filter((file) => {
      const content = source(file);
      return forbidden.some((secret) => content.includes(secret)) || jwt.test(content);
    });

    expect(violations).toEqual([]);
  });

  it('déclare sharp dans devDependencies', () => {
    const packageJson = JSON.parse(source('package.json')) as { devDependencies?: Record<string, string> };

    expect(packageJson.devDependencies?.sharp).toBeDefined();
  });

  it('supprime les rapports obsolètes avant une nouvelle exécution', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'lkdv-audit-test-'));
    const reportPath = path.join(directory, 'old-report.json');
    writeFileSync(reportPath, '{"status":"PASS"}\n');
    invalidateAuditReports([reportPath]);
    expect(existsSync(reportPath)).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });

  it('écrit un rapport d’erreur après invalidation du répertoire', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'lkdv-audit-error-test-'));
    const oldReport = path.join(directory, 'old.json');
    const errorReport = path.join(directory, 'error.json');
    writeFileSync(oldReport, '{"status":"PASS"}\n');
    invalidateAuditReportDirectory(directory, () => true);
    expect(existsSync(oldReport)).toBe(false);
    writeAuditErrorReport(errorReport, new Error('échec password=hidden'), { route: 'demo' });
    expect(JSON.parse(readFileSync(errorReport, 'utf8'))).toMatchObject({ status: 'ERROR' });
    expect(readFileSync(errorReport, 'utf8')).not.toContain('hidden');
    rmSync(directory, { recursive: true, force: true });
  });

  it('place le storageState par défaut dans un répertoire temporaire privé', () => {
    const defaultPath = defaultAuditStorageStatePath({} as NodeJS.ProcessEnv);
    expect(defaultPath).toBe(path.join(os.tmpdir(), 'lkdv-audit', 'auth-storage-state.json'));
    expect(defaultPath).not.toContain(`${path.sep}audit${path.sep}`);
  });

  it('transforme pageerror, requestfailed et console error en erreurs bloquantes', () => {
    const listeners = new Map<string, (...args: any[]) => void>();
    const page = {
      on(event: string, listener: (...args: any[]) => void) {
        listeners.set(event, listener);
      },
      off(event: string) {
        listeners.delete(event);
      },
    };
    const diagnostics = attachPageDiagnostics(page);
    listeners.get('pageerror')?.(new Error('password=hidden'));
    listeners.get('requestfailed')?.({
      method: () => 'GET',
      url: () => 'https://example.test/path?access_token=hidden',
      failure: () => ({ errorText: 'failed' }),
    });
    listeners.get('console')?.({ type: () => 'error', text: () => 'boom' });

    expect(diagnostics.errors).toHaveLength(3);
    expect(() => diagnostics.assertClean()).toThrow(/runtime audit/i);
    expect(JSON.stringify(diagnostics.errors)).not.toContain('hidden');
    diagnostics.dispose();
  });
});
