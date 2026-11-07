/**
 * Choix du palier de maillage.
 *
 * Ce que ces tests protègent : la règle « on ne sert le master que sur preuve ». Un maillage de
 * 40 Mo coûte une minute d'attente sur un réseau mobile, quelle que soit la puissance du téléphone.
 * Chaque assouplissement de cette règle doit faire tomber un test ici.
 */

import { describe, expect, it } from 'vitest';
import type { BagManifest } from '../scene/bag/parts';
import { chooseBagTier, resolveBagAssetUrl, UNKNOWN_DEVICE, type DeviceProfile } from '../scene/bag/tier';

const manifeste = (assets: BagManifest['assets']): BagManifest => ({
  schema: 1,
  modelId: 'lkdv-one-45',
  label: 'LKDV ONE 45 L',
  generator: 'import-model.mjs',
  generatedBy: 'imported',
  license: 'LKDV',
  units: 'meters',
  origin: 'centre du sol',
  capabilities: {
    rotatable: true,
    openable: false,
    hasInterior: false,
    customizableParts: [],
    badgeAnchors: [],
    attachmentPoints: [],
  },
  hasHinge: false,
  declaredCapacityL: 45,
  boundingBoxM: { w: 0.4, h: 0.62, d: 0.29 },
  slots: [],
  budget: { triangles: 34683, fileBytes: 631888 },
  assets,
});

const DEUX_PALIERS = manifeste({
  web: { url: '/assets/bags/lkdv-one-45.glb', bytes: 631888, triangles: 34683 },
  hd: { url: 'https://exemple.test/lkdv-one-45.hd.glb', bytes: 49501768, triangles: 1109421 },
});

const capable: DeviceProfile = {
  ...UNKNOWN_DEVICE,
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  effectiveType: '4g',
};

describe('Choix du palier de maillage', () => {
  it('sert le palier web quand on ne sait rien de l’appareil', () => {
    const d = chooseBagTier(DEUX_PALIERS, UNKNOWN_DEVICE);
    expect(d.tier).toBe('web');
    expect(d.reason).toMatch(/inconnue/i);
  });

  it('sert le master à un appareil dont la capacité est prouvée', () => {
    expect(chooseBagTier(DEUX_PALIERS, capable).tier).toBe('hd');
  });

  it('ne sert jamais le master quand l’économie de données est demandée, même sur un appareil capable', () => {
    expect(chooseBagTier(DEUX_PALIERS, { ...capable, saveData: true }).tier).toBe('web');
    expect(chooseBagTier(DEUX_PALIERS, { ...capable, prefersReducedData: true }).tier).toBe('web');
  });

  it('fait passer l’économie de données avant la préférence pour la haute définition', () => {
    // Elle porte sur ce qu'on facture à la personne, pas sur son goût : elle gagne.
    const d = chooseBagTier(DEUX_PALIERS, { ...capable, saveData: true, override: 'hd' });
    expect(d.tier).toBe('web');
  });

  it('respecte une préférence explicite dans les deux sens', () => {
    expect(chooseBagTier(DEUX_PALIERS, { ...UNKNOWN_DEVICE, override: 'hd' }).tier).toBe('hd');
    expect(chooseBagTier(DEUX_PALIERS, { ...capable, override: 'web' }).tier).toBe('web');
  });

  it('retombe sur le palier web sur une connexion lente', () => {
    for (const type of ['slow-2g', '2g', '3g']) {
      expect(chooseBagTier(DEUX_PALIERS, { ...capable, effectiveType: type }).tier).toBe('web');
    }
  });

  it('refuse le master à un appareil qui n’a ni la mémoire ni les cœurs', () => {
    expect(chooseBagTier(DEUX_PALIERS, { ...capable, deviceMemoryGb: 4 }).tier).toBe('web');
    expect(chooseBagTier(DEUX_PALIERS, { ...capable, hardwareConcurrency: 4 }).tier).toBe('web');
  });

  it('ne déduit pas la capacité du seul nombre de cœurs quand la mémoire est inconnue', () => {
    // C'est le cas de Safari : un iPhone et un appareil modeste annoncent le même nombre de cœurs.
    const safari: DeviceProfile = { ...capable, deviceMemoryGb: null, hardwareConcurrency: 8 };
    expect(chooseBagTier(DEUX_PALIERS, safari).tier).toBe('web');
  });

  it('ne propose pas un palier qui n’existe pas', () => {
    const webSeul = manifeste({ web: { url: '/a.glb', bytes: 1, triangles: 1 } });
    expect(chooseBagTier(webSeul, capable).tier).toBe('web');
    const hdSeul = manifeste({ hd: { url: 'https://x/a.glb', bytes: 1, triangles: 1 } });
    expect(chooseBagTier(hdSeul, UNKNOWN_DEVICE).tier).toBe('hd');
  });

  it('traite un manifeste sans section assets comme un modèle à un seul maillage', () => {
    expect(chooseBagTier(manifeste(undefined), capable).tier).toBe('web');
    expect(resolveBagAssetUrl(manifeste(undefined), 'web')).toBeNull();
  });

  it('résout l’adresse du palier demandé', () => {
    expect(resolveBagAssetUrl(DEUX_PALIERS, 'web')).toBe('/assets/bags/lkdv-one-45.glb');
    expect(resolveBagAssetUrl(DEUX_PALIERS, 'hd')).toMatch(/^https:\/\//);
  });
});
