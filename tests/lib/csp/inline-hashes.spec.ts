import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SW_CLEANUP_JS,
  THEME_INIT_JS,
  TRAVELPAYOUTS_LOADER_JS,
} from '@/lib/csp/inline-scripts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

function sha256b64(body: string): string {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

/**
 * La CSP `script-src` autorise exactement ces contenus (hashes).
 * Si ce test échoue : recalculez les hashes (ils sont affichés dans
 * l'erreur) et mettez à jour `next.config.mjs` — jamais l'inverse.
 */
describe('CSP inline hashes', () => {
  it('next.config.mjs contient exactement les hashes du registre', () => {
    const config = readFileSync(join(repoRoot, 'next.config.mjs'), 'utf8');
    const expected = [THEME_INIT_JS, SW_CLEANUP_JS, TRAVELPAYOUTS_LOADER_JS].map(sha256b64);
    for (const hash of expected) {
      expect(config, `hash manquant dans next.config.mjs : ${hash}`).toContain(hash);
    }
    const found = config.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [];
    expect(found.sort()).toEqual(expected.sort());
  });
});
