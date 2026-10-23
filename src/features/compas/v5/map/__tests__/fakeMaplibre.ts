import { vi } from 'vitest';

/**
 * MapLibre simulé pour les tests de composant : mémorise ce que le composant lui demande (sources, calques,
 * caméra, marqueurs) et laisse le test déclencher les événements (`style.load`, `moveend`, `click`…).
 * Projection : 1 degré de longitude = 1500 px, 1 degré de latitude = 3000 px, centrée sur (45,05 ; 5,5).
 */
type Handler = (event: unknown) => void;

export const registry = {
  maps: [] as FakeMap[],
  markers: [] as FakeMarker[],
  workerUrl: null as string | null,
  failConstruct: false,
};

export function resetRegistry() {
  registry.maps = [];
  registry.markers = [];
  registry.workerUrl = null;
  registry.failConstruct = false;
}

export class FakeMap {
  options: Record<string, unknown>;
  container: HTMLElement;
  canvasContainer: HTMLElement;
  handlers = new Map<string, Handler[]>();
  sources = new Map<string, { data: unknown; setData: ReturnType<typeof vi.fn> }>();
  layers = new Map<string, Record<string, unknown>>();
  layout: Record<string, unknown> = {};
  paint: Record<string, unknown> = {};
  fits: Array<{ bounds: unknown; options: Record<string, unknown> }> = [];
  calls: string[] = [];
  zoom = 10;
  removed = false;
  touchZoomRotate = { disableRotation: vi.fn() };

  constructor(options: Record<string, unknown>) {
    if (registry.failConstruct) throw new Error('Failed to initialize WebGL');
    this.options = options;
    this.container = options.container as HTMLElement;
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'maplibregl-canvas-container';
    this.container.appendChild(this.canvasContainer);
    const style = options.style as { layers?: Array<{ id: string }> } | undefined;
    for (const l of style?.layers ?? []) this.layers.set(l.id, l as Record<string, unknown>);
    registry.maps.push(this);
  }

  on(event: string, a: string | Handler, b?: Handler) {
    const key = typeof a === 'string' ? `${event}:${a}` : event;
    const handler = (typeof a === 'string' ? b : a) as Handler;
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
    return this;
  }
  /** Déclenche un événement (avec un calque : `fire('click', payload, 'v5-days-hit')`). */
  fire(event: string, payload: unknown = {}, layer?: string) {
    for (const h of this.handlers.get(layer ? `${event}:${layer}` : event) ?? []) h(payload);
  }
  addSource(id: string, spec: { data: unknown }) {
    const entry = { data: spec.data, setData: vi.fn((d: unknown) => void (entry.data = d)) };
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
  setLayoutProperty(id: string, key: string, value: unknown) {
    this.layout[`${id}.${key}`] = value;
  }
  setPaintProperty(id: string, key: string, value: unknown) {
    this.paint[`${id}.${key}`] = value;
  }
  getCanvas() {
    return { style: {} as Record<string, string> };
  }
  getBounds() {
    return { getSouth: () => 44.9, getWest: () => 5.3, getNorth: () => 45.2, getEast: () => 5.7 };
  }
  getZoom() {
    return this.zoom;
  }
  project([lon, lat]: [number, number]) {
    return { x: 200 + (lon - 5.5) * 1500, y: 300 - (lat - 45.05) * 3000 };
  }
  fitBounds(bounds: unknown, options: Record<string, unknown>) {
    this.calls.push('fitBounds');
    this.fits.push({ bounds, options });
  }
  zoomIn(options: unknown) {
    this.calls.push(`zoomIn:${JSON.stringify(options)}`);
  }
  zoomOut(options: unknown) {
    this.calls.push(`zoomOut:${JSON.stringify(options)}`);
  }
  stop() {
    this.calls.push('stop');
  }
  resize() {
    this.calls.push('resize');
  }
  remove() {
    this.removed = true;
    this.calls.push('remove');
  }
}

export class FakeMarker {
  element: HTMLElement;
  lngLat: [number, number] | null = null;
  map: FakeMap | null = null;
  removed = false;
  setLngLatCalls = 0;

  constructor(options: { element: HTMLElement; anchor?: string }) {
    this.element = options.element;
    registry.markers.push(this);
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    this.setLngLatCalls++;
    return this;
  }
  addTo(map: FakeMap) {
    this.map = map;
    this.element.classList.add('maplibregl-marker');
    map.canvasContainer.appendChild(this.element);
    return this;
  }
  remove() {
    this.removed = true;
    this.element.remove();
    return this;
  }
}

export const fakeMaplibreModule = {
  Map: FakeMap,
  Marker: FakeMarker,
  setWorkerUrl: (url: string) => {
    registry.workerUrl = url;
  },
};
