// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * « Carte indisponible » : WebGL refusé (contexte nul) ou fond de carte muet.
 * La fiche carnet garde sa lisibilité (tracé dans les tiroirs) et n'instancie
 * jamais MapLibre sans contexte WebGL (un seul contexte vivant, ADR-002).
 */

const mapConstructor = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl', () => {
  class FakeMap {
    constructor(options: unknown) {
      mapConstructor(options);
      throw new Error('MapLibre ne doit pas être instancié sans WebGL');
    }
  }
  return {
    default: { Map: FakeMap, setWorkerUrl: vi.fn() },
    Map: FakeMap,
    Marker: class {},
    Popup: class {},
    LngLatBounds: class {},
    setWorkerUrl: vi.fn(),
  };
});

import { CompteMap } from '../CompteMap';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  mapConstructor.mockClear();
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  vi.useRealTimers();
  cleanup();
});

const props = {
  authState: 'owner' as const,
  context: { mode: 'overview' as const },
  variant: 'carnet' as const,
  trace: {
    type: 'LineString',
    coordinates: [
      [6.29, 44.94],
      [6.3, 44.95],
    ],
  },
};

describe('CompteMap (variante carnet) — carte indisponible', () => {
  it('sans contexte WebGL : message honnête, MapLibre jamais instancié', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, 'WebGLRenderingContext', { value: undefined, configurable: true });
    render(<CompteMap {...props} />);
    await act(async () => undefined);
    expect(screen.getByText('Carte indisponible.')).toBeTruthy();
    expect(screen.getByText(/Le tracé reste lisible dans les tiroirs/)).toBeTruthy();
    expect(mapConstructor).not.toHaveBeenCalled();
  });

  it('hors ligne : l’explication change, le message reste', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(window, 'WebGLRenderingContext', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<CompteMap {...props} />);
    await act(async () => undefined);
    expect(screen.getByText('Carte indisponible.')).toBeTruthy();
    expect(screen.getByText(/Tu es hors ligne/)).toBeTruthy();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});
