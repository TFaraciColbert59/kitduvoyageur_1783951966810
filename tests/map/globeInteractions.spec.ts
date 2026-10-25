import { describe, expect, it, vi } from 'vitest';

import * as camera from '../../src/components/map/engine/camera';

type ToggleHandler = {
  enable: () => void;
  disable: () => void;
};

type RotationHandler = {
  enableRotation: () => void;
  disableRotation: () => void;
};

type SyncGlobeInteractionHandlers = (
  map: {
    dragRotate?: ToggleHandler;
    touchZoomRotate?: RotationHandler;
    touchPitch?: ToggleHandler;
  },
  mode: 'local' | 'globe'
) => void;

const syncGlobeInteractionHandlers = (
  camera as unknown as {
    syncGlobeInteractionHandlers?: SyncGlobeInteractionHandlers;
  }
).syncGlobeInteractionHandlers;

describe('Carte globe — gestes 3D conditionnels', () => {
  it('expose un synchroniseur de gestures globe/local', () => {
    expect(syncGlobeInteractionHandlers).toBeTypeOf('function');
  });

  it('active rotation, rotation du pincement et pitch en mode globe', () => {
    expect(syncGlobeInteractionHandlers).toBeTypeOf('function');
    if (!syncGlobeInteractionHandlers) return;

    const calls: string[] = [];
    const toggle = (name: string): ToggleHandler => ({
      enable: vi.fn(() => calls.push(`${name}:enable`)),
      disable: vi.fn(() => calls.push(`${name}:disable`)),
    });

    syncGlobeInteractionHandlers(
      {
        dragRotate: toggle('dragRotate'),
        touchZoomRotate: {
          enableRotation: vi.fn(() => calls.push('touchZoomRotate:enableRotation')),
          disableRotation: vi.fn(() => calls.push('touchZoomRotate:disableRotation')),
        },
        touchPitch: toggle('touchPitch'),
      },
      'globe'
    );

    expect(calls).toEqual([
      'dragRotate:enable',
      'touchZoomRotate:enableRotation',
      'touchPitch:enable',
    ]);
  });

  it('les désactive en mode local pour garder la carte locale stable', () => {
    expect(syncGlobeInteractionHandlers).toBeTypeOf('function');
    if (!syncGlobeInteractionHandlers) return;

    const calls: string[] = [];
    const toggle = (name: string): ToggleHandler => ({
      enable: vi.fn(() => calls.push(`${name}:enable`)),
      disable: vi.fn(() => calls.push(`${name}:disable`)),
    });

    syncGlobeInteractionHandlers(
      {
        dragRotate: toggle('dragRotate'),
        touchZoomRotate: {
          enableRotation: vi.fn(() => calls.push('touchZoomRotate:enableRotation')),
          disableRotation: vi.fn(() => calls.push('touchZoomRotate:disableRotation')),
        },
        touchPitch: toggle('touchPitch'),
      },
      'local'
    );

    expect(calls).toEqual([
      'dragRotate:disable',
      'touchZoomRotate:disableRotation',
      'touchPitch:disable',
    ]);
  });

  it('reste tolérant si le terminal ne fournit pas touchPitch', () => {
    expect(syncGlobeInteractionHandlers).toBeTypeOf('function');
    if (!syncGlobeInteractionHandlers) return;

    const disable = vi.fn();
    const disableRotation = vi.fn();

    expect(() =>
      syncGlobeInteractionHandlers(
        {
          dragRotate: { enable: vi.fn(), disable },
          touchZoomRotate: { enableRotation: vi.fn(), disableRotation },
        },
        'local'
      )
    ).not.toThrow();
    expect(disable).toHaveBeenCalledOnce();
    expect(disableRotation).toHaveBeenCalledOnce();
  });

  it('conserve le handler MapLibre comme receveur pendant la synchronisation', () => {
    expect(syncGlobeInteractionHandlers).toBeTypeOf('function');
    if (!syncGlobeInteractionHandlers) return;

    const dragRotate = {
      internalState: 'ready',
      enable(this: { internalState: string }) {
        this.internalState = 'enabled';
      },
      disable(this: { internalState: string }) {
        this.internalState = 'disabled';
      },
    };

    expect(() => syncGlobeInteractionHandlers({ dragRotate }, 'globe')).not.toThrow();
    expect(dragRotate.internalState).toBe('enabled');
  });
});
