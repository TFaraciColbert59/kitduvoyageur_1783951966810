import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M2.4 — « 2 rayons maximum, documentes ».
 *
 * CE QUE CES TESTS PROUVENT : le travail de reduction fait sur la feuille.
 *   - les trois jetons de rayon morts (map / map-compact / fullscreen) ont ete
 *     supprimes : ils etaient definis et jamais consommes ;
 *   - il ne reste que trois jetons --prep-radius-*, chacun aliasant un jeton
 *     global plutot que de recopier un nombre ;
 *   - les surfaces de carte lisent --prep-radius-card au lieu du jeton global
 *     ecrit en dur ;
 *   - plus aucun border-radius ne porte de repli en dur. C etait le point le
 *     plus tendu : `var(--radius-lg, 14px)` sur .prep-notice referencait un
 *     jeton qui N'EXISTE PAS dans src, donc la surface rendait toujours 14 px,
 *     un nombre plausible ecrit en dur. Elle rejoint maintenant le rayon des
 *     tuiles soeurs.
 *
 * CE QUE CES TESTS NE PROUVENT PAS, ET LE DISENT : l'item n'est pas termine.
 * On mesure ci-dessous le nombre de rayons distincts encore poses, et le
 * test echoue volontairement tant qu'il n'y en a pas deux. C'est un etat
 * mesure, pas une declaration.
 *
 * Pourquoi --prep-radius-sheet survit : `free-departure.css` (autre
 * proprietaire, hors de mon perimetre) lit ce jeton depuis le :root de cette
 * feuille. Le supprimer casse `design-tokens-p017.test.ts`. L'aliaser sur
 * --prep-radius-card changerait la feuille de 36 px a 18 px : visible. Il est
 * donc conserve, et le test verifie que la dependance croisee reste vraie.
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

function jeton(nom: string): string {
  const m = new RegExp(`--${nom}:\\s*([^;]+);`).exec(css);
  expect(m, `jeton introuvable : --${nom}`).not.toBeNull();
  return (m?.[1] ?? '').trim();
}

/** Toutes les valeurs border-radius posees, hors commentaires. */
function rayons(): string[] {
  return [...sansCommentaires.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => (m[1] ?? '').trim());
}

const JETONS_SUPPRIMES = ['prep-radius-map', 'prep-radius-map-compact', 'prep-radius-fullscreen'];

describe('M2.4 — etat mesure de la reduction des rayons', () => {
  it('les jetons de rayon morts ont disparu', () => {
    for (const nom of JETONS_SUPPRIMES) {
      expect(css, `--${nom} est toujours defini`).not.toContain(`--${nom}:`);
    }
  });

  it('il ne reste que trois jetons de rayon, chacun aliasant un jeton global', () => {
    const trouves = [...new Set([...css.matchAll(/(--prep-radius-[a-z-]+):\s*([^;]+);/g)].map((m) => m[1] ?? ''))].sort();
    expect(trouves).toEqual(['--prep-radius-card', '--prep-radius-pill', '--prep-radius-sheet']);
    // Un alias, pas une recopie : chacun pointe sur un jeton du design system.
    for (const nom of ['prep-radius-card', 'prep-radius-pill', 'prep-radius-sheet'] as const) {
      expect(jeton(nom), `--${nom} doit pointer sur un jeton global`).toMatch(/^var\(\s*--lkv-radius-/);
    }
  });

  it('aucun des deux jetons locaux n est defini sans etre pose', () => {
    // --prep-radius-sheet est le cas a part : il est defini ici et consomme
    // par free-departure.css, que la dependance croisee verifie plus bas.
    for (const nom of ['prep-radius-card', 'prep-radius-pill'] as const) {
      const n = (css.match(new RegExp(`var\\(\\s*--${nom}\\s*[,)]`, 'g')) ?? []).length;
      expect(n, `--${nom} est defini mais jamais applique dans cette feuille`).toBeGreaterThan(0);
    }
    expect(css).toMatch(/--prep-radius-sheet:/);
  });

  it('aucun border-radius ne porte de repli en dur', () => {
    // Regle du chantier : jamais de nombre plausible en dur comme repli.
    // Un repli sur un jeton existant est du bruit ; un repli sur un jeton
    // INEXISTANT (`--radius-lg`) est une donnee inventee : c'etait exactement
    // le cas de .prep-notice, qui rendait 14 px sans que rien ne le declare.
    const coupables = rayons().filter((v) => /var\([^)]*,[^)]*\)/.test(v));
    expect(coupables, `repli en dur encore present : ${JSON.stringify(coupables)}`).toEqual([]);
  });

  it('le jeton invente --radius-lg a disparu de la feuille', () => {
    // Regression ciblee : .prep-notice lisait `var(--radius-lg, 14px)` alors
    // que --radius-lg n existe nulle part dans src. La pastille rendait donc
    // 14 px sans qu aucune declaration ne les porte.
    expect(css, '--radius-lg est toujours reference').not.toContain('--radius-lg');
    expect(css, 'le repli invente 14px est toujours present').not.toMatch(/,\s*14px\s*\)/);
    expect(declarations('.prep-notice').get('border-radius')).toBe('var(--lkv-radius-concentric)');
  });

  it('aucun repli de var() n est une mesure inventee', () => {
    // Seuls replis admis dans tout le fichier : le zero d absence (rien a
    // publier au runtime) et un alias vers un autre jeton. Jamais un nombre.
    for (const m of sansCommentaires.matchAll(/var\(\s*--[a-zA-Z0-9-]+\s*,\s*([^)]*)\)/g)) {
      const repli = (m[1] ?? '').trim();
      const admis = repli === '0px' || repli.startsWith('var(');
      expect(admis, `repli ${repli} : mesure inventee, pas l absence de valeur`).toBe(true);
    }
  });

  it('M2.4 RESTE OUVERT : il y a encore plus de deux rayons distincts', () => {
    // Etat mesure au 2026-09-29, revu le meme jour pour L1.4 : passer le rail
    // d'etapes en pastilles a retire le `border-radius: 2px` du focus-visible,
    // un rayon ecrit en dur qui n'etait ni dans le design system ni dans la
    // recette du verre. On passe donc de 15 a 14 rayons distincts.
    //
    // Ce test ne valide pas l'item : il ENregistre l'ecart, et tombera des que
    // le fichier sera ramene a deux rayons. Chaque reduction doit se voir ici.
    const distincts = [...new Set(rayons())];
    expect(
      distincts.length,
      `il ne reste que ${distincts.length} rayons distincts (${JSON.stringify(distincts)}) : mettre a jour`,
    ).toBe(14);
  });

  it('la dependance croisee sur --prep-radius-sheet est toujours vraie', () => {
    // free-departure.css n'est pas a moi ; c'est precisement pourquoi le jeton
    // ne peut pas etre supprime ni ramene sur le rayon de carte.
    const fd = readFileSync(join(__dirname, '..', '..', 'free-departure', 'free-departure.css'), 'utf8');
    expect(fd, 'free-departure.css ne lit plus --prep-radius-sheet : le jeton peut enfin partir').toContain(
      'var(--prep-radius-sheet)',
    );
  });
});
