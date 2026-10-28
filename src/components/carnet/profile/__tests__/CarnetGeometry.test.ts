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

describe('Carte du bas — 40 % de la hauteur de page (373 px à 430 × 932)', () => {
  it('prend 40 % de la hauteur de page, sans min-height qui l’écrase', () => {
    const blocks = rules('.ckp-mapzone {');
    expect(blocks.some((block) => /height:\s*40dvh/.test(block))).toBe(true);
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

  it('laisse la carte d’identité occuper l’espace restant, sans marge parasite', () => {
    const blocks = rules('.ckp-card {');
    const flexible = blocks.find((block) => /flex:\s*1 1 auto/.test(block));
    expect(flexible).toBeTruthy();
    expect(flexible).toMatch(/min-height:\s*0/);
    expect(blocks.every((block) => !/height:\s*541px/.test(block))).toBe(true);
    expect(blocks.some((block) => /margin-bottom:\s*0/.test(block))).toBe(true);
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

describe('Récit de la carte — une ligne et « voir plus… »', () => {
  it('tronque la description sur une seule ligne, avec ellipse', () => {
    const block = last('.ckp-bio-line {');
    expect(block).toMatch(/white-space:\s*nowrap/);
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
    expect(block).toMatch(/overflow:\s*hidden/);
    /* La ligne prend la place restante, le bouton garde la sienne. */
    expect(last('.ckp-bio-row {')).toMatch(/display:\s*flex/);
    expect(block).toMatch(/min-width:\s*0/);
  });

  it('pose « voir plus… » en 13/600 #56665D, sans fond ni bordure', () => {
    const more = last('.ckp-more {');
    expect(more).toMatch(/font:\s*600 13px\/1\.15/);
    expect(more).toMatch(/color:\s*#56665D/);
    expect(more).toMatch(/background:\s*none/);
    expect(more).toMatch(/border:\s*0/);
    expect(more).toMatch(/cursor:\s*pointer/);
  });

  it('a retiré la ligne de lieu et les lignes d’information de la carte', () => {
    expect(css).not.toMatch(/\.ckp-place-line/);
    expect(css).not.toMatch(/\.ckp-dayinfo-row/);
    expect(css).not.toMatch(/\.ckp-dayinfo-l/);
    expect(css).not.toMatch(/\.ckp-dayinfo-v/);
  });
});
