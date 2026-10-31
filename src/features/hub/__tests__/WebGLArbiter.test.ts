import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebGLArbiter, type MapViewState } from '../webgl/WebGLArbiter';

describe('WebGLArbiter (ADR-002 / L3-2)', () => {
  beforeEach(() => {
    WebGLArbiter.resetInstance();
  });

  it('démarre sans détenteur de contexte et non dégradé', () => {
    const arbiter = WebGLArbiter.getInstance();
    expect(arbiter.current()).toBeNull();
    expect(arbiter.isContextDegraded()).toBe(false);
  });

  it('acquiert le contexte pour camp-map puis le cède à bag-scene', async () => {
    const arbiter = WebGLArbiter.getInstance();
    const mapRelease = vi.fn().mockResolvedValue(undefined);

    await arbiter.acquire('camp-map');
    expect(arbiter.current()).toBe('camp-map');

    arbiter.registerReleaseHandler('camp-map', mapRelease);

    await arbiter.acquire('bag-scene');
    expect(mapRelease).toHaveBeenCalledTimes(1);
    expect(arbiter.current()).toBe('bag-scene');
  });

  it('ré-acquérir le même détenteur est un no-op sans appel de libération', async () => {
    const arbiter = WebGLArbiter.getInstance();
    const mapRelease = vi.fn();

    await arbiter.acquire('camp-map');
    arbiter.registerReleaseHandler('camp-map', mapRelease);

    await arbiter.acquire('camp-map');
    expect(mapRelease).not.toHaveBeenCalled();
    expect(arbiter.current()).toBe('camp-map');
  });

  it('libère explicitement un détenteur', async () => {
    const arbiter = WebGLArbiter.getInstance();

    await arbiter.acquire('bag-scene');
    expect(arbiter.current()).toBe('bag-scene');

    arbiter.release('bag-scene');
    expect(arbiter.current()).toBeNull();
  });

  it('enregistre et restitue fidèlement l état de la vue cartographique', () => {
    const arbiter = WebGLArbiter.getInstance();
    expect(arbiter.getSavedMapState()).toBeNull();

    const viewState: MapViewState = {
      center: [6.865, 45.832],
      zoom: 13.5,
      pitch: 45,
      bearing: 180,
    };

    arbiter.saveMapState(viewState);
    expect(arbiter.getSavedMapState()).toEqual(viewState);
  });

  it('gère la perte de contexte WebGL et alerte les écouteurs', () => {
    const arbiter = WebGLArbiter.getInstance();
    const listener = vi.fn();

    const unsubscribe = arbiter.onContextLost(listener);

    arbiter.triggerContextLost();
    expect(arbiter.isContextDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Se désabonner empêche d'autres notifications
    unsubscribe();
    arbiter.triggerContextLost();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
