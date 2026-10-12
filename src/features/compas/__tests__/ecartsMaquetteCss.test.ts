import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Écarts avec la maquette (PLAN-100 5.5) : verrous du CSS neuf.
 * - unités en rem (le texte et les cibles suivent la taille choisie) ;
 * - jetons seulement, aucune couleur littérale nouvelle ;
 * - mouvement : opacité et transform seulement, et seulement si la personne ne demande pas de
 *   réduire les animations ;
 * - mode contraste forcé : les barres gardent une forme système.
 */

const RAW = readFileSync(join(__dirname, '..', 'compas.css'), 'utf8');
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, ' ');

type Rule = { selectors: string[]; body: string };
const RULES: Rule[] = [];
for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  RULES.push({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] });
}

/** Les règles dont un sélecteur commence par l'un des préfixes (hors @media/@keyframes). */
const rulesOf = (prefixes: string[]) =>
  RULES.filter((r) => r.selectors.some((s) => prefixes.some((p) => s.startsWith(p)) && !s.startsWith('@')));

/** Corps d'un bloc `@media … {` ou `@keyframes … {` (accolades équilibrées). */
function blocks(header: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(header.source, 'g');
  for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === '{') depth++;
      else if (CSS[i] === '}') depth--;
      i++;
    }
    out.push(CSS.slice(re.lastIndex, i - 1));
  }
  return out;
}

/** Les déclarations d'un corps, sans les filets (`border`, `outline`) qui restent en px. */
const withoutHairlines = (body: string) => body.replace(/(?:^|;)\s*(?:border|outline)[a-z-]*:[^;]*/g, ';');

const NEW_PREFIXES = ['.cp-pass', '.cp-risk', '.cp-gauge'];

describe('CSS neuf : heure de passage, barres de risque', () => {
  const rules = rulesOf(NEW_PREFIXES);

  it('les règles existent', () => {
    expect(rules.length).toBeGreaterThan(15);
  });

  it('aucune taille en px (texte, hauteurs, largeurs, marges) : tout est en rem', () => {
    const bad = rules
      .map((r) => ({ sel: r.selectors.join(', '), px: [...withoutHairlines(r.body).matchAll(/[\d.]+px/g)].map((m) => m[0]) }))
      .filter((r) => r.px.length);
    expect(bad).toEqual([]);
  });

  it('aucune couleur littérale : des jetons seulement', () => {
    for (const r of rules) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(r.body, r.selectors.join(', ')).not.toMatch(/\b(?:rgba?|hsla?)\(/i);
      expect(r.body.toLowerCase()).not.toContain('e4501c');
    }
  });

  it('les lignes de texte passent à la ligne au lieu d’être tronquées', () => {
    for (const r of rules) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/text-overflow:\s*ellipsis/);
    }
  });
});

describe('barres de risque : mouvement et contraste forcé', () => {
  it('aucune animation hors du bloc « pas de préférence de réduction »', () => {
    const allowed = blocks(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/);
    expect(allowed.some((b) => b.includes('.cp-gauge') && b.includes('cp-gauge-in'))).toBe(true);
    // Le CSS sans ces blocs : ni animation ni transition sur les barres.
    let outside = CSS;
    for (const b of allowed) outside = outside.replace(b, ' ');
    const outsideRules: Rule[] = [];
    for (const m of outside.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      outsideRules.push({ selectors: m[1].split(',').map((x) => x.trim()), body: m[2] });
    const bars = outsideRules.filter((r) => r.selectors.some((x) => x.startsWith('.cp-gauge') || x.startsWith('.cp-risk')));
    expect(bars.length).toBeGreaterThan(5);
    for (const r of bars) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/animation/);
      expect(r.body, r.selectors.join(', ')).not.toMatch(/transition/);
    }
  });

  it('l’animation ne touche que transform et opacity', () => {
    const [frames] = blocks(/@keyframes\s+cp-gauge-in\s*\{/);
    const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    expect(new Set(props)).toEqual(new Set(['transform', 'opacity']));
  });

  it('un axe non évalué est hachuré et pointillé (pas une barre à zéro)', () => {
    const body = rulesOf(['.cp-gauge[data-level=\'non_evalue\']'])[0]?.body ?? '';
    expect(body).toMatch(/repeating-linear-gradient/);
    expect(body).toMatch(/border-style:\s*dashed/);
  });

  it('contraste forcé : segments cernés, pleins en Highlight, non évalué en pointillés', () => {
    const forced = blocks(/@media\s*\(forced-colors:\s*active\)\s*\{/).join('\n');
    expect(forced).toMatch(/\.cp-gauge i\s*\{[^}]*border:\s*1px solid CanvasText/);
    expect(forced).toMatch(/\.cp-gauge i\[data-on='1'\]\s*\{[^}]*background:\s*Highlight/);
    expect(forced).toMatch(/\.cp-gauge\[data-level='non_evalue'\] i\s*\{[^}]*border-style:\s*dashed/);
  });
});
