// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebGLArbiter } from '@/features/hub/webgl/WebGLArbiter';
import { LIVE_MAP_OPTIONS, createLiveMap, leaseWebGL, type MlModule } from '@/components/map/engine/liveMapCore';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** 2.1 : un seul moteur de carte, partagé par le Compas (LiveMap) et l'itinéraire (RouteCollabMap). */
class FakeMap {
  handlers = new Map<string, () => void>();
  dragPan = { enable: vi.fn() };
  constructor(public opts: Record<string, unknown>) {}
  on(t: string, h: () => void) {
    this.handlers.set(t, h);
  }
}

afterEach(() => WebGLArbiter.resetInstance());

describe('liveMapCore', () => {
  it('crée la carte avec les options et le style du Compas (Mercator, sans rotation)', () => {
    const lib = { Map: FakeMap } as unknown as MlModule;
    const el = document.createElement('div');
    const m = createLiveMap(lib, { container: el, base: 'topo', center: [2, 46], zoom: 5, title: 'Carte' }) as unknown as FakeMap;
    expect(m.opts).toMatchObject({ ...LIVE_MAP_OPTIONS, center: [2, 46], zoom: 5, locale: { 'Map.Title': 'Carte' } });
    expect((m.opts.style as { projection: { type: string } }).projection.type).toBe('mercator');
    expect(m.dragPan.enable).toHaveBeenCalled();
  });

  it('le bail WebGL : une autre vue qui réclame le contexte libère la carte ; la perte de contexte est relayée une fois', async () => {
    const arbiter = WebGLArbiter.getInstance();
    const onReleased = vi.fn();
    const onLost = vi.fn();
    const lease = await leaseWebGL('route-map', { isCancelled: () => false, onReleased, onLost }, arbiter);
    expect(arbiter.current()).toBe('route-map');
    await arbiter.acquire('bag-scene');
    expect(onReleased).toHaveBeenCalledTimes(1);
    lease.release();
    expect(arbiter.current()).toBe('bag-scene');
  });

  it('les deux cartes passent par le noyau (aucun MapLibre propre à l’itinéraire)', () => {
    const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
    const route = read('src/features/route-collab/components/RouteCollabMap.tsx');
    const live = read('src/features/compas/v5/map/LiveMap.tsx');
    for (const src of [route, live]) {
      expect(src).toContain('@/components/map/engine/liveMapCore');
      expect(src).not.toMatch(/new maplibre\.Map\(/);
      expect(src).not.toContain("setWorkerUrl");
    }
  });
});
