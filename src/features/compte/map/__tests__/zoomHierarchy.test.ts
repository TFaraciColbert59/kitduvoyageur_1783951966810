import { describe, expect, it } from 'vitest';
import {
  MAP_ZOOM_PRIORITY,
  clusterByScreenDistance,
  isInsideViewport,
  isOverlayEntryVisible,
  resolveMapZoomConfig,
  resolveNativeLayerVisibility,
  simplifyCoordinates,
} from '../zoomHierarchy';

describe('simplifyCoordinates', () => {
  const trace = (length: number, offset = 0) =>
    Array.from({ length }, (_, index) => ({
      id: index + offset,
      lng: index + offset,
      lat: -(index + offset),
    }));

  it('renvoie la trace courte telle quelle, par identité', () => {
    const short = trace(20);
    expect(simplifyCoordinates(short)).toBe(short);
    const tiny = trace(3);
    expect(simplifyCoordinates(tiny)).toBe(tiny);
  });

  it('borne une trace longue à 20 points', () => {
    const simplified = simplifyCoordinates(trace(120));
    expect(simplified).toHaveLength(20);
    expect(simplified.length).toBeLessThanOrEqual(20);
  });

  it('garde toujours le premier et le dernier point', () => {
    const long = trace(87, 5);
    const simplified = simplifyCoordinates(long);
    expect(simplified[0]).toBe(long[0]);
    expect(simplified[simplified.length - 1]).toBe(long[long.length - 1]);
  });

  it('produit un échantillonnage stable et sans doublon', () => {
    const long = trace(97);
    const first = simplifyCoordinates(long);
    const second = simplifyCoordinates(long);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });

  it('respecte une borne personnalisée', () => {
    const long = trace(50);
    const simplified = simplifyCoordinates(long, 5);
    expect(simplified).toHaveLength(5);
    expect(simplified[0]).toBe(long[0]);
  });
});

describe('resolveMapZoomConfig', () => {
  it('classe les quatre bandes aux seuils exacts', () => {
    expect(resolveMapZoomConfig(4.49).band).toBe('world');
    expect(resolveMapZoomConfig(4.5).band).toBe('country');
    expect(resolveMapZoomConfig(6.49).band).toBe('country');
    expect(resolveMapZoomConfig(6.5).band).toBe('region');
    expect(resolveMapZoomConfig(9.99).band).toBe('region');
    expect(resolveMapZoomConfig(10).band).toBe('place');
  });

  it('garde des tailles fixes par bande', () => {
    expect(resolveMapZoomConfig(3).trackWidth).toBe(1.5);
    expect(resolveMapZoomConfig(5).trackWidth).toBe(2);
    expect(resolveMapZoomConfig(8).trackWidth).toBe(3.5);
    expect(resolveMapZoomConfig(12).trackWidth).toBe(4);
  });

  it('masque les POI hors de la bande lieu', () => {
    expect(resolveMapZoomConfig(3).pois).toBe('hidden');
    expect(resolveMapZoomConfig(8).pois).toBe('pills');
    expect(resolveMapZoomConfig(12).pois).toBe('pills');
  });

  it('expose la visibilité de chaque couche par bande', () => {
    const world = resolveMapZoomConfig(3);
    expect(world.massifs).toBe('clustered');
    expect(world.carnets).toBe('hidden');
    expect(world.endpoints).toBe('hidden');
    expect(world.trackSimplified).toBe(true);
    expect(world.casing).toBe(false);
    expect(world.glow).toBe(false);

    const country = resolveMapZoomConfig(5);
    expect(country.massifs).toBe('clustered');
    expect(country.carnets).toBe('hidden');
    expect(country.endpoints).toBe('hidden');

    const region = resolveMapZoomConfig(8);
    expect(region.massifs).toBe('individual');
    expect(region.carnets).toBe('dots');
    expect(region.endpoints).toBe('dots');
    expect(region.trackSimplified).toBe(false);
    expect(region.casing).toBe(true);
    expect(region.glow).toBe(true);

    const place = resolveMapZoomConfig(12);
    expect(place.massifs).toBe('individual');
    expect(place.carnets).toBe('pills');
    expect(place.endpoints).toBe('dots');
  });

  it('garde une taille de point stable dans une même bande', () => {
    // Aucune taille ne doit grossir au dézoom : à bande égale, largeur égale.
    expect(resolveMapZoomConfig(6.5).trackWidth).toBe(resolveMapZoomConfig(9.99).trackWidth);
    expect(resolveMapZoomConfig(10).trackWidth).toBe(resolveMapZoomConfig(16).trackWidth);
    expect(resolveMapZoomConfig(0).trackWidth).toBe(resolveMapZoomConfig(4.49).trackWidth);
  });

  it('applique la priorité d’empilement documentée', () => {
    expect(MAP_ZOOM_PRIORITY).toEqual(['selected', 'poi', 'carnet', 'massif', 'endpoint', 'track']);
  });
});

describe('clusterByScreenDistance', () => {
  it('regroupe les points à moins de 40 px', () => {
    const clusters = clusterByScreenDistance(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      (item) => ({ a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, c: { x: 100, y: 0 } })[item.id]!,
      40
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0].items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(clusters[0].x).toBe(10);
  });

  it('place le centre du massif sur la moyenne de ses membres', () => {
    const clusters = clusterByScreenDistance(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      (item) => ({ a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, c: { x: 10, y: 20 } })[item.id]!,
      40
    );
    expect(clusters).toHaveLength(1);
    // Moyenne des trois membres, pas le milieu de la première paire.
    expect(clusters[0].x).toBeCloseTo((0 + 20 + 10) / 3);
    expect(clusters[0].y).toBeCloseTo((0 + 0 + 20) / 3);
  });

  it('mesure le rayon depuis le centre courant, pas entre voisins', () => {
    // a -> b -> c : chaque voisin est à 35 px du précédent, mais c est à 70 px de a.
    // Après a et b, le centre vaut 17,5 : c est à 52,5 px du centre, donc il ne rejoint pas.
    const clusters = clusterByScreenDistance(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      (item) => ({ a: { x: 0, y: 0 }, b: { x: 35, y: 0 }, c: { x: 70, y: 0 } })[item.id]!,
      40
    );
    expect(clusters.map((cluster) => cluster.items.map((item) => item.id))).toEqual([
      ['a', 'b'],
      ['c'],
    ]);
  });

  it('documente la dérive du centre : aucune borne d’emprise de massif', () => {
    // Chaque point reste à moins de 40 px du centre courant au moment de son insertion,
    // alors que l'emprise totale (83,33 px) dépasse le rayon. Comportement attendu, pas un bug :
    // le contrat est « rayon depuis le centre à l'insertion », pas « diamètre borné ».
    const xs = { a: 0, b: 40, c: 60, d: 73.33, e: 83.33 };
    const clusters = clusterByScreenDistance(
      ['a', 'b', 'c', 'd', 'e'] as const,
      (id) => ({ x: xs[id], y: 0 }),
      40
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(clusters[0].x).toBeCloseTo((0 + 40 + 60 + 73.33 + 83.33) / 5);
    expect(xs.e - xs.a).toBeGreaterThan(40);
  });

  it('fait absorber par le premier massif compatible, dans l’ordre d’entrée', () => {
    // a crée cluster-0 (0), b crée cluster-1 (80), puis c (40) est à 40 px du centre de
    // cluster-0 et à 40 px de cluster-1 : le premier compatible l'emporte, sans retrier.
    const clusters = clusterByScreenDistance(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      (item) => ({ a: { x: 0, y: 0 }, b: { x: 80, y: 0 }, c: { x: 40, y: 0 } })[item.id]!,
      40
    );
    expect(clusters.map((cluster) => cluster.id)).toEqual(['cluster-0', 'cluster-1']);
    expect(clusters[0].items.map((item) => item.id)).toEqual(['a', 'c']);
    expect(clusters[0].x).toBe(20);
    expect(clusters[1].items.map((item) => item.id)).toEqual(['b']);
    expect(clusters[1].x).toBe(80);
  });

  it('garde le rayon de 40 px : 40 px agrège, 41 px sépare', () => {
    const atDistance = (distance: number) =>
      clusterByScreenDistance(
        [{ id: 'a' }, { id: 'b' }],
        (item) => (item.id === 'a' ? { x: 0, y: 0 } : { x: distance, y: 0 }),
        40
      );
    expect(atDistance(40)).toHaveLength(1);
    expect(atDistance(41)).toHaveLength(2);
  });

  it('rend un ordre de sortie stable, ancré sur l’ordre d’entrée', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const pointOf = (item: { id: string }) =>
      ({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, c: { x: 100, y: 0 }, d: { x: 110, y: 0 } })[
        item.id
      ]!;
    const first = clusterByScreenDistance(items, pointOf, 40);
    const second = clusterByScreenDistance(items, pointOf, 40);

    expect(first).toEqual(second);
    expect(first.map((cluster) => cluster.id)).toEqual(['cluster-0', 'cluster-1']);
    expect(first.map((cluster) => cluster.items.map((item) => item.id))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('rend un tableau vide sans point à agrégrer', () => {
    expect(clusterByScreenDistance([], () => ({ x: 0, y: 0 }), 40)).toEqual([]);
  });

  it('agrège un point isolé en massif à un seul membre', () => {
    const clusters = clusterByScreenDistance([{ id: 'solo' }], () => ({ x: 12, y: -8 }), 40);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toEqual({ id: 'cluster-0', items: [{ id: 'solo' }], x: 12, y: -8 });
  });
});

describe('isInsideViewport', () => {
  const viewport = { width: 400, height: 600 };

  it('garde les POI dans le viewport avec 24 px de marge', () => {
    expect(isInsideViewport({ x: 24, y: 24 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 23, y: 100 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 200, y: 590 }, viewport, 24)).toBe(true);
  });

  it('élargit le cadre de la marge : 24 px dehors passe, 25 px dehors non', () => {
    expect(isInsideViewport({ x: -24, y: 300 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: -25, y: 300 }, viewport, 24)).toBe(false);
    expect(isInsideViewport({ x: 424, y: 300 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 425, y: 300 }, viewport, 24)).toBe(false);
    expect(isInsideViewport({ x: 200, y: -24 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 200, y: -25 }, viewport, 24)).toBe(false);
    expect(isInsideViewport({ x: 200, y: 624 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 200, y: 625 }, viewport, 24)).toBe(false);
  });

  it('borne les quatre coins, marge comprise', () => {
    expect(isInsideViewport({ x: -24, y: -24 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 424, y: 624 }, viewport, 24)).toBe(true);
    expect(isInsideViewport({ x: 424, y: -25 }, viewport, 24)).toBe(false);
    expect(isInsideViewport({ x: -25, y: 624 }, viewport, 24)).toBe(false);
  });

  it('traite une marge nulle comme le cadre strict, bornes incluses', () => {
    expect(isInsideViewport({ x: 0, y: 0 }, viewport, 0)).toBe(true);
    expect(isInsideViewport({ x: 400, y: 600 }, viewport, 0)).toBe(true);
    expect(isInsideViewport({ x: -1, y: 300 }, viewport, 0)).toBe(false);
    expect(isInsideViewport({ x: 200, y: 601 }, viewport, 0)).toBe(false);
  });

  it('lit un viewport de taille nulle sans accepter un point au-delà de la marge', () => {
    expect(isInsideViewport({ x: 0, y: 0 }, { width: 0, height: 0 }, 24)).toBe(true);
    expect(isInsideViewport({ x: 24, y: 24 }, { width: 0, height: 0 }, 24)).toBe(true);
    expect(isInsideViewport({ x: 25, y: 0 }, { width: 0, height: 0 }, 24)).toBe(false);
  });
});

describe('isOverlayEntryVisible', () => {
  it('au zoom 3 (Monde) : ni POI ni carnet, massifs toujours là', () => {
    const band = resolveMapZoomConfig(3);
    expect(isOverlayEntryVisible('poi', band, true)).toBe(false);
    expect(isOverlayEntryVisible('carnet', band, true)).toBe(false);
    expect(isOverlayEntryVisible('massif', band, true)).toBe(true);
  });

  it('au zoom 8 (Région) : carnets et POI visibles', () => {
    const band = resolveMapZoomConfig(8);
    expect(band.carnets).toBe('dots');
    expect(isOverlayEntryVisible('carnet', band, true)).toBe(true);
    expect(isOverlayEntryVisible('poi', band, true)).toBe(true);
    expect(isOverlayEntryVisible('massif', band, true)).toBe(true);
  });

  it('au zoom 12 (Lieu) : POI et carnets visibles s’ils sont dans le cadre', () => {
    const band = resolveMapZoomConfig(12);
    expect(isOverlayEntryVisible('poi', band, true)).toBe(true);
    expect(isOverlayEntryVisible('carnet', band, true)).toBe(true);
    expect(isOverlayEntryVisible('massif', band, true)).toBe(true);
  });

  it('hors du viewport, aucun type n’est visible, quelle que soit la bande', () => {
    for (const zoom of [3, 8, 12]) {
      const band = resolveMapZoomConfig(zoom);
      for (const kind of ['poi', 'carnet', 'massif'] as const) {
        expect(isOverlayEntryVisible(kind, band, false)).toBe(false);
      }
    }
  });

  it('le massif ignore la bande : seule la projection décide', () => {
    const hidden = { ...resolveMapZoomConfig(12), carnets: 'hidden' as const, pois: 'hidden' as const };
    expect(isOverlayEntryVisible('massif', hidden, true)).toBe(true);
    expect(isOverlayEntryVisible('carnet', hidden, true)).toBe(false);
    expect(isOverlayEntryVisible('poi', hidden, true)).toBe(false);
  });
});

describe('resolveNativeLayerVisibility', () => {
  const mode = { pois: true, outingPins: true, tracks: true };

  it('masque les couches POI natives hors bande `pills`', () => {
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(3)).pois).toBe(false);
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(8)).pois).toBe(true);
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(12)).pois).toBe(true);
  });

  it('masque départs et arrivées en Monde/Pays, les montre en Région/Lieu', () => {
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(3))).toMatchObject({
      trackStarts: false,
      trackEnds: false,
    });
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(5))).toMatchObject({
      trackStarts: false,
      trackEnds: false,
    });
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(8))).toMatchObject({
      trackStarts: true,
      trackEnds: true,
    });
    expect(resolveNativeLayerVisibility(mode, resolveMapZoomConfig(12))).toMatchObject({
      trackStarts: true,
      trackEnds: true,
    });
  });

  it('ne ressuscite jamais une couche que le mode refuse', () => {
    const off = { pois: false, outingPins: false, tracks: false };
    const place = resolveMapZoomConfig(14);
    expect(resolveNativeLayerVisibility(off, place)).toEqual({
      pois: false,
      trackStarts: false,
      trackEnds: false,
      casing: false,
      glow: false,
    });
  });

  it('garde casing et glow liés à la bande et aux traces du mode', () => {
    const world = resolveNativeLayerVisibility({ pois: false, outingPins: false, tracks: true }, resolveMapZoomConfig(3));
    expect(world).toMatchObject({ casing: false, glow: false });
    const place = resolveNativeLayerVisibility({ pois: false, outingPins: false, tracks: true }, resolveMapZoomConfig(12));
    expect(place).toMatchObject({ casing: true, glow: true });
  });
});
