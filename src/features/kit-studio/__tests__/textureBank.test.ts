// @vitest-environment jsdom
// Banc de textures UNIQUE de la scène survivante (P3) : l'ancien `bag/fabricMaps.ts` a été
// fusionné ici. Ce test vérifie la correspondance preset → tissu, le partage des textures et
// le cycle de vie (tout ce que la banque crée est libéré avec elle).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from '../scene/resources';
import { FABRIC_REPEAT, FABRIC_TILE_M, PRESETS_WITH_FABRIC_MAPS, createTextureBank } from '../scene/textures';

beforeEach(() => {
  // Pas de contexte 2D en jsdom : les textures procédurales restent vides, sans bruit.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function bank() {
  const tr = new ResourceTracker();
  const tex = createTextureBank(tr, 8);
  return { tr, tex };
}

describe('banc de textures unique — pas physique et partage', () => {
  it('respecte le pas de 100 mm : répétition 10 sur des UV en mètres', () => {
    expect(FABRIC_TILE_M).toBe(0.1);
    expect(FABRIC_REPEAT).toBe(10);
  });

  it('sert les cinq presets de matière de la couche GLB', () => {
    expect(PRESETS_WITH_FABRIC_MAPS).toEqual(
      expect.arrayContaining(['cordura-matte', 'ballistic-nylon', 'ripstop-ultralight', 'waxed-canvas', 'recycled-pet']),
    );
    const { tex } = bank();
    for (const preset of PRESETS_WITH_FABRIC_MAPS) {
      const maps = tex.forPreset(preset);
      expect(maps, preset).not.toBeNull();
      expect(maps!.albedo).toBeDefined();
      expect(maps!.normal).not.toBeNull();
    }
    tex.dispose();
  });

  it('renvoie null pour un preset inconnu ou absent, sans lever', () => {
    const { tex } = bank();
    expect(tex.forPreset(undefined)).toBeNull();
    expect(tex.forPreset('preset-qui-nexiste-pas')).toBeNull();
    tex.dispose();
  });

  it('partage les textures : deux presets qui pointent le même tissu reçoivent la même instance', () => {
    const { tex } = bank();
    const cordura = tex.forPreset('cordura-matte')!;
    const ballistic = tex.forPreset('ballistic-nylon')!;
    // Deux armures de nylon lourdes : même relevé Cordura, seule la rugosité du preset diffère.
    expect(ballistic.albedo).toBe(cordura.albedo);
    expect(ballistic.normal).toBe(cordura.normal);
    // L'appel direct au tissu rend la même texture que le preset.
    expect(tex.fabric('cordura')).toBe(cordura.albedo);
    expect(tex.fabricNormal('cordura')).toBe(cordura.normal);
    tex.dispose();
  });

  it('recycled-pet utilise le relevé « brushed-pet » (matière réellement photographiée)', () => {
    const { tex } = bank();
    const maps = tex.forPreset('recycled-pet')!;
    expect(maps.albedo).toBe(tex.fabric('brushed-pet'));
    // `brushed-pet` est un tissu photographique : il porte une carte de relief.
    expect(maps.normal).not.toBeNull();
    tex.dispose();
  });

  it('une matière sans relevé photographique n’a pas de carte de relief', () => {
    const { tex } = bank();
    expect(tex.fabricNormal('dcf')).toBeNull();
    expect(tex.fabricNormal('mesh')).toBeNull();
    expect(tex.fabricNormal('cordura')).not.toBeNull();
    tex.dispose();
  });

  it('un nom de tissu inconnu retombe sur ripstop (jamais de texture vide)', () => {
    const { tex } = bank();
    expect(tex.fabric('pas-un-tissu')).toBe(tex.fabric('ripstop'));
    tex.dispose();
  });

  it('libère toutes ses textures : le ResourceTracker retombe à zéro', () => {
    const { tr, tex } = bank();
    tex.fabric('cordura');
    tex.fabricNormal('cordura');
    tex.forPreset('recycled-pet');
    tex.panorama();
    tex.wood();
    expect(tr.counts().textures).toBeGreaterThan(0);
    tex.dispose();
    expect(tr.counts().textures).toBe(0);
  });
});
