import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Lot Q, PLAN-100 5.2 — texte agrandissable (WCAG 1.4.4 redimensionnement du
 * texte, 1.4.12 espacement du texte).
 *
 * Quand la personne règle une taille de texte plus grande, tout ce que le
 * Compas dimensionne en pixels ne suit pas : le texte grossit dans une boîte
 * de hauteur fixe qui le coupe, ou ne grossit pas du tout. Règles tenues ici :
 *   - tailles de texte en rem (jamais en px) ;
 *   - une ligne ou une commande qui porte du texte a une HAUTEUR MINIMALE
 *     (elle s'agrandit), jamais une hauteur fixe qui rogne ;
 *   - le texte d'une ligne (nom, détail, raison) passe à la ligne au lieu
 *     d'être tronqué par « … ».
 */

const SRC = join(__dirname, '..');
const CSS = readFileSync(join(SRC, 'compas.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

type Rule = { selectors: string[]; body: string };
const RULES: Rule[] = [];
for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  RULES.push({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] });
}

/** Corps de toutes les règles dont la liste de sélecteurs contient exactement `selector`. */
const bodyOf = (selector: string): string =>
  RULES.filter((r) => r.selectors.includes(selector))
    .map((r) => r.body)
    .join('\n');

describe('compas.css : le texte suit la taille choisie', () => {
  it('aucune taille de texte en px', () => {
    const bad = [...CSS.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => m[0]);
    expect(bad).toEqual([]);
  });

  it('aucune hauteur de ligne en px', () => {
    const bad = [...CSS.matchAll(/line-height:\s*([\d.]+)px/g)].map((m) => m[0]);
    expect(bad).toEqual([]);
  });

  it('les lignes de liste ont une hauteur minimale en rem, pas une hauteur fixe', () => {
    expect(CSS).toMatch(/--cp-row-h:\s*3rem/);
    const row = bodyOf('.cp-row');
    expect(row).toMatch(/min-height:\s*var\(--cp-row-h\)/);
    expect(row).not.toMatch(/(^|[;\s])height:/);
  });

  // Commandes et lignes qui portent du texte : elles s'agrandissent avec lui.
  const TEXT_BOXES = [
    '.cp-step',
    '.cp-chip',
    '.cp-seg button',
    '.cp-field select',
    '.cp-island__btn',
    '.cp-tchip',
    '.cp-pill',
    '.cp-cal__d',
    '.cp-disle__in',
    '.cp-row__t input',
    '.cp-intent',
    '.cp-intent input',
    '.cp-acc',
  ];
  it.each(TEXT_BOXES)('%s : hauteur minimale, pas de hauteur fixe qui rogne le texte', (selector) => {
    const body = bodyOf(selector);
    expect(body, `${selector} introuvable`).not.toBe('');
    expect(body).not.toMatch(/(^|[;\s])height:\s*[\d.]+px/);
    expect(body).not.toMatch(/(^|[;\s])height:\s*[\d.]+rem/);
    expect(body).toMatch(/min-height:\s*[\d.]+rem/);
  });

  it('aucun min-height de commande en px (il ne suivrait pas la taille du texte)', () => {
    const bad = RULES.filter(
      (r) =>
        /min-height:\s*[\d.]+px/.test(r.body) &&
        // Les surfaces de mise en page (écran entier, tiroir) restent en px.
        !r.selectors.includes('.compas')
    ).map((r) => r.selectors.join(', '));
    expect(bad).toEqual([]);
  });

  // Textes qui doivent se lire en entier : nom d'objet, détail, raison, titre.
  const LONG_TEXT = [
    '.cp-row__t b',
    '.cp-row__t span',
    '.cp-kv dd',
    '.cp-sheet__h h3',
    '.cp-mini__t span',
    '.cp-t2',
    '.cp-fr__v',
    '.cp-fr__v > span',
    '.cp-day small',
    '.cp-decision__t span',
    '.cp-dayd__h span',
    '.cp-prop__why',
    '.cp-tchip--axis .cp-tchip__bd',
  ];
  it.each(LONG_TEXT)('%s : le texte passe à la ligne, il n’est pas tronqué par « … »', (selector) => {
    const body = bodyOf(selector);
    expect(body, `${selector} introuvable`).not.toBe('');
    expect(body).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(body).not.toMatch(/white-space:\s*nowrap/);
  });

  it('les nombres et libellés courts gardent une seule ligne (« 100 % » ne se coupe pas)', () => {
    expect(bodyOf('.cp-ready b')).toMatch(/white-space:\s*nowrap/);
    expect(bodyOf('.cp-mb b')).toMatch(/white-space:\s*nowrap/);
  });
});

describe('composants du Compas : pas de taille de texte en pixels dans les styles en ligne', () => {
  const INVITATIONS = readFileSync(join(SRC, 'components', 'TripInvitations.tsx'), 'utf8');
  it('TripInvitations : fontSize et minHeight en rem', () => {
    expect([...INVITATIONS.matchAll(/fontSize:\s*\d+/g)].map((m) => m[0])).toEqual([]);
    expect([...INVITATIONS.matchAll(/minHeight:\s*\d+/g)].map((m) => m[0])).toEqual([]);
  });
});
