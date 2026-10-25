import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 100, 2.2 : une seule lecture de l'adresse du client. Chaque route qui lisait
 * `x-forwarded-for` à sa façon (premier saut, chaîne entière) avait sa propre
 * faille ; elles passent toutes par `clientIpFromHeaders` (`src/lib/rate-limit`).
 * Ce test casse si une lecture directe des en-têtes de proxy réapparaît ailleurs.
 */
const SRC = join(process.cwd(), 'src');
const HEADER = /x-forwarded-for|x-real-ip|x-vercel-forwarded-for|cf-connecting-ip|true-client-ip/i;
const ALLOWED = new Set(['lib/rate-limit/clientIp.ts']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('adresse du client : un seul endroit la lit', () => {
  it('aucun fichier de src/ ne lit les en-têtes de proxy hors de clientIp.ts', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => HEADER.test(readFileSync(join(SRC, file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
