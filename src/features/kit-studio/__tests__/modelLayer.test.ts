// @vitest-environment jsdom
// Couche « GLB ou procédural » de la scène survivante : choix de source, chargement,
// apparences appliquées, repli propre et libération. Aucun WebGL (three en mémoire).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/catalog';
import type { BagManifest } from '../domain/bagModel';
import { RAW_MATERIALS } from '../domain/palette';
import type { BagAssetProvider } from '../scene/bag/loader';
import {
  applyAppearanceToLoaded,
  createBagModelLayer,
  glbModelForBag,
  selectBagRenderSource,
  type BagModelRuntimeInfo,
} from '../scene/bag/modelLayer';
import { ResourceTracker } from '../scene/resources';
import { createTextureBank } from '../scene/textures';

const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');

const fsProvider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    return JSON.parse(fs.readFileSync(path.join(BAGS_DIR, `${modelId}.manifest.json`), 'utf8'));
  },
  async fetchGlb(modelId: string): Promise<ArrayBuffer> {
    const buf = fs.readFileSync(path.join(BAGS_DIR, `${modelId}.glb`));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

function makeLayer() {
  const scene = new THREE.Scene();
  const procedural = new THREE.Group();
  procedural.name = 'procedural-bag';
  scene.add(procedural);
  const tr = new ResourceTracker();
  const textures = createTextureBank(tr, 4);
  const events: BagModelRuntimeInfo[] = [];
  const layer = createBagModelLayer({
    scene,
    textures,
    proceduralBag: procedural,
    targetHeightM: () => 1.45,
    onChange: (info) => events.push(info),
    provider: fsProvider,
  });
  return { scene, procedural, textures, tr, layer, events };
}

describe('Choix de la source de rendu du sac', () => {
  it('repli procédural par défaut : aucun maillage n’est déclaré pour les corps 28/42 L', () => {
    expect(glbModelForBag('b42')).toBeNull();
    expect(glbModelForBag('b28')).toBeNull();
    expect(selectBagRenderSource(null, 'b42')).toEqual({ kind: 'procedural' });
    expect(selectBagRenderSource(undefined, undefined)).toEqual({ kind: 'procedural' });
  });

  it('un modèle explicite (lien profond, donnée serveur, test) force le GLB', () => {
    expect(selectBagRenderSource('daypack-22', 'b42')).toEqual({ kind: 'glb', modelId: 'daypack-22' });
    // Une chaîne vide ou blanche ne force rien.
    expect(selectBagRenderSource('  ', 'b42')).toEqual({ kind: 'procedural' });
  });
});

describe('Chargement du maillage dans la scène survivante', () => {
  it('sans modèle : le sac procédural reste seul, rien n’est annoncé', async () => {
    const { layer, procedural } = makeLayer();
    const info = await layer.load(null);
    expect(info.status).toBe('procedural');
    expect(info.parts).toEqual([]);
    expect(info.capabilities).toBeNull();
    expect(procedural.visible).toBe(true);
    layer.dispose();
  });

  it('GLB réel : pièces, ancrages, capacités déclarées et masquage du procédural', async () => {
    const { layer, procedural, events } = makeLayer();
    const info = await layer.load('daypack-22');

    expect(info.status).toBe('glb');
    expect(info.modelId).toBe('daypack-22');
    expect(info.label).toBe('Sac à dos journée 22 L');
    expect(info.parts).toContain('body');
    expect(info.parts).toContain('lid');
    expect(info.anchors).toContain('badge-body-front');
    expect(info.capabilities?.openable).toBe(true);
    expect(info.capabilities?.attachmentPoints).toContain('attach-top');
    expect(info.declaredCapacityL).toBe(22);
    // Pas d'atlas dans les sacs générés : la couleur reste appliquée par le code.
    expect(info.colorCustomization).toBe('procedural');
    // Le maillage remplace le sac procédural à l'écran.
    expect(procedural.visible).toBe(false);
    // Le chargement a bien été annoncé (loading puis glb).
    expect(events.map((event) => event.status)).toEqual(['loading', 'glb']);
    layer.dispose();
  });

  it('un modèle absent dégrade proprement : raison annoncée, procédural restauré', async () => {
    const { layer, procedural } = makeLayer();
    const info = await layer.load('modele-fantome-999');
    expect(info.status).toBe('degraded');
    expect(info.reason).toBeTruthy();
    expect(procedural.visible).toBe(true);
    layer.dispose();
  });

  it('applique couleur, matière et finition du studio aux pièces nommées du GLB', async () => {
    const { textures } = makeLayer();
    const config = {
      ...DEFAULT_CONFIG.b42,
      body: { shape: 'classic', mat: 'cordura' as const, col: 'm-2d482a' as const, fin: 'mat' as const },
    };
    // Chargement direct de l'asset (sans scène) : on inspecte les matériaux réels.
    const { loadBagAsset } = await import('../scene/bag/loader');
    const loaded = await loadBagAsset('daypack-22', fsProvider);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;

    applyAppearanceToLoaded(loaded, config, textures);
    const bodyMaterial = loaded.parts.get('body')!.material as THREE.MeshStandardMaterial;
    expect(bodyMaterial.color.getHexString()).toBe(RAW_MATERIALS['m-2d482a'].slice(1).toLowerCase());
    // La matière choisie pose sa trame (banc unique) : une carte de détail neutre.
    expect(bodyMaterial.map).not.toBeNull();
    // La finition « mat » du studio s'ajoute à la rugosité de la matière Cordura.
    expect(bodyMaterial.roughness).toBeCloseTo(0.88, 2);
    loaded.dispose();
    textures.dispose();
  });

  it('revenir au procédural libère le maillage et le réaffiche', async () => {
    const { layer, procedural } = makeLayer();
    await layer.load('daypack-22');
    expect(procedural.visible).toBe(false);
    const info = await layer.load(null);
    expect(info.status).toBe('procedural');
    expect(procedural.visible).toBe(true);
    layer.dispose();
  });

  it('changer de modèle remplace l’ancien sans empiler les maillages', async () => {
    const { layer, scene } = makeLayer();
    await layer.load('daypack-22');
    await layer.load('trekker-55');
    const holder = scene.children.find((child) => child.name === 'bag-model-layer');
    expect(holder).toBeDefined();
    expect(holder!.children).toHaveLength(1);
    expect(layer.info().modelId).toBe('trekker-55');
    layer.dispose();
  });

  it('dispose retire tout de la scène et n’annonce plus rien', async () => {
    const { layer, scene, textures, tr } = makeLayer();
    await layer.load('daypack-22');
    layer.dispose();
    expect(scene.children.some((child) => child.name === 'bag-model-layer')).toBe(false);
    textures.dispose();
    expect(tr.counts().textures).toBe(0);
    // Après destruction, un rechargement ne relance aucun chargement.
    const info = await layer.load('daypack-22');
    expect(info.status).toBe('procedural');
  });

  it('modèle importé texturé : sans carte de zones annonce unavailable-no-mask et garde scale 1', async () => {
    const { layer, scene } = makeLayer();
    const info = await layer.load('lkdv-one-45');
    expect(info.status).toBe('glb');
    expect(info.modelId).toBe('lkdv-one-45');
    expect(info.colorCustomization).toBe('unavailable-no-mask');
    const holder = scene.children.find((child) => child.name === 'bag-model-layer');
    expect(holder).toBeDefined();
    const root = holder!.children[0];
    // Échelle préservée à 1 pour les modèles importés (avenant 7 nov)
    expect(root.scale.y).toBe(1);
    layer.dispose();
  });

  it('modèle importé texturé : avec carte de zones annonce available', async () => {
    const scene = new THREE.Scene();
    const procedural = new THREE.Group();
    scene.add(procedural);
    const tr = new ResourceTracker();
    const textures = createTextureBank(tr, 4);

    const providerWithZones: BagAssetProvider = {
      ...fsProvider,
      async fetchZonesMap() {
        return { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) };
      },
    };

    const layer = createBagModelLayer({
      scene,
      textures,
      proceduralBag: procedural,
      targetHeightM: () => 1.45,
      provider: providerWithZones,
    });

    const info = await layer.load('lkdv-one-45');
    expect(info.status).toBe('glb');
    expect(info.colorCustomization).toBe('available');
    layer.dispose();
    textures.dispose();
  });
});
