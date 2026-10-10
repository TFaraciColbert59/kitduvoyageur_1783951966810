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

/**
 * Posture CSP documentée : Report-Only TANT QUE script-src contient
 * 'unsafe-inline'. Les scripts inline émis par Next.js à chaque rendu
 * (RSC payloads, HMR dev) sont incompatibles avec une allowlist par hash.
 * Passer en enforcing exige des nonces par requête (middleware) — ne PAS
 * simplement retirer 'unsafe-inline' (écran noir, incident constaté).
 */
describe('CSP posture', () => {
  const config = readFileSync(join(repoRoot, 'next.config.mjs'), 'utf8');

  it('reste en Report-Only (pas de enforcing sans nonces)', () => {
    expect(config).toContain('Content-Security-Policy-Report-Only');
    expect(config).not.toMatch(/key:\s*'Content-Security-Policy',/);
  });

  it('garde unsafe-inline tant que les scripts Next ne sont pas noncés', () => {
    expect(config).toContain("'unsafe-inline'");
  });

  it('le registre inline-scripts reste la source unique des 3 inlines', () => {
    for (const body of [THEME_INIT_JS, SW_CLEANUP_JS, TRAVELPAYOUTS_LOADER_JS]) {
      expect(body.length).toBeGreaterThan(20);
    }
    expect(THEME_INIT_JS).toContain('lkdv_theme');
    expect(TRAVELPAYOUTS_LOADER_JS).toContain('tpembars.com');
  });
});
