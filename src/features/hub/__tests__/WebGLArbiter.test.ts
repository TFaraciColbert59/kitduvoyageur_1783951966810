import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKGROUND_RELEASE_MS,
  WebGLArbiter,
  type MapViewState,
} from '../webgl/WebGLArbiter';

describe('WebGLArbiter (ADR-002 / L3-2 / C-17 / C-18)', () => {
  beforeEach(() => {
    WebGLArbiter.resetInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('démarre sans détenteur de contexte, non en pause et non dégradé', () => {
    const arbiter = WebGLArbiter.getInstance();
    expect(arbiter.current()).toBeNull();
    expect(arbiter.isPaused()).toBe(false);
    expect(arbiter.isContextDegraded()).toBe(false);
  });

  it('acquiert le contexte pour camp-map puis le cède à bag-scene (XOR strict)', async () => {
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

  it('enregistre et restitue fidèlement l état de la vue cartographique (C-05)', () => {
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

  it('dégrade immédiatement si aucun gestionnaire de restauration n est enregistré', () => {
    const arbiter = WebGLArbiter.getInstance();
    const listener = vi.fn();

    const unsubscribe = arbiter.onContextLost(listener);
    const recovered = arbiter.triggerContextLost();

    expect(recovered).toBe(false);
    expect(arbiter.isContextDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    arbiter.triggerContextLost();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tente UNE restauration sur la 1re perte puis bascule en DEGRADED à la 2e perte (C-18)', async () => {
    const arbiter = WebGLArbiter.getInstance();
    const onLost = vi.fn();
    const restoreFn = vi.fn().mockReturnValue(true);

    await arbiter.acquire('bag-scene');
    arbiter.registerRestoreHandler('bag-scene', restoreFn);
    arbiter.onContextLost(onLost);

    // 1re perte : restauration tentée et acceptée -> pas encore dégradé
    const firstAttempt = arbiter.triggerContextLost();
    expect(firstAttempt).toBe(true);
    expect(restoreFn).toHaveBeenCalledTimes(1);
    expect(arbiter.getRestorationAttempts()).toBe(1);
    expect(arbiter.isContextDegraded()).toBe(false);
    expect(onLost).not.toHaveBeenCalled();

    arbiter.notifyContextRestored();

    // 2e perte : aucune seconde tentative -> bascule immédiate en DEGRADED
    const secondAttempt = arbiter.triggerContextLost();
    expect(secondAttempt).toBe(false);
    expect(restoreFn).toHaveBeenCalledTimes(1);
    expect(arbiter.isContextDegraded()).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('met en pause la boucle de rendu et libère le GPU après 30 s en arrière-plan (C-17)', async () => {
    vi.useFakeTimers();
    const arbiter = WebGLArbiter.getInstance();
    const pauseListener = vi.fn();
    const releaseScene = vi.fn();

    await arbiter.acquire('bag-scene');
    arbiter.registerReleaseHandler('bag-scene', releaseScene);
    arbiter.onPauseChange(pauseListener);

    arbiter.setPaused(true, { releaseAfterTimeout: true });
    expect(arbiter.isPaused()).toBe(true);
    expect(pauseListener).toHaveBeenCalledWith(true);
    expect(arbiter.current()).toBe('bag-scene');

    // Avance de 29 s : pas encore libéré
    await vi.advanceTimersByTimeAsync(BACKGROUND_RELEASE_MS - 1000);
    expect(releaseScene).not.toHaveBeenCalled();

    // Franchit 30 s : contexte libéré
    await vi.advanceTimersByTimeAsync(1500);
    expect(releaseScene).toHaveBeenCalledTimes(1);
    expect(arbiter.current()).toBeNull();
  });
});
