// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  BAGS,
  LKDV_ONE_BAG_IDS,
  ONE,
} from '../domain/catalog';
import { glbModelForBag, selectBagRenderSource } from '../scene/bag/modelLayer';
import type { BagAssetProvider } from '../scene/bag/loader';
import { bagFromCorps, kitsFromRows } from '../server/getStudioData';
import { createInitialState } from '../domain/state';
import { setBag } from '../domain/packing';
import { orderLines } from '../domain/order';
import { optionCards, contentCards } from '../ui/cards/cardsData';
import { OrderSheet } from '../ui/sheets/OrderSheet';
import { createKitScene, type RendererFactory, type RendererLike } from '../scene/createScene';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';

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

describe('Gamme des cinq LKDV ONE (SUITE-AGENT-KIT-STUDIO-chiffres-indicatifs)', () => {
  it('1. Porte les chiffres indicatifs avec le drapeau figuresProvisional obligatoire', () => {
    const EXPECTED_INDICATIVE = {
      'lkdv-one-15': { g: 640, eur: 89, pts: 5 },
      'lkdv-one-25': { g: 840, eur: 109, pts: 6 },
      'lkdv-one-45': { g: 1240, eur: 159, pts: 8 },
      'lkdv-one-60': { g: 1580, eur: 189, pts: 10 },
      'lkdv-one-80': { g: 2050, eur: 229, pts: 12 },
    } as const;

    for (const bagId of LKDV_ONE_BAG_IDS) {
      const bag = BAGS[bagId];
      expect(bag, `Sac ${bagId} doit exister dans BAGS`).toBeDefined();
      const exp = EXPECTED_INDICATIVE[bagId];
      expect(bag.g, `Sac ${bagId} doit porter son poids indicatif dérivé`).toBe(exp.g);
      expect(bag.figuresProvisional, `Sac ${bagId} doit porter figuresProvisional: true`).toBe(true);

      const corpsSpec = ONE.corps[bagId];
      expect(corpsSpec, `Sac ${bagId} doit exister dans ONE.corps`).toBeDefined();
      expect(corpsSpec.eur, `Sac ${bagId} doit porter son prix indicatif dérivé`).toBe(exp.eur);
      expect(corpsSpec.pts, `Sac ${bagId} doit porter ses points indicatifs dérivés`).toBe(exp.pts);
      expect(corpsSpec.figuresProvisional, `ONE.corps[${bagId}] doit porter figuresProvisional: true`).toBe(true);

      // Verrou inversé : un prix sur un corps LKDV ONE sans drapeau provisoire est une faute
      if (corpsSpec.eur != null) {
        expect(corpsSpec.figuresProvisional, `Prix ferme non autorisé sur ${bagId} sans drapeau provisoire`).toBe(true);
      }
    }

    // Les corps historiques b42 et b28 gardent leurs valeurs réelles et SANS drapeau provisoire
    expect(BAGS.b42.g).toBe(1180);
    expect(BAGS.b42.L).toBe(42);
    expect(BAGS.b42.figuresProvisional).toBeUndefined();
    expect(ONE.corps.b42.eur).toBe(149);
    expect(ONE.corps.b42.pts).toBe(8);
    expect(ONE.corps.b42.figuresProvisional).toBeUndefined();

    expect(BAGS.b28.g).toBe(900);
    expect(BAGS.b28.L).toBe(28);
    expect(BAGS.b28.figuresProvisional).toBeUndefined();
    expect(ONE.corps.b28.eur).toBe(119);
    expect(ONE.corps.b28.pts).toBe(6);
    expect(ONE.corps.b28.figuresProvisional).toBeUndefined();
  });

  it('2. Les cinq corps LKDV ONE rendent bien leur GLB respectif sans retombée sur procedural', async () => {
    for (const bagId of LKDV_ONE_BAG_IDS) {
      // 1:1 direct mapping
      expect(glbModelForBag(bagId)).toBe(bagId);
      const source = selectBagRenderSource(null, bagId);
      expect(source).toEqual({ kind: 'glb', modelId: bagId });
      expect(source.kind).not.toBe('procedural');
    }

    // Vérification dans la scène Three.js avec createKitScene
    const canvas = document.createElement('canvas');
    for (const bagId of LKDV_ONE_BAG_IDS) {
      let state = createInitialState('tmb');
      state = setBag(state, bagId).state;

      const scene = createKitScene(canvas, {
        state,
        reducedMotion: true,
        rendererFactory: createMockRendererFactory(),
        bagAssetProvider: testProvider,
      });

      await vi.waitFor(() => {
        expect(scene.info().bagModel.status).toBe('glb');
      });
      expect(scene.info().bagModel.modelId).toBe(bagId);
      expect(scene.info().bagModel.status).not.toBe('procedural');

      scene.dispose();
    }
  });

  it('3. Ouvre un kit existant en corps:b42 et vérifie qu’il s’affiche inchangé', () => {
    // Résolution de corps_id historique persisté en base
    expect(bagFromCorps('corps:b42')).toBe('b42');
    expect(bagFromCorps('corps:b28')).toBe('b28');

    // Restauration via kitsFromRows
    const mockKits = [
      { id: 'kit-existant', user_id: 'user-1', name: 'Trek Alpes', days: 5, sort: 1, created_at: '', updated_at: '' },
    ];
    const mockConfigs = {
      b42: {
        body: { col: 'm-2d482a' },
        lid: { col: 'm-2d482a' },
        front: { col: 'm-3d6038' },
        sides: { col: 'm-3d6038' },
        hip: { col: 'm-1e301c' },
        harness: { col: 'm-1e301c' },
        webbing: { col: 'm-1e301c' },
        accent: 'm-9bbda7',
        acc: [],
      },
    } as any;
    const mockConfigRows = [
      { id: 'cfg-1', kit_id: 'kit-existant', corps_id: 'corps:b42', modules: ['lid'], colors: {} },
    ] as any;

    const restored = kitsFromRows(mockKits as any, [], mockConfigs, {} as any, mockConfigRows, 70);
    expect(restored).toHaveLength(1);
    expect(restored[0].bag).toBe('b42');
    expect(BAGS[restored[0].bag].n).toBe('Corps 42 L');
    expect(BAGS[restored[0].bag].L).toBe(42);
    expect(BAGS[restored[0].bag].g).toBe(1180);

    // En revanche, un nouveau kit sans configuration préalable atterrit par défaut sur lkdv-one-45
    const nouveauKit = kitsFromRows(
      [{ id: 'nouveau-kit', user_id: 'user-2', name: 'Nouveau', days: 2, sort: 1, created_at: '', updated_at: '' }] as any,
      [],
      mockConfigs,
      {} as any,
      [], // aucune ligne one_bag_configs
      70,
    );
    expect(nouveauKit[0].bag).toBe('lkdv-one-45');

    // En 3D, le sac b42 s'affiche bien via lkdv-one-45
    expect(glbModelForBag('b42')).toBe('lkdv-one-45');
    expect(selectBagRenderSource(null, 'b42')).toEqual({ kind: 'glb', modelId: 'lkdv-one-45' });
  });

  it('4. Les corps hérités b42/b28 disparaissent de la liste proposée à la création / changement', () => {
    let state = createInitialState('tmb'); // tmb par défaut
    // Basculé sur un nouveau sac
    state = setBag(state, 'lkdv-one-45').state;

    // Dans les cartes d'apparence 'shape'
    const shapeCards = optionCards(state, 'all', 'shape');
    const shapeIds = shapeCards.map((c) => c.id);
    expect(shapeIds).not.toContain('b42');
    expect(shapeIds).not.toContain('b28');
    expect(shapeIds).toContain('lkdv-one-15');
    expect(shapeIds).toContain('lkdv-one-25');
    expect(shapeIds).toContain('lkdv-one-45');
    expect(shapeIds).toContain('lkdv-one-60');
    expect(shapeIds).toContain('lkdv-one-80');

    // Dans les cartes de contenu pour la zone 'bag'
    const bagCards = contentCards(state, 'bag', null);
    const bagContentIds = bagCards.map((c) => c.id);
    expect(bagContentIds).not.toContain('b42');
    expect(bagContentIds).not.toContain('b28');
  });

  it('5. Un corps à figuresProvisional n’est pas achetable : verrou de commande actif et mention indicatif affichée', () => {
    let state = createInitialState('tmb');
    // On passe sur le 15L à chiffres indicatifs
    state = setBag(state, 'lkdv-one-15').state;

    // Lignes de commande
    const lines = orderLines(state);
    const corpsLine = lines.find((l) => l.key.startsWith('corps:'));
    expect(corpsLine).toBeDefined();
    expect(corpsLine?.priceCents).toBe(8900); // 89 €
    expect(corpsLine?.figuresProvisional).toBe(true);

    // Rendu de OrderSheet
    const onConfirm = () => {};
    render(<OrderSheet state={state} onConfirmOrder={onConfirm} />);

    // Le bouton de précommande doit être désactivé avec la mention indicative
    const preorderBtn = screen.getByRole('button', { name: /Prix indicatif \(non commandable\)/i });
    expect((preorderBtn as HTMLButtonElement).disabled).toBe(true);

    // La mention explicite et la ligne indicative doivent être affichées dans le DOM
    expect(
      screen.getByText(/Ce corps de sac n’est pas encore achetable \(prix indicatif, non commandable pour l’instant\)\./i)
    ).not.toBeNull();
    expect(
      screen.getByText(/89\s*€\s*\(indicatif\)/i)
    ).not.toBeNull();
  });
});
