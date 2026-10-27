import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Gabarit de la fiche, mesuré sur /compte à 430 × 932. jsdom ne calcule aucune
 * mise en page : on lit la feuille réellement servie, comme le fait déjà
 * `CarnetLens.test.ts`, et la capture d'écran reste la preuve visuelle
 * (docs/audit/carnet-2026-10-27).
 */
const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/carnet-profile.css'), 'utf8');

function rules(selector: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(selector, from);
    if (start < 0) break;
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    blocks.push(css.slice(open + 1, close));
    from = close + 1;
  }
  if (blocks.length === 0) throw new Error(`règle absente : ${selector}`);
  return blocks;
}

const last = (selector: string) => rules(selector).at(-1) as string;

describe('Carte du bas — 430 × 335, de y 597 à 932', () => {
  it('occupe tout le reste de l’écran, sans min-height qui l’écrase', () => {
    const blocks = rules('.ckp-mapzone {');
    expect(blocks[0]).toMatch(/flex:\s*1 1 auto/);
    for (const block of blocks) {
      expect(block).toMatch(/min-height:\s*0/);
      expect(block).not.toMatch(/min-height:\s*240px/);
    }
  });

  it('sort de la gouttière 12 px et garde une seule marge haute de 8 px', () => {
    const block = last('.ckp-mapzone {');
    expect(block).toMatch(/margin:\s*8px -12px 0/);
    expect(block).toMatch(/border-radius:\s*0/);
  });

  it('laisse la carte d’identité à 541 px, sans marge parasite', () => {
    const card = rules('.ckp-card {').find((block) => /height:\s*541px/.test(block));
    expect(card).toBeTruthy();
    expect(card).toMatch(/flex:\s*none/);
    expect(card).not.toMatch(/min-height/);
    expect(last('.ckp-card {')).toMatch(/margin-bottom:\s*0/);
  });

  it('ne garde aucune réserve basse : la carte touche le bas de l’écran', () => {
    expect(last('.ckp-screen-body {')).toMatch(/padding-bottom:\s*0/);
  });
});

describe('Grille des posts — gabarit du Compte (134 / 2 / 2, pleine largeur)', () => {
  it('trois colonnes pleine largeur, sans padding latéral', () => {
    const block = last('.ckp-grid-wrap {');
    expect(block).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(block).toMatch(/gap:\s*2px/);
    expect(block).toMatch(/padding:\s*0/);
    /* 3 × 134 + 2 × 2 = 406 : la grille colle à la largeur de la carte. */
    expect(last('.ckp-media {')).toMatch(/margin:\s*0 -12px/);
  });

  it('tuiles carrées de 134 px, rayon 2, image en cover', () => {
    const tile = rules('.ckp-tile {').find((block) => /aspect-ratio/.test(block)) as string;
    expect(tile).toBeTruthy();
    expect(tile).toMatch(/aspect-ratio:\s*1 \/ 1/);
    expect(tile).toMatch(/border-radius:\s*2px/);
    expect(tile).toMatch(/width:\s*100%/);
    expect(last('.ckp-tile img {')).toMatch(/object-fit:\s*cover/);
  });

  it('aucune décoration de tuile ne recouvre l’image', () => {
    expect(css).not.toMatch(/\.ckp-tile-expand/);
  });
});

describe('Ligne de lieu — texte seul, gabarit de la ligne de bio du Compte', () => {
  it('12 px, encre secondaire, séparateur « · »', () => {
    const block = last('.ckp-place-line {');
    expect(block).toMatch(/font:\s*500 12px/);
    expect(block).toMatch(/color:\s*#3f4f46/);
    expect(block).toMatch(/letter-spacing:\s*-\.14px/);
    expect(block).toMatch(/white-space:\s*nowrap/);
  });

  it('n’est ni une pastille ni un bouton', () => {
    const block = last('.ckp-place-line {');
    expect(block).not.toMatch(/background/);
    expect(block).not.toMatch(/border/);
    expect(block).not.toMatch(/border-radius/);
    expect(block).not.toMatch(/cursor/);
    expect(css).not.toMatch(/\.ckp-place-pill/);
    expect(css).not.toMatch(/\.ckp-place-row/);
    expect(css).not.toMatch(/\.ckp-place-date/);
  });
});
