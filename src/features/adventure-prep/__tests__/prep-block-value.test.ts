import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

/** Toutes les declarations jamais ecrites pour ce selecteur, du debut a la fin. */
function allDeclarations(selector: string): string {
  const pattern = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:,[^{]*)?\\{([^}]*)\\}',
    'g',
  );
  return [...css.matchAll(pattern)].map((m) => m[1]).join('\n');
}

describe('la valeur d un bloc ne se fait jamais couper par un libelle long', () => {
  it('interdit a la valeur de retrecir avant le libelle', () => {
    // Regression observee sur l ecran 12 : le libelle « Destination ou
    // hebergement de base » passe sur deux lignes, la valeur « A verifier » se
    // fait reduire a « A ve… ». Les deux enfants sont en flex-shrink 1, donc la
    // reduction se partage au prorata et la valeur — la plus courte — perd
    // aussi. La valeur doit garder sa largeur intrinsèque.
    const value = allDeclarations('.prep-block__value');
    expect(value).toMatch(/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/);
  });

  it('garde la troncature pour une valeur vraiment trop longue', () => {
    // Une valeur peut rester legitement coupee : un nom de lieu tres long ou
    // une adresse. On ne supprime donc pas l ellipse, on change seulement qui
    //Trigger la premiere.
    const value = allDeclarations('.prep-block__value');
    expect(value).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('laisse le libelle se reduire, lui seul, plutot que de pousser la valeur', () => {
    // Ce test exigeait `flex-grow: 1`. Mesure du 2026-09-29 (393x852,
    // `/prepare?nouvelle=1`, etape 1, libelle « Destination ou hebergement de
    // base » + valeur « 3 personnes · 1 adulte ») : avec la pile en
    // `flex: 0 0 auto`, `flex: 0 1 auto` et `flex: 1 1 auto` donnent la meme
    // boite au pixel pres (183.9 / 183.9). Le libelle est le seul element
    // qui peut s etendre, donc son grow ne change rien a l ecran — le contrat
    // decrivait une intention, pas une geometrie.
    //
    // Ce qui protege reellement la valeur est ailleurs, et les deux assertions
    // ci-dessous le disent :
    //   - le libelle se laisse reduire (sinon son texte deborde sur la pile) ;
    //   - il se tronque dans sa boite plutot que de painted par-dessus.
    const label = allDeclarations('.prep-block__label');
    expect(label).toMatch(/min-width:\s*0/);
    expect(label, 'un libelle bloque sur sa largeur deborde sur la valeur').not.toMatch(
      /flex:\s*0\s+0\s+auto|flex-shrink:\s*0/,
    );
    expect(label, 'sans ellipse, le libelle peint son texte sur la valeur').toMatch(
      /text-overflow:\s*ellipsis/,
    );
  });
});