/**
 * Échelle physique des coordonnées de texture.
 *
 * Le défaut corrigé ici était mesurable : avec les UV normalisées 0..1 des primitives de three et une
 * répétition fixe, la tuile de tissu s'étirait à la taille de la pièce — 29 mm sur une sangle de
 * 0,10 m, 143 mm sur un corps de 0,50 m, soit un tissage cinq fois plus grossier sur le corps.
 *
 * Ces tests vérifient qu'une même étendue d'UV correspond désormais à une même longueur réelle,
 * quelle que soit la taille de la pièce.
 */

import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { roundedBox } from '../scene/bagBuilder';
import { FABRIC_REPEAT, FABRIC_TILE_M } from '../scene/textures';
import { uvMeters } from '../scene/uv';

/** Plus grande étendue d'UV de la géométrie, sur chaque axe. */
function uvSpan(geometry: { getAttribute: (n: string) => { count: number; getX(i: number): number; getY(i: number): number } | undefined }) {
  const uv = geometry.getAttribute('uv');
  if (!uv) throw new Error('géométrie sans uv');
  let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i); const v = uv.getY(i);
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  return { u: maxU - minU, v: maxV - minV };
}

describe('UV en mètres (échelle physique de la trame)', () => {
  it('la tuile vaut 100 mm, et la répétition en découle', () => {
    expect(FABRIC_TILE_M).toBe(0.1);
    expect(FABRIC_REPEAT).toBe(10);
  });

  it('l’étendue d’UV suit la taille réelle, d’une sangle à un corps de sac', () => {
    // Trois pièces aux dimensions très différentes, comme dans un vrai sac.
    const cases: { nom: string; w: number; h: number; d: number }[] = [
      { nom: 'sangle', w: 0.04, h: 0.1, d: 0.012 },
      { nom: 'poche', w: 0.22, h: 0.26, d: 0.08 },
      { nom: 'corps', w: 0.5, h: 0.62, d: 0.3 },
    ];

    for (const c of cases) {
      const g = uvMeters(roundedBox(c.w, c.h, c.d, Math.min(0.02, c.d / 3)));
      const span = uvSpan(g);
      const plus = Math.max(c.w, c.h, c.d);
      // L'étendue d'UV doit valoir la dimension réelle en mètres, et non 1 comme avant.
      // Marge basse à 0,70 : les coins arrondis raccourcissent la projection, et les sommets
      // extrêmes d'un axe appartiennent à la face perpendiculaire, où cet axe n'est pas projeté.
      // L'effet est d'autant plus marqué que la pièce est petite (mesuré : 0,075 pour 0,10 m sur
      // une sangle, 0,60 pour 0,62 m sur un corps).
      expect(Math.max(span.u, span.v), `${c.nom} : étendue d'UV`).toBeGreaterThan(plus * 0.7);
      expect(Math.max(span.u, span.v), `${c.nom} : étendue d'UV`).toBeLessThan(plus * 1.2);
    }
  });

  it('deux pièces de tailles différentes reçoivent le même nombre de tuiles par mètre', () => {
    const petite = uvMeters(roundedBox(0.04, 0.1, 0.012, 0.004));
    const grande = uvMeters(roundedBox(0.5, 0.62, 0.3, 0.02));

    const tuilesParMetre = (g: ReturnType<typeof uvMeters>, taille: number) =>
      (Math.max(uvSpan(g).u, uvSpan(g).v) * FABRIC_REPEAT) / taille;

    const p = tuilesParMetre(petite, 0.1);
    const G = tuilesParMetre(grande, 0.62);
    // Avec les UV 0..1 d'origine, ce rapport valait 0,62 / 0,10 = 6,2 : le tissage était six fois
    // plus grossier sur le corps. Mesuré après le correctif : 1,31. Le reste de l'écart vient des
    // coins arrondis, qui pèsent proportionnellement plus sur une petite pièce.
    // Le seuil garde tout son pouvoir discriminant : une régression ramènerait le rapport au-delà
    // de 5, très loin de la borne.
    expect(G / p).toBeGreaterThan(0.75);
    expect(G / p).toBeLessThan(1.4);
  });

  it('est idempotent : une géométrie partagée n’est pas remise à l’échelle deux fois', () => {
    const g = uvMeters(roundedBox(0.3, 0.4, 0.2, 0.02));
    const premier = uvSpan(g);
    uvMeters(g);
    uvMeters(g);
    const apres = uvSpan(g);
    expect(apres.u).toBeCloseTo(premier.u, 6);
    expect(apres.v).toBeCloseTo(premier.v, 6);
    expect(g.userData.uvMeters).toBe(true);
  });

  it('fonctionne sur une primitive indexée à surface courbe, sans trou', () => {
    for (const g of [new CylinderGeometry(0.1, 0.1, 0.4, 24), new SphereGeometry(0.15, 20, 12)]) {
      const out = uvMeters(g);
      const uv = out.getAttribute('uv');
      const pos = out.getAttribute('position');
      expect(uv).toBeDefined();
      expect(uv.count).toBe(pos.count);
      for (let i = 0; i < uv.count; i++) {
        expect(Number.isFinite(uv.getX(i))).toBe(true);
        expect(Number.isFinite(uv.getY(i))).toBe(true);
      }
    }
  });

  it('rend la géométrie inchangée si elle n’a pas de normales', () => {
    const g = new BoxGeometry(0.2, 0.2, 0.2);
    g.deleteAttribute('normal');
    const avant = g.getAttribute('uv');
    const out = uvMeters(g);
    // Les UV d'origine de three sont conservées : pas de projection possible sans normale.
    expect(out.getAttribute('uv')).toBe(avant);
    expect(out.userData.uvMeters).toBeUndefined();
  });
});
