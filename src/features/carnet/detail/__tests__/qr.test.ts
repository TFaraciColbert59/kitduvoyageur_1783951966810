import { describe, expect, it } from 'vitest';
import { encodeQr, qrCapacityBytes, qrPath } from '../qr';

/*
 * Vérification de fond (hors dépôt, 2026-11-10) : les matrices de sept textes
 * (1 à 271 octets, versions 1 à 10, UTF-8 compris) ont été rastérisées puis
 * décodées par jsQR, un décodeur indépendant : texte identique à l'octet près.
 * Ici : les propriétés structurelles qui ne dépendent d'aucun décodeur.
 */
describe('encodeQr', () => {
  it('produit la taille de la version et les trois repères de coin', () => {
    const url = 'https://lkdv.fr/carnets/749e9e8c-9540-5a73-8b6c-6ab07264f62f';
    const m = encodeQr(url) as boolean[][];
    expect([21, 25, 29, 33, 37, 41, 45, 49, 53, 57]).toContain(m.length);
    expect(m.length).toBe(33); // 61 octets : version 4
    const finderRing = (x0: number, y0: number) =>
      [0, 6].every((d) => [0, 1, 2, 3, 4, 5, 6].every((i) => m[y0 + d][x0 + i] && m[y0 + i][x0 + d])) &&
      m[y0 + 3][x0 + 3];
    expect(finderRing(0, 0)).toBe(true);
    expect(finderRing(m.length - 7, 0)).toBe(true);
    expect(finderRing(0, m.length - 7)).toBe(true);
  });

  it('est déterministe et refuse ce qui dépasse la capacité de la version 10', () => {
    expect(encodeQr('abc')).toEqual(encodeQr('abc'));
    expect(qrCapacityBytes(10)).toBe(271);
    expect(encodeQr('x'.repeat(271))).not.toBeNull();
    expect(encodeQr('x'.repeat(272))).toBeNull();
  });

  it('trace un unique chemin SVG avec zone de silence', () => {
    const { d, size } = qrPath(encodeQr('a') as boolean[][], 2);
    expect(size).toBe(21 + 4);
    expect(d.startsWith('M')).toBe(true);
    expect((d.match(/M/g) ?? []).length).toBeGreaterThan(100);
  });
});
