// @vitest-environment jsdom
// Règle produit du 09/11/2026 : maillages réels uniquement. Aucun `.glb` d'objet n'est publié, donc ni objet
// ni « fantôme » (fonction manquante) ne doit être dessiné par code : ni dans la scène, ni dans les vignettes.
// Le manque, lui, reste lisible en 2D (bilan).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, PerspectiveCamera, Scene, Sprite } from 'three';
import { blockers } from '../domain/blockers';
import { createInitialState } from '../domain/state';
import { createBag } from '../scene/bagBuilder';
import { ITEM_GLB_BY_ID, hasItemModel } from '../scene/itemAssets';
import { createObjectLayer } from '../scene/objects';
import { ResourceTracker } from '../scene/resources';
import { createTextureBank } from '../scene/textures';
import { itemBuilder } from '../scene/thumbBuilders';
import { contentCards } from '../ui/cards/cardsData';

afterEach(() => vi.restoreAllMocks());

/** Nombre de mesh et de sprites sous un nœud (les sprites portaient le halo des fantômes). */
function drawn(root: Scene): number {
  let n = 0;
  root.traverse((o) => { if (o instanceof Mesh || o instanceof Sprite) n++; });
  return n;
}

describe('objets du kit : aucun maillage publié, rien dessiné', () => {
  it('le registre des maillages d\'objets est vide aujourd\'hui', () => {
    expect(Object.keys(ITEM_GLB_BY_ID)).toEqual([]);
    expect(hasItemModel('bladder')).toBe(false);
    expect(hasItemModel('toString')).toBe(false);
  });

  it('sync() d\'un kit avec objets et fantômes n\'ajoute ni mesh ni sprite, y compris en arc et pièces séparées', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const tr = new ResourceTracker();
    const tex = createTextureBank(tr, 1);
    const bag = createBag(tr, tex, true);
    const root = new Scene();
    const layer = createObjectLayer({
      root, tr, bag, camera: new PerspectiveCamera(36, 1), viewport: () => ({ width: 640, height: 760 }),
      fabric: tex.fabric('ripstop'), reducedMotion: true,
    });
    const state = createInitialState('tmb');
    expect(blockers(state).some((b) => b.kind === 'ghost')).toBe(true); // le kit a bien des manques à dessiner
    layer.sync(state);
    for (const frame of [
      { focus: 'worn', arcAmt: 0, ex: 0, pos: 0 },
      { focus: 'front', arcAmt: 1, ex: 0, pos: 2 },
      { focus: 'bag', arcAmt: 0, ex: 1, pos: 1 },
    ] as const) {
      for (let i = 0; i < 30; i++) layer.step(1 / 60, frame);
      expect(drawn(root)).toBe(0);
      expect(root.children).toHaveLength(0);
    }
    expect(layer.counts()).toEqual({ items: 0, dying: 0 });
    expect(layer.projectItem('bladder', { x: 0, y: 0 })).toBeNull();
    expect(layer.canLift('bladder')).toBe(false);
    expect(layer.pick(0, 0)?.type).not.toBe('item');
    layer.dispose(); bag.dispose(); tex.dispose(); tr.disposeAll();
  });

  it('la vignette d\'un objet sans maillage est un groupe vide', () => {
    const g = itemBuilder({ kind: 'i', id: 'bladder', shape: 'bladder', glyph: 'water', color: 'rgb(10 20 30)', liters: 2, planned: false });
    let meshes = 0;
    g.traverse((o) => { if (o instanceof Mesh) meshes++; });
    expect(meshes).toBe(0);
    expect(g.children).toHaveLength(0);
  });

  it('les cartes d\'objets n\'ont pas de vignette 3D : pictogramme 2D plat', () => {
    const cards = contentCards(createInitialState('tmb'), 'bag', null).filter((c) => c.kind === 'item');
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.thumb).toBeNull();
      expect(c.glyph).not.toBe('');
    }
  });

  it('le manque reste dit en 2D : bloc « Manque » du bilan, avec sa raison', () => {
    const missing = blockers(createInitialState('tmb')).filter((b) => b.kind === 'ghost');
    expect(missing.map((b) => b.fn)).toEqual(['rainshell', 'emergency']);
    for (const b of missing) {
      expect(b.t).toMatch(/^Manque/);
      expect(b.s).not.toBe('');
    }
  });
});
