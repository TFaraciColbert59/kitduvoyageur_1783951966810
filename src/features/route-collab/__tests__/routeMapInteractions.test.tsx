// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WebGLArbiter } from '@/features/hub/webgl/WebGLArbiter';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { setRouteViewMode } from '../components/workspace/expertMode';
import { baseWorkspace } from '../insights/__tests__/fixtures';
import { LONG_PRESS_MS } from '../mapGesture';

type Handler = (e: unknown) => void;

/** Fausse carte MapLibre : enregistre les gestionnaires, les sources et les réglages ; rien n'est dessiné. */
class FakeMap {
  static last: FakeMap | null = null;
  static zoom = 14;
  handlers = new Map<string, Handler[]>();
  layerHandlers = new Map<string, Handler[]>();
  sources = new Map<string, unknown[]>();
  layers = new Set<string>();
  layout: Record<string, string> = {};
  fits: unknown[] = [];
  eases: unknown[] = [];
  rendered: unknown[] = [];
  dragPan = { enable: vi.fn(), disable: vi.fn() };
  constructor(public opts: Record<string, unknown>) {
    FakeMap.last = this;
    Object.defineProperty(opts.container as HTMLElement, 'clientHeight', { value: 800, configurable: true });
    queueMicrotask(() => this.emit('load', {}));
  }
  on(type: string, a: string | Handler, b?: Handler) {
    if (typeof a === 'function') this.handlers.set(type, [...(this.handlers.get(type) ?? []), a]);
    else if (b) this.layerHandlers.set(`${type}:${a}`, [...(this.layerHandlers.get(`${type}:${a}`) ?? []), b]);
  }
  emit(type: string, e: unknown) {
    for (const h of this.handlers.get(type) ?? []) h(e);
  }
  emitLayer(type: string, layer: string, e: unknown) {
    for (const h of this.layerHandlers.get(`${type}:${layer}`) ?? []) h(e);
  }
  addSource(id: string) {
    this.sources.set(id, []);
  }
  addLayer(l: { id: string }) {
    this.layers.add(l.id);
  }
  getSource(id: string) {
    return this.sources.has(id) ? { setData: (d: unknown) => this.sources.get(id)!.push(d) } : undefined;
  }
  getLayer(id: string) {
    return this.layers.has(id) ? { id } : undefined;
  }
  setLayoutProperty(id: string, _k: string, v: string) {
    this.layout[id] = v;
  }
  queryRenderedFeatures() {
    return this.rendered;
  }
  getZoom() {
    return FakeMap.zoom;
  }
  getCanvas() {
    return document.createElement('canvas');
  }
  fitBounds(...a: unknown[]) {
    this.fits.push(a);
  }
  easeTo(...a: unknown[]) {
    this.eases.push(a);
  }
  unproject() {
    return { lng: 0, lat: 0 };
  }
  remove() {}
}
class FakeMarker {
  setLngLat() {
    return this;
  }
  addTo() {
    return this;
  }
  on() {}
  remove() {}
  setRotation() {}
  getElement() {
    return document.createElement('div');
  }
}

vi.mock('maplibre-gl', () => ({ Map: FakeMap, Marker: FakeMarker, setWorkerUrl: () => undefined }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

const lastLast = () => FakeMap.last as FakeMap;
const ev = (x: number, y: number, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  point: { x, y },
  lngLat: { lat, lng },
  originalEvent: {},
  preventDefault: vi.fn(),
  ...extra,
});

function ws() {
  return baseWorkspace({
    id: 'w-map',
    tripId: 't',
    sport: 'marche',
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }],
  });
}

async function mountMap() {
  render(<RouteCollabWorkspace initialWorkspace={ws()} currentUserId="u1" currentUserName="Alice" />);
  await screen.findByTestId('route-collab-map');
  await waitFor(() => expect(lastLast().sources.has('rcw-sections')).toBe(true));
}

/**
 * Maintient un appui pendant `ms` sur une horloge simulée (setTimeout, clearTimeout, Date seulement), puis rend la
 * main aux vrais minuteurs pour que `waitFor` et les promesses de l'espace continuent normalement.
 */
function holdPress(press: () => void, ms: number): HTMLElement | null {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  try {
    act(() => press());
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  } finally {
    vi.useRealTimers();
  }
  return screen.queryByTestId('point-role-menu');
}

const headSeq = () => Number(screen.getByTestId('route-collab-workspace').getAttribute('data-head-seq'));

describe('carte de l’itinéraire : arbitre WebGL, gestes, calques, hors ligne', () => {
  beforeEach(() => {
    FakeMap.last = null;
    FakeMap.zoom = 14;
    WebGLArbiter.resetInstance();
    window.localStorage.clear();
    (window as unknown as { WebGLRenderingContext: unknown }).WebGLRenderingContext = function () {};
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
      kind === 'webgl' || kind === 'experimental-webgl' ? ({} as WebGLRenderingContext) : null) as never);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    setRouteViewMode('simple');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('2.1 : la carte s’enregistre auprès de WebGLArbiter (route-map) et le libère au démontage', async () => {
    const view = render(<RouteCollabWorkspace initialWorkspace={ws()} currentUserId="u1" currentUserName="Alice" />);
    await screen.findByTestId('route-collab-map');
    await waitFor(() => expect(WebGLArbiter.getInstance().current()).toBe('route-map'));
    view.unmount();
    expect(WebGLArbiter.getInstance().current()).toBeNull();
  });

  it('2.1 : un contexte WebGL déjà dégradé bascule en mode liste, sans créer de carte', async () => {
    WebGLArbiter.getInstance().triggerContextLost();
    render(<RouteCollabWorkspace initialWorkspace={ws()} currentUserId="u1" currentUserName="Alice" />);
    await screen.findByTestId('list-mode-fallback');
    expect(FakeMap.last).toBeNull();
  });

  it('2.2 / 2.3 : un toucher loin du tracé ajoute un point de passage', async () => {
    await mountMap();
    const before = headSeq();
    act(() => lastLast().emit('click', ev(200, 300, 46.5, 7.5)));
    await waitFor(() => expect(headSeq()).toBeGreaterThan(before));
  });

  it('2.2 : sous le zoom 9, le toucher zoome sur le lieu au lieu de poser un point, et le dit', async () => {
    await mountMap();
    FakeMap.zoom = 5;
    const before = headSeq();
    act(() => lastLast().emit('click', ev(200, 300, 46.5, 7.5)));
    await waitFor(() => expect(lastLast().eases.length).toBeGreaterThan(0));
    const opts = lastLast().eases.at(-1) as [{ center: [number, number]; zoom: number }];
    expect(opts[0].zoom).toBe(12);
    expect(opts[0].center).toEqual([7.5, 46.5]);
    expect(headSeq()).toBe(before);
    expect((await screen.findByTestId('status-message')).textContent).toMatch(/trop large/i);
  });

  it('1.x : une carte sans voyage ni tracé s’ouvre à zoom de randonnée sur un repère neutre, jamais sur l’Europe', async () => {
    render(<RouteCollabWorkspace initialWorkspace={baseWorkspace({ id: 'w-empty', tripId: 't', sport: 'marche', members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }], points: [], sections: [], stages: [] })} currentUserId="u1" currentUserName="Alice" />);
    await screen.findByTestId('route-collab-map');
    await waitFor(() => expect(FakeMap.last).not.toBeNull());
    expect(lastLast().opts.zoom).toBe(12);
    await screen.findByTestId('place-yourself');
    expect(screen.getByTestId('address-input')).toBeTruthy();
  });

  it('2.2 : un toucher sur un point ne pose rien (il le sélectionne)', async () => {
    await mountMap();
    lastLast().rendered = [{ properties: { id: 'a' } }];
    const before = headSeq();
    act(() => lastLast().emit('click', ev(10, 10, 45.9, 6.0)));
    await new Promise((r) => setTimeout(r, 30));
    expect(headSeq()).toBe(before);
  });

  it('2.2 : l’appui long ouvre le menu (Point de passage, Arrêt, Fin d’étape, Repère) et Arrêt pose un arrêt', async () => {
    await mountMap();
    // Appui long déterministe : minuteurs et horloge simulés, aucune attente réelle (le test ne dépend plus de la charge).
    const menu = holdPress(() => lastLast().emit('mousedown', ev(200, 300, 46.5, 7.5)), LONG_PRESS_MS);
    expect(menu).toBeTruthy();
    for (const id of ['waypoint', 'stop', 'stage_end', 'landmark']) {
      expect(screen.getByTestId(`point-role-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('point-role-menu').getAttribute('role')).toBe('menu');
    // Le clic qui suit l'appui long ne pose pas un second point.
    const before = headSeq();
    act(() => lastLast().emit('click', ev(200, 300, 46.5, 7.5)));
    await act(async () => {});
    expect(headSeq()).toBe(before);
    fireEvent.click(screen.getByTestId('point-role-stop'));
    await waitFor(() => expect(headSeq()).toBeGreaterThan(before));
    expect(screen.queryByTestId('point-role-menu')).toBeNull();
  });

  it('2.2 : un doigt qui bouge annule l’appui long', async () => {
    await mountMap();
    // Le doigt bouge avant l'échéance : même durée écoulée qu'au test précédent (plus une marge), aucun menu.
    holdPress(() => {
      lastLast().emit('mousedown', ev(200, 300, 46.5, 7.5));
      lastLast().emit('mousemove', ev(260, 340, 46.5, 7.6));
    }, LONG_PRESS_MS + 150);
    expect(screen.queryByTestId('point-role-menu')).toBeNull();
  });

  it('2.2 : Échap ferme le menu sans rien poser', async () => {
    await mountMap();
    const before = headSeq();
    act(() => lastLast().emit('contextmenu', ev(200, 300, 46.5, 7.5)));
    await screen.findByTestId('point-role-menu');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('point-role-menu')).toBeNull();
    expect(headSeq()).toBe(before);
  });

  it('2.5 : une couleur par jour et une légende J1 / J2 ; les lentilles n’existent qu’en vue experte', async () => {
    await mountMap();
    expect(screen.getByTestId('legend-day-1')).toBeTruthy();
    expect(screen.getByTestId('legend-day-2')).toBeTruthy();
    expect(screen.queryByTestId('map-lens')).toBeNull();
    const feats = lastLast().sources.get('rcw-sections')!.at(-1) as { features: Array<{ properties: { color: string; day: number } }> };
    expect(feats.features.map((f) => f.properties.day)).toEqual([1, 2]);
    expect(feats.features[0].properties.color).toBeTruthy();
    act(() => setRouteViewMode('expert'));
    await screen.findByTestId('map-lens');
    fireEvent.click(screen.getByTestId('lens-slope'));
    await waitFor(() => expect(lastLast().layout['rcw-lens-line']).toBe('visible'));
    expect(lastLast().layout['rcw-sections-day']).toBe('none');
    expect(screen.getByTestId('map-lens-legend').textContent).toContain('Pente inconnue');
    fireEvent.click(screen.getByTestId('lens-days'));
    await waitFor(() => expect(lastLast().layout['rcw-lens-line']).toBe('none'));
  });

  it('2.7 : calques selon le sport ; sans donnée relevée le calque le dit', async () => {
    await mountMap();
    fireEvent.click(screen.getByTestId('map-settings-trigger'));
    const panel = await screen.findByTestId('map-layers-panel');
    expect(panel.textContent).toContain('Eau');
    expect(panel.textContent).toContain('Abris');
    expect(panel.textContent).not.toContain('Ateliers vélo');
    await waitFor(() => expect(screen.getByTestId('layer-water-note')).toBeTruthy());
    expect(screen.getByTestId('layer-water-note').textContent).toMatch(/Aucun point relevé|indisponible|Relevé en cours/);
  });

  it('2.8 : le cadrage tient compte de la marge du tiroir (jamais de cadre vide)', async () => {
    await mountMap();
    await waitFor(() => expect(lastLast().fits.length).toBeGreaterThan(0));
    const opts = (lastLast().fits.at(-1) as unknown[])[1] as { padding: { top: number; bottom: number } };
    expect(opts.padding.top).toBeGreaterThan(0);
    expect(opts.padding.bottom).toBeGreaterThan(0);
  });

  it('2.10 : hors ligne, le badge « Hors ligne » apparaît ; sans copie, il le dit', async () => {
    await mountMap();
    expect(screen.queryByTestId('offline-badge')).toBeNull();
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    const badge = await screen.findByTestId('offline-badge');
    expect(badge.textContent).toBe('Hors ligne · aucune copie téléchargée');
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('2.4 : glisser une ligne choisie montre le halo du chemin réel (snap=1), puis déforme le tracé au dépôt', async () => {
    await mountMap();
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        calls.push(String(url));
        if (String(url).startsWith('/api/route')) {
          return new Response(
            JSON.stringify({ status: 'ok', provider: 'valhalla', legs: [{ distanceKm: 21, durationMin: 200, geometry: [[6.0, 45.9], [6.13, 45.95], [6.26, 45.9]] }] }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 503 });
      }),
    );
    const map = lastLast();
    // Une ligne se déforme une fois choisie : on la touche d'abord.
    act(() => map.emitLayer('click', 'rcw-sections-hit', { ...ev(5, 5, 45.9, 6.05), features: [{ properties: { id: 's1' } }] }));
    await screen.findByTestId('subdrawer-section');
    const before = headSeq();
    const down = ev(100, 100, 45.9, 6.05, { features: [{ properties: { id: 's1' } }] });
    act(() => map.emitLayer('mousedown', 'rcw-sections-hit', down));
    expect(down.preventDefault).toHaveBeenCalled();
    act(() => map.emit('mousemove', ev(100, 160, 45.95, 6.06)));
    await waitFor(() => expect(calls.some((c) => c.includes('snap=1'))).toBe(true), { timeout: 2000 });
    await screen.findByTestId('drag-info');
    await waitFor(() => expect(screen.getByTestId('drag-info').textContent).toContain('Chemin réel'));
    act(() => {
      window.dispatchEvent(new Event('mouseup'));
    });
    await waitFor(() => expect(headSeq()).toBeGreaterThan(before));
  });

  it('2.4 : une ligne non choisie reste de la carte (le glissé la fait défiler)', async () => {
    await mountMap();
    const down = ev(100, 100, 45.9, 6.05, { features: [{ properties: { id: 's2' } }] });
    act(() => lastLast().emitLayer('mousedown', 'rcw-sections-hit', down));
    expect(down.preventDefault).not.toHaveBeenCalled();
  });
  it('2.6 : la souris sur le tracé pose le curseur du profil (km, altitude, pente, passage) ; « inconnu » plutôt que 0', async () => {
    await mountMap();
    expect(screen.queryByTestId('profile-readout')).toBeNull();
    act(() => lastLast().emit('mousemove', ev(100, 100, 45.9, 6.05)));
    const readout = await screen.findByTestId('profile-readout');
    expect(readout.textContent).toContain('km');
    expect(readout.textContent).toContain('Altitude');
    expect(readout.textContent).toContain('Pente');
    expect(readout.textContent).toContain('Passage');
    // Ces tronçons n'ont pas d'altitude échantillonnée : elle est dite inconnue, jamais 0 m.
    expect(readout.textContent).not.toMatch(/\b0 m\b/);
    // Le point rouge du curseur est posé sur la carte.
    const hover = lastLast().sources.get('rcw-hover')!.at(-1) as { features: unknown[] };
    expect(hover.features).toHaveLength(1);
    // Hors tracé : le curseur disparaît (la lecture du survol est espacée de 70 ms).
    await new Promise((r) => setTimeout(r, 90));
    act(() => lastLast().emit('mousemove', ev(100, 100, 47.5, 9.5)));
    await waitFor(() => expect(screen.queryByTestId('profile-readout')).toBeNull());
  });

  it('2.9 : position en direct, cap et écart au tracé (sur le tracé puis éloigné)', async () => {
    let push: ((p: unknown) => void) | null = null;
    const clearWatch = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (cb: (p: unknown) => void) => {
          push = cb;
          return 7;
        },
        clearWatch,
      },
    });
    const pos = (lat: number, lon: number, heading: number | null) => ({
      coords: { latitude: lat, longitude: lon, accuracy: 9, altitude: null, altitudeAccuracy: null, heading, speed: null },
      timestamp: Date.now(),
    });
    await mountMap();
    fireEvent.click(screen.getByTestId('map-locate'));
    await waitFor(() => expect(push).not.toBeNull());
    act(() => push!(pos(45.9, 6.05, 90)));
    const status = await screen.findByTestId('live-status');
    expect(status.textContent).toContain('Sur le tracé');
    expect(status.textContent).toContain('cap E');
    act(() => push!(pos(45.95, 6.05, null)));
    await waitFor(() => expect(screen.getByTestId('live-status').textContent).toMatch(/À [\d,.]+ (m|km) du tracé/));
    fireEvent.click(screen.getByTestId('map-locate'));
    await waitFor(() => expect(screen.queryByTestId('live-status')).toBeNull());
    expect(clearWatch).toHaveBeenCalled();
  });
});
