import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Integrite structurelle de la feuille de style du preparateur.
 *
 * Deux regressions reelles ont ete produit par des editions de fichier
 * partielle, chacune invisible a la relecture du code mais ruineuse au
 * rendu, et chacune attrapable ici :
 *
 *  1. Un commentaire `/*` non ferme (trois ouvertures pour une fermeture)
 *     vers la ligne 598. Le navigateur cesse de parser a cet endroit et
 *     ignore toute la suite du fichier : plus de 120 regles perdues, dont
 *     `.prep-footer-link`. Aucun test ne l avait vu, parce que tous les tests
 *     lisaient la regle comme du texte, pas comme ce que le parseur CSS en
 *     fait reellement.
 *
 *  2. Deux declarations orphelines (`display: block;` / `text-align: center;`)
 *     placees entre deux blocs. Le selecteur qui suivait devenait un prelude
 *     de regle invalide : le navigateur jetait la regle entiere. Le texte
 *     présentait bien `.prep-footer-link { ... }`, la regle n'existait pas.
 *
 * Ces deux defauts partagent la meme signature : le fichier est illisible pour
 * le parseur alors qu'il est parfaitement lisible pour un editeur. Les tests
 * de ce fichier travaillent donc sur la structure, pas sur des sous-chaines.
 */

const cssPath = join(__dirname, '..', 'adventure-prep.css');
const css = readFileSync(cssPath, 'utf8');

/** Retire commentaires et chaines, qui peuvent contenir des `/*` ou des `{`. */
export function stripNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

export function unclosedCommentCount(source: string): number {
  let open = 0;
  for (let i = 0; i < source.length - 1; i += 1) {
    if (source[i] === '/' && source[i + 1] === '*') {
      open += 1;
      i += 1;
    } else if (source[i] === '*' && source[i + 1] === '/') {
      open -= 1;
      i += 1;
    }
  }
  return Math.max(open, 0);
}

export function braceBalance(source: string): number {
  const clean = stripNoise(source);
  let balance = 0;
  for (const char of clean) {
    if (char === '{') balance += 1;
    else if (char === '}') balance -= 1;
  }
  return balance;
}

/** Indices de `;` rencontres hors de tout bloc : declarations orphelines. */
export function orphanDeclarations(source: string): number[] {
  const clean = stripNoise(source);
  const found: number[] = [];
  let depth = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === ';' && depth === 0) found.push(i);
  }
  return found;
}

describe('integrite structurelle de adventure-prep.css', () => {
  it('n a aucun commentaire ouvert et non referme', () => {
    expect(unclosedCommentCount(css)).toBe(0);
  });

  it('a des accolades equilibrees', () => {
    expect(braceBalance(css)).toBe(0);
  });

  it('n a aucune declaration hors bloc', () => {
    const orphans = orphanDeclarations(css);
    const contexts = orphans
      .slice(0, 3)
      .map((index) => stripNoise(css).slice(Math.max(0, index - 70), index + 40).replace(/\s+/g, ' '));
    expect(contexts).toEqual([]);
  });

  it('declare overflow-x sur .prep-body hors de tout commentaire', () => {
    const clean = stripNoise(css);
    const match = /(?:^|\})\s*\.prep-body\s*\{([^}]*)\}/.exec(clean);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/overflow-x:\s*hidden/);
  });
});

describe('les garde-fous detectent les regressions qu ils surveillent', () => {
  it('detecte un commentaire non referme', () => {
    expect(unclosedCommentCount('a { color: red; } /* ouvert')).toBe(1);
    expect(unclosedCommentCount('/* ferme */ a { color: red; }')).toBe(0);
  });

  it('detecte des accolades desequilibrees', () => {
    expect(braceBalance('a { b: c;')).toBe(1);
    expect(braceBalance('a { b: c; }')).toBe(0);
  });

  it('detecte une declaration orpheline entre deux blocs', () => {
    expect(orphanDeclarations('a { b: c; } d: e; f { g: h; }')).toHaveLength(1);
    expect(orphanDeclarations('a { b: c; } f { g: h; }')).toHaveLength(0);
  });

  it('ne confond pas un point-virgule de commentaire avec une declaration', () => {
    expect(orphanDeclarations('a { b: c; } /* ; ; ; */ f { g: h; }')).toHaveLength(0);
  });
});
