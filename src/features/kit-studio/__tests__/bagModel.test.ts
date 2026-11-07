// Domaine du manifeste de sac (P3) : mapping manifeste → modèle, capacités, slots, ancrages
// et apparences de pièces. Aucun three, aucun DOM : ce sont les concepts repris de l'ancien
// second modèle (state/types.ts) qui survivent à la suppression du studio du hub.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BAG_MODELS,
  DEGRADED_BAG_CAPABILITIES,
  attachmentPoints,
  bagAssetUrl,
  bagModelFromManifest,
  bagPartAppearances,
  declaredCapacityL,
  fabricMaskUrl,
  fabricNameForMaterial,
  isBuiltinBagModel,
  storageSlots,
} from '../domain/bagModel';
import type { BagManifest } from '../domain/bagModel';
import { DEFAULT_CONFIG } from '../domain/catalog';
import { RAW_MATERIALS } from '../domain/palette';

const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');

function readManifest(modelId: string): BagManifest {
  return JSON.parse(fs.readFileSync(path.join(BAGS_DIR, `${modelId}.manifest.json`), 'utf8')) as BagManifest;
}

describe('Mapping manifeste → modèle de domaine', () => {
  it('projette le manifeste réel de daypack-22 sans rien inventer', () => {
    const manifest = readManifest('daypack-22');
    const model = bagModelFromManifest(manifest);

    expect(model.modelId).toBe('daypack-22');
    expect(model.label).toBe('Sac à dos journée 22 L');
    expect(model.declaredCapacityL).toBe(22);
    expect(model.hasHinge).toBe(true);
    expect(model.boundingBoxM).toEqual({ w: 0.416, h: 0.53, d: 0.3369 });
    // 5 emplacements de rangement + 4 points d'attache, lus dans le manifeste.
    expect(model.slots).toHaveLength(manifest.slots.length);
    expect(model.capabilities.attachmentPoints).toEqual([
      'attach-top',
      'attach-bottom',
      'attach-side-l',
      'attach-side-r',
    ]);
    expect(model.capabilities.badgeAnchors).toEqual(['badge-body-front', 'badge-lid', 'badge-front-pocket']);
    expect(model.capabilities.customizableParts).toContain('body');
  });

  it('arrondit les capacités d’emplacement à 2 décimales (jamais de flottant brut)', () => {
    const model = bagModelFromManifest(readManifest('daypack-22'));
    const top = model.slots.find((slot) => slot.id === 'interior-top');
    expect(top?.capacityL).toBe(7.7);
    for (const slot of model.slots) {
      if (slot.capacityL === null) continue;
      expect(Number.isInteger(Math.round(slot.capacityL * 100))).toBe(true);
    }
  });

  it('honnêteté C-13 : openable/hasInterior retombent à false sans charnière réelle', () => {
    const manifest = readManifest('daypack-22');
    const dishonest: BagManifest = { ...manifest, hasHinge: false };
    const model = bagModelFromManifest(dishonest);
    expect(model.capabilities.openable).toBe(false);
    expect(model.capabilities.hasInterior).toBe(false);
    expect(model.hasHinge).toBe(false);
  });

  it('capacité déclarée : manifeste prioritaire, somme des emplacements sinon, null jamais 0', () => {
    const manifest = readManifest('daypack-22');
    expect(declaredCapacityL(manifest)).toBe(22);

    const withoutDeclared = { ...manifest, declaredCapacityL: null } as BagManifest;
    const fromSlots = declaredCapacityL(withoutDeclared);
    expect(fromSlots).not.toBeNull();
    expect(fromSlots).toBeGreaterThan(0);
    expect(fromSlots).toBeLessThan(60);

    const empty: BagManifest = {
      ...manifest,
      declaredCapacityL: null,
      slots: manifest.slots.map((slot) => ({ ...slot, capacityL: null })),
    };
    expect(declaredCapacityL(empty)).toBeNull();
  });

  it('sépare emplacements de rangement et points d’attache', () => {
    const manifest = readManifest('daypack-22');
    expect(storageSlots(manifest).every((slot) => slot.kind !== 'attachment')).toBe(true);
    expect(attachmentPoints(manifest)).toHaveLength(4);
    expect(attachmentPoints(manifest).every((slot) => slot.kind === 'attachment')).toBe(true);
  });

  it('construit les chemins des assets et du masque de tissu à côté du GLB', () => {
    expect(fabricMaskUrl('daypack-22')).toBe('/assets/bags/daypack-22.mask.png');
    expect(bagAssetUrl('trekker-55', 'glb')).toBe('/assets/bags/trekker-55.glb');
    expect(bagAssetUrl('trekker-55', 'manifest.json')).toBe('/assets/bags/trekker-55.manifest.json');
  });

  it('connaît les cinq sacs GLB livrés et refuse les identifiants inconnus', () => {
    expect(BUILTIN_BAG_MODELS.map((model) => model.modelId)).toEqual([
      'daypack-22',
      'ultralight-40',
      'trekker-55',
      'expedition-75',
      'duffel-60',
    ]);
    expect(isBuiltinBagModel('daypack-22')).toBe(true);
    expect(isBuiltinBagModel('pas-un-sac')).toBe(false);
    expect(isBuiltinBagModel(null)).toBe(false);
  });

  it('capacités dégradées : rien n’est promis sans maillage', () => {
    expect(DEGRADED_BAG_CAPABILITIES).toEqual({
      rotatable: false,
      openable: false,
      hasInterior: false,
      customizableParts: [],
      badgeAnchors: [],
      attachmentPoints: [],
    });
  });
});

describe('Mapping configuration d’apparence → pièces du maillage', () => {
  it('projette les couleurs et matières du studio sur les pièces nommées du GLB', () => {
    const config = DEFAULT_CONFIG.b42;
    const appearances = bagPartAppearances(config);

    // Corps et doublure partagent l'apparence du corps.
    expect(appearances.body.color).toBe(RAW_MATERIALS[config.body.col!]);
    expect(appearances.interior.color).toBe(appearances.body.color);
    // Poche avant → front-pocket ; poches latérales → les deux côtés.
    expect(appearances['front-pocket'].color).toBe(RAW_MATERIALS[config.front.col!]);
    expect(appearances['side-pocket-l'].color).toBe(RAW_MATERIALS[config.sides.col!]);
    expect(appearances['side-pocket-r'].color).toBe(appearances['side-pocket-l'].color);
    // Ceinture et bretelles.
    expect(appearances['hip-belt'].color).toBe(RAW_MATERIALS[config.hip.col!]);
    expect(appearances['shoulder-strap-l'].color).toBe(RAW_MATERIALS[config.harness.col!]);
    // Aucune pièce inventée hors du mapping.
    expect(Object.keys(appearances).every((part) => part.length > 0)).toBe(true);
  });

  it('traduit la matière du studio en preset de trame, sans inventer de relevé pour dcf/xpac', () => {
    const appearances = bagPartAppearances({
      ...DEFAULT_CONFIG.b42,
      body: { mat: 'cordura', col: 'm-2d482a', fin: 'mat' },
      front: { mat: 'dcf', col: 'm-3d6038', fin: 'satin' },
      lid: { mat: 'ripstop', col: 'm-2d482a', fin: 'mat' },
    });
    expect(appearances.body.material).toBe('cordura-matte');
    expect(appearances['front-pocket'].material).toBeUndefined(); // dcf : aspect uni juste
    expect(appearances.lid.material).toBe('ripstop-ultralight');
  });

  it('fabricNameForMaterial suit le catalogue des matières réel', () => {
    expect(fabricNameForMaterial('cordura')).toBe('cordura');
    expect(fabricNameForMaterial('waxed')).toBe('waxed');
    expect(fabricNameForMaterial(undefined)).toBeNull();
    expect(fabricNameForMaterial('inconnue' as never)).toBeNull();
  });
});
