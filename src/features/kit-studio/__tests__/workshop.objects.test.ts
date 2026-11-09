// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Group, PerspectiveCamera, Scene } from 'three';
import { createInitialState } from '../domain/state';
import { createBag } from '../scene/bagBuilder';
import { createObjectLayer } from '../scene/objects';
import { ResourceTracker } from '../scene/resources';
import { createTextureBank } from '../scene/textures';
import { GROUND_Y, TABLE } from '../scene/layout';

afterEach(() => vi.restoreAllMocks());
it('pose les objets de « Sur toi » sur le plan, quelle que soit leur forme', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const tr = new ResourceTracker();
  const tex = createTextureBank(tr, 1);
  const bag = createBag(tr, tex, true);
  const root = new Scene();
  const layer = createObjectLayer({root, tr, bag, camera: new PerspectiveCamera(36,1), viewport: () => ({width:640,height:760}), fabric: tex.fabric('ripstop'), reducedMotion:true});
  layer.sync(createInitialState('tmb'));
  for(let i=0;i<30;i++) layer.step(1/60, {focus:'worn',arcAmt:0,ex:0,pos:0,ghostsOn:false});
  const visible = root.children.filter(n => n instanceof Group && n.visible);
  expect(visible.length).toBeGreaterThan(3);
  for(const object of visible) {
    const bounds = new Box3().setFromObject(object);
    expect(bounds.min.y).toBeCloseTo(GROUND_Y, 3);
    expect(bounds.max.z).toBeLessThanOrEqual(TABLE.z + TABLE.d / 2);
    expect(bounds.min.z).toBeGreaterThanOrEqual(TABLE.z - TABLE.d / 2);
    expect(bounds.max.x).toBeLessThanOrEqual(TABLE.x + TABLE.w / 2);
    expect(bounds.min.x).toBeGreaterThanOrEqual(TABLE.x - TABLE.w / 2);
  }
  layer.dispose(); bag.dispose(); tex.dispose(); tr.disposeAll();
});
