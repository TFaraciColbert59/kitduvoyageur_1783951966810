import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const auditScripts = [
  'scripts/audit/measure_contrast_v2.mjs',
  'scripts/audit/run_audit_campaign.mjs',
  'scripts/audit/create_test_session.mjs',
  'scripts/audit/measure_key_screens_matrix.mjs',
  'scripts/audit/capture_section4.mjs',
];
const codeExtensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.tsx', '.py', '.ps1'];
const excludedCodeFiles = new Set([
  'src/features/materiel/components/DemoLoginButton.tsx',
]);
const allTrackedCodeFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((file) => codeExtensions.some((extension) => file.endsWith(extension)))
  .filter((file) => !file.startsWith('docs/'));
const trackedCodeFiles = allTrackedCodeFiles.filter((file) => !excludedCodeFiles.has(file));

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('audit — garde-fous statiques', () => {
  it('interdit les credentials littéraux dans tout le code suivi hors docs', () => {
    const violations: string[] = [];
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

    for (const relativePath of trackedCodeFiles) {
      const content = source(relativePath);
      if (forbidden.some((secret) => content.includes(secret)) || jwt.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('exclut explicitement le seul reliquat démo public autorisé', () => {
    const excluded = 'src/features/materiel/components/DemoLoginButton.tsx';

    expect([...excludedCodeFiles]).toEqual([excluded]);
    expect(allTrackedCodeFiles).toContain(excluded);
    expect(trackedCodeFiles).not.toContain(excluded);
    expect(trackedCodeFiles.some((file) => file.startsWith('scripts/')))
      .toBe(true);
    expect(trackedCodeFiles.some((file) => file.startsWith('src/')))
      .toBe(true);
    expect(trackedCodeFiles.some((file) => file.startsWith('tests/')))
      .toBe(true);
    expect(trackedCodeFiles.some((file) => file.startsWith('.agents/')))
      .toBe(true);
    expect(allTrackedCodeFiles.some((file) => file.startsWith('docs/')))
      .toBe(false);
    expect(source('.agents/test_rls_intrusion.mjs')).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(source('.agents/test_rls_intrusion.mjs')).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('ignore auth-storage-state.json et tous les storageState JSON', () => {
    const gitignore = source('.gitignore');

    expect(gitignore).toContain('audit/auth-storage-state.json');
    expect(gitignore).toContain('**/auth-storage-state*.json');
    expect(gitignore).toContain('**/*.storageState.json');
  });

  it('naient suit de storageState JSON', () => {
    const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const tracked = files.filter((file) => (
      file === 'audit/auth-storage-state.json'
      || /(?:^|\/)auth-storage-state[^/]*\.json$/.test(file)
      || /\.storageState\.json$/.test(file)
    ));

    expect(tracked).toEqual([]);
  });

  it('force la capture exacte, les rectangles de lignes et deviceScaleFactor=1', () => {
    const contrastScript = source('scripts/audit/measure_contrast_v2.mjs');
    const matrixScript = source('scripts/audit/measure_key_screens_matrix.mjs');
    const exactCss = '* { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }';

    expect(contrastScript).toContain(exactCss);
    expect(matrixScript).toContain(exactCss);
    expect(contrastScript).toContain('.getClientRects()');
    expect(matrixScript).toContain('measurePageContrast');
    expect(contrastScript).toContain('deviceScaleFactor: 1');
    expect(matrixScript).toContain('deviceScaleFactor: 1');
  });

  it('ne désactive pas le sandbox du navigateur pour les audits authentifiés', () => {
    for (const relativePath of auditScripts) {
      expect(source(relativePath)).not.toContain('--no-sandbox');
      expect(source(relativePath)).not.toContain('--disable-setuid-sandbox');
      expect(source(relativePath)).toContain("serviceWorkers: 'block'");
    }
  });

  it('ne désactive pas le sandbox Lighthouse ni ne publie ses résultats', () => {
    const lighthouse = source('.lighthouserc.json');
    expect(lighthouse).not.toContain('--no-sandbox');
    expect(lighthouse).not.toContain('temporary-public-storage');
  });

  it('bloque la publication d’une campagne dégradée ou incomplète', () => {
    expect(source('scripts/audit/run_audit_campaign.mjs')).toContain("campaignReport.verificationStatus !== 'VERIFIED'");
    expect(source('scripts/audit/measure_contrast_v2.mjs')).toContain("verificationStatus !== 'VERIFIED'");
    const capture = source('scripts/audit/capture_section4.mjs');
    expect(capture).toContain("verificationStatus !== 'VERIFIED'");
    expect(capture).toContain('getAuditBaseUrl');
    expect(capture).toContain('assertRouteNavigation');
    expect(capture).toContain('EXPECTED_CAPTURE_COUNT');
    expect(capture).toContain('loadAuditStorageState');
    expect(capture).toContain('verifyCompteSession');
    expect(capture).not.toContain('createServerClient');
    expect(capture).not.toContain('getAuthCookie');
    expect(capture).toContain('invokedPath === import.meta.url');
    expect(capture.lastIndexOf('invalidateAuditReports')).toBeGreaterThan(capture.indexOf('async function run'));
    const campaign = source('scripts/audit/run_audit_campaign.mjs');
    const campaignRunStart = campaign.indexOf('async function run()');
    const campaignWarningsStart = campaign.indexOf('const warnings = []', campaignRunStart);
    const campaignRouteLoopStart = campaign.indexOf('for (const route of ROUTES)', campaignRunStart);
    expect(campaignWarningsStart).toBeGreaterThan(campaignRunStart);
    expect(campaignWarningsStart).toBeLessThan(campaignRouteLoopStart);
    const campaignAfterWarnings = campaign.slice(campaign.indexOf(';', campaignWarningsStart) + 1, campaign.indexOf('const safeErrors', campaignRunStart));
    expect(campaignAfterWarnings).not.toContain('const warnings = [');
    const intensityBlock = capture.slice(capture.indexOf('if (INTENSITY_ROUTES.has(r.id))'));
    expect(intensityBlock).not.toContain('${vp.name}-${theme}');
  });

  it('conserve tous les résultats Axe color-contrast et ne publie pas ancien taux', () => {
    const scripts = auditScripts.map(source).join('\n');
    const legacyRate = ['20', '6'].join('.');

    expect(scripts).not.toContain(legacyRate);
    expect(scripts).not.toMatch(/\.find\([^)]*id\s*===\s*['"]color-contrast['"]/);
    expect(scripts).toContain('contrast_fail');
    expect(scripts).toContain('unknown');
    expect(scripts).toContain('occluded');
  });
});
