/**
 * P0.1 - La phase LIEUX doit etre BRANCHEE, pas seulement ecrite.
 *
 * Une phase declaree, un rail qui l'annonce, sept tests verts : et pourtant
 * l'ecran ne la declencheait pas. `ItineraryStep` appelait
 * `runItineraryGeneration` avec cinq arguments sur sept, donc
 * `resolvePlaces` tombait sur son defaut `NO_PLACES`. La phase se coche,
 * l'ecran de chargement se deroule, et le modele ressortit avec ses 17 etapes
 * sans position - donc sans chaine a router, sans kilometre et sans point sur
 * la carte. Le code etait correct, les tests etaient verts, l'ecran non.
 *
 * Ces deux tests verrouillent le raccordement, parce qu'un argument manquant
 * ne casse aucune compilation : il ne casse que l'ecran.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screenPath = join(__dirname, '..', 'components', 'ItineraryStep.tsx');
const screen = readFileSync(screenPath, 'utf8');

describe("P0.1 - l'ecran branche la recherche des lieux", () => {
  it("P0.1-01 l'ecran atteint la source des lieux, celle qui interroge la base", () => {
    // L'ecran ne doit plus construire la requete lui-meme : il appelle le
    // resolveur, qui interroge `/api/pois` et accroche les positions. Ce que
    // compte le test, c'est le lien vers cette source - pas le nom des
    // fonctions internes, qui peuvent changer sans que l'ecran soit faux.
    expect(screen).toContain("from '../placeSource'");
    expect(screen).toContain('resolvePlacesFor(');
  });

  it('P0.1-02 le resolveur est bien passe a runItineraryGeneration', () => {
    // On lit l'appel entier : c'est le seul endroit ou un septieme argument
    // peut disparaitre sans qu'aucun test de compilation ne le remarque.
    const call = screen.slice(screen.indexOf('runItineraryGeneration('));
    const end = call.indexOf(');');
    const invocation = call.slice(0, end);
    expect(invocation).toContain('resolvePlacesFor');
  });
});
