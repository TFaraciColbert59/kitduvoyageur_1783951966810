// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';
import { createInitialState } from '../domain/state';
import {
  glbModelForBag,
  selectBagRenderSource,
  GLB_MODEL_BY_BAG,
} from '../scene/bag/modelLayer';
import { createKitScene, type RendererFactory, type RendererLike } from '../scene/createScene';
import type { BagAssetProvider } from '../scene/bag/loader';
import { setScene } from '../scene/sceneRef';
import { optionCards } from '../ui/cards/cardsData';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { CardsView } from '../ui/cards/CardsView';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('@/hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ haptic: vi.fn() }),
}));

const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');
const MODULES_DIR = path.join(process.cwd(), 'public', 'assets', 'modules');

const testProvider: BagAssetProvider = {
  async fetchManifest(modelId: string) {
    const isModule = modelId.startsWith('lkdv-m') || modelId.startsWith('module-');
    const dir = isModule ? MODULES_DIR : BAGS_DIR;
    const p = path.join(dir, `${modelId}.manifest.json`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  },
  async fetchGlb(modelId: string) {
    const isModule = modelId.startsWith('lkdv-m') || modelId.startsWith('module-');
    const dir = isModule ? MODULES_DIR : BAGS_DIR;
    const p = path.join(dir, `${modelId}.glb`);
    const buf = fs.readFileSync(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
  async fetchZonesMap() {
    return null;
  },
};

function createMockRendererFactory(): RendererFactory {
  return (canvas) => {
    const r: RendererLike = {
      domElement: canvas,
      shadowMap: { enabled: false, type: PCFShadowMap },
      toneMapping: ACESFilmicToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: 'srgb',
      capabilities: { getMaxAnisotropy: () => 4 },
      info: { memory: { geometries: 0, textures: 0 } },
      setPixelRatio() {},
      setSize() {},
      render() {},
      setAnimationLoop() {},
      dispose() {},
    };
    return r;
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Validation des 3 portes d’affichage du Kit Studio (URGENT)', () => {
  it('1. Échoue si GLB_MODEL_BY_BAG est vide', () => {
    // Échouait sur main car GLB_MODEL_BY_BAG valait {}
    expect(Object.keys(GLB_MODEL_BY_BAG).length).toBeGreaterThan(0);
    expect(glbModelForBag('b42')).toBe('lkdv-one-45');
    expect(glbModelForBag('b28')).toBe('lkdv-one-25');
  });

  it('2. Échoue si la scène avec b42 utilise une source procedural', async () => {
    // Échouait sur main car selectBagRenderSource(null, 'b42') renvoyait { kind: 'procedural' }
    const source = selectBagRenderSource(null, 'b42');
    expect(source.kind).not.toBe('procedural');
    expect(source).toEqual({ kind: 'glb', modelId: 'lkdv-one-45' });

    const canvas = document.createElement('canvas');
    const state = createInitialState(); // b42
    const scene = createKitScene(canvas, {
      state,
      reducedMotion: true,
      rendererFactory: createMockRendererFactory(),
      bagAssetProvider: testProvider,
    });

    // Attendre que le modèle asynchrone charge
    await vi.waitFor(() => {
      expect(scene.info().bagModel.status).toBe('glb');
    });
    expect(scene.info().bagModel.modelId).toBe('lkdv-one-45');
    expect(scene.info().bagModel.status).not.toBe('procedural');

    scene.dispose();
  });

  it('3. Pose un module par le chemin d’interface et vérifie qu’il est dans la scène', async () => {
    // Échouait sur main car aucune interface n'appelait loadModuleAsset ni attachModule
    const canvas = document.createElement('canvas');
    const state = createInitialState(); // b42 -> lkdv-one-45
    useKitStore.setState({ kit: state });
    useUiStore.setState({ mode: 'appearance', category: 'mod', part: 'all' });

    const scene = createKitScene(canvas, {
      state,
      reducedMotion: true,
      rendererFactory: createMockRendererFactory(),
      bagAssetProvider: testProvider,
    });
    setScene(scene);

    await vi.waitFor(() => {
      expect(scene.info().bagModel.status).toBe('glb');
    });

    // Les cartes de modules disponibles dans le rail d'apparence sont bien celles des modules 3D compatibles
    const cards = optionCards(useKitStore.getState().kit, 'all', 'mod');
    expect(cards.length).toBeGreaterThanOrEqual(15);
    const m04Card = cards.find((c) => c.id === 'lkdv-m04');
    expect(m04Card).toBeDefined();

    // Rendu de CardsView dans le DOM
    render(<CardsView />);

    // Clic sur la carte du module M04 (Poche multifonction)
    const m04Button = await screen.findByRole('button', { name: /M04/i });
    fireEvent.click(m04Button);

    // Vérifier que le module M04 est maintenant monté sur l'ancre façade dans la scène 3D
    await vi.waitFor(() => {
      const ctrl = scene.getAttachments();
      expect(ctrl?.isOccupied('facade')).toBe(true);
      expect(ctrl?.getMountedModule('facade')?.moduleId).toBe('lkdv-m04');
    });

    // Vérifier que le mesh 3D est physiquement présent dans l'arborescence Three.js
    const mounted = scene.getAttachments()?.getMountedModule('facade');
    expect(mounted?.root.parent).not.toBeNull();
    expect(mounted?.triangleCount).toBe(10938);

    scene.dispose();
    setScene(null);
  });

  it('4. Affiche la mention de débordement pour les modules porteurs dans les cartes d’interface', () => {
    const state = createInitialState(); // b42 -> lkdv-one-45
    useKitStore.setState({ kit: state });
    useUiStore.setState({ mode: 'appearance', category: 'mod', part: 'all' });

    const cards = optionCards(useKitStore.getState().kit, 'all', 'mod');
    const m14Card = cards.find((c) => c.id === 'lkdv-m14');
    expect(m14Card).toBeDefined();
    expect(m14Card?.sub).toMatch(/dépasse de \d+ cm au-dessus du sac/);
    expect(m14Card?.overflowNotice).toMatch(/dépasse de \d+ cm au-dessus du sac/);
    expect(m14Card?.label).toMatch(/dépasse de \d+ cm au-dessus du sac/);

    const m10Card = cards.find((c) => c.id === 'lkdv-m10');
    expect(m10Card).toBeDefined();
    expect(m10Card?.sub).toMatch(/dépasse de \d+ cm en largeur/);
  });
});
