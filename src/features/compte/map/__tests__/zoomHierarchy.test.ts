import { describe, expect, it } from 'vitest';
import { MAP_ZOOM_PRIORITY, clusterByScreenDistance, resolveMapZoomConfig } from '../zoomHierarchy';

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
    expect(resolveMapZoomConfig(8).pois).toBe('hidden');
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
