// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';
import { ALL_LAYERS } from '../../../engine/mapLayers';
import type { CompasPoint } from '../../../server/getCompasData';
import type { V5StayOption } from '../../types';
import { LiveMap, type LiveMapProps } from '../LiveMap';
import { FakeMap, registry, resetRegistry } from './fakeMaplibre';

vi.mock('maplibre-gl', async () => (await import('./fakeMaplibre')).fakeMaplibreModule);

/* ---------- Environnement jsdom ---------- */

let reduced = false;
const resizeCallbacks: Array<() => void> = [];
let resizeDisconnects = 0;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
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
  class FakeResizeObserver {
    constructor(cb: () => void) {
      resizeCallbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      resizeDisconnects++;
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
});

beforeEach(() => {
  resetRegistry();
  reduced = false;
  resizeCallbacks.length = 0;
  resizeDisconnects = 0;
});
afterEach(() => cleanup());

/* ---------- Données ---------- */

const D = { lat: 45.0, lon: 5.4 };
const R = { lat: 45.07, lon: 5.45 };
const C = { lat: 45.04, lon: 5.55 };
const L = { lat: 45.0, lon: 5.62 };

function stay(id: string, name: string, lat: number, lon: number, over: Partial<V5StayOption> = {}): V5StayOption {
  return {
    id,
    name,
    kind: 'hebergement',
    lat,
    lon,
    distanceM: 200,
    elevationM: null,
    price: null,
    photo: null,
    source: 'OpenStreetMap',
    url: null,
    partner: null,
    ...over,
  };
}

function poi(id: string, label: string, category: string, lat: number, lon: number): CompasPoint {
  return { id, label, category, lat, lon, kind: 'poi' };
}

function track() {
  const pts = [D, R, C, L];
  const coordinates: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 10; k++) {
      coordinates.push([pts[i].lon + ((pts[i + 1].lon - pts[i].lon) * k) / 10, pts[i].lat + ((pts[i + 1].lat - pts[i].lat) * k) / 10]);
    }
  }
  coordinates.push([L.lon, L.lat]);
  return { type: 'LineString', coordinates };
}

function makeProps(over: Partial<LiveMapProps> = {}): LiveMapProps {
  return {
    name: 'Randonnée · Vercors',
    routeGeojson: track(),
    coords: [],
    stages: [
      { day: 1, ...R, title: 'Sainte-Eulalie-en-Royans → Rencurel' },
      { day: 2, ...C, title: 'Rencurel → Corrençon-en-Vercors' },
      { day: 3, ...L, title: 'Corrençon-en-Vercors → La Chapelle-en-Vercors' },
    ],
    origin: { ...D, title: 'Sainte-Eulalie-en-Royans' },
    nights: [
      {
        day: 1,
        chosen: stay('osm:1', 'Gîte du Royans', 45.0705, 5.4505, {
          photo: { url: 'https://upload.wikimedia.org/x.jpg', credit: 'A. Auteur', license: 'CC BY-SA 4.0', pageUrl: 'https://commons.wikimedia.org/x' },
        }),
        alternatives: [stay('osm:2', 'Refuge des Allières', 45.0707, 5.4507, { kind: 'refuge', price: { perPerson: 22, currency: 'EUR', basis: 'bareme', asOf: '2026-10-01' } }), stay('osm:3', 'Camping du Pont', 45.0708, 5.4508, { kind: 'camping' })],
        booked: true,
        priceLabel: '45 €',
      },
      { day: 2, chosen: stay('osm:4', 'Hôtel des Cimes', 45.0405, 5.5505), alternatives: [], booked: false, priceLabel: null },
    ],
    points: [poi('w1', 'Source captée', 'water', 45.02, 5.5), poi('t1', 'Toilettes du col', 'toilets', 45.02, 5.45), poi('p1', 'Moucherotte', 'peak', 45.1, 5.6)],
    layers: { ...ALL_LAYERS },
    onLayers: vi.fn(),
    base: 'osm',
    onBase: vi.fn(),
    focus: { kind: 'trip' },
    inset: { top: 0, bottom: 120, left: 0, right: 0 },
    onSelectDay: vi.fn(),
    onSelectNight: vi.fn(),
    onPickAlternative: vi.fn(),
    onPoi: vi.fn(),
    big: false,
    onToggleBig: vi.fn(),
    emptyText: 'Rien à montrer pour l’instant.',
    ...over,
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mount(over: Partial<LiveMapProps> = {}) {
  const props = makeProps(over);
  const utils = render(<LiveMap {...props} />);
  await waitFor(() => expect(registry.maps).toHaveLength(1));
  const map = registry.maps[0];
  await act(async () => {
    map.fire('style.load');
  });
  await settle();
  const again = (next: Partial<LiveMapProps>) => {
    const merged = { ...props, ...next };
    utils.rerender(<LiveMap {...merged} />);
    return merged;
  };
  return { ...utils, props, map, again };
}

const markerEls = () => Array.from(document.querySelectorAll<HTMLElement>('.v5-mk'));
const buttonNames = () => markerEls().flatMap((el) => Array.from(el.querySelectorAll('button')).map((b) => b.getAttribute('aria-label')));

/* ---------- Tests ---------- */

describe('LiveMap : état vide et chargement', () => {
  it('sans aucune donnée géolocalisée : le texte d’état vide, et MapLibre n’est jamais chargé', async () => {
    render(<LiveMap {...makeProps({ routeGeojson: null, stages: [], origin: null, nights: [], points: [], coords: [] })} />);
    expect(screen.getByText('Rien à montrer pour l’instant.')).toBeTruthy();
    await settle();
    expect(registry.maps).toHaveLength(0);
  });

  it('charge MapLibre à la demande, règle le worker et crée une seule carte en projection plane', async () => {
    const { map } = await mount();
    expect(registry.maps).toHaveLength(1);
    expect(registry.workerUrl).toBe('/maplibre/maplibre-gl-worker.mjs');
    const style = map.options.style as { projection: { type: string }; layers: Array<{ id: string }> };
    expect(style.projection.type).toBe('mercator');
    expect(style.layers.map((l) => l.id)).toEqual(expect.arrayContaining(['atlas-tile-topo', 'atlas-tile-osm', 'atlas-tile-satellite']));
    expect(map.options.attributionControl).toBe(false);
    expect(map.options.dragRotate).toBe(false);
  });

  it('si MapLibre ne démarre pas (WebGL absent) : message clair, aucune erreur levée', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.failConstruct = true;
    render(<LiveMap {...makeProps()} />);
    expect(await screen.findByText('La carte n’est pas disponible sur cet appareil.')).toBeTruthy();
    expect(markerEls()).toHaveLength(0);
    spy.mockRestore();
  });

  it('nettoie tout au démontage : carte retirée, marqueurs retirés, observateur déconnecté', async () => {
    const { map, unmount } = await mount();
    const created = [...registry.markers];
    expect(created.length).toBeGreaterThan(0);
    unmount();
    expect(map.removed).toBe(true);
    expect(created.every((m) => m.removed)).toBe(true);
    expect(resizeDisconnects).toBeGreaterThan(0);
  });
});

describe('LiveMap : accessibilité du conteneur', () => {
  it('résume le parcours : jours, kilomètres du tracé réel, nuits', async () => {
    await mount();
    const region = screen.getByRole('region', { name: /^Carte du parcours, 3 jours, \d+ km, 2 nuits$/ });
    expect(region).toBeTruthy();
    expect(within(region).getByText('Randonnée · Vercors')).toBeTruthy();
  });

  it('sans tracé réel : « tracé approximatif » dans le libellé, sans kilomètres inventés, et dit à l’écran', async () => {
    await mount({ routeGeojson: null });
    expect(screen.getByRole('region', { name: 'Carte du parcours, 3 jours, 2 nuits, tracé approximatif' })).toBeTruthy();
    expect(screen.getByText('Tracé approximatif')).toBeTruthy();
  });

  it('chaque marqueur est un bouton nommé', async () => {
    await mount();
    for (const el of markerEls()) {
      for (const b of Array.from(el.querySelectorAll('button'))) {
        expect(b.getAttribute('type')).toBe('button');
        expect(b.getAttribute('aria-label')).toBeTruthy();
      }
    }
    expect(screen.getByRole('button', { name: 'Départ : Sainte-Eulalie-en-Royans' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jour 1 : arrivée à Rencurel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jour 3 : arrivée à La Chapelle-en-Vercors' })).toBeTruthy();
  });

  it('affiche l’attribution du fond choisi, tirée des licences', async () => {
    const { again } = await mount({ base: 'osm' });
    expect(document.querySelector('.v5-attrib')?.textContent).toContain(ATLAS_TILES.osm.short);
    again({ base: 'satellite' });
    expect(document.querySelector('.v5-attrib')?.textContent).toContain(ATLAS_TILES.satellite.short);
  });

  it('toutes les commandes ont une cible nommée, la poignée comprise', async () => {
    await mount();
    for (const name of ['Plan', 'Relief', 'Satellite', 'Ce qui est affiché', 'Tout le voyage', 'Zoomer', 'Dézoomer', 'Agrandir la carte']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });
});

describe('LiveMap : tracé et fonds', () => {
  it('envoie un segment par jour, sans coupure, au calque du tracé', async () => {
    const { map } = await mount();
    const src = map.getSource('v5-days')!;
    const fc = src.data as { features: Array<{ properties: { day: number; approximate: boolean }; geometry: { coordinates: number[][] } }> };
    expect(fc.features.map((f) => f.properties.day)).toEqual([1, 2, 3]);
    expect(fc.features.every((f) => !f.properties.approximate)).toBe(true);
    for (let i = 0; i < 2; i++) {
      const a = fc.features[i].geometry.coordinates;
      expect(a[a.length - 1]).toEqual(fc.features[i + 1].geometry.coordinates[0]);
    }
    expect(['v5-days-halo', 'v5-days-line', 'v5-days-dash', 'v5-days-hit'].every((id) => map.layers.has(id))).toBe(true);
  });

  it('sans tracé : segments droits marqués approximatifs', async () => {
    const { map } = await mount({ routeGeojson: null });
    const fc = map.getSource('v5-days')!.data as { features: Array<{ properties: { approximate: boolean } }> };
    expect(fc.features).toHaveLength(3);
    expect(fc.features.every((f) => f.properties.approximate)).toBe(true);
  });

  it('atténue les autres jours quand un jour est ouvert, et rend tout au voyage entier', async () => {
    const { map, again } = await mount();
    expect(map.paint['v5-days-line.line-opacity']).toBe(1);
    again({ focus: { kind: 'day', day: 2 } });
    const expr = map.paint['v5-days-line.line-opacity'] as unknown[];
    expect(expr[0]).toBe('case');
    expect(JSON.stringify(expr)).toContain('2');
    again({ focus: { kind: 'trip' } });
    expect(map.paint['v5-days-line.line-opacity']).toBe(1);
  });

  it('un clic sur un jour du tracé ouvre ce jour', async () => {
    const { map, props } = await mount();
    act(() => map.fire('click', { features: [{ properties: { day: 2 } }], originalEvent: { target: document.body } }, 'v5-days-hit'));
    expect(props.onSelectDay).toHaveBeenCalledWith(2);
  });

  it('le fond suit le réglage sans recharger le style', async () => {
    const { map, again } = await mount({ base: 'osm' });
    expect(map.layout['atlas-tile-osm.visibility']).toBe('visible');
    expect(map.layout['atlas-tile-topo.visibility']).toBe('none');
    again({ base: 'satellite' });
    expect(map.layout['atlas-tile-satellite.visibility']).toBe('visible');
    expect(map.layout['atlas-tile-osm.visibility']).toBe('none');
  });

  it('la capsule demande le fond choisi', async () => {
    const user = userEvent.setup();
    const { props } = await mount({ base: 'osm' });
    expect(screen.getByRole('button', { name: 'Plan' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Relief' }));
    expect(props.onBase).toHaveBeenCalledWith('topo');
    await user.click(screen.getByRole('button', { name: 'Satellite' }));
    expect(props.onBase).toHaveBeenCalledWith('satellite');
  });
});

describe('LiveMap : marqueurs', () => {
  it('pastilles D, 1, 2, 3, nuits retenues en photo avec prix, et aucune alternative en vue du voyage', async () => {
    await mount();
    const names = buttonNames();
    expect(names).toEqual(expect.arrayContaining(['Départ : Sainte-Eulalie-en-Royans', 'Jour 1 : arrivée à Rencurel', 'Jour 2 : arrivée à Corrençon-en-Vercors']));
    const night1 = screen.getByRole('button', { name: 'Nuit du jour 1 : Gîte du Royans, 45 €, réservée' });
    expect(night1.querySelector('img')?.getAttribute('src')).toBe('https://upload.wikimedia.org/x.jpg');
    expect(night1.querySelector('.tag')?.textContent).toBe('45 €');
    expect(night1.querySelector('.ok')).toBeTruthy();
    expect(night1.getAttribute('title')).toContain('A. Auteur');
    const night2 = screen.getByRole('button', { name: 'Nuit du jour 2 : Hôtel des Cimes' });
    expect(night2.querySelector('img')).toBeNull();
    expect(night2.querySelector('.fb')).toBeTruthy();
    expect(night2.querySelector('.ok')).toBeNull();
    expect(names.some((n) => n?.startsWith('Autre nuit possible'))).toBe(false);
  });

  it('une nuit sans choix n’a pas de marqueur (rien n’est inventé)', async () => {
    await mount({ nights: [{ day: 1, chosen: null, alternatives: [], booked: false, priceLabel: null }] });
    expect(buttonNames().some((n) => n?.startsWith('Nuit du jour'))).toBe(false);
  });

  it('les alternatives n’apparaissent que pour le jour ouvert, et disparaissent avec lui', async () => {
    const { again } = await mount();
    again({ focus: { kind: 'day', day: 1 } });
    await settle();
    expect(screen.getByRole('button', { name: /^Autre nuit possible : Refuge des Allières, repère 22\s€ par personne$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Autre nuit possible : Camping du Pont' })).toBeTruthy();
    again({ focus: { kind: 'day', day: 2 } });
    await settle();
    expect(screen.queryByRole('button', { name: /Autre nuit possible/ })).toBeNull();
    again({ focus: { kind: 'trip' } });
    await settle();
    expect(screen.queryByRole('button', { name: /Autre nuit possible/ })).toBeNull();
  });

  it('les marqueurs sont créés une fois puis mis à jour, jamais recréés à chaque rendu', async () => {
    const { again, props } = await mount();
    const before = registry.markers.length;
    again({});
    again({ nights: props.nights.map((n) => ({ ...n })) });
    await settle();
    expect(registry.markers.length).toBe(before);
    expect(registry.markers.filter((m) => m.removed)).toHaveLength(0);
    // Le contenu se met à jour dans le même marqueur.
    again({ nights: props.nights.map((n) => (n.day === 1 ? { ...n, priceLabel: '52 €' } : n)) });
    await settle();
    expect(registry.markers.length).toBe(before);
    expect(screen.getByRole('button', { name: /Gîte du Royans, 52 €/ }).querySelector('.tag')?.textContent).toBe('52 €');
  });

  it('chaque marqueur est posé à ses coordonnées réelles [lon, lat]', async () => {
    await mount();
    const pin = registry.markers.find((m) => m.element.querySelector('button')?.getAttribute('aria-label') === 'Jour 2 : arrivée à Corrençon-en-Vercors')!;
    expect(pin.lngLat).toEqual([C.lon, C.lat]);
  });

  it('sélection : étape, nuit et alternative préviennent l’hôte', async () => {
    const user = userEvent.setup();
    const { props, again } = await mount();
    await user.click(screen.getByRole('button', { name: 'Jour 2 : arrivée à Corrençon-en-Vercors' }));
    expect(props.onSelectDay).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: 'Départ : Sainte-Eulalie-en-Royans' }));
    expect(props.onSelectDay).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: /^Nuit du jour 1/ }));
    expect(props.onSelectNight).toHaveBeenCalledWith(1);
    again({ focus: { kind: 'day', day: 1 } });
    await settle();
    await user.click(screen.getByRole('button', { name: /^Autre nuit possible : Camping du Pont/ }));
    expect(props.onPickAlternative).toHaveBeenCalledWith(1, 'osm:3');
  });

  it('clavier : une pastille focalisée se déclenche avec Entrée', async () => {
    const user = userEvent.setup();
    const { props } = await mount();
    screen.getByRole('button', { name: 'Jour 3 : arrivée à La Chapelle-en-Vercors' }).focus();
    await user.keyboard('{Enter}');
    expect(props.onSelectDay).toHaveBeenCalledWith(3);
  });

  it('la pastille du jour ouvert est mise en avant', async () => {
    const { again } = await mount();
    again({ focus: { kind: 'day', day: 2 } });
    expect(screen.getByRole('button', { name: /^Jour 2/ }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /^Jour 1/ }).getAttribute('data-active')).toBeNull();
  });

  it('une photo qui ne charge pas retombe sur l’illustration', async () => {
    await mount();
    const night = screen.getByRole('button', { name: /^Nuit du jour 1/ });
    const img = night.querySelector('img')!;
    fireEvent.error(img);
    await settle();
    expect(night.querySelector('img')).toBeNull();
    expect(night.querySelector('.fb')).toBeTruthy();
  });
});

describe('LiveMap : calques et niveau de détail', () => {
  it('en détail moyen : l’essentiel (eau, sommets) ; en vue d’ensemble : rien ; en détail fort : tout', async () => {
    const { map } = await mount();
    expect(document.querySelector('.v5-map')?.getAttribute('data-lod')).toBe('mid');
    expect(buttonNames()).toEqual(expect.arrayContaining(['Source captée, Eau', 'Moucherotte, Sommets']));
    expect(buttonNames()).not.toContain('Toilettes du col, Toilettes');

    await act(async () => {
      map.zoom = 7;
      map.fire('moveend');
    });
    await settle();
    expect(document.querySelector('.v5-map')?.getAttribute('data-lod')).toBe('low');
    expect(buttonNames().some((n) => n?.includes('Eau'))).toBe(false);

    await act(async () => {
      map.zoom = 12;
      map.fire('moveend');
    });
    await settle();
    expect(buttonNames()).toContain('Toilettes du col, Toilettes');
  });

  it('plafonne le nombre de marqueurs de points utiles', async () => {
    const many = Array.from({ length: 300 }, (_, i) => poi(`m${i}`, `Source ${i}`, 'water', 44.95 + (i % 25) * 0.008, 5.32 + Math.floor(i / 25) * 0.03));
    await mount({ points: many });
    const pois = markerEls().filter((el) => el.classList.contains('v5-mk-poi'));
    expect(pois.length).toBeLessThanOrEqual(40);
    expect(pois.length).toBeGreaterThan(0);
  });

  it('le panneau des calques liste ce qui existe, avec ses compteurs, et rend la main à l’hôte', async () => {
    const user = userEvent.setup();
    const { props } = await mount();
    const toggle = screen.getByRole('button', { name: 'Ce qui est affiché' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('group', { name: 'Sur la carte' });
    expect(within(panel).getByText('5 sur 5')).toBeTruthy();
    const water = within(panel).getByRole('button', { name: /Eau/ });
    expect(water.textContent).toContain('1');
    expect(within(panel).getByRole('button', { name: /Étapes/ }).textContent).toContain('4');
    expect(within(panel).getByRole('button', { name: /Nuits/ }).textContent).toContain('2');
    expect(within(panel).queryByRole('button', { name: /Parkings/ })).toBeNull();
    await user.click(water);
    expect(props.onLayers).toHaveBeenCalledWith({ ...props.layers, water: false });
  });

  it('un calque éteint retire ses marqueurs', async () => {
    const { again, props } = await mount();
    again({ layers: { ...props.layers, hebergement: false } });
    await settle();
    expect(buttonNames().some((n) => n?.startsWith('Nuit du jour'))).toBe(false);
    again({ layers: { ...props.layers, etapes: false } });
    await settle();
    expect(buttonNames().some((n) => n?.startsWith('Jour '))).toBe(false);
    again({ layers: { ...props.layers, water: false } });
    await settle();
    expect(buttonNames().some((n) => n?.includes('Eau'))).toBe(false);
  });

  it('Échap referme le panneau des calques', async () => {
    const user = userEvent.setup();
    await mount();
    await user.click(screen.getByRole('button', { name: 'Ce qui est affiché' }));
    expect(screen.getByRole('group', { name: 'Sur la carte' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Sur la carte' })).toBeNull();
  });
});

describe('LiveMap : bulle d’information', () => {
  it('ouvre une bulle sur un point, au clavier jusqu’à l’action, et la referme avec Échap en rendant le focus', async () => {
    const user = userEvent.setup();
    const { props } = await mount();
    const marker = screen.getByRole('button', { name: 'Source captée, Eau' });
    marker.focus();
    await user.keyboard('{Enter}');
    const callout = await screen.findByRole('dialog', { name: 'Information : Source captée' });
    expect(within(callout).getByText('Eau')).toBeTruthy();
    expect(document.activeElement).toBe(callout);
    // La bulle suit la carte : une position lui est donnée, pointe vers le point.
    expect((callout as HTMLElement).style.transform).toMatch(/translate\(/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(marker);
    expect(props.onPoi).not.toHaveBeenCalled();
  });

  it('l’action de la bulle prévient l’hôte et la ferme', async () => {
    const user = userEvent.setup();
    const { props } = await mount();
    await user.click(screen.getByRole('button', { name: 'Moucherotte, Sommets' }));
    await user.click(await screen.findByRole('button', { name: 'Voir ce point' }));
    expect(props.onPoi).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('le bouton de fermeture a une cible nommée', async () => {
    const user = userEvent.setup();
    await mount();
    await user.click(screen.getByRole('button', { name: 'Source captée, Eau' }));
    await user.click(await screen.findByRole('button', { name: 'Fermer l’information' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('suit la carte quand elle bouge', async () => {
    const user = userEvent.setup();
    const { map } = await mount();
    await user.click(screen.getByRole('button', { name: 'Source captée, Eau' }));
    const callout = (await screen.findByRole('dialog')) as HTMLElement;
    const before = callout.style.transform;
    const original = map.project.bind(map);
    map.project = ([lon, lat]: [number, number]) => {
      const p = original([lon, lat]);
      return { x: p.x + 40, y: p.y };
    };
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    act(() => map.fire('move'));
    raf.mockRestore();
    expect(callout.style.transform).not.toBe(before);
  });

  it('un clic sur la carte referme la bulle, un clic sur un marqueur non', async () => {
    const user = userEvent.setup();
    const { map } = await mount();
    await user.click(screen.getByRole('button', { name: 'Source captée, Eau' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    const marker = screen.getByRole('button', { name: 'Moucherotte, Sommets' });
    act(() => map.fire('click', { originalEvent: { target: marker } }));
    expect(screen.queryByRole('dialog')).toBeTruthy();
    act(() => map.fire('click', { originalEvent: { target: document.body } }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la bulle disparaît quand le calque du point est éteint', async () => {
    const user = userEvent.setup();
    const { again, props } = await mount();
    await user.click(screen.getByRole('button', { name: 'Source captée, Eau' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    again({ layers: { ...props.layers, water: false } });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('LiveMap : caméra', () => {
  it('cadre le voyage sans animation au départ, avec la zone masquée en marge', async () => {
    const { map } = await mount();
    expect(map.fits).toHaveLength(1);
    expect(map.fits[0].options.duration).toBe(0);
    const padding = map.fits[0].options.padding as { top: number; bottom: number; left: number; right: number };
    expect(padding.bottom).toBeGreaterThanOrEqual(24 + 120 - 1);
    expect(padding.top).toBeGreaterThan(0);
    expect(map.fits[0].options.maxZoom).toBeLessThanOrEqual(15);
  });

  it('vole d’un jour à l’autre : un seul mouvement à la fois (l’ancien est arrêté d’abord)', async () => {
    const { map, again } = await mount();
    again({ focus: { kind: 'day', day: 1 } });
    again({ focus: { kind: 'day', day: 2 } });
    expect(map.fits).toHaveLength(3);
    expect(map.fits[1].options.duration).toBeGreaterThan(0);
    const calls = map.calls.filter((c) => c === 'stop' || c === 'fitBounds');
    for (let i = 0; i < calls.length; i++) if (calls[i] === 'fitBounds') expect(calls[i - 1]).toBe('stop');
    expect(JSON.stringify(map.fits[1].bounds)).not.toBe(JSON.stringify(map.fits[2].bounds));
  });

  it('ne bouge pas quand l’emprise n’a pas changé', async () => {
    const { map, again, props } = await mount();
    again({});
    again({ stages: props.stages.map((s) => ({ ...s })), nights: props.nights.map((n) => ({ ...n })) });
    await settle();
    expect(map.fits).toHaveLength(1);
    again({ focus: { kind: 'day', day: 1 } });
    again({ focus: { kind: 'day', day: 1 } });
    expect(map.fits).toHaveLength(2);
  });

  it('une zone masquée différente recadre', async () => {
    const { map, again } = await mount();
    again({ inset: { top: 0, bottom: 300, left: 0, right: 0 } });
    expect(map.fits).toHaveLength(2);
  });

  it('prefers-reduced-motion : caméra sans animation', async () => {
    reduced = true;
    const { map, again } = await mount();
    again({ focus: { kind: 'day', day: 2 } });
    expect(map.fits.every((f) => f.options.duration === 0)).toBe(true);
  });

  it('un jour inconnu retombe sur le voyage entier', async () => {
    const { map, again } = await mount();
    again({ focus: { kind: 'day', day: 9 } });
    expect(map.fits).toHaveLength(2);
    expect(map.fits[1].bounds).toEqual(map.fits[0].bounds);
  });

  it('« Tout le voyage » recadre le voyage, et les boutons de zoom zooment', async () => {
    const user = userEvent.setup();
    const { map } = await mount({ focus: { kind: 'day', day: 2 } });
    const n = map.fits.length;
    await user.click(screen.getByRole('button', { name: 'Tout le voyage' }));
    expect(map.fits).toHaveLength(n + 1);
    await user.click(screen.getByRole('button', { name: 'Zoomer' }));
    await user.click(screen.getByRole('button', { name: 'Dézoomer' }));
    expect(map.calls.some((c) => c.startsWith('zoomIn'))).toBe(true);
    expect(map.calls.some((c) => c.startsWith('zoomOut'))).toBe(true);
  });

  it('suit les changements de taille de la carte (agrandir) : redimensionne puis recadre', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { map } = await mount();
      const n = map.fits.length;
      let height = 600;
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => height });
      height = 900;
      act(() => resizeCallbacks.forEach((cb) => cb()));
      expect(map.calls).toContain('resize');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(map.fits.length).toBeGreaterThan(n);
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
      vi.useRealTimers();
    }
  });
});

describe('LiveMap : poignée', () => {
  it('un toucher ou la touche Entrée agrandit ou réduit', async () => {
    const user = userEvent.setup();
    const { props } = await mount();
    const grab = screen.getByRole('button', { name: 'Agrandir la carte' });
    await user.click(grab);
    expect(props.onToggleBig).toHaveBeenCalledTimes(1);
    grab.focus();
    await user.keyboard('{Enter}');
    expect(props.onToggleBig).toHaveBeenCalledTimes(2);
  });

  it('annonce l’état quand la carte est agrandie', async () => {
    await mount({ big: true });
    const grab = screen.getByRole('button', { name: 'Réduire la carte' });
    expect(grab.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('LiveMap : l’hôte peut changer de carte', () => {
  it('une carte vide qui reçoit des données se charge alors', async () => {
    const empty = makeProps({ routeGeojson: null, stages: [], origin: null, nights: [], points: [], coords: [] });
    const { rerender } = render(<LiveMap {...empty} />);
    await settle();
    expect(registry.maps).toHaveLength(0);
    rerender(<LiveMap {...makeProps()} />);
    await waitFor(() => expect(registry.maps).toHaveLength(1));
  });

  it('rendre le composant sans fournisseur de langue ne casse pas (français par défaut)', async () => {
    const ui: ReactElement = <LiveMap {...makeProps()} />;
    render(ui);
    await waitFor(() => expect(registry.maps).toHaveLength(1));
    expect(registry.maps[0]).toBeInstanceOf(FakeMap);
  });
});
