import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * L1 / L5 — les deux barres.
 *
 * L5 est une reclamation de l'utilisateur, repetee : « la bottom bar ne
 * s'affiche pas et rien ne doit se superposer par dessus elle ». Le verrou de
 * fond est deja dans `prep-bottom-inset.test.ts`, qui va jusqu'au TSX du
 * greffon. On ne le duplique pas : on verifie ici ce qui appartient
 * reellement a cette feuille — la reservation est-elle une VARIABLE, et non
 * une hauteur figee ? La feuille peut-elle poser quelque chose au-dessus ?
 *
 * L1.5 : la pastille de progression de la barre haute ne doit jamais
 * s'ellipser. Elle tient sur une ligne a 393 px ; si un libelle d'etape
 * s'allonge, c'est la barre qui doit s'adapter, pas le texte qui disparait.
 *
 * L1.1 a L1.4 (retirer bouton retour / fermeture / filtres, pastilles de
 * fil d'Ariane) ne sont PAS verifiables ici : ce sont des elements TSX, et
 * `ItineraryStep.tsx` n'est pas de mon perimetre. Ces items restent ouverts.
 */

const CSS = join(__dirname, '..', 'adventure-prep.css');
const css = readFileSync(CSS, 'utf8');
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    const sel = (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((p) => p.trim());
    // Les commentaires sont retires du CORPS aussi : un commentaire qui
    // contient `:` et point-virgule absorberait sinon la declaration suivante.
    const corps = (m[2] ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (sel.includes(selector)) {
      for (const d of corps.split(';')) {
        const i = d.indexOf(':');
        if (i > 0) out.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
      }
    }
    m = re.exec(css);
  }
  return out;
}

/** La declaration complete d'un jeton, commentaires retires. */
function blocJeton(nom: string): string {
  const i = css.indexOf(`--${nom}:`);
  expect(i, `jeton introuvable : --${nom}`).toBeGreaterThan(-1);
  const fin = css.indexOf(';', i);
  return css
    .slice(i, fin + 1)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ');
}

describe('L5 — la reservation basse ne se fige pas et rien ne la recouvre', () => {
  it('--prep-bottom-inset passe par la hauteur publiee de la barre basse', () => {
    expect(blocJeton('prep-bottom-inset')).toContain('var(--bottom-nav-height');
  });

  it('la reservation cumule bien bandeau cookies ET barre basse', () => {
    const bloc = blocJeton('prep-bottom-inset');
    expect(bloc, 'le bandeau cookies doit rester dans la somme').toContain('var(--cookie-banner-h');
    expect(bloc, 'la barre basse doit rester dans la somme').toContain('var(--bottom-nav-height');
  });

  it('la reservation ne contient aucune hauteur figee', () => {
    // Le reproche d origine : une hauteur ecrite en dur dans la feuille.
    // Ignoree quand la barre n existe pas, elle ne peut plus la rattraper si
    // elle grandit. Seul le 0 est admis : `var(--cookie-banner-h, 0px)` ne
    // dit pas « 0 pixel de bandeau », il dit « aucun bandeau publie ».
    const px = [...blocJeton('prep-bottom-inset').matchAll(/\b(\d+)px\b/g)]
      .map((m) => Number(m[1]))
      .filter((n) => n !== 0);
    expect(px, `hauteurs figees dans la reservation : ${JSON.stringify(px)}`).toEqual([]);
  });

  it('le seul repli en pixels de la reservation est le zero d absence', () => {
    expect(blocJeton('prep-bottom-inset')).toContain('var(--cookie-banner-h, 0px)');
  });

  it('la coque du scrollable retire exactement cette reservation', () => {
    const d = declarations('.adventure-prep');
    const h = d.get('height') ?? '';
    expect(h, 'la hauteur de la coque ne deduit plus la reservation basse').toContain(
      'var(--prep-bottom-inset)',
    );
    expect(h).toContain('100dvh');
  });

  it('la coque ne laisse rien deborder par-dessus la barre', () => {
    expect(declarations('.adventure-prep').get('overflow')).toBe('hidden');
  });

  it('la feuille ne pose qu UN seul element en position fixe, et c est la carte plein ecran', () => {
    // Un fixed dans cette feuille peut passer devant la barre basse. On
    // compte donc, et on nomme le seul tolere.
    const fixed = [...sansCommentaires.matchAll(/(?:^|[;{])\s*position:\s*fixed/g)].length;
    expect(fixed, 'un nouvel overlay fixe est apparu dans la feuille').toBe(1);
    expect(css, 'le seul fixed autorise est la carte en plein ecran').toMatch(
      /\.prep-map--full\s*\{[^}]*position:\s*fixed/,
    );
  });

  it('la barre basse elle-meme n est pas une surface de cette feuille', () => {
    // Elle est montee par WebNavigationBar, hors de ce fichier : le
    // preparateur ne doit donc jamais la redessiner par-dessus.
    expect(css, 'le preparateur redessine une barre basse').not.toMatch(/\.bottom-nav\s*\{/);
    expect(
      sansCommentaires,
      'le preparateur fixe lui-meme la barre basse par-dessus la reservation',
    ).not.toMatch(/position:\s*fixed;[^;}]*bottom:\s*0/);
  });
});

describe('L1.5 — la pastille de progression ne s ellipse pas', () => {
  it('elle tient sur une seule ligne', () => {
    expect(declarations('.prep-nav__progress').get('white-space')).toBe('nowrap');
  });

  it('elle ne peut pas etre tronquee', () => {
    const d = declarations('.prep-nav__progress');
    expect(`text-overflow=${d.get('text-overflow') ?? ''}`).toBe('text-overflow=');
    expect(`overflow=${d.get('overflow') ?? ''}`).toBe('overflow=');
  });

  it('elle est centree et bornee par la largeur de la barre', () => {
    const d = declarations('.prep-nav__progress');
    expect(d.get('justify-self')).toBe('center');
    expect(d.get('max-width')).toBe('100%');
  });

  it('la barre haute garde ses trois colonnes et une hauteur declaree', () => {
    const d = declarations('.prep-nav');
    // retour / contenu / action : la grille tient la place meme si un des
    // deux bouts disparait (etape 1 n'a pas de retour).
    expect(d.get('grid-template-columns') ?? '').toMatch(/var\(--control-height-md\)/);
    expect(d.get('min-height') ?? '').toMatch(/^var\(--prep-nav-height\)$/);
  });
});
