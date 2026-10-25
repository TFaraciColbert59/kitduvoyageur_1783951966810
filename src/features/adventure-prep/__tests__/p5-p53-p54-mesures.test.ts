/**
 * P5.3 et P5.4 - deux items qui exigeaient une MESURE, pas une lecture du CSS.
 *
 * La campagne de contraste (G3) ne passait que par le premier ecran, et
 * `/prepare` n etait meme pas dans ROUTES. Ces deux-la ont donc ete mesures
 * au navigateur, en 393x852, sur l etape 2 semee depuis un vrai draft
 * (qa-local/p53-draft.json -> 5 etapes, 2 jours).
 *
 * MESURES REELLES, 393x852, au pixel :
 *   .prep-day  pressee  : trait 1px solid, fond rgb(34,97,72)  opaque,
 *                          texte rgb(255,255,255)      100 %, graisse 750
 *   .prep-day  au repos : trait 1px solid, fond rgb(38,43,56)  opaque,
 *                          texte rgba(255,255,255,0.71)  71 %,  graisse 650
 *   rayon 999px, hauteur 44px, corps 13px : identiques dans les deux etats.
 *
 * Ces deux lignes datent d AVANT G1 et decrivent l etat au repos comme un
 * aplat : c etait vrai a la mesure, ce ne l est plus. Le repos est devenu du
 * verre (G1), puis son opacite a ete remontee de 0,84 a 0,94 (G3.1). Seul
 * l etat ACTIF est reste un aplat de marque, ce qui est voulu : c est le seul
 * element du rail qui doit se lire comme un bouton plein. P5.3-05 verrouille
 * les DEUX etats, pour qu aucun des deux ne puisse redevenir translucide.
 *
 * CE QUE CES CHIFFRES PROUVENT, ET CE QU ILS NE PROUVENT PAS.
 * Ils prouvent que la GEOMETRIE des pastilles est uniforme et que l etat actif
 * se distingue par le POIDS et l ALPHA DU TEXTE, pas par un bricolage de
 * boite. Ils prouvent aussi que le 0.71 n est PAS un alpha code en dur : il
 * vient de `--hub-white-secondary` (liquid-ios27.css:47), relie par
 * `--lkv-text-secondary` (liquid-ios27.css:50).
 * Ils ne prouvent PAS que le 0.71 est la bonne valeur de contraste - cela
 * appartient a la campagne de pixels (G3), pas ici.
 *
 * Carte d etape, meme passage :
 *   titre  .prep-step__name   17px / 700 / lh 23.8px   <- la SEULE taille 17
 *   corps  place, when,
 *          reason, price      13px / lh 18.2px
 *   donc exactement DEUX tailles sur la carte : 17 et 13.
 *
 * Chaque test MORD : reintroduire le defait decrit le fait rougir.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css'),
  'utf8'
);
const TOKENS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function escapeRe(value: string): string {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, (ch) => '\\' + ch);
}

/** Le corps d une regle, selecteur donne. */
function regle(css: string, selecteur: string): string {
  const source = '(^|\\})\\s*' + escapeRe(selecteur) + '\\s*(?:,[^{]*)?\\{([^}]*)\\}';
  const found = new RegExp(source, 'm').exec(css);
  expect(found, 'regle introuvable : ' + selecteur).not.toBeNull();
  return (found?.[2] ?? '').trim();
}

/** La valeur declaree d une propriete dans un corps de regle. */
function decl(corps: string, propriete: string): string | null {
  const found = new RegExp('(?:^|;|\\s)' + propriete + '\\s*:\\s*([^;]+)').exec(corps);
  return found ? found[1].trim() : null;
}

/** La valeur declaree d un jeton, dans un fichier de jetons. */
function jeton(source: string, nom: string): string {
  const found = new RegExp(escapeRe(nom) + '\\s*:\\s*([^;]+);').exec(source);
  expect(found, 'jeton introuvable : ' + nom).not.toBeNull();
  return (found?.[1] ?? '').trim();
}

const RE_CARDS = new RegExp('\\.(prep-step__[a-z-]+)\\s*\\{([^}]*)\\}', 'gs');

const JOUR = regle(CSS, '.prep-day');
const JOUR_ACTIF = regle(CSS, ".prep-day[aria-pressed='true']");

describe('P5.3 - les pastilles de jour sont uniformes', () => {
  it('P5.3-01: l epaisseur de trait vient du jeton, PAS d un px ecrit en dur', () => {
    // Mesure : 1px / solid dans les DEUX etats. Un 2px ecrit en dur sur
    // l etat actif serait la facon la plus rapide de casser l uniformite.
    expect(decl(JOUR, 'border')).toContain('var(--prep-hairline)');
    expect(jeton(CSS, '--prep-hairline')).toBe('1px');
  });

  it('P5.3-02: l etat actif ne RE DECLARE PAS l epaisseur, seulement la couleur', () => {
    // Une epaisseur reecrite ici decalerait la pastille de 1px a l activation.
    expect(decl(JOUR_ACTIF, 'border-width')).toBeNull();
    expect(decl(JOUR_ACTIF, 'border')).toBeNull();
    expect(decl(JOUR_ACTIF, 'border-color')).toBe('transparent');
  });

  it('P5.3-03: l etat actif ne change ni le rayon ni la taille du corps', () => {
    // Mesure : rayon pilule et corps 13px dans les deux etats. Le rayon est
    // desormais lu dans le jeton --prep-radius-pill (M2.4) et non plus dans un
    // 999px ecrit en dur : le RENDU est identique (le jeton vaut 9999px, la
    // pastille etant une capsule de 44px de haut), seule la feuille change.
    expect(decl(JOUR, 'border-radius')).toBe('var(--prep-radius-pill)');
    expect(decl(JOUR_ACTIF, 'border-radius')).toBeNull();
    expect(decl(JOUR, 'font-size')).toBe('var(--prep-type-meta)');
    expect(decl(JOUR_ACTIF, 'font-size')).toBeNull();
  });

  it('P5.3-04: la pastille fait 44pt de haut (cible tactile N1)', () => {
    // Mesure : hauteur 44px. La chaine de jetons est verifiee jusqu au bout.
    expect(decl(JOUR, 'min-height')).toBe('var(--control-height-md)');
    expect(jeton(TOKENS, '--control-height-md')).toContain('--lkv-touch-min');
    expect(jeton(TOKENS, '--lkv-touch-min')).toBe('44px');
  });

  it('P5.3-05: au repos la pastille est du VERRE, active c est un aplat de marque (cf. P5.7)', () => {
    /* Ce test disait "les deux fonds sont des APLATS". C etait faux, et pire :
       il passait meme quand le fond du repos etait devenu du verre, parce
       qu il ne verifiait que la FORME du jeton (`var(...)`) sans regarder la
       presence d un materiau. Une regle de verre et un aplat s y ressemble.

       MESURE, 393x852, apres le correctif G1 :
         repos  : background-color var(--prep-panel-bg) = rgba(16,16,16,0.94)
                 + backdrop-filter blur 22px + box-shadow --prep-glass-material
         actif  : background-color var(--btn-tint-solid), OPAQUE, encre
                 --btn-on-solid, graisse 750.
       Le repos est donc du verre, l actif un aplat plein : c est voulu et
       c est le SEUL element du rail qui doit se lire comme un bouton plein.
       On verifie les DEUX mats, sinon on laisserait passer un etat a moitie
       translucide ou un actif redevenu vitreux. */
    const fondRepos = decl(JOUR, 'background-color') ?? '';
    const fondActif = decl(JOUR_ACTIF, 'background-color') ?? '';
    // Repos : un materiau de verre, complet.
    expect(fondRepos, 'repos : fond absent').toBe('var(--prep-panel-bg)');
    expect(JOUR, 'repos : il faut flouter').toMatch(/backdrop-filter:\s*blur\(/);
    expect(JOUR, 'repos : il faut une arete').toMatch(/box-shadow:[^;]*var\(--prep-glass-material\)/);
    expect(fondRepos, 'repos : ne doit pas retomber sur un aplat').not.toMatch(/--card-tint-solid/);
    // Actif : un aplat de marque, opaque, sans materiau translucide.
    expect(fondActif, 'actif : fond absent').toBe('var(--btn-tint-solid)');
    expect(JOUR_ACTIF, 'actif : un aplat plein ne doit pas flouter').not.toMatch(
      /backdrop-filter:\s*blur\(/,
    );
    expect(JOUR_ACTIF, 'actif : un aplat plein ne doit pas porter le materiau').not.toMatch(
      /--prep-glass-material/,
    );
  });

  it('P5.3-06: aucune couleur en dur dans les deux regles, tout est en jeton', () => {
    // Le 0.71 mesure vient de --hub-white-secondary, PAS d un rgba ecrit ici.
    // On interdit donc le LITTERAL, pas une forme exacte : `border` est un
    // assemblage legitime de jetons et de mots cles.
    for (const [nom, corps] of [['repos', JOUR], ['actif', JOUR_ACTIF]] as const) {
      for (const ligne of corps.split(';')) {
        const propriete = ligne.split(':')[0].trim();
        if (!/^(color|background-color|border-color|border)$/.test(propriete)) continue;
        const valeur = ligne.slice(ligne.indexOf(':') + 1).trim();
        // Ni hexadecimal, ni rgb/rgba/hsl, ni nom de couleur HTML.
        expect(valeur, nom + ' / ' + propriete + ' : litteral de couleur').not.toMatch(
          /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:red|blue|green|white|black|grey|gray)\b/i
        );
        // Et la valeur porte au moins un jeton, sauf `transparent` nu.
        if (valeur !== 'transparent') {
          expect(valeur, nom + ' / ' + propriete + ' : aucun jeton').toContain('var(--');
        }
      }
    }
  });

  it('P5.3-07: les deux etats se distinguent VRAIMENT - uniformiser ne veut pas dire confondre', () => {
    // Le piege : uniformiser au point de fusionner les deux pastilles.
    const bgActif = decl(JOUR_ACTIF, 'background-color');
    const bgRepOS = decl(JOUR, 'background-color');
    expect(bgActif).not.toBeNull();
    expect(bgActif).not.toBe(bgRepOS);
    expect(decl(JOUR_ACTIF, 'color')).not.toBe(decl(JOUR, 'color'));
  });
});

describe('P5.4 - une seule hierarchie typographique par carte', () => {
  const slots = [...CSS.matchAll(RE_CARDS)]
    .map((m) => ({ nom: m[1] as string, corps: m[2] as string }))
    .filter((s) => decl(s.corps, 'font-size') !== null);

  it('P5.4-01: la carte a bien des slots de texte a mesurer', () => {
    expect(slots.length).toBeGreaterThanOrEqual(6);
  });

  it('P5.4-02: le titre est le SEUL slot en corps 17, tous les autres en 13', () => {
    const parTaille = new Map<string, string[]>();
    for (const s of slots) {
      const taille = decl(s.corps, 'font-size') as string;
      const liste = parTaille.get(taille) ?? [];
      liste.push(s.nom);
      parTaille.set(taille, liste);
    }
    // EXACTEMENT deux tailles, et une seule par slot : c'est la hierarchie.
    expect([...parTaille.keys()].sort()).toEqual([
      'var(--prep-type-body)',
      'var(--prep-type-meta)',
    ]);
    expect(parTaille.get('var(--prep-type-body)')).toEqual(['prep-step__name']);
    expect(parTaille.get('var(--prep-type-meta)')?.length).toBe(slots.length - 1);
  });

  it('P5.4-03: aucun px ecrit en dur dans les regles de la carte', () => {
    // Un 17px colle ici passerait le test 02 en apparence mais casserait
    // le jeton : c est ce que ce test interdit.
    for (const s of slots) {
      expect(decl(s.corps, 'font-size'), s.nom).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it('P5.4-04: les deux tailles resolues valent bien 17px et 13px', () => {
    // 1.0625rem = 17px et 0.8125rem = 13px a la racine de 16px.
    expect(jeton(TOKENS, '--lkv-text-body')).toBe('1.0625rem');
    expect(jeton(TOKENS, '--lkv-text-footnote')).toBe('0.8125rem');
    expect(jeton(CSS, '--prep-type-body')).toBe('var(--lkv-text-body)');
    expect(jeton(CSS, '--prep-type-meta')).toBe('var(--lkv-text-footnote)');
  });
});
