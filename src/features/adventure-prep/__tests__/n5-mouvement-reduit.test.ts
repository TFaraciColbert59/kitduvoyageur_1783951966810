/**
 * N5 — `prefers-reduced-motion` : les quatre jetons de mouvement remises a zero.
 *
 * Le repli existait deja (`adventure-prep.css`, bloc `@media
 * (prefers-reduced-motion: reduce)` sur `:root`). Ce qui manquait, etait un
 * test EXECUTE : rien ne verifiait que les quatre jetons de mouvement du
 * preparateur etaient bien neutralises.
 *
 * Trois pieges que ce fichier ferme explicitement, parce que chacun rend
 * l assertion vide sans la rendre fausse :
 *
 * 1. Un test qui cherche `--prep-duration-control: 0.001ms` dans toute la
 *    feuille passerait meme bloc supprime, tant que la chaine reste. On isole
 *    donc le CORPS du media query par equilibre d accolades, et on y cherche
 *    les declarations.
 * 2. Un jeton remis a zero dans le repli ne prouve rien si le meme jeton vaut
 *    deja zero HORS repli. On resout donc la chaine d alias jusqu a
 *    `tokens.css` et on exige que la valeur normale soit non nulle : c est
 *    le CONTRASTE entre les deux etats qui rend l assertion mordante.
 * 3. Un jeton pose et jamais lu ne change aucun pixel. Ce controle existe
 *    ici, mais il ne porte que sur le jeton reellement consomme — voir
 *    N5-03 pour le detail honnete de ce que la feuille fait et ne fait pas.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = join(__dirname, '..', 'adventure-prep.css');
const TOKENS = join(__dirname, '..', '..', '..', 'styles', 'tokens.css');
const css = readFileSync(CSS, 'utf8');
const tokens = readFileSync(TOKENS, 'utf8');
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const tokensSansCommentaires = tokens.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Les quatre jetons de duree du preparateur — l integralite, pas un extrait. */
const JETONS = [
  'prep-duration-press',
  'prep-duration-control',
  'prep-duration-page',
  'prep-duration-sheet',
] as const;

interface Tranche {
  readonly corps: string;
  readonly debut: number;
  readonly fin: number;
}

/**
 * Le corps d un media query, accolades equilibrees, commentaires retires.
 *
 * Une regex `\{[^{}]*\}` ne suffirait pas : cette feuille imbrique
 * `.adventure-prep *::before { ... }` dans un bloc. On equilibrage donc a la
 * main, sinon on lirait un `@media` Different de celui qu on vise.
 */
function media(requete: string): Tranche[] {
  const out: Tranche[] = [];
  const re = new RegExp('@media\\s*' + requete + '\\s*\\{', 'g');
  for (const m of sansCommentaires.matchAll(re)) {
    const debut = m.index + m[0].length;
    let profondeur = 1;
    let i = debut;
    while (i < sansCommentaires.length && profondeur > 0) {
      const c = sansCommentaires[i];
      if (c === '{') profondeur += 1;
      else if (c === '}') profondeur -= 1;
      i += 1;
    }
    out.push({ corps: sansCommentaires.slice(debut, i - 1), debut, fin: i - 1 });
  }
  return out;
}

const blocs = media('\\(prefers-reduced-motion:\\s*reduce\\)');

/** La feuille SANS les blocs de mouvement reduit, pour le contraste. */
function horsRepli(): string {
  let out = '';
  let curseur = 0;
  for (const b of blocs) {
    out += sansCommentaires.slice(curseur, b.debut - 1);
    curseur = b.fin + 1;
  }
  return out + resteApresLesBlocs();
}
function resteApresLesBlocs(): string {
  return sansCommentaires.slice(
    blocs.length === 0
      ? 0
      : blocs[blocs.length - 1]!.fin + 1,
  );
}

/** Declarations `--x: y` posees dans un corps de bloc. */
function declarations(corps: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const bout of corps.split(';')) {
    const i = bout.indexOf(':');
    if (i === -1) continue;
    const nom = bout.slice(0, i).replace(/[^{}]*\{[^{}]*$/, '').trim();
    if (nom.startsWith('--')) out.set(nom, bout.slice(i + 1).trim());
  }
  return out;
}

/** Le bloc `:root` du repli, isole : c est lui qui porte les quatre jetons. */
const blocRacine = blocs
  .map((b) => /:root\s*\{([^{}]*)\}/.exec(b.corps))
  .find((m): m is RegExpExecArray => m !== null);
const racineRepli = declarations(blocRacine?.[1] ?? '');

/** Une duree CSS en millisecondes. `0.001ms` vaut 0,001 — pas zero. */
function enMs(valeur: string): number {
  const m = /^(-?[\d.]+)(ms|s)$/.exec(valeur.trim());
  if (!m) return Number.NaN;
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
}

/**
 * Resout une valeur jusqu a une duree, en suivant les alias `var(--x)`.
 *
 * Sans cette resolution, `--prep-duration-control: var(--motion-control-duration)`
 * n est pas une duree : c est un nom. Comparer un nom a zero ne prouverait
 * rien. La resolution va chercher la cible dans `tokens.css`, et leve une
 * erreur si la chaine est rompue — une chaine rompue est exactement le bug
 * que `n3-durees.test.ts` surveille de son cote.
 */
function resoudreDuree(valeur: string, profondeur = 0): number {
  expect(profondeur, 'chaine d alias circulaire : ' + valeur).toBeLessThan(10);
  const alias = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec(valeur.trim());
  if (!alias) return enMs(valeur);
  const cible = alias[1]!;
  const source = cible.startsWith('--prep-') ? sansCommentaires : tokensSansCommentaires;
  const trouve = new RegExp(cible + ':\\s*([^;]+);').exec(source);
  expect(trouve, `jeton non resolu : ${cible} (alias de "${valeur}")`).not.toBeNull();
  return resoudreDuree(trouve![1]!, profondeur + 1);
}

const feuilleHorsRepli = horsRepli();

describe('N5-1 — le repli existe et son bloc `:root` est isolable', () => {
  it('le media query est present et son corps se lit', () => {
    expect(blocs.length, 'le repli prefers-reduced-motion a disparu').toBeGreaterThan(0);
    expect(
      blocRacine,
      'aucun bloc `:root` dans le repli : les jetons ne sont plus remis a zero',
    ).not.toBeNull();
  });
});

describe('N5-2 — les quatre jetons sont remises a quasi-zero DANS le repli', () => {
  for (const nom of JETONS) {
    it(`N5-02: --${nom} est depose et quasi nul sous mouvement reduit`, () => {
      const valeur = racineRepli.get(`--${nom}`);
      expect(
        valeur,
        `--${nom} n est pas depose dans le bloc \`:root\` du repli prefers-reduced-motion`,
      ).toBeDefined();
      const ms = enMs(valeur!);
      expect(Number.isFinite(ms), `--${nom} a une valeur illisible : ${valeur}`).toBe(true);
      // 0,001 ms et non exactement 0 : les navigateurs ignorent une duree
      // nulle. La borne reste sous 1 ms, donc le mouvement est annule.
      expect(ms, `--${nom} = ${valeur} : le mouvement n est pas annule`).toBeLessThan(1);
    });
  }
});

describe('N5-3 — la mise a zero n est pas vacuque', () => {
  it('hors repli, chaque jeton resout a une duree REELLEMENT non nulle', () => {
    // C est ce test qui donne son mordant a N5-02. Sans lui, une feuille qui
    // aurait mis a zero les jetons PARTOUT passerait les deux suites : le
    // repli ne serait plus une exception, il ne serait plus rien.
    const mesures: string[] = [];
    for (const nom of JETONS) {
      const trouve = new RegExp('--' + nom + ':\\s*([^;]+);').exec(feuilleHorsRepli);
      expect(trouve, `--${nom} n est pas declare hors du repli`).not.toBeNull();
      const ms = resoudreDuree(trouve![1]!);
      mesures.push(`--${nom} = ${ms} ms`);
      expect(
        ms,
        `--${nom} resout deja a quasi-zero hors repli (\`${trouve![1]}\`) : le contraste avec le repli est nul`,
      ).toBeGreaterThan(1);
    }
    // Trace explicite : les quatre durees normales, mesurees.
    expect(mesures.join(' | ')).toBe(
      '--prep-duration-press = 110 ms | --prep-duration-control = 220 ms | ' +
        '--prep-duration-page = 260 ms | --prep-duration-sheet = 380 ms',
    );
  });

  it('le jeton qui porte les transitions du preparateur est bien Consomme', () => {
    // Mesure honnete : dans cette feuille, les 18 transitions lisent
    // toutes `--prep-duration-control`. Les trois autres jetons sont
    // declares et remises a zero correctement, mais AUCUNE transition ne
    // les lit : leur repli est donc, aujourd hui, sans effet visible.
    // Ce test verrouille la charge utile — il ne pretend pas que les quatre
    // portent du mouvement, et ne peut pas le pretendre.
    const usages = [...sansCommentaires.matchAll(/var\(\s*--prep-duration-control\s*[,)]/g)];
    expect(
      usages.length,
      'aucune transition ne lit --prep-duration-control : le repli ne neutralise aucun mouvement reel',
    ).toBeGreaterThan(0);
    const transitions = [...sansCommentaires.matchAll(/(?:^|[;{])\s*transition:\s*([^;]+);/g)];
    const sansJeton = transitions.filter((m) => !m[1]!.includes('var(--prep-duration-control'));
    expect(
      sansJeton.map((m) => m[1]!.trim()).join(' | '),
      'des transitions lisent une duree qui ne passe pas par le jeton de controle',
    ).toBe('');
  });
});

describe('N5-4 — le repli agit aussi sur le sous-arbre rendu', () => {
  it('les transitions du sous-arbre sont forcees a quasi-zero en !important', () => {
    // Les jetons couvrent les surfaces rendues hors de `.adventure-prep`.
    // A l interieur, c est la regle `!important` qui coupe les transitions.
    const dansSousArbre = blocs.some(
      (b) =>
        /\.adventure-prep/.test(b.corps) &&
        /transition-duration:\s*0\.0?1?\d*ms\s*!important/.test(b.corps),
    );
    expect(
      dansSousArbre,
      'aucune regle !important ne coupe les transitions dans `.adventure-prep` sous mouvement reduit',
    ).toBe(true);
  });

  it('le repli neutralise aussi le defilement anime', () => {
    const bloque = blocs.some((b) => /scroll-behavior:\s*auto\s*!important/.test(b.corps));
    expect(bloque, 'le scroll-behavior anime survit au repli').toBe(true);
  });
});
