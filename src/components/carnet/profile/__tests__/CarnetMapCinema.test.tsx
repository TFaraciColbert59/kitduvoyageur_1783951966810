// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { detail } from './fixtures';

/**
 * Caméra réelle de la carte, sans WebGL : `maplibre-gl` est remplacé par une
 * instance qui retient ce qu'on lui demande (`fitBounds`, `jumpTo`). On teste
 * donc la chaîne complète — `CarnetMapCard` → `CompteMap` → caméra — et pas
 * seulement le passage de props.
 */
const fake = vi.hoisted(() => ({
  state: {
    fitBounds: [] as Array<{ bounds: unknown; options: Record<string, unknown> }>,
    jumpTo: [] as Array<Record<string, unknown>>,
    flyTo: [] as Array<Record<string, unknown>>,
    map: null as unknown,
  },
}));

vi.mock('maplibre-gl', () => {
  class FakeMap {
    container: HTMLElement;
    handlers = new Map<string, Array<(event?: unknown) => void>>();
    sources = new Map<string, { data: unknown; setData: (data: unknown) => void }>();
    layers = new Map<string, Record<string, unknown>>();

    constructor(options: Record<string, unknown>) {
      this.container = options.container as HTMLElement;
      const style = options.style as { layers?: Array<{ id: string }> } | undefined;
      for (const layer of style?.layers ?? []) this.layers.set(layer.id, layer);
      fake.state.map = this;
    }

    on(event: string, a: string | ((event?: unknown) => void), b?: (event?: unknown) => void) {
      const key = typeof a === 'string' ? `${event}:${a}` : event;
      const handler = (typeof a === 'string' ? b : a) as (event?: unknown) => void;
      this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
      return this;
    }
    off() {
      return this;
    }
    fire(event: string) {
      for (const handler of this.handlers.get(event) ?? []) handler({});
    }
    getContainer() {
      return this.container;
    }
    addSource(id: string, spec: { data: unknown }) {
      const entry = { data: spec.data, setData: (data: unknown) => void (entry.data = data) };
      this.sources.set(id, entry);
    }
    getSource(id: string) {
      return this.sources.get(id);
    }
    addLayer(layer: Record<string, unknown>) {
      this.layers.set(layer.id as string, layer);
    }
    getLayer(id: string) {
      return this.layers.get(id);
    }
    setLayoutProperty() {}
    setPaintProperty() {}
    queryRenderedFeatures() {
      return [];
    }
    project() {
      return { x: 0, y: 0 };
    }
    getZoom() {
      return 10;
    }
    zoomIn() {}
    zoomOut() {}
    resize() {}
    stop() {}
    remove() {}
    fitBounds(bounds: unknown, options: Record<string, unknown>) {
      fake.state.fitBounds.push({ bounds, options });
    }
    cameraForBounds(bounds: [[number, number], [number, number]]) {
      return {
        center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
        zoom: 11,
      };
    }
    jumpTo(options: Record<string, unknown>) {
      fake.state.jumpTo.push(options);
    }
    flyTo(options: Record<string, unknown>) {
      fake.state.flyTo.push(options);
    }
  }

  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }

  return { Map: FakeMap, Marker: FakeMarker, setWorkerUrl: () => {}, default: {} };
});

import { CarnetMapCard } from '../CarnetMapCard';

/* WebGL n'existe pas dans jsdom : on le simule, sinon la carte tombe en repli
   et ne touche jamais la caméra. */
beforeAll(() => {
  Object.defineProperty(window, 'WebGLRenderingContext', {
    configurable: true,
    value: function WebGLRenderingContext() {},
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});

let reduced = false;
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  reduced = false;
  fake.state.fitBounds = [];
  fake.state.jumpTo = [];
  fake.state.flyTo = [];
  fake.state.map = null;
});

afterEach(() => cleanup());

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.9, 45.9],
  ],
};

/* Deux jours distincts, à deux endroits : J1 autour de Chamonix, J2 autour
   d'Annecy. Les bornes ne se recouvrent pas, donc un cadrage faux se voit. */
const J1 = [
  { lat: 45.9, lng: 6.86 },
  { lat: 45.93, lng: 6.9 },
];
const J2 = [
  { lat: 45.6, lng: 6.1 },
  { lat: 45.63, lng: 6.14 },
];

function mount(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

async function mountReady(node: React.ReactElement) {
  const view = mount(node);
  /* `style.load` est le seul signal de disponibilité de la carte. */
  await waitFor(() => expect(fake.state.map).not.toBeNull(), { timeout: 5000 });
  act(() => {
    (fake.state.map as unknown as { fire: (event: string) => void }).fire('style.load');
  });
  return view;
}

const boundsOfLastFit = () => {
  const last = fake.state.fitBounds[fake.state.fitBounds.length - 1];
  return last?.bounds as [[number, number], [number, number]] | undefined;
};

describe('CarnetMapCard — caméra cinématique par jour', () => {
  it('vole vers le segment du jour quand la page passe du Résumé à J1', async () => {
    const carnet = detail({ trace: TRACE, days: [] });
    const view = await mountReady(<CarnetMapCard detail={carnet} focusKey="resume" dayPoints={null} />);

    /* Résumé : cadrage du tracé complet du carnet. */
    await waitFor(() => expect(fake.state.fitBounds.length).toBeGreaterThan(0), { timeout: 5000 });
    const full = boundsOfLastFit();
    expect(full).toEqual([
      [6.86, 45.83],
      [6.9, 45.9],
    ]);
    expect(fake.state.fitBounds[0].options.duration).toBe(900);
    expect(fake.state.fitBounds[0].options.pitch).toBe(45);
    expect(typeof fake.state.fitBounds[0].options.easing).toBe('function');

    /* J1 : mêmes props, seule la page change → la caméra rejoue sur le segment. */
    const before = fake.state.fitBounds.length;
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CarnetMapCard detail={carnet} focusKey="j1" dayPoints={J1} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fake.state.fitBounds.length).toBeGreaterThan(before), { timeout: 5000 });
    expect(boundsOfLastFit()).toEqual([
      [6.86, 45.9],
      [6.9, 45.93],
    ]);
  });

  it('recadre sur le tracé complet quand on revient au Résumé', async () => {
    const carnet = detail({ trace: TRACE });
    const view = await mountReady(<CarnetMapCard detail={carnet} focusKey="j1" dayPoints={J1} />);
    await waitFor(() => expect(fake.state.fitBounds.length).toBeGreaterThan(0), { timeout: 5000 });
    expect(boundsOfLastFit()).toEqual([
      [6.86, 45.9],
      [6.9, 45.93],
    ]);

    const before = fake.state.fitBounds.length;
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CarnetMapCard detail={carnet} focusKey="resume" dayPoints={null} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fake.state.fitBounds.length).toBeGreaterThan(before), { timeout: 5000 });
    expect(boundsOfLastFit()).toEqual([
      [6.86, 45.83],
      [6.9, 45.9],
    ]);
  });

  it('saute sans animation en `prefers-reduced-motion`', async () => {
    reduced = true;
    await mountReady(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="j1" dayPoints={J1} />);

    await waitFor(() => expect(fake.state.jumpTo.length).toBeGreaterThan(0), { timeout: 5000 });
    expect(fake.state.fitBounds).toHaveLength(0);
    const jump = fake.state.jumpTo[0] as { center: [number, number]; zoom: number; pitch: number };
    expect(jump.center[0]).toBeCloseTo(6.88, 6);
    expect(jump.center[1]).toBeCloseTo(45.915, 6);
    expect(jump.zoom).toBe(11);
    expect(jump.pitch).toBe(45);
  });

  it('ne peint aucun tracé pour un jour réellement sans point GPS', async () => {
    await mountReady(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="j3" dayPoints={[]} />);

    /* Aucun cadrage : il n'y a pas de bornes, donc pas de vol. */
    expect(fake.state.fitBounds).toHaveLength(0);
    const root = document.querySelector('.lkdv-map-root');
    expect(root?.getAttribute('data-map-trace')).toBe('false');
    expect(document.body.textContent).toContain('—');
  });
});
