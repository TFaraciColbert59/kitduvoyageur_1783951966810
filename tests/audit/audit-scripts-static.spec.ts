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
];
const trackedScripts = execFileSync('git', ['ls-files', 'scripts'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((file) => /\.(?:mjs|js|ts|tsx)$/.test(file));

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('audit — garde-fous statiques', () => {
  it('interdit les credentials littéraux dans tous les scripts suivis', () => {
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

    for (const relativePath of trackedScripts) {
      const content = source(relativePath);
      if (forbidden.some((secret) => content.includes(secret)) || jwt.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
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
