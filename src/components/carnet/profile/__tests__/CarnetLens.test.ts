// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La lentille du sélecteur est une forme peinte par le CSS : on lit la feuille
 * réellement servie et on vérifie le gabarit au dixième de pixel. Une capture
 * d'écran zoomée reste la preuve visuelle (docs/audit/carnet-2026-10-27).
 */
const css = fs.readFileSync(
  path.join(process.cwd(), 'src/styles/carnet-profile.css'),
  'utf8',
);

function rule(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('Lentille du sélecteur — gabarit du segment actif', () => {
  const lens = rule('.ckp-capsule > .ckp-th {');

  it('fait exactement 41,5 × 25, rayon 999, inset 2,5', () => {
    expect(lens).toMatch(/width:\s*41\.5px/);
    expect(lens).toMatch(/height:\s*25px/);
    expect(lens).toMatch(/border-radius:\s*999px/);
    expect(lens).toMatch(/top:\s*2\.5px/);
    expect(lens).toMatch(/left:\s*2\.5px/);
  });

  it('est un fond blanc avec l’ombre et le liseré demandés', () => {
    expect(lens).toMatch(/background:\s*#fff/);
    expect(lens).toMatch(/0 1px 3px rgba\(23, 43, 36, \.18\)/);
    expect(lens).toMatch(/0 0 0 \.5px rgba\(23, 43, 36, \.06\)/);
    /* Aucun dégradé parasite : la lentille est opaque. */
    expect(lens).not.toMatch(/linear-gradient/);
  });

  it('glisse par transform, au pas exact du segment', () => {
    expect(lens).toMatch(/transform:\s*translateX\(calc\(var\(--i, 0\) \* 41\.5px\)\)/);
    expect(lens).toMatch(/transition:\s*transform 220ms var\(--ease-glass\)/);
  });

  it('n’anime ni la largeur ni l’opacité', () => {
    expect(lens).not.toMatch(/transition:[^;]*opacity/);
    expect(lens).not.toMatch(/transition:[^;]*width/);
    expect(lens).not.toMatch(/width 220ms/);
  });

  it('disparaît sans segment actif et sous mouvement réduit', () => {
    expect(rule(".ckp-capsule > .ckp-th[data-off='true']")).toMatch(/opacity:\s*0/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.ckp-capsule > \.ckp-th\s*\{\s*transition:\s*none/);
  });

  it('reste sous les boutons du sélecteur', () => {
    expect(lens).toMatch(/z-index:\s*0/);
    const button = rule('.ckp-capsule .ckp-tabs button {');
    expect(button).toMatch(/z-index:\s*1/);
  });
});
