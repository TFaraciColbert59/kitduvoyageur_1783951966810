import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte iOS 27 v16 — la card défile au lieu d’écraser les posts', () => {
  // Les règles de style ont été extraites dans des feuilles dédiées : on lit la
  // source TSX *et* les CSS, sans toucher aux assertions de contrat.
  const source = read('src/components/compte/CompteLiquidGlassV8.tsx') + '\n' + read('src/components/compte/compte-apple-hig.css') + '\n' + read('src/components/compte/compte-v8.css');
  const v16 = source.slice(source.indexOf('Compte iOS 27 v16'));

  it('1. Les blocs du conteneur scrollable gardent leur hauteur naturelle', () => {
    expect(v16).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0\s*!important/);
  });

  it('2. Le conteneur reste la seule couche scrollable de la card', () => {
    expect(source).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*\{[^}]*display:\s*flex/);
    expect(source).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*\{[^}]*flex-direction:\s*column/);
    expect(source).toMatch(/#card\.cs\s*>\s*\.card-scroll\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('3. La grille conserve son rognage de coins mais plus sa compression', () => {
    expect(source).toMatch(/\.ig-grid-wrap\s*\{[^}]*overflow:\s*hidden/);
    expect(v16).not.toMatch(/\.ig-grid-wrap\s*\{[^}]*height:\s*\d/);
  });

  it('isolation du Compas (aucun import de la refonte du compte)', () => {
    // Intention de l'invariant d'origine (« 0 modification dans /compas ») : cette refonte ne touche pas
    // au Compas. Une différence avec origin/main ne le prouve pas (elle échoue pour toute branche qui fait
    // évoluer le Compas) : on vérifie l'isolation, comme compte-refonte-v17 (remplacé le 01/11/2026).
    const leaks = execSync(
      'git grep -l -E "components/compte/|CompteLiquidGlassV8" -- src/app/compas src/features/compas || true',
      { encoding: 'utf8' },
    ).trim();
    expect(leaks).toBe('');
  });
});
