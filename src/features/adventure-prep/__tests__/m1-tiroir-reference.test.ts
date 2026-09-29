import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * M1 — le tiroir Lieu est la seule surface qui atteignait la spec.
 *
 * M1.1 demande que SES valeurs soient extraites en jetons nommes, pour que
 * les autres surfaces soient correctes PAR REFERENCE et non par recopie
 * manuelle. Un test qui verrait quatre fois `rgb(255 255 255 / 0.12)` ecrit
 * en dur dans quatre blocs passerait lui aussi, tout en rouvrant la porte
 * au drift : c'est pourquoi on verifie le LIEN (`var(--prep-...)`), pas
 * seulement la valeur rendue.
 *
 * M1.2 verifie la consommation : `.li`, `.note`, `.badge` et `.seg` doivent
 * lire les jetons du tiroir, et l'accent de selection ne doit plus venir
 * d'un aplat de page.
 *
 * Meme harnais que le reste de la suite : le repo n'a pas de jsdom, la
 * feuille est donc lue comme du texte.
 */

const CSS = join(__dirname, '..', 'adventure-prep.css');
const css = readFileSync(CSS, 'utf8');

/** Declarations d'un selecteur, tous blocs confondus, la derniere gagne. */
function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    const sel = (m[1] ?? '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((p) => p.trim());
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

/** Un selecteur existe-t-il reellement dans la feuille ? */
function existe(selector: string): boolean {
  return declarations(selector).size > 0;
}

/** La valeur brute d'un jeton. */
function jeton(nom: string): string {
  const m = new RegExp(`--${nom}:\\s*([^;]+);`).exec(css);
  expect(m, `jeton introuvable : --${nom}`).not.toBeNull();
  return (m?.[1] ?? '').trim();
}

/** Le jeton vise par `var(--x)` existe-t-il dans la feuille ? */
function cibleDefinie(valeur: string): boolean {
  const m = /^var\(\s*(--[a-zA-Z0-9-]+)/.exec(valeur);
  if (m === null) return false;
  return new RegExp(`${m[1]}\\s*:`).test(css);
}

const JETONS_TIROIR = [
  'prep-drawer-row-bg',
  'prep-drawer-row-edge',
  'prep-drawer-row-radius',
  'prep-drawer-row-hover',
  'prep-drawer-row-selected-ink',
] as const;

const SURFACES = ['.li', '.note', '.badge', '.seg'] as const;

describe('M1.1 — les valeurs du tiroir sont nommees, pas recopiees', () => {
  it('les cinq jetons du tiroir existent', () => {
    for (const nom of JETONS_TIROIR) {
      expect(jeton(nom), `--${nom} a disparu`).not.toBe('');
    }
  });

  it('fond, filet et rayon sont des ALIAS vers un jeton de base, pas des copies', () => {
    // C'est le coeur de M1.1 : une recopie en dur passerait aussi le test de
    // "la valeur est la bonne", mais casse la reference. On exige donc que la
    // valeur soit un `var(--prep-...)` resolvable.
    for (const nom of ['prep-drawer-row-bg', 'prep-drawer-row-edge', 'prep-drawer-row-radius'] as const) {
      const v = jeton(nom);
      expect(v, `--${nom} doit pointer sur un jeton, pas sur une valeur`).toMatch(/^var\(\s*--prep-/);
      expect(cibleDefinie(v), `--${nom} pointe sur un jeton inexistant : ${v}`).toBe(true);
    }
  });

  it('le fond de ligne du tiroir reste un blanc translucide, pas un aplat', () => {
    const v = jeton('prep-row-bg');
    expect(v, 'le fond du tiroir a cesse d etre translucide').toMatch(
      /rgb\(\s*255\s+255\s+255\s*\/\s*0?\.\d+\s*\)/,
    );
  });

  it('le survol du tiroir est translucide et l accent de selection vient du jeu de marque', () => {
    const hover = jeton('prep-drawer-row-hover');
    expect(hover, 'le survol doit rester translucide').toMatch(
      /rgb\(\s*255\s+255\s+255\s*\/\s*0?\.\d+\s*\)/,
    );
    const accent = jeton('prep-drawer-row-selected-ink');
    expect(accent, 'la selection doit venir de l accent de la marque').toMatch(
      /^var\(\s*--lkv-action\s*\)$/,
    );
    expect(cibleDefinie(accent)).toBe(true);
  });
});

describe('M1.2 — les surfaces du tiroir consomment ces jetons', () => {
  it('chaque surface du tiroir existe et lit le fond du tiroir', () => {
    for (const s of SURFACES) {
      expect(existe(s), `le selecteur ${s} a disparu de la feuille`).toBe(true);
      const d = declarations(s);
      const fond = d.get('background') ?? d.get('background-color') ?? '';
      expect(`${s} fond=${fond}`).toBe(`${s} fond=var(--prep-drawer-row-bg)`);
    }
  });

  it('chaque surface du tiroir lit le filet du tiroir', () => {
    for (const s of SURFACES) {
      const bord = declarations(s).get('border') ?? '';
      expect(`${s} border=${bord}`, `${s} ne lit pas le filet du tiroir`).toContain(
        'var(--prep-drawer-row-edge)',
      );
    }
  });

  it('les rangees carrees du tiroir lisent le rayon du tiroir', () => {
    // `.badge` reste une pastille : son rayon plein est voulu, on ne lui force
    // donc pas le rayon de carte.
    for (const s of ['.seg', '.li', '.note'] as const) {
      const r = declarations(s).get('border-radius') ?? '';
      expect(`${s} rayon=${r}`).toBe(`${s} rayon=var(--prep-drawer-row-radius)`);
    }
  });

  it('le bouton interne du seg deduit son rayon de celui du tiroir', () => {
    const r = declarations('.seg > button').get('border-radius') ?? '';
    expect(r, 'le bouton du seg doit deduire du rayon du tiroir').toBe(
      'calc(var(--prep-drawer-row-radius) - 2px)',
    );
  });

  it('le survol de ligne ne redonne plus un aplat de page', () => {
    const hover = declarations('.li:hover').get('background') ?? '';
    expect(hover, 'le survol ne doit plus reprendre un aplat opaque').toBe(
      'var(--prep-drawer-row-hover)',
    );
    expect(hover, 'le survol ne doit plus pointer sur une surface opaque de page').not.toContain(
      '--lkv-surface-elevated',
    );
  });

  it('la ligne selectionnee prend son accent dans le jeton du tiroir', () => {
    const d = declarations('.li.sel');
    expect(d.get('border-color') ?? '').toBe('var(--prep-drawer-row-selected-ink)');
    expect(d.get('color') ?? '').toBe('var(--prep-drawer-row-selected-ink)');
  });

  it('aucun jeton du tiroir ne reste defini sans etre pose', () => {
    // Regle M0.1 : un jeton defini et jamais consomme ne compte pas.
    for (const nom of JETONS_TIROIR) {
      const n = (css.match(new RegExp(`var\\(\\s*--${nom}\\s*[,)]`, 'g')) ?? []).length;
      expect(n, `--${nom} est defini mais jamais applique`).toBeGreaterThan(0);
    }
  });
});
