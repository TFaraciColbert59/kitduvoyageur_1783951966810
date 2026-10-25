import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Toute classe posee par un composant doit exister dans la feuille.
 *
 * Le 2026-09-28, le bloc du programme du jour (ItineraryStep.tsx) portait
 * huit classes — `prep-programme__day`, `__dayhead`, `__daylabel`, `__weather`,
 * `__steps`, `__step`, `__steptitle`, `__list` — sans la moindre regle. Le
 * rendu etait celui du HTML nu : `Jour 1` et la meteo colles sans espace,
 * listes a puces brutes, aucun verre. Aucun test ne l attrapait : tous les
 * tests existants lisaient des chaines du CSS, jamais l inverse — verifier
 * que la feuille contient ce que le TSX demande.
 *
 * La liste ci-dessous est volontairement maintenue a la main plutot que
 * derivee : les utilitaires Tailwind (`flex`, `gap-2`...) legendent des
 * classes qui n'ont pas a etre dans la feuille, et une liste auto-derivee
 * reclamerait une table d'exceptions qui deviendrait fausse en silence.
 */

/*
 * La feuille est lue commentaires retires. Un bandeau de section pose entre la
 * regle precedente et la regle qu il annonce (accolade fermante, puis un
 * bandeau de commentaire, puis la regle) : c est du code pour le navigateur,
 * pas pour lelecteur. Sans ce retrait les deux regles passees plus bas
 * paraissaient absentes et le
 * test echouait sur du CSS correct. Symetriquement, une declaration qui
 * n existe que dans un commentaire ne doit jamais compter comme satisfaite —
 * c est exactement le faux vert qu a produit `prep-body-overflow.test.ts`,
 * dont la regex lisait `overflow-x: hidden` dans un commentaire. Les deux
 * sens sont verrouilles par les tests de garde-fous plus bas.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

const css = stripComments(readFileSync(join(__dirname, '..', 'adventure-prep.css'), 'utf8'));

const REQUIRED_SELECTORS = [
  // Programme du jour — eight classes, aucune regle avant le 2026-09-28.
  '.prep-programme',
  '.prep-programme__list',
  '.prep-programme__day',
  '.prep-programme__dayhead',
  '.prep-programme__daylabel',
  '.prep-programme__weather',
  '.prep-programme__steps',
  '.prep-programme__step',
  '.prep-programme__steptitle',
  // Renseignes par les agents sur leurs composants.
  '.prep-step__place',
  '.prep-step__states',
  '.prep-actionrow__link',
  '.prep-primary',
  '.prep-maphint',
  // Rangee utilitaire employee par les tiroirs de preparation.
  '.row',
  '.row.between',
];

function hasRule(selector: string, source: string = css): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\s])${escaped}(?=[\\s,{:>+~.\\[])`).test(stripComments(source));
}

function hasDeclaration(selector: string, declaration: RegExp, source: string = css): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`).exec(
    stripComments(source),
  );
  return match ? declaration.test(match[1]) : false;
}

describe('couverture des classes posees par les composants', () => {
  it.each(REQUIRED_SELECTORS)('%s existe dans la feuille', (selector) => {
    expect(hasRule(selector)).toBe(true);
  });
});

describe('le decor ne peut pas deborder horizontalement', () => {
  /*
   * Sonde du 2026-09-28, viewport 393x852 : `.adventure-prep` mesurait
   * `scrollWidth` 448 pour `clientWidth` 393. Le decor en relief
   * (`.adventure-prep::after`, anneau de 62vmin) sortait de 14 vmin a droite
   * et entrainait toute la page. `overflow: clip` seul ne suffitait pas : le
   * debordement provenait du pseudo-element, pas de la boite.
   */
  it('le relief decoratif reste dans la surface', () => {
    const confined =
      hasDeclaration('.adventure-prep::after', /right:\s*0\b/) ||
      hasDeclaration('.adventure-prep', /contain:\s*(paint|layout|strict)/);
    expect(confined).toBe(true);
  });
});

describe('les libelles de bloc ne tronquent pas leur valeur', () => {
  it('.prep-block__label ellipse au lieu de deborder', () => {
    expect(hasDeclaration('.prep-block__label', /text-overflow:\s*ellipsis/)).toBe(true);
  });

  it('.prep-block__stack ne se comprime pas', () => {
    expect(hasDeclaration('.prep-block__stack', /flex:\s*0 0 auto/)).toBe(true);
  });
});

describe('les garde-fous du detecteur ne peuvent pas etre satisfaits par un commentaire', () => {
  /*
   * Fixture synthetique, volontairementlee comme un navigateur : la regle `.b`
   * n existe que dans un commentaire, et le `}` qui la precede est lui aussi
   * dans le commentaire. Sans le retrait des commentaires, les deux assertions
   * ci-dessous passeraient — c est la preuve que le retrait works.
   */
  const commented = '.a { color: red; }\n/* } .b { flex: 0 0 auto; overflow: hidden; } */\n.c { color: blue; }';

  it('une regle uniquement commentee ne compte pas comme regle', () => {
    expect(hasRule('.b', commented)).toBe(false);
  });

  it('une declaration uniquement commentee ne compte pas comme declaration', () => {
    expect(hasDeclaration('.b', /flex:\s*0 0 auto/, commented)).toBe(false);
  });

  it('une regle reelle apres un commentaire reste vue', () => {
    expect(hasRule('.c', commented)).toBe(true);
  });
});
