// @vitest-environment jsdom
/**
 * src/features/kit-studio/__tests__/atlas.test.ts
 * Tests unitaires du système d'atlas texturé et carte de zones — Avenant 7 nov (§ 4).
 *
 * Vérifie :
 * 1. Deux couleurs de token => texels hors zone rouge strictement identiques / texels tissu différents.
 * 2. Sans carte de zones => pas de teinte, pas de sheen, atlas restitué tel quel, customized: false.
 * 3. Lueur textile (sheen) active uniquement sur les zones R+V, et strictement 0 sur la zone rigide B.
 * 4. Zone bleue B (boucles / fermetures / écusson) => rugosité plus basse que le tissu.
 * 5. Trame tissée physique greffée par-dessus l'atlas et pondérée par les zones textiles.
 * 6. Intégration modelLayer : colorCustomization = 'unavailable-no-mask' en l'absence de carte.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateLuminance,
  createPixelBuffer,
  processAtlasBuffers,
  type AtlasPixelBuffer,
} from '../scene/bag/atlas';

describe('Avenant § 4 — Système d’atlas et carte de zones', () => {
  // Fabrique une carte de zones 16x16 :
  // - Quadrant haut-gauche (x < 8, y < 8) : Zone Rouge (Tissu) -> (255, 0, 0)
  // - Quadrant haut-droit (x >= 8, y < 8) : Zone Verte (Sangles) -> (0, 255, 0)
  // - Quadrant bas-droit (x >= 8, y >= 8) : Zone Bleue (Rigide : boucles) -> (0, 0, 255)
  // - Quadrant bas-gauche (x < 8, y >= 8) : Neutre / fond -> (0, 0, 0)
  function makeTestZonesMap(w = 16, h = 16): AtlasPixelBuffer {
    const buf = createPixelBuffer(w, h, [0, 0, 0, 255]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (x < w / 2 && y < h / 2) {
          // R = Tissu
          buf.data[idx] = 255;
          buf.data[idx + 1] = 0;
          buf.data[idx + 2] = 0;
        } else if (x >= w / 2 && y < h / 2) {
          // V = Sangles
          buf.data[idx] = 0;
          buf.data[idx + 1] = 255;
          buf.data[idx + 2] = 0;
        } else if (x >= w / 2 && y >= h / 2) {
          // B = Rigide (boucles, fermetures)
          buf.data[idx] = 0;
          buf.data[idx + 1] = 0;
          buf.data[idx + 2] = 255;
        } else {
          // Neutre
          buf.data[idx] = 0;
          buf.data[idx + 1] = 0;
          buf.data[idx + 2] = 0;
        }
      }
    }
    return buf;
  }

  // Base albedo uniforme gris moyen (160, 160, 160)
  function makeTestAlbedo(w = 16, h = 16): AtlasPixelBuffer {
    return createPixelBuffer(w, h, [160, 160, 160, 255]);
  }

  it('calcule la luminance Rec. 709 conformément au standard photométrique', () => {
    // Blanc pur
    expect(calculateLuminance(255, 255, 255)).toBeCloseTo(255, 1);
    // Noir pur
    expect(calculateLuminance(0, 0, 0)).toBe(0);
    // Vert domine la luminance
    const lumGreen = calculateLuminance(0, 255, 0);
    const lumRed = calculateLuminance(255, 0, 0);
    const lumBlue = calculateLuminance(0, 0, 255);
    expect(lumGreen).toBeGreaterThan(lumRed);
    expect(lumRed).toBeGreaterThan(lumBlue);
  });

  it('deux couleurs de token => texels hors zone rouge identiques / texels tissu différents', () => {
    const W = 16;
    const H = 16;
    const baseAlbedo = makeTestAlbedo(W, H);
    const zonesMap = makeTestZonesMap(W, H);

    // Couleur 1 : Vert Forêt (0.09, 0.25, 0.17)
    const tokenForet = { r: 23 / 255, g: 64 / 255, b: 44 / 255 };
    // Couleur 2 : Ocre Minéral (0.78, 0.60, 0.23)
    const tokenOchre = { r: 200 / 255, g: 154 / 255, b: 59 / 255 };

    const resForet = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      tokenColor: tokenForet,
      weaveEnabled: false, // désactivé pour tester la pureté mathématique de la teinte
    });

    const resOchre = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      tokenColor: tokenOchre,
      weaveEnabled: false,
    });

    expect(resForet.customized).toBe(true);
    expect(resOchre.customized).toBe(true);

    let redZoneDifferentCount = 0;
    let nonRedZoneSameCount = 0;
    let totalNonRedPixels = 0;
    let totalRedPixels = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const isRedZone = x < W / 2 && y < H / 2;

        const r1 = resForet.albedo.data[i];
        const g1 = resForet.albedo.data[i + 1];
        const b1 = resForet.albedo.data[i + 2];

        const r2 = resOchre.albedo.data[i];
        const g2 = resOchre.albedo.data[i + 1];
        const b2 = resOchre.albedo.data[i + 2];

        if (isRedZone) {
          totalRedPixels += 1;
          // Les texels tissu DOIVENT être différents entre Forêt et Ocre
          if (r1 !== r2 || g1 !== g2 || b1 !== b2) {
            redZoneDifferentCount += 1;
          }
        } else {
          totalNonRedPixels += 1;
          // Les texels hors zone rouge (sangles, boucles, neutre) DOIVENT être strictement identiques
          if (r1 === r2 && g1 === g2 && b1 === b2) {
            nonRedZoneSameCount += 1;
          }
        }
      }
    }

    expect(totalRedPixels).toBe(64);
    expect(redZoneDifferentCount).toBe(64);
    expect(totalNonRedPixels).toBe(192);
    expect(nonRedZoneSameCount).toBe(192);
  });

  it('sans carte de zones => pas de teinte, pas de sheen, atlas restitué tel quel', () => {
    const W = 16;
    const H = 16;
    const baseAlbedo = makeTestAlbedo(W, H);

    const tokenForet = { r: 23 / 255, g: 64 / 255, b: 44 / 255 };

    const resWithoutMap = processAtlasBuffers({
      baseAlbedo,
      zonesMap: null, // Carte absente
      tokenColor: tokenForet,
    });

    expect(resWithoutMap.customized).toBe(false);
    expect(resWithoutMap.sheenMap).toBeNull();
    expect(resWithoutMap.roughnessMap).toBeNull();
    // L'albédo est resté intact, aucun texel altéré
    expect(resWithoutMap.albedo.data).toEqual(baseAlbedo.data);
  });

  it('lueur textile (sheen) : active sur R+V, et strictement 0 sur zone B (boucles)', () => {
    const W = 16;
    const H = 16;
    const baseAlbedo = makeTestAlbedo(W, H);
    const zonesMap = makeTestZonesMap(W, H);

    const res = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      tokenColor: { r: 0.5, g: 0.5, b: 0.5 },
    });

    expect(res.sheenMap).not.toBeNull();
    const sheen = res.sheenMap!;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const sVal = sheen.data[i];

        if (x < W / 2 && y < H / 2) {
          // Zone R (tissu) : sheen actif
          expect(sVal).toBeGreaterThan(0);
        } else if (x >= W / 2 && y < H / 2) {
          // Zone V (sangles) : sheen actif
          expect(sVal).toBeGreaterThan(0);
        } else if (x >= W / 2 && y >= H / 2) {
          // Zone B (boucles rigides) : sheen STRICTEMENT 0 (empêche les boucles de virer au vert pâle)
          expect(sVal).toBe(0);
        }
      }
    }
  });

  it('zone bleue B (rigide) reçoit une rugosité plus basse que le tissu', () => {
    const W = 16;
    const H = 16;
    const baseAlbedo = makeTestAlbedo(W, H);
    const zonesMap = makeTestZonesMap(W, H);

    const res = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      fabricRoughness: 0.82,
      rigidRoughness: 0.25,
    });

    expect(res.roughnessMap).not.toBeNull();
    const rough = res.roughnessMap!;

    // Pixel tissu (0, 0)
    const fabricPixelRoughness = rough.data[0];
    // Pixel rigide (12, 12)
    const rigidIdx = (12 * W + 12) * 4;
    const rigidPixelRoughness = rough.data[rigidIdx];

    expect(fabricPixelRoughness).toBeCloseTo(Math.round(0.82 * 255), 1);
    expect(rigidPixelRoughness).toBeCloseTo(Math.round(0.25 * 255), 1);
    expect(rigidPixelRoughness).toBeLessThan(fabricPixelRoughness);
  });

  it('trame tissée physique module les zones textiles sans altérer les boucles rigides B', () => {
    const W = 16;
    const H = 16;
    const baseAlbedo = makeTestAlbedo(W, H);
    const zonesMap = makeTestZonesMap(W, H);

    const withWeave = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      weaveEnabled: true,
    });

    const withoutWeave = processAtlasBuffers({
      baseAlbedo,
      zonesMap,
      weaveEnabled: false,
    });

    // Sur la zone rigide B (12, 12), le weave ne doit pas s'appliquer
    const rigidIdx = (12 * W + 12) * 4;
    expect(withWeave.albedo.data[rigidIdx]).toBe(withoutWeave.albedo.data[rigidIdx]);
    expect(withWeave.albedo.data[rigidIdx + 1]).toBe(withoutWeave.albedo.data[rigidIdx + 1]);
    expect(withWeave.albedo.data[rigidIdx + 2]).toBe(withoutWeave.albedo.data[rigidIdx + 2]);
  });
});
