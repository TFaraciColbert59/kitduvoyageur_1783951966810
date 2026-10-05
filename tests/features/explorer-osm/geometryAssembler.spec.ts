import { describe, it, expect } from 'vitest';
import {
  assembleContinuousLines,
  assembleOsmRelationGeometry,
  calculateBboxGeodesicAreaKm2,
  calculateLineDistanceKm,
  computeGeometryHash,
  haversineDistanceKm,
  hierarchyToGeoJsonMultiLineString,
  hierarchyToMultiLineString,
  normalizeMemberRole,
  type RawOsmMemberGeometry,
} from '@/features/explorer-osm/domain/geometry';

describe('Geometry Assembler — Validation et Assemblage OSM', () => {
  it('haversineDistanceKm calcule la distance orthodromique réelle', () => {
    // Paris [2.3522, 48.8566] -> Lyon [4.8357, 45.7640] (~391 km)
    const dist = haversineDistanceKm([2.3522, 48.8566], [4.8357, 45.764]);
    expect(dist).toBeGreaterThan(385);
    expect(dist).toBeLessThan(400);
  });

  it('assemble une route simple continue (complete)', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 101,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 102,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.01 }, // Connecté exactement
          { lat: 45.02, lon: 6.02 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.status).toBe('complete');
    expect(hierarchy.gapCount).toBe(0);
    expect(hierarchy.mainSegments).toHaveLength(2);
    expect(hierarchy.totalDistanceKm).toBeGreaterThan(0);

    // Vérifie que les segments raccordés sont assemblés en un LineString continu
    const lineString = hierarchyToMultiLineString(hierarchy);
    expect(lineString?.type).toBe('LineString');
    if (lineString?.type === 'LineString') {
      expect(lineString.coordinates).toEqual([
        [6.0, 45.0],
        [6.01, 45.01],
        [6.02, 45.02],
      ]);
    }
  });

  it('gère les segments inversés sans rupture', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 201,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 202,
        role: 'main',
        // Segment orienté en sens inverse (fin à 45.01, début à 45.02)
        geometry: [
          { lat: 45.02, lon: 6.02 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.status).toBe('complete');
    expect(hierarchy.gapCount).toBe(0);
    // Le segment 2 doit avoir été inversé pour se connecter
    expect(hierarchy.mainSegments[1].isReversed).toBe(true);
    expect(hierarchy.mainSegments[1].coordinates[0]).toEqual([6.01, 45.01]);
  });

  it('détecte les ruptures (> 35m) et classe le tracé en partial SANS inventer de ligne', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 301,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 302,
        role: 'main',
        // Segment situé 2 km plus loin (rupture manifeste)
        geometry: [
          { lat: 45.03, lon: 6.03 },
          { lat: 45.04, lon: 6.04 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.status).toBe('partial');
    expect(hierarchy.gapCount).toBeGreaterThanOrEqual(1);
    expect(hierarchy.warnings.some((w) => w.includes('Tracé partiel'))).toBe(true);

    // Vérifie que les coordonnées ne sont PAS reliées par une fausse ligne droite
    const multiLine = hierarchyToMultiLineString(hierarchy);
    expect(multiLine).not.toBeNull();
    expect(multiLine?.type).toBe('MultiLineString');
    if (multiLine?.type === 'MultiLineString') {
      expect(multiLine.coordinates).toHaveLength(2);
      // Segment 1 finit à [6.01, 45.01], segment 2 commence à [6.03, 45.03]
      expect(multiLine.coordinates[0][1]).toEqual([6.01, 45.01]);
      expect(multiLine.coordinates[1][0]).toEqual([6.03, 45.03]);
    }
  });

  it('sépare rigoureusement les rôles (main, alternative, approach, excursion, connection)', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 1,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 2,
        role: 'alternative',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.015, lon: 6.015 },
        ],
      },
      {
        type: 'way',
        ref: 3,
        role: 'approach',
        geometry: [
          { lat: 44.99, lon: 5.99 },
          { lat: 45.0, lon: 6.0 },
        ],
      },
      {
        type: 'way',
        ref: 4,
        role: 'excursion',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          { lat: 45.02, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 5,
        role: 'connection',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          { lat: 45.01, lon: 6.03 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.mainSegments).toHaveLength(1);
    expect(hierarchy.alternatives).toHaveLength(1);
    expect(hierarchy.approaches).toHaveLength(1);
    expect(hierarchy.excursions).toHaveLength(1);
    expect(hierarchy.connections).toHaveLength(1);
  });

  it('gère une sous-relation non résolue sans crasher', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'relation',
        ref: 99999,
        role: 'part',
      },
      {
        type: 'way',
        ref: 1,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.mainSegments).toHaveLength(1);
    expect(hierarchy.warnings.some((w) => w.includes('Sous-relation non résolue'))).toBe(true);
  });

  it('rejette les points corrompus (NaN, null, hors bornes) et conserve les points valides', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 501,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: NaN, lon: 6.01 }, // Invalide
          { lat: 195.0, lon: 6.02 }, // Hors borne lat > 90
          { lat: 45.02, lon: 6.02 }, // Valide
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.mainSegments).toHaveLength(1);
    expect(hierarchy.mainSegments[0].coordinates).toEqual([
      [6.0, 45.0],
      [6.02, 45.02],
    ]);
    expect(hierarchy.warnings.some((w) => w.includes('coordonnées invalides rejetées'))).toBe(true);
  });

  it('déclare unavailable si aucun point valide n’existe', () => {
    const hierarchy = assembleOsmRelationGeometry([]);
    expect(hierarchy.status).toBe('unavailable');
    expect(hierarchy.mainSegments).toHaveLength(0);
  });

  it('assemble des segments fournis dans le désordre et inversés en tracé continu sans fausse brèche', () => {
    // 3 segments ordonnés physiquement: 101 -> 102 -> 103
    // Mais fournis dans la relation sous l'ordre: [102, 103 (inversé), 101]
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 102,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          { lat: 45.02, lon: 6.02 },
        ],
      },
      {
        type: 'way',
        ref: 103,
        role: 'main',
        // Segment 103 inversé: commence à 45.03 et finit à 45.02
        geometry: [
          { lat: 45.03, lon: 6.03 },
          { lat: 45.02, lon: 6.02 },
        ],
      },
      {
        type: 'way',
        ref: 101,
        role: 'main',
        // Segment 101: se connecte au début de 102 (prepend)
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.status).toBe('complete');
    expect(hierarchy.gapCount).toBe(0);
    expect(hierarchy.mainSegments).toHaveLength(3);
    // Le premier segment doit être 101
    expect(hierarchy.mainSegments[0].id).toBe('101');
    // Le second segment doit être 102
    expect(hierarchy.mainSegments[1].id).toBe('102');
    // Le troisième segment doit être 103 inversé
    expect(hierarchy.mainSegments[2].id).toBe('103');
    expect(hierarchy.mainSegments[2].isReversed).toBe(true);
  });

  it('détecte automatiquement les boucles fermées géométriques (isLoop: true)', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 1,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.0 },
        ],
      },
      {
        type: 'way',
        ref: 2,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 3,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          { lat: 45.0, lon: 6.0 }, // Reboucle sur le point de départ
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    expect(hierarchy.status).toBe('complete');
    expect(hierarchy.gapCount).toBe(0);
    expect(hierarchy.isLoop).toBe(true);
  });

  it('garantit un MultiLineString GeoJSON valide pour PostGIS même pour 1 ligne unique', () => {
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 1,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);
    const postGisMls = hierarchyToGeoJsonMultiLineString(hierarchy);
    expect(postGisMls).not.toBeNull();
    if (!postGisMls) return;
    expect(postGisMls.type).toBe('MultiLineString');
    expect(postGisMls.coordinates).toHaveLength(1);
    expect(postGisMls.coordinates[0]).toEqual([
      [6.0, 45.0],
      [6.01, 45.01],
    ]);
  });

  it('TEST STRICT : deux segments espacés de 20 m NE SONT PAS raccordés -> gapCount > 0 -> partial', () => {
    // Écart de 20 mètres à lat 45° : ~0.00018 degré de latitude
    const deltaLat20m = 20 / 111139; // ~20m
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 701,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 702,
        role: 'main',
        // Démarre 20 mètres après la fin du segment 701
        geometry: [
          { lat: 45.01 + deltaLat20m, lon: 6.01 },
          { lat: 45.02, lon: 6.02 },
        ],
      },
    ];

    const hierarchy = assembleOsmRelationGeometry(members);

    // Vérifications strictes demandées :
    // 1. NE SONT PAS raccordés
    expect(hierarchy.gapCount).toBeGreaterThan(0);
    // 2. Statut partial
    expect(hierarchy.status).toBe('partial');
    // 3. Deux lignes séparées dans le MultiLineString (aucune invention de segment de raccord)
    const mls = hierarchyToMultiLineString(hierarchy);
    expect(mls?.type).toBe('MultiLineString');
    if (mls?.type === 'MultiLineString') {
      expect(mls.coordinates).toHaveLength(2);
    }
  });

  it('TEST BORNE : test à proximité immédiate de la limite (2m raccordé vs 3m non raccordé)', () => {
    const deltaLat2m = 2.0 / 111139; // ~2.0 mètres (< 2.5m tolérance numérique)
    const deltaLat3m = 3.5 / 111139; // ~3.5 mètres (> 2.5m tolérance numérique)

    // Cas 1 : 2.0 mètres -> Raccordé (imprécision numérique acceptée)
    const membersConnected: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 801,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 802,
        role: 'main',
        geometry: [
          { lat: 45.01 + deltaLat2m, lon: 6.01 },
          { lat: 45.02, lon: 6.02 },
        ],
      },
    ];
    const resConnected = assembleOsmRelationGeometry(membersConnected);
    expect(resConnected.gapCount).toBe(0);
    expect(resConnected.status).toBe('complete');

    // Cas 2 : 3.5 mètres -> NON raccordé (écart physique supérieur à la tolérance)
    const membersDisconnected: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 803,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 804,
        role: 'main',
        geometry: [
          { lat: 45.01 + deltaLat3m, lon: 6.01 },
          { lat: 45.02, lon: 6.02 },
        ],
      },
    ];
    const resDisconnected = assembleOsmRelationGeometry(membersDisconnected);
    expect(resDisconnected.gapCount).toBe(1);
    expect(resDisconnected.status).toBe('partial');
  });

  it('TEST BOUCLE : deux extrémités distantes de 49 m NE SONT PAS déclarées boucle sans tag explicite', () => {
    // Écart de 49 mètres entre début et fin
    const deltaLat49m = 49 / 111139;
    const members: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 901,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 902,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          // Fin située à 49 m du départ [6.0, 45.0]
          { lat: 45.0 + deltaLat49m, lon: 6.0 },
        ],
      },
    ];

    // Sans tag source : REFUS de déclarer une boucle fermée (distance > 2m)
    const resNoTag = assembleOsmRelationGeometry(members);
    expect(resNoTag.isLoop).toBe(false);
    expect(resNoTag.loopDetectionMethod).toBe('none');

    // Avec tag explicite roundtrip=yes et départ/arrivée proches (<100m) : acceptée avec méthode conservée
    const resWithTag = assembleOsmRelationGeometry(members, { roundtrip: 'yes' });
    expect(resWithTag.isLoop).toBe(true);
    expect(resWithTag.loopDetectionMethod).toBe('source_tag');

    // Avec boucle géométrique exacte (< 2.0m) : méthode exact_endpoints
    const membersExactLoop: RawOsmMemberGeometry[] = [
      {
        type: 'way',
        ref: 903,
        role: 'main',
        geometry: [
          { lat: 45.0, lon: 6.0 },
          { lat: 45.01, lon: 6.01 },
        ],
      },
      {
        type: 'way',
        ref: 904,
        role: 'main',
        geometry: [
          { lat: 45.01, lon: 6.01 },
          { lat: 45.0, lon: 6.0 }, // Exactement identique
        ],
      },
    ];
    const resExact = assembleOsmRelationGeometry(membersExactLoop);
    expect(resExact.isLoop).toBe(true);
    expect(resExact.loopDetectionMethod).toBe('exact_endpoints');
  });

  it('TEST GÉODÉSIQUE : calcul d’aire sphérique selon la latitude et rejet > 400 km²', () => {
    // 1. Box de taille raisonnable en France (45°N) : 0.15° lat x 0.20° lng
    // ~16.6 km x 15.7 km ~ 260 km² <= 400 km²
    const bboxFrance = {
      south: 45.0,
      north: 45.15,
      west: 6.0,
      east: 6.2,
    };
    const areaFrance = calculateBboxGeodesicAreaKm2(bboxFrance);
    expect(areaFrance).toBeGreaterThan(200);
    expect(areaFrance).toBeLessThan(350);
    expect(areaFrance).toBeLessThanOrEqual(400);

    // 2. Même span en degrés à l'Équateur (0°N) : 1.5° x 1.5°
    // 166.8 km x 166.8 km ~ 27 800 km² >>> 400 km² !
    const bboxEquateur = {
      south: 0.0,
      north: 1.5,
      west: 0.0,
      east: 1.5,
    };
    const areaEquateur = calculateBboxGeodesicAreaKm2(bboxEquateur);
    expect(areaEquateur).toBeGreaterThan(25000);
    expect(areaEquateur).toBeGreaterThan(400);
  });
});


describe('computeGeometryHash — chaque sommet compte (revue Codex)', () => {
  it('déplacer un point intérieur change le hash', async () => {
    const { computeGeometryHash } = await import('@/features/explorer-osm/domain/geometry');
    const base = [{ id: 'w1', coordinates: [[6.1, 45.1], [6.2, 45.2], [6.3, 45.3]] }];
    const moved = [{ id: 'w1', coordinates: [[6.1, 45.1], [6.25, 45.2], [6.3, 45.3]] }];
    expect(computeGeometryHash(base as never)).not.toBe(computeGeometryHash(moved as never));
    expect(computeGeometryHash(base as never)).toBe(computeGeometryHash(base as never));
  });
});
