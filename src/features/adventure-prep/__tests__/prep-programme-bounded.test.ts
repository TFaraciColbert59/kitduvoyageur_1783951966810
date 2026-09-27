import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'adventure-prep.css'), 'utf8');
const itinerary = readFileSync(join(here, '..', 'components', 'ItineraryStep.tsx'), 'utf8');

const ANCHOR = '.prep-body > .prep-map:not(.prep-map--full)';
const INLINE = '.prep-body > .prep-map--inline:not(.prep-map--full)';

/** Nombre de classes d'un selecteur : `.a > .b:not(.c)` en compte trois. */
function weight(selector: string): number {
  return (selector.match(/\.[-\w]+/g) ?? []).length;
}

/**
 * Corps d'une regle CSS. Ancre en debut de ligne et refus d'un suffixe de nom
 * de classe : sans cela `.prep-map` matchait aussi
 * `.prep-screen--dense .prep-map`, et le test portait sur la mauvaise regle.
 */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
  const pattern = new RegExp(
    '(?:^|\\n)\\s*' + escaped + '(?![-\\w])\\s*(?:,[^{]*)?\\{([^}]*)\\}',
  );
  return css.match(pattern)?.[1] ?? '';
}

describe("l'etape 2 pose la carte dans le flux, comme la maquette", () => {
  it('pose la carte du parcours AVANT le programme, dans la colonne flex', () => {
    // Mesure avant correction : le <ul> du programme mesurait 732 px dans un
    // viewport de 844 px, la carte posee en bas du scrollport le recouvrait et
    // la premiere etape etait invisible au premier ecran. La maquette place la
    // carte en element de flux, pas en voile colle par-dessus.
    expect(itinerary.match(/prep-map--inline/g) ?? []).toHaveLength(1);
    expect(css).toContain(INLINE + ' {');

    const inline = rule(INLINE);
    expect(inline).toMatch(/order:\s*0/);
    expect(inline).toMatch(/position:\s*relative/);
    expect(inline).toMatch(/bottom:\s*auto/);
  });

  it("l'ecrasement muet du selecteur est verrouille, pas seulement evite", () => {
    // La regle d ancrage pese (0,3,0) : meme parent, meme :not(), meme nombre de
    // classes que la variante. Une variante ecrite en simple .prep-map--inline
    // ne pesait que (0,1,0) et se faisait ecraser SANS ERREUR : mesure au
    // navigateur la carte gardait son order 99 et partait a 1676 px, donc
    // invisible — alors que le test passait quand meme. A specificite egale
    // c'est l ORDRE DU FICHIER qui tranche, donc cet ordre est une regle de
    // conception et pas un hasard de tri.
    expect(weight(INLINE)).toBe(weight(ANCHOR));
    expect(css.indexOf(INLINE + ' {')).toBeGreaterThan(css.indexOf(ANCHOR + ' {'));
  });

  it('la carte du parcours est bien celle du programme, pas celle du plein ecran', () => {
    // La variante ne doit porter que sur la carte du programme : l overlay plein
    // ecran (ecran 40) reste en position fixe, sinon il deviendrait inatteignable.
    const variantIndex = itinerary.indexOf('className="prep-map--inline"');
    const nameIndex = itinerary.indexOf('name="Ton parcours"');
    expect(variantIndex).toBeGreaterThan(-1);
    expect(nameIndex).toBeGreaterThan(variantIndex);
    // Moins de 120 caracteres : la classe est bien posee sur ce PrepMap-la.
    expect(nameIndex - variantIndex).toBeLessThan(120);
  });

  it('laisse UNE seule region defilable : le corps, jamais la liste', () => {
    // Borner la liste a 42vh avec un overflow-y creait une deuxieme region
    // defilable dans .prep-body : deux barres imbriquees sur le meme pouce, le
    // defilement enchaine vers la liste avant d aller plus loin.
    const list = rule('.prep-programme__list');
    expect(list).not.toMatch(/overflow-y/);
    expect(list).not.toMatch(/max-height/);
  });

  it('interdit au programme de s ecraser a zero', () => {
    // Plans B (309 px) et « Ce que l app ne sait pas » (235 px) ne peuvent pas
    // reduire : sans flex: 0 0 auto la colonne flex leur cede toute la reduction
    // et le programme, lui, retombe a 0 px — donc invisible.
    expect(rule('.prep-programme')).toMatch(/flex:\s*0\s+0\s+auto/);
  });

  it('conserve la carte posee au-dessus du CTA sur les etats ou le contenu tient', () => {
    // Exigence de la maquette et du cahier des charges : la carte reste en bas de
    // page, avec le trace et les points d interet, sur chaque etape. La variante
    // --inline est une exception ciblee a l etape 2, pas une regle generale.
    const base = rule('.prep-map');
    expect(base).toMatch(/position:\s*sticky/);
    expect(base).toMatch(/bottom:\s*0/);
    expect(css).toMatch(/order:\s*99/);
  });

  it('la liste du programme porte bien la classe bornee', () => {
    expect(itinerary).toMatch(/prep-programme__list/);
  });
});
