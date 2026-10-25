import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HOMEPAGE = path.join(ROOT, 'src', 'app', 'page.tsx');

/**
 * H0.5 (D8) — aucun lien de l'accueil ne pointe vers une route inexistante.
 * Rouge attendu tant que /boutique et /manifeste n'existent pas et que
 * page.tsx référence /ateliers, /presse ou /confidentialite (404 avérés H0).
 */
function routeExists(route: string): boolean {
  return fs.existsSync(path.join(ROOT, 'src', 'app', route, 'page.tsx'));
}

describe('H0.5 liens morts accueil (D8)', () => {
  it('H05-1: /boutique existe (45 références, middleware /catalogue -> /boutique)', () => {
    expect(routeExists('boutique')).toBe(true);
  });

  it('H05-2: /manifeste existe (CTA hero + footer MAISON)', () => {
    expect(routeExists('manifeste')).toBe(true);
  });

  it('H05-3: page.tsx ne référence plus /ateliers (route inexistante)', () => {
    const src = fs.readFileSync(HOMEPAGE, 'utf8');
    expect(src).not.toContain('href="/ateliers"');
  });

  it('H05-4: page.tsx ne référence plus /presse (route inexistante)', () => {
    const src = fs.readFileSync(HOMEPAGE, 'utf8');
    expect(src).not.toContain('href="/presse"');
  });

  it('H05-5: page.tsx ne référence plus href="/confidentialite" (la route est /politique-confidentialite)', () => {
    const src = fs.readFileSync(HOMEPAGE, 'utf8');
    expect(src).not.toContain('href="/confidentialite"');
    expect(routeExists('politique-confidentialite')).toBe(true);
  });
});
