import { describe, expect, it } from 'vitest';

import { buildPoiTooltipModel } from '../../src/components/map/engine/poiTooltip';

describe('POI — modele de tooltip Liquid Glass', () => {
  it('conserve les donnees reelles et les rend lisibles sur mobile', () => {
    expect(
      buildPoiTooltipModel({
        name: 'Point de vue JA.2',
        category: 'viewpoint',
        altitude: 312,
        description: '  Panorama dégagé sur la vallée.  ',
        visited: true,
        stepLabel: 'Étape 2',
        verified: true,
      }),
    ).toEqual({
      title: 'Point de vue JA.2',
      categoryLabel: 'Point de vue',
      altitudeLabel: '312 m',
      description: 'Panorama dégagé sur la vallée.',
      badges: ['Déjà visité', 'Étape 2', 'Vérifié'],
    });
  });

  it('utilise des libelles francais et des fallbacks robustes', () => {
    expect(
      buildPoiTooltipModel({
        name: '   ',
        category: 'water',
        altitude: 'inconnu',
        details: 'Source naturelle',
      }),
    ).toEqual({
      title: "Point d’intérêt",
      categoryLabel: "Point d'eau",
      altitudeLabel: null,
      description: 'Source naturelle',
      badges: [],
    });
  });

  it('normalise une categorie inconnue sans exposer de valeur brute', () => {
    expect(buildPoiTooltipModel({ category: 'point_de_vue_inconnu' })).toEqual({
      title: "Point d’intérêt",
      categoryLabel: 'Point d’intérêt',
      altitudeLabel: null,
      description: '',
      badges: [],
    });
  });
});
