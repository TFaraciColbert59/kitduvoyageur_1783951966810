import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadBagAsset,
  type BagAssetProvider,
} from '../scene/bag/loader';
import { applyPartCustomization } from '../scene/bag/materials';
import type { BagIndexEntry, BagManifest } from '../scene/bag/parts';

const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');
const indexJson = JSON.parse(
  fs.readFileSync(path.join(BAGS_DIR, 'bags.index.json'), 'utf8')
) as { schema: number; models: BagIndexEntry[] };

const fsProvider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    const file = path.join(BAGS_DIR, `${modelId}.manifest.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  },
  async fetchGlb(modelId: string): Promise<ArrayBuffer> {
    const file = path.join(BAGS_DIR, `${modelId}.glb`);
    const buf = fs.readFileSync(file);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

describe('Bag GLB + Manifest Loader (Lot L4-2 / C-13 / D-04 / H-07)', () => {
  it('trouve les 5 modèles procéduraux validés dans bags.index.json sous les budgets (<= 40k tri, <= 900 Ko)', () => {
    expect(indexJson.models.length).toBe(5);
    for (const entry of indexJson.models) {
      expect(entry.valid).toBe(true);
      expect(entry.triangles).toBeLessThanOrEqual(40_000);
      expect(entry.bytes).toBeLessThanOrEqual(900 * 1024);
    }
  });

  it.each(indexJson.models)(
    'charge $modelId : pièces nommées, ancres, matériaux isolés et honnêteté openable ($openable)',
    async (entry) => {
      const loaded = await loadBagAsset(entry.modelId, fsProvider);
      expect(loaded.status).toBe('ready');
      if (loaded.status !== 'ready') return;

      // Toutes les pièces personnalisables déclarées dans le manifeste existent dans le graphe 3D
      for (const partId of loaded.manifest.capabilities.customizableParts) {
        expect(loaded.parts.has(partId)).toBe(true);
      }

      // Toutes les ancres d'insigne déclarées existent
      for (const anchorId of loaded.manifest.capabilities.badgeAnchors) {
        expect(loaded.anchors.has(anchorId)).toBe(true);
      }

      // Honnêteté C-13 : duffel-60 (openable: false) n'expose AUCUNE charnière
      if (entry.openable) {
        expect(loaded.capabilities.openable).toBe(true);
        expect(loaded.hinges.size).toBeGreaterThan(0);
      } else {
        expect(loaded.capabilities.openable).toBe(false);
        expect(loaded.capabilities.hasInterior).toBe(false);
        expect(loaded.hinges.size).toBe(0);
      }

      // D-04 : modifier une pièce ne modifie AUCUNE pièce sœur (isolation des matériaux)
      if (loaded.parts.has('shoulder-strap-l') && loaded.parts.has('shoulder-strap-r')) {
        const leftMat = loaded.parts.get('shoulder-strap-l')!.material as any;
        const rightMat = loaded.parts.get('shoulder-strap-r')!.material as any;
        expect(leftMat).not.toBe(rightMat);

        const rightHexBefore = rightMat.color.getHexString();
        const applied = applyPartCustomization(loaded.parts, 'shoulder-strap-l', {
          color: 'var(--hub-bag-ochre)',
          material: 'ripstop-ultralight',
        });
        expect(applied).toBe(true);
        expect(rightMat.color.getHexString()).toBe(rightHexBefore);
        expect(leftMat.color.getHexString()).not.toBe(rightHexBefore);
      }

      loaded.dispose();
    }
  );

  it.each(indexJson.models)(
    '$modelId porte des coordonnées de texture sur toutes ses pièces, sans quoi aucune matière ne peut se poser',
    async (entry) => {
      const loaded = await loadBagAsset(entry.modelId, fsProvider);
      expect(loaded.status).toBe('ready');
      if (loaded.status !== 'ready') return;

      for (const [partId, mesh] of loaded.parts) {
        const uv = mesh.geometry.getAttribute('uv');
        expect(uv, `pièce ${partId} sans uv`).toBeDefined();
        expect(uv.itemSize).toBe(2);
        expect(uv.count).toBe(mesh.geometry.getAttribute('position').count);
      }
    }
  );

  it('retourne status: degraded sans crash lorsque le fichier GLB est manquant ou corrompu', async () => {
    const missing = await loadBagAsset('modele-fantome-999', fsProvider);
    expect(missing.status).toBe('degraded');
    expect(missing.capabilities.openable).toBe(false);
    expect(missing.root).toBeNull();

    const empty = await loadBagAsset(null, fsProvider);
    expect(empty.status).toBe('degraded');
  });
});
