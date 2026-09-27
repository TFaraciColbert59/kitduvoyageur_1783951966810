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

  it('autorise le libelle a passer a la ligne plutot que de pousser la valeur', () => {
    const label = allDeclarations('.prep-block__label');
    expect(label).toMatch(/flex:\s*1\s+1\s+auto|flex-grow:\s*1/);
    expect(label).toMatch(/min-width:\s*0/);
  });
});