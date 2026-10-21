import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareLedger,
  parseMigrationFile,
  parseRegistryLine,
} from '../../scripts/db/migrations-alignment.mjs';

/**
 * PLAN-100 phase 9 — alignement dépôt ↔ registre. Le script ne touche aucune
 * base : il compare les fichiers à un export du registre fourni par Tony.
 */
describe('migrations-alignment', () => {
  it('lit les noms de fichiers et les lignes d’export', () => {
    expect(parseMigrationFile('20261012100000_adventure_events_claim_lease.sql')).toEqual({
      version: '20261012100000',
      name: 'adventure_events_claim_lease',
      file: '20261012100000_adventure_events_claim_lease.sql',
    });
    expect(parseMigrationFile('README.md')).toBeNull();
    expect(parseRegistryLine('"20261012142746","adventure_events_claim_lease"')).toEqual({
      version: '20261012142746',
      name: 'adventure_events_claim_lease',
    });
    expect(parseRegistryLine('20261005090000')).toEqual({ version: '20261005090000', name: '' });
    expect(parseRegistryLine('version,name')).toBeNull();
    expect(parseRegistryLine('')).toBeNull();
  });

  it('classe aligné, renuméroté, dépôt seul, registre seul, mis de côté', () => {
    const repo = [
      { version: '20261009093721', name: 'app_errors', file: '20261009093721_app_errors.sql' },
      { version: '20261012100000', name: 'adventure_events_claim_lease', file: 'a.sql' },
      { version: '20261012142746', name: 'hotfix', file: '20261012142746_hotfix.sql' },
      { version: '20261017120000', name: 'geo_trails', file: 'b.sql' },
    ];
    const registry = [
      { version: '20261009093721', name: 'app_errors' },
      { version: '20261012142746', name: 'adventure_events_claim_lease' },
      { version: '20261017151515', name: 'geo_trails' },
      { version: '20261005090000', name: '' },
      { version: '20260922000000', name: 'claim_revoke_after_app_deploy' },
    ];
    const res = compareLedger(repo, registry, ['20260922000000']);
    expect(res.aligned).toEqual(['20261009093721', '20261012142746']);
    expect(res.renumbered).toEqual([
      { name: 'geo_trails', repoVersion: '20261017120000', registryVersion: '20261017151515', file: 'b.sql' },
    ]);
    // Le fichier nommé dont la copie `_hotfix` porte la version du registre reste
    // « dépôt seul » : c'est un doublon à trancher, jamais une correspondance devinée.
    expect(res.repoOnly.map((r) => r.version)).toEqual(['20261012100000']);
    expect(res.registryOnly.map((r) => r.version)).toEqual(['20261005090000', '20260922000000']);
    expect(res.parkedInRegistry).toEqual(['20260922000000']);
  });

  it('ne devine pas une correspondance quand un nom est ambigu', () => {
    const repo = [
      { version: '20261001000000', name: 'fix', file: 'x.sql' },
      { version: '20261002000000', name: 'fix', file: 'y.sql' },
    ];
    const registry = [{ version: '20261003000000', name: 'fix' }];
    const res = compareLedger(repo, registry);
    expect(res.renumbered).toEqual([]);
    expect(res.repoOnly).toHaveLength(2);
    expect(res.registryOnly).toHaveLength(1);
  });

  it('CLI : lit les vrais fichiers du dépôt, ne modifie rien, --strict échoue sur écart', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ledger-'));
    const exportFile = path.join(dir, 'registre.csv');
    writeFileSync(exportFile, 'version,name\n20261005090000,\n', 'utf8');
    const script = path.resolve(process.cwd(), 'scripts/db/migrations-alignment.mjs');
    const out = execFileSync(process.execPath, [script, exportFile], { encoding: 'utf8' });
    expect(out).toMatch(/Dépôt : \d+ fichiers · registre : 1 lignes/);
    expect(out).toContain('20261005090000');
    expect(() => execFileSync(process.execPath, [script, exportFile, '--strict'], { stdio: 'pipe' })).toThrow();
  });
});
