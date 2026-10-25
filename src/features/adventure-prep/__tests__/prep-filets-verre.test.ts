import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Un filet de verre est une COULEUR. `--glass-rim` est un ANNEAU d ombre.
 *
 * Les deux se ressemblent, ils n ont rien de commun. `--glass-rim` vaut
 * `0 0 0 0.5px …` dans les themes iOS 27 : c est une couche de `box-shadow`,
 * celle qui dessine l arete du verre. Pose dans un `border`, il ne rend pas
 * une bordure fine — il rend la declaration INVALIDE, et la bordure
 * disparait sans la moindre erreur, sans avertissement, sans trace.
 *
 * C est ce qui est arrive. Sur le theme iOS 27 actif, 24 declarations du
 * prepareur et 7 de free-departure ne bordaient plus rien : les trois tuiles
 * de mesures, le rail de generation, le bandeau du programme, les tiroirs.
 * Ce qui restait etait le reflet interne (deux traits blancs en haut et en
 * bas), qui se lisait alors comme un lisere mal enregistre.
 *
 * Ces tests verrouillent la distinction SANS liste de jetons autorises : un
 * jeton est juge sur sa valeur RESOLUE, dans le theme ou il est declare. Un
 * jeton qui reste une ombre dans un seul theme est refuse, car c est
 * precisement ce theme-la qui casse a l affichage.
 */
const RACINE = process.cwd();

/** Les deux feuilles qui posent des filets sur du verre. */
const FEUILLES = [
  'src/features/adventure-prep/adventure-prep.css',
  'src/features/free-departure/free-departure.css',
];

/** Ou sont declares les jetons, themes compris. */
const SOURCES_JETONS = [...FEUILLES, 'src/styles/tokens.css', 'src/styles/liquid-ios27.css'];

const lire = (chemin: string): string => readFileSync(join(RACINE, chemin), 'utf8');

/** Les commentaires ne sont pas des declarations : les purger avant de parser. */
const sansCommentaires = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Toutes les valeurs declarees pour un jeton, tous scopes confondus. */
const valeursDuJeton = new Map<string, string[]>();
for (const source of SOURCES_JETONS) {
  for (const m of sansCommentaires(lire(source)).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const nom = m[1] ?? '';
    const valeur = (m[2] ?? '').trim();
    const deja = valeursDuJeton.get(nom) ?? [];
    if (!deja.includes(valeur)) deja.push(valeur);
    valeursDuJeton.set(nom, deja);
  }
}

/** Resout un jeton jusqu aux litteraux, en suivant les alias. */
function resoudre(nom: string, vus: Set<string> = new Set()): string[] {
  if (vus.has(nom)) return [];
  const suivants = new Set(vus);
  suivants.add(nom);
  return (valeursDuJeton.get(nom) ?? []).flatMap((valeur) => {
    const alias = [...valeur.matchAll(/var\((--[a-z0-9-]+)\)/g)];
    if (alias.length === 0) return [valeur.trim()];
    return alias.flatMap((m) => resoudre(m[1] ?? '', suivants));
  });
}

type Nature = 'ombre' | 'couleur' | 'longueur' | 'inconnu';

/**
 * De quoi est fait le jeton ?
 *
 * On ne juge pas sur le nom : `--prep-hairline` vaut `1px` et
 * `--glass-rim` vaut `0 0 0 0.5px rgba(…)`, et les deux sont bien des
 * valeurs de mise en page sans etre de la meme nature.
 *
 * Le discriminant est la longueur ABSOLUTE. Une ombre en porte — c est une
 * liste de longueurs (`0 0 0 0.5px`, `inset 0 1px 0`, `0 8px 32px`). Une
 * couleur n en porte jamais, meme semi transparente, et `color-mix()` se
 * replie sur un pourcentage, pas sur un `px` : un pourcentage ne compte
 * donc pas comme une longueur, sinon le `color-mix` serait classe en
 * ombre. Une longueur seule n en porte qu une, et n est rien d autre.
 */
function nature(valeur: string): Nature {
  const v = valeur.trim();
  const absolues = v.match(/\d*\.?\d+(px|rem|em)\b/g) ?? [];
  if (absolues.length === 0) return /\b(rgba?|hsla?|color-mix|color|lab|lch|oklab|oklch)\s*\(|^#[0-9a-f]{3,8}$/i.test(v)
    ? 'couleur'
    : 'inconnu';
  // Une longueur et rien d autre : c est une longueur, pas une ombre.
  return absolues.length === 1 && v === absolues[0] ? 'longueur' : 'ombre';
}

/** Chaque declaration de la feuille, avec sa ligne. */
function declarations(css: string): { propriete: string; valeur: string; ligne: number }[] {
  const out: { propriete: string; valeur: string; ligne: number }[] = [];
  const re = /(?:^|[;{])\s*([a-z-]+)\s*:\s*([^;{}]+)/g;
  let m = re.exec(css);
  while (m !== null) {
    out.push({
      propriete: m[1] ?? '',
      valeur: (m[2] ?? '').trim(),
      ligne: css.slice(0, m.index).split('\n').length,
    });
    m = re.exec(css);
  }
  return out;
}

const jetonsCites = (valeur: string): string[] => [...valeur.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1] ?? '');

/** `border-radius` n est pas une bordure : c est un rayon. */
const PROPRIETES_BORDURE = /^border(-(top|right|bottom|left))?(-(color|width|style))?$/;

/** Les proprietes qui recoivent une couleur. `box-shadow` est hors tableau : son melange est legitime. */
const PROPRIETES_COULEUR = new Set([
  ...['border', 'border-top', 'border-right', 'border-bottom', 'border-left'],
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'color',
  'fill',
  'stroke',
]);

/** Les jetons d une declaration dont la valeur resolue est une ombre. */
function ombresCitees(valeur: string): string[] {
  return jetonsCites(valeur).filter((jeton) => resoudre(jeton).some((v) => nature(v) === 'ombre'));
}

describe('filets de verre — une bordure ne recoit jamais une ombre', () => {
  it('--glass-rim est une ombre dans un theme, et une couleur dans un autre', () => {
    // Ce dualite est la raison du silence : le meme jeton fonctionne dans un
    // theme et casse dans l autre, sans jamais lever la moindre erreur.
    const valeurs = valeursDuJeton.get('--glass-rim') ?? [];
    expect(valeurs.length, '--glass-rim introuvable').toBeGreaterThan(0);
    expect(valeurs.filter((v) => nature(v) === 'ombre').length).toBeGreaterThan(0);
    expect(valeurs.filter((v) => nature(v) === 'couleur').length).toBeGreaterThan(0);
  });

  it('aucune bordure ne recoit un jeton qui est une ombre dans un theme', () => {
    const coupables: string[] = [];
    for (const feuille of FEUILLES) {
      for (const d of declarations(sansCommentaires(lire(feuille)))) {
        if (!PROPRIETES_BORDURE.test(d.propriete)) continue;
        const ombres = ombresCitees(d.valeur);
        if (ombres.length > 0) coupables.push(`${feuille}:${d.ligne} — ${d.propriete}: ${d.valeur} (${ombres[0]})`);
      }
    }
    expect(
      coupables,
      'une bordure qui recoit une ombre devient invalide et disparait sans bruit',
    ).toEqual([]);
  });

  it('aucune couleur ne recoit un jeton qui est une ombre', () => {
    const coupables: string[] = [];
    for (const feuille of FEUILLES) {
      for (const d of declarations(sansCommentaires(lire(feuille)))) {
        if (!PROPRIETES_COULEUR.has(d.propriete)) continue;
        const ombres = ombresCitees(d.valeur);
        if (ombres.length > 0) coupables.push(`${feuille}:${d.ligne} — ${d.propriete}: ${d.valeur} (${ombres[0]})`);
      }
    }
    expect(coupables, 'une couleur qui recoit une ombre devient invalide, elle aussi en silence').toEqual([]);
  });
});

describe('filets de verre — le trait unique du chantier', () => {
  it('le jeton de largeur est une longueur', () => {
    const valeurs = resoudre('--prep-hairline');
    expect(valeurs.length, '--prep-hairline introuvable').toBeGreaterThan(0);
    for (const v of valeurs) expect(nature(v), `--prep-hairline devrait etre une longueur : ${v}`).toBe('longueur');
  });

  it('le jeton d encre est une couleur, dans tous les themes', () => {
    const valeurs = resoudre('--prep-hairline-ink');
    expect(valeurs.length, '--prep-hairline-ink introuvable').toBeGreaterThan(0);
    for (const v of valeurs) expect(nature(v), `--prep-hairline-ink devrait etre une couleur : ${v}`).toBe('couleur');
  });

  it('chaque filet du verre pose la paire, et le prepareur l utilise', () => {
    const filets = declarations(sansCommentaires(lire(FEUILLES[0]!))).filter(
      (d) => PROPRIETES_BORDURE.test(d.propriete) && d.valeur.includes('var(--prep-hairline)'),
    );
    expect(filets.length, 'aucun filet ne pose la paire --prep-hairline / --prep-hairline-ink').toBeGreaterThan(0);
    for (const d of filets) {
      expect(d.valeur, `${FEUILLES[0]}:${d.ligne} — un filet sans encre ne se voit pas`).toContain(
        'var(--prep-hairline-ink)',
      );
    }
  });
});
