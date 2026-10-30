import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSeedDemoCredentials } from '../../scripts/seed/seed_demo_credentials.mjs';

describe('demo seed credentials', () => {
  it.each([
    {},
    { SEED_DEMO_EMAIL: 'operator@example.invalid' },
    { SEED_DEMO_PASSWORD: 'operator-supplied-value' },
    { SEED_DEMO_EMAIL: ' ', SEED_DEMO_PASSWORD: 'operator-supplied-value' },
    { SEED_DEMO_EMAIL: 'operator@example.invalid', SEED_DEMO_PASSWORD: ' ' },
  ])('fails closed when either credential is absent or blank', (env) => {
    expect(() => readSeedDemoCredentials(env)).toThrow(
      'SEED_DEMO_EMAIL et SEED_DEMO_PASSWORD sont requis'
    );
  });

  it('uses supplied credentials, trimming email but preserving password bytes', () => {
    expect(readSeedDemoCredentials({
      SEED_DEMO_EMAIL: ' operator@example.invalid ',
      SEED_DEMO_PASSWORD: ' operator-supplied-value ',
    })).toEqual({ email: 'operator@example.invalid', password: ' operator-supplied-value ' });
  });

  it('never includes supplied values in configuration errors', () => {
    expect(() => readSeedDemoCredentials({
      SEED_DEMO_PASSWORD: 'private-value-for-error-check',
    })).toThrow(/^SEED_DEMO_EMAIL et SEED_DEMO_PASSWORD sont requis$/);
  });

  it('validates before creating a remote client and limits the password to its auth write', () => {
    const source = readFileSync('scripts/seed/seed_compte_demo_complet.mjs', 'utf8');
    const validation = source.indexOf('= readSeedDemoCredentials(');
    expect(validation).toBeGreaterThan(0);
    expect(validation).toBeLessThan(source.indexOf('const supabase = createClient('));
    // `note()` also prints and retains messages in the final summary. Restrict
    // all uses, rather than looking only for direct console calls.
    const passwordUses = source.split('\n')
      .filter((line) => line.includes('DEMO_PASSWORD'))
      .map((line) => line.trim());
    expect(passwordUses).toEqual([
      'const { email: DEMO_EMAIL, password: DEMO_PASSWORD } = readSeedDemoCredentials();',
      'password: DEMO_PASSWORD,',
    ]);
  });
});
