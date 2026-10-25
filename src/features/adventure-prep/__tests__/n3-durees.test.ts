import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * N3 — les durees passent par des jetons, et les jetons sont resolvables.
 *
 * Ce fichier a attrape un vrai bug, pas une convention. En renommant les
 * jetons de duree en --prep-duration-*, un remplacement global avait aussi
 * reecrit le bloc d'alias lui-meme :
 *
 *     --prep-duration-control: var(--prep-duration-control);
 *
 * Une propriete personnalisee qui se reference elle-meme est invalide au
 * moment du calcul : sa valeur devient « garantie invalide » et les quinze
 * `transition: ... var(--prep-duration-control) ...` de la feuille tombaient
 * silencieusement a `none`. Aucun test ne le voyait. Le premier test de ce
 * fichier existe pour que cela ne puisse plus arriver : il interdit la
 * auto-reference, quelle qu'elle soit, dans tout le fichier.
 *
 * Le reste verifie que les quinze transitions lisent bien les jetons, que les
 * jetons pointent sur le systeme de mouvement global (donc heritent du
 * theme), et que la duree de controle resolue tient dans la fourchette
 * 150-300 ms du chantier.
 */

const CSS = join(__dirname, '..', 'adventure-prep.css');
const TOKENS = join(__dirname, '..', '..', '..', 'styles', 'tokens.css');
const css = readFileSync(CSS, 'utf8');
const tokens = readFileSync(TOKENS, 'utf8');
const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Valeur d'un jeton dans un fichier donne. */
function jeton(source: string, nom: string): string {
  const m = new RegExp(`--${nom}:\\s*([^;]+);`).exec(source);
  expect(m, `jeton introuvable : --${nom}`).not.toBeNull();
  return (m?.[1] ?? '').trim();
}

const ALIAS = {
  'prep-duration-press': 'motion-press-duration',
  'prep-duration-control': 'motion-control-duration',
  'prep-duration-page': 'motion-page-duration',
  'prep-duration-sheet': 'motion-sheet-duration',
  'prep-ease-standard': 'motion-ease-standard',
  'prep-ease-enter': 'motion-ease-decelerate',
  'prep-ease-exit': 'motion-ease-accelerate',
} as const;

describe('N3 — aucune duree ecrite en dur, et des jetons qui resolvent', () => {
  it('AUCUNE propriete personnalisee ne se reference elle-meme', () => {
    // Le garde-fou anti-regression du bug decrit en tete de fichier.
    const auto = [...css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*var\(\s*\1\s*[,)]/g)].map(
      (m) => m[1] ?? '',
    );
    expect(auto, `auto-reference : la valeur devient garantie-invalide`).toEqual([]);
  });

  it('les sept jetons de duree et de courbe pointent sur le mouvement global', () => {
    for (const [prep, motion] of Object.entries(ALIAS)) {
      expect(jeton(css, prep), `--${prep} ne pointe plus sur --${motion}`).toBe(
        `var(--${motion})`,
      );
      // Et la cible existe bien dans le systeme global.
      expect(jeton(tokens, motion), `--${motion} n existe pas dans tokens.css`).not.toBe('');
    }
  });

  it('aucune duree en millisecondes n est ecrite en dur hors mouvement reduit', () => {
    // On retire les deux blocs prefers-reduced-motion, ou 0.001ms et 0.01ms
    // sont la BONNE valeur : le but est de supprimer le mouvement.
    const horsRepli = sansCommentaires.replace(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
      ' ',
    );
    const brutes = [...horsRepli.matchAll(/[a-z-]+:\s*[^;]*\b\d+ms\b/g)].map((m) => m[0] ?? '');
    expect(brutes, `durees en dur hors repli : ${JSON.stringify(brutes)}`).toEqual([]);
  });

  it('les deux blocs de mouvement reduit neutralisent bien la duree', () => {
    const blocs = [...sansCommentaires.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)];
    expect(blocs.length, 'le repli prefers-reduced-motion a disparu').toBeGreaterThan(0);
    // transition-duration: 0 a l echelle du sous-arbre, avec !important.
    expect(sansCommentaires).toMatch(/transition-duration:\s*0\.0?1?\d*ms\s*!important/);
  });

  it('chaque transition lit un jeton de duree ET un jeton de courbe', () => {
    const transitions = [...sansCommentaires.matchAll(/(?:^|[;{])\s*transition:\s*([^;]+);/g)].map(
      (m) => (m[1] ?? '').trim(),
    );
    expect(transitions.length, 'la feuille a perdu ses transitions').toBe(15);
    for (const t of transitions) {
      expect(t, `transition sans jeton de duree : ${t}`).toContain('var(--prep-duration-');
      expect(t, `transition sans jeton de courbe : ${t}`).toContain('var(--prep-ease-');
    }
  });

  it('aucune animation ne porte une duree en dur', () => {
    const brutes = [...sansCommentaires.matchAll(/(?:^|[;{])\s*animation(?:-[a-z]+)?:\s*([^;]+);/g)]
      .map((m) => (m[1] ?? '').trim())
      .filter((v) => /\d/.test(v) && !/^0\.0?1?\d*ms/.test(v));
    expect(brutes, `animation avec une duree propre : ${JSON.stringify(brutes)}`).toEqual([]);
  });

  it('la duree de controle resolue tient dans la fourchette 150-300 ms', () => {
    const ms = Number(/([\d.]+)ms/.exec(jeton(tokens, 'motion-control-duration'))?.[1] ?? '0');
    expect(ms).toBeGreaterThanOrEqual(150);
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('le repli de mouvement reduit remet bien les quatre jetons a zero', () => {
    for (const nom of Object.keys(ALIAS).filter((n) => n.startsWith('prep-duration'))) {
      // Les jetons ne sont pas reecrits par le media query au niveau global
      // pour ease-* : seules les durees le sont.
      expect(css, `--${nom} a disparu`).toContain(`--${nom}:`);
    }
    expect(css).toMatch(/--prep-duration-control:\s*0\.001ms;/);
  });
});
