import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Deux migrations ne partagent jamais une version : le ledger (`schema_migrations`) n'en garde qu'une,
 * et `database-gates` échoue (« migrations non inscrites au ledger »). Arrivé le 13 octobre quand deux
 * branches ont créé chacune une migration `20261013090000_…`.
 */
describe('migrations — une version par fichier', () => {
  it('aucune version en double dans supabase/migrations', () => {
    const dir = path.join(process.cwd(), 'supabase/migrations');
    const versions = readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.split('_')[0]);
    const seen = new Set<string>();
    const doubles = versions.filter((v) => (seen.has(v) ? true : (seen.add(v), false)));
    expect(doubles).toEqual([]);
  });
});
