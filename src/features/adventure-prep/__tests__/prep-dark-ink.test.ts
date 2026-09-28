import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * D9 — l'encre d'accent existe en theme sombre.
 *
 * Defaut REPRODUIT au navigateur en 393x852, sur /prepare?nouvelle=1 : la puce
 * de filtre selectionnee s'affichait en rgb(34, 97, 72) — le `--lkv-action` du
 * theme CLAIR — sur un verre sombre. Contraste mesure 1,77:1 : le libelle
 * « A pied » etait illisible.
 *
 * Cause racine, mesuree sur la cascade : le bloc
 * `html.dark, .dark, [data-theme='dark']` (tokens.css) redefinit les encres de
 * texte ET les encres de verre, mais pas `--lkv-action` ni `--lkv-on-action`.
 * En theme sombre, l'accent restait donc celui des surfaces claires, et tout
 * composant qui s'en sert comme encre ou comme aplat relevait du meme defaut.
 */

const tokens = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'styles', 'tokens.css'),
  'utf8',
);

const prep = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'adventure-prep.css'),
  'utf8',
);

const DARK_SELECTOR = "html.dark, .dark, [data-theme='dark']";

function block(selector: string): Map<string, string> {
  const withoutComments = tokens.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const found = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) =>
    m[1].trim().replace(/\s+/g, ' ') === selector,
  );
  const out = new Map<string, string>();
  if (!found) return out;
  for (const raw of found[2].split(';')) {
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    out.set(raw.slice(0, idx).trim(), raw.slice(idx + 1).trim());
  }
  return out;
}

describe('D9 — le theme sombre possede sa propre encre d accent', () => {
  it('D9-01: le bloc sombre redéclare --lkv-action', () => {
    expect(block(DARK_SELECTOR).get('--lkv-action')).toBeTruthy();
  });

  it('D9-02: le bloc sombre redéclare --lkv-on-action', () => {
    // Sans le couple, un aplat d'accent clair recevrait encore l'encre blanche
    // du theme clair : le texte disparaitrait sur le remplissage.
    expect(block(DARK_SELECTOR).get('--lkv-on-action')).toBeTruthy();
  });

  it('D9-03: les deux valeurs sombres different de celles du theme clair', () => {
    const dark = block(DARK_SELECTOR);
    const light = block(':root');
    // Sans cette garde, le test passait sur deux `undefined` : une absence de
    // declaration se compare bien a une valeur, mais ne prouve rien.
    expect(dark.get('--lkv-action')).toBeTruthy();
    expect(dark.get('--lkv-on-action')).toBeTruthy();
    expect(dark.get('--lkv-action')).not.toBe(light.get('--lkv-action'));
    expect(dark.get('--lkv-on-action')).not.toBe(light.get('--lkv-on-action'));
  });
});

describe('D9 — l encre du contenu d accent suit le theme', () => {
  it('D9-04: --prep-on-action n est pas figee sur une seule valeur', () => {
    // #0b0d12 ne vaut que sur un aplat clair. Sur l'accent sombre du theme
    // clair elle disparait, et sur l'accent clair du theme sombre elle
    // disparait aussi : seule l'encre de contenu du theme convient.
    const decl = /--prep-on-action:\s*([^;]+);/.exec(prep)?.[1]?.trim() ?? '';
    expect(decl).toContain('var(--lkv-on-action)');
  });
});

describe('D9 — le preparateur possede son encre d accent', () => {
  // Mesure complementaire, sur la meme page : `<html data-theme="light">`. Le
  // preparateur flotte sur la photo dans un verre sombre, mais l'accent qu'il
  // recoit alors est celui des surfaces claires (#226148). Un composant pose
  // sur la photo a donc besoin de sa propre encre d'accent, au meme titre que
  // `--prep-glass-label` : c'est le meme contrat que le verre.
  it('D9-05: --prep-ink-accent reprend l accent sombre de l app', () => {
    // Le preparateur flotte sur la photo : son encre d'accent ne doit pas
    // suivre le theme de la page. Elle reprend donc la valeur que l'app
    // declare deja pour son theme sombre, et le test compare les deux pour
    // qu'elles ne puissent pas diverger.
    const decl = /--prep-ink-accent:\s*([^;]+);/.exec(prep)?.[1]?.trim() ?? '';
    expect(decl).toBe(block(DARK_SELECTOR).get('--lkv-action'));
  });

  it('D9-06: la puce selectionnee prend cette encre, pas l accent brut', () => {
    const decl = /\.prep-action\[aria-pressed=["']?true["']?\]\s*\{([^}]*)\}/.exec(prep)?.[1] ?? '';
    const color = /color:\s*([^;]+);/.exec(decl)?.[1]?.trim() ?? '';
    expect(color).toBe('var(--prep-ink-accent)');
  });

  it('D9-07: le preparateur remappe l accent du theme sur son encre', () => {
    // Sans ce remappage, une dizaine de declarations `color: var(--lkv-action)`
    // continueraient de livrer l'accent clair sur le verre sombre.
    const root = /\.adventure-prep\s*\{([^}]*)\}/.exec(prep)?.[1] ?? '';
    expect(/--lkv-action:\s*var\(--prep-ink-accent\);/.test(root)).toBe(true);
  });

  it('D9-08: les aplats d accent recoivent une encre sombre', () => {
    // Le remappage de D9-07 rend l'accent clair partout dans le preparateur,
    // y compris la ou il sert de REMPLISSAGE (jour selectionne du calendrier,
    // epingle de carte, vignette d'etape). Sans encre sombre posee, le texte
    // de ces aplats disparaitrait.
    const root = /\.adventure-prep\s*\{([^}]*)\}/.exec(prep)?.[1] ?? '';
    expect(/--lkv-on-action:\s*#08150F;/.test(root)).toBe(true);
    expect(/--btn-on-solid:\s*#08150F;/.test(root)).toBe(true);
  });

  it('D9-09: aucun aplat d accent n est melange a du blanc', () => {
    // Melanger l'accent a --prep-mix-light (qui vaut #fff) posait un aplat
    // clair sous une encre claire : le meme defaut que `.prep-note`.
    expect(prep).not.toMatch(/color-mix\(in srgb, var\(--lkv-action\)[^)]*--prep-mix-light\)/);
  });
});
