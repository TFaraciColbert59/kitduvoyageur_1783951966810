import { describe, expect, it, beforeEach } from 'vitest';
import { useExplorerStore } from '@/features/explorer-v2/state/store';
import { HAPTIC_TABLE, haptic, resetHapticThrottle } from '@/features/explorer-v2/state/haptics';
import { SCENES, SCENE_NAMES, LEVEL_ZOOM, isSceneName } from '@/features/explorer-v2/state/scenes';
import { evaluateOffRoute, offRouteLabel } from '@/features/explorer-v2/activity/offRoute';
import { poiPriority, selectVisiblePins, symbolSortKey } from '@/features/explorer-v2/map/hierarchy';
import { TRACE_STYLES, traceStyleForRoute } from '@/features/explorer-v2/map/traceStyles';
import {
  distanceKm,
  findRegionAt,
  formatDistance,
  formatDuration,
  pointInRing,
} from '@/features/explorer-v2/sheet/context';

describe('explorer-v2 · machine d’état', () => {
  beforeEach(() => {
    useExplorerStore.setState({
      level: 0,
      geo: '',
      sheet: 'level',
      detent: 'peek',
      tab: 0,
      selection: undefined,
      activity: undefined,
      center: [2.35, 48.85],
      zoom: 1.6,
    });
  });

  it('ouvre un pays : niveau 1, geo, centre et caméra', () => {
    useExplorerStore.getState().openCountry('FR', [2.35, 46.6], 'France');
    const state = useExplorerStore.getState();
    expect(state.level).toBe(1);
    expect(state.geo).toBe('FR');
    expect(state.zoom).toBe(LEVEL_ZOOM[1]);
    expect(state.camera).toEqual({ type: 'level', level: 1, center: [2.35, 46.6] });
  });

  it('descend puis remonte : région → lieu → retour', () => {
    const store = useExplorerStore.getState();
    store.openCountry('FR', [2.35, 46.6], 'France');
    store.openRegion('Auvergne-Rhône-Alpes', [4.83, 45.76], 'ARA');
    expect(useExplorerStore.getState().level).toBe(2);
    expect(useExplorerStore.getState().regionId).toBe('Auvergne-Rhône-Alpes');
    store.openPlace('chamonix', [6.8694, 45.9237], 'Chamonix');
    expect(useExplorerStore.getState().level).toBe(3);
    useExplorerStore.getState().goUp();
    expect(useExplorerStore.getState().level).toBe(2);
    expect(useExplorerStore.getState().placeId).toBeUndefined();
  });

  it('sélectionne un repère et ouvre la feuille correspondante', () => {
    useExplorerStore.getState().select({ kind: 'water', id: 'n123' }, 'water', 'mid');
    const state = useExplorerStore.getState();
    expect(state.sheet).toBe('water');
    expect(state.detent).toBe('mid');
    expect(state.selection).toEqual({ kind: 'water', id: 'n123' });
    expect(state.tab).toBe(0);
  });

  it('démarre et arrête une activité', () => {
    useExplorerStore.getState().startActivity('rando', 'session-test');
    const started = useExplorerStore.getState();
    expect(started.activity?.sport).toBe('rando');
    expect(started.camera).toEqual({ type: 'follow' });
    expect(started.sheet).toBe('live');
    useExplorerStore.getState().updateActivity({ offRoute: true, distanceM: 1200 });
    expect(useExplorerStore.getState().activity?.distanceM).toBe(1200);
    useExplorerStore.getState().stopActivity();
    expect(useExplorerStore.getState().activity).toBeUndefined();
    expect(useExplorerStore.getState().sheet).toBe('summary');
  });

  it('journalise les événements pour l’inventaire de clics', () => {
    const target = globalThis as unknown as {
      window?: { __explorerEvents?: Array<{ event: string }> };
    };
    target.window = target.window ?? {};
    target.window.__explorerEvents = [];
    useExplorerStore.getState().setTab(2);
    expect(target.window.__explorerEvents?.some((event) => event.event === 'tab')).toBe(true);
  });
});

describe('explorer-v2 · haptique', () => {
  it('couvre les 14 événements du design', () => {
    expect(Object.keys(HAPTIC_TABLE)).toHaveLength(14);
    expect(HAPTIC_TABLE.countdown).toBe('rigid');
    expect(HAPTIC_TABLE.tab).toBe('selection');
    expect(HAPTIC_TABLE['off-route']).toBe('warning');
  });

  it('n’émet pas deux retours à moins de 80 ms', () => {
    resetHapticThrottle();
    expect(haptic('tab', 1000)).toBe(true);
    expect(haptic('tab', 1050)).toBe(false);
    expect(haptic('tab', 1081)).toBe(true);
  });
});

describe('explorer-v2 · scènes', () => {
  it('déclare les 41 scènes de la maquette', () => {
    expect(SCENE_NAMES.length).toBe(41);
  });

  it('a un état complet pour chaque scène', () => {
    for (const name of SCENE_NAMES) {
      const preset = SCENES[name];
      expect(preset, name).toBeTruthy();
      expect(typeof preset.level, name).toBe('number');
      expect(preset.center, name).toHaveLength(2);
      expect(preset.detent, name).toMatch(/peek|low|mid|full/);
    }
  });

  it('reconnaît les noms de scène', () => {
    expect(isSceneName('monde')).toBe(true);
    expect(isSceneName('inconnu')).toBe(false);
  });
});

describe('explorer-v2 · géométrie', () => {
  it('calcule une distance haversine', () => {
    const km = distanceKm([6.8694, 45.9237], [6.838, 45.9442]);
    expect(km).toBeGreaterThan(2.5);
    expect(km).toBeLessThan(4);
  });

  it('formate distances et durées', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(9.06)).toBe('9,1 km');
    expect(formatDistance(42.6)).toBe('43 km');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(3661)).toBe('1 h 01');
  });

  it('teste l’appartenance d’un point à un anneau', () => {
    const ring = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ];
    expect(pointInRing([5, 5], ring)).toBe(true);
    expect(pointInRing([15, 5], ring)).toBe(false);
  });

  it('trouve la région sous un point (Natural Earth)', () => {
    const geo = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: 'Haute-Savoie', group: 'Auvergne-Rhône-Alpes', iso_a2: 'FR' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [6.7, 45.8],
                [6.7, 46.1],
                [7.0, 46.1],
                [7.0, 45.8],
                [6.7, 45.8],
              ],
            ],
          },
        },
      ],
    };
    const found = findRegionAt(geo, [6.8694, 45.9237]);
    expect(found?.group).toBe('Auvergne-Rhône-Alpes');
    expect(findRegionAt(geo, [2.35, 48.85])).toBeNull();
  });
});

describe('explorer-v2 · hiérarchie carte', () => {
  it('classe les dangers en P0 à tous les niveaux', () => {
    expect(poiPriority('danger', 0)).toBe(0);
    expect(poiPriority('danger', 3)).toBe(0);
    expect(poiPriority('bivouac', 3)).toBe(3);
    expect(poiPriority('trail', 0)).toBe(1);
    expect(poiPriority('trail', 3)).toBe(0);
  });

  it('écarte les repères sous le tiroir et hors champ', () => {
    const pins = [
      { id: 'a', kind: 'water' as const, x: 100, y: 200, distanceKm: 1 },
      { id: 'b', kind: 'water' as const, x: 100, y: 900, distanceKm: 0.2 },
      { id: 'c', kind: 'summit' as const, x: -120, y: 200, distanceKm: 2 },
    ];
    const kept = selectVisiblePins(pins, {
      level: 3,
      sheetTop: 600,
      viewport: { width: 390, height: 844 },
    });
    expect(kept.map((pin) => pin.id)).toEqual(['a']);
  });

  it('priorité puis proximité, et densité bornée par cellule', () => {
    const pins = Array.from({ length: 10 }, (_, index) => ({
      id: `p${index}`,
      kind: (index === 9 ? 'danger' : 'bivouac') as 'danger' | 'bivouac',
      x: 10 + index,
      y: 10 + index,
      distanceKm: index,
    }));
    const kept = selectVisiblePins(pins, {
      level: 3,
      sheetTop: 700,
      viewport: { width: 390, height: 844 },
      maxPerCell: 3,
    });
    // Le danger (P0) passe devant malgré sa distance, et la cellule est plafonnée.
    expect(kept).toHaveLength(3);
    expect(kept[0].id).toBe('p9');
  });

  it('en activité, les repères secondaires reculent', () => {
    const pins = [{ id: 'v', kind: 'viewpoint' as const, x: 50, y: 50, distanceKm: 0 }];
    const normal = selectVisiblePins(pins, {
      level: 3,
      sheetTop: 700,
      viewport: { width: 390, height: 844 },
    });
    const live = selectVisiblePins(pins, {
      level: 3,
      sheetTop: 700,
      viewport: { width: 390, height: 844 },
      activity: true,
    });
    expect(normal).toHaveLength(1);
    expect(live).toHaveLength(1);
    expect(symbolSortKey('viewpoint', 3, 0)).toBeGreaterThan(symbolSortKey('danger', 3, 10));
  });
});

describe('explorer-v2 · styles de tracés', () => {
  it('expose les 13 styles de la planche Traces', () => {
    expect(Object.keys(TRACE_STYLES)).toHaveLength(13);
    expect(TRACE_STYLES.gr.dash).toEqual([2, 1.4]);
    expect(TRACE_STYLES.itineraire.casing).toBe('#FFFFFF');
  });

  it('déduit le style du réseau OSM', () => {
    expect(traceStyleForRoute('nwn')).toBe('gr');
    expect(traceStyleForRoute('iwn')).toBe('gr');
    expect(traceStyleForRoute('rwn')).toBe('pr');
    expect(traceStyleForRoute('lwn')).toBe('variante');
    expect(traceStyleForRoute(null)).toBe('itineraire');
  });
});

describe('explorer-v2 · hors itinéraire', () => {
  const at = (seconds: number, distanceM: number) => ({ t: seconds * 1000, distanceM });

  it('ne déclenche pas avant 15 s au-delà de 40 m', () => {
    const samples = [at(0, 10), at(5, 45), at(10, 60), at(14, 55)];
    expect(evaluateOffRoute(samples).offRoute).toBe(false);
  });

  it('déclenche après 15 s continus hors trace', () => {
    const samples = [at(0, 10), at(5, 45), at(20, 80)];
    const state = evaluateOffRoute(samples);
    expect(state.offRoute).toBe(true);
    expect(state.distanceM).toBe(80);
  });

  it('revient sur la trace sous 25 m', () => {
    const samples = [at(0, 10), at(5, 45), at(20, 80), at(25, 20)];
    const state = evaluateOffRoute(samples, { offRoute: true, distanceM: 80, outSinceS: 15 });
    expect(state.offRoute).toBe(false);
  });

  it('reste hors trace entre 25 et 40 m (hystérésis)', () => {
    const state = evaluateOffRoute([at(30, 32)], { offRoute: true, distanceM: 40, outSinceS: 20 });
    expect(state.offRoute).toBe(true);
  });

  it('formate le libellé de la carte du haut', () => {
    expect(offRouteLabel(80)).toBe('Hors itinéraire · 80 m');
  });
});
