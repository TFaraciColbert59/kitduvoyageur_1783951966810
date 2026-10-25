/**
 * Contrat visuel du mode libre — plein ecran, materiau, en-tete.
 *
 * Meme harnais que `prep-layout-visual.test.ts` : le repo n'a ni jsdom ni
 * testing-library, et les defauts verrouilles ici sont purement CSS
 * (defilement, couleur en dur, geometrie d'en-tete). On lit donc la feuille
 * comme du texte.
 *
 * Ce que ces tests empêchent :
 *  - une page qui se met a defiler sur l'ecran principal,
 *  - une teinte en dur qui casse le mode sombre,
 *  - un titre d'en-tete qui derive parce que le bouton de fermeture est
 *    dans le flux (le defaut corrige ici : selon l'ordre du DOM, le titre
 *    derivait a gauche sur l'ecran 60 et a droite sur le 62),
 *  - un `var(--x)` utilise mais jamais defini.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const featureDir = join(here, '..');

const css = readFileSync(join(featureDir, 'free-departure.css'), 'utf8');

/** Tokens globaux du produit + ceux du preparateur. */
const GLOBAL = readFileSync(join(here, '..', '..', '..', 'styles', 'tokens.css'), 'utf8');
const PREP = readFileSync(join(here, '..', '..', 'adventure-prep', 'adventure-prep.css'), 'utf8');

interface Rule {
  selector: string;
  body: string;
}

function rules(): Rule[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim().replace(/\s+/g, ' '),
    body: match[2],
  }));
}

function rule(selector: string): Rule | undefined {
  return rules().find((r) => r.selector.split(',').some((s) => s.trim() === selector));
}

function declared(selector: string): string {
  return rule(selector)?.body ?? '';
}

describe('free-departure.css — plein ecran sans defilement', () => {
  it('FREE-C01: l’ecran est une colonne, pas une page', () => {
    const body = declared('.free-screen');
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-direction:\s*column/);
    // C’est cette colonne qui empeche la page de taller.
    expect(body).toMatch(/min-height:\s*0/);
  });

  it('FREE-C02: le corps ne defile JAMAIS — les details vont en feuille', () => {
    expect(declared('.free-body')).toMatch(/overflow:\s*hidden/);
  });

  it('FREE-C11: la carte est l’unique element compressible', () => {
    // Sinon le contenu deborde d'un `overflow: hidden` : il n'est pas
    // defile, il est COUPE. La carte doit donc etre le seul element a
    // absorber la hauteur restante, avec un plancher et un plafond.
    const map = declared('.free-body > .prep-map');
    expect(map).toMatch(/flex:\s*1 1 auto/);
    expect(map).toMatch(/min-height:/);
    expect(map).toMatch(/max-height:/);
  });

  it('FREE-C03: rien dans le corps ne peut etre comprime par la carte', () => {
    expect(declared('.free-body > *')).toMatch(/flex-shrink:\s*0/);
  });
});

describe('free-departure.css — en-tete', () => {
  it('FREE-C04: le bouton de fermeture est HORS du flux, donc le titre reste centre', () => {
    // Defaut reproduit : le titre etait centre dans un flex, mais le bouton
    // prenait de la place d'un seul cote — le texte derivait donc du cote
    // oppose au bouton, et les ecrans 60 et 62 n'etaient pas alignes.
    const close = declared('.free-close');
    expect(close).toMatch(/position:\s*absolute/);
    expect(close).toMatch(/inset-inline-end:\s*0/);
  });

  it('FREE-C05: le titre est centre des qu’un bouton de fermeture existe', () => {
    expect(declared('.free-top:has(.free-close)')).toMatch(/justify-content:\s*center/);
    expect(declared('.free-top__title')).toMatch(/text-align:\s*center/);
  });

  it('FREE-C06: l’en-tete 61 (sans bouton) garde son icone a gauche', () => {
    // Le centrage n’est applique que lorsqu’un bouton existe : sans lui,
    // l’icone + libelle reste aligne a gauche, comme sur la maquette.
    const centered = declared('.free-top:has(.free-close)');
    expect(centered).not.toMatch(/free-top__icon/);
    expect(rule('.free-top')).toBeDefined();
  });

  it('FREE-C07: le bouton de fermeture reste atteignable au clavier', () => {
    expect(declared('.free-close:focus-visible')).toMatch(/outline:/);
  });
});

describe('free-departure.css — discipline de materiau', () => {
  it('FREE-C08: aucune teinte en dur dans le fichier', () => {
    // `color-mix(... var(--x) 34%, transparent)` n'est PAS une teinte en dur :
    // c'est un melange de tokens, donc theme-agnostique — et c'est l'idiome du
    // design system (55 usages dans adventure-prep.css). On l'autorise donc,
    // mais UNIQUEMENT avec des arguments de couleur tokenises : chaque melange
    // est retire avant la chasse aux litteraux, donc un `color-mix(... #ff0000 ...)`
    // ne peut pas se cacher la-dedans.
    const mixes = [
      ...css.matchAll(
        /color-mix\(\s*[a-z0-9]+\s*,\s*([^;{}]*)\)/gi,
      ),
    ];
    for (const mix of mixes) {
      for (const arg of mix[1].split(',')) {
        expect(arg.trim(), `melange non tokenise : color-mix(${mix[1]})`).toMatch(
          /var\(--|transparent|currentcolor/i,
        );
      }
    }

    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const body = withoutComments.replace(
      /color-mix\(\s*[a-z0-9]+\s*,\s*[^;{}]*\)/gi,
      ' ',
    );
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(body).not.toMatch(/\brgba?\(/);
    expect(body).not.toMatch(/\bhsla?\(/);
    expect(body).not.toMatch(/\boklch\(/);
  });

  it('FREE-C09: chaque token utilise est defini quelque part', () => {
    const used = new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]),
    );
    const defined = new Set(
      [...`${GLOBAL}\n${PREP}\n${css}`.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
    );
    const missing = [...used].filter((token) => !defined.has(token));
    expect(missing, `tokens non definis : ${missing.join(', ')}`).toEqual([]);
  });

  it('FREE-C10: le mode libre etend le design system, il ne le redefinit pas', () => {
    // Les briques mutualisees viennent du preparateur : si ce fichier se met
    // a redefinir `.prep-*`, les deux surfaces divergent silencieusement.
    const redefined = rules().filter((r) => r.selector.split(',').some((s) => s.trim().startsWith('.prep-')));
    expect(redefined.map((r) => r.selector)).toEqual([]);
  });
});
