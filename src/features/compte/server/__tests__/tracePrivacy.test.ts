import { describe, expect, it } from 'vitest';
import type { PrivacyZone } from '../../domain/traceProjection';
import {
  DEFAULT_SHARE_END_MASK_M,
  DEFAULT_SHARE_START_MASK_M,
  mostRestrictiveTraceVisibility,
  projectTraceGeometry,
  projectTraceSamples,
  resolveTraceMasks,
} from '../tracePrivacy';

const line = [
  { lng: 0, lat: 0, elevationM: 100, timestamp: '2026-09-12T06:00:00Z' },
  { lng: 0.005, lat: 0, elevationM: 200, timestamp: '2026-09-12T06:05:00Z' },
  { lng: 0.01, lat: 0, elevationM: 300, timestamp: '2026-09-12T06:10:00Z' },
  { lng: 0.015, lat: 0, elevationM: 400, timestamp: '2026-09-12T06:15:00Z' },
  { lng: 0.02, lat: 0, elevationM: 500, timestamp: '2026-09-12T06:20:00Z' },
];

function squaredMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const earth = 6_371_000;
  const rad = Math.PI / 180;
  const x = (a.lng - b.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad) * earth;
  const y = (a.lat - b.lat) * rad * earth;
  return x * x + y * y;
}

describe('resolveTraceMasks — politique unique', () => {
  it('ne masque rien pour le propriétaire ni pour un participant', () => {
    expect(resolveTraceMasks({ viewer: 'owner' })).toEqual([]);
    expect(resolveTraceMasks({ viewer: 'participant', visibility: 'public' })).toEqual([]);
  });

  it('masque début et fin pour un visiteur d’une trace partagée', () => {
    expect(resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })).toEqual([
      { kind: 'start', meters: DEFAULT_SHARE_START_MASK_M },
      { kind: 'end', meters: DEFAULT_SHARE_END_MASK_M },
    ]);
    expect(resolveTraceMasks({ viewer: 'visitor', visibility: 'collective_anonymized' })).toHaveLength(
      2
    );
  });

  it('masque tout pour un visiteur d’une trace privée (échec fermé)', () => {
    expect(resolveTraceMasks({ viewer: 'visitor', visibility: 'private' })).toEqual([
      { kind: 'all' },
    ]);
  });

  it('masque tout pour une visibilité absente ou inconnue', () => {
    for (const visibility of [null, undefined, '', 'collective', 'amis']) {
      expect(resolveTraceMasks({ viewer: 'visitor', visibility })).toEqual([
        { kind: 'all' },
      ]);
    }
  });

  it('refuse friends/followers à un visiteur non abonné', () => {
    for (const visibility of ['friends', 'followers']) {
      expect(resolveTraceMasks({ viewer: 'visitor', visibility })).toEqual([
        { kind: 'all' },
      ]);
      expect(
        resolveTraceMasks({ viewer: 'follower', visibility })
      ).toEqual([
        { kind: 'start', meters: DEFAULT_SHARE_START_MASK_M },
        { kind: 'end', meters: DEFAULT_SHARE_END_MASK_M },
      ]);
    }
  });

  it('accorde seulement des masques d’extrémités à un abonné vérifié', () => {
    expect(
      resolveTraceMasks({ viewer: 'follower', visibility: 'friends' })
    ).toHaveLength(2);
    expect(
      resolveTraceMasks({ viewer: 'follower', visibility: 'public' })
    ).toHaveLength(2);
    expect(resolveTraceMasks({ viewer: 'follower', visibility: 'private' })).toEqual([
      { kind: 'all' },
    ]);
    expect(resolveTraceMasks({ viewer: 'follower', visibility: null })).toEqual([
      { kind: 'all' },
    ]);
  });

  it('combine carnet et sortie avec la valeur la plus restrictive', () => {
    expect(mostRestrictiveTraceVisibility('public', 'collective_anonymized')).toBe(
      'public'
    );
    expect(mostRestrictiveTraceVisibility('public', 'private')).toBe('private');
    expect(mostRestrictiveTraceVisibility('private', 'collective_anonymized')).toBe(
      'private'
    );
    expect(mostRestrictiveTraceVisibility('public', null)).toBe('private');
    expect(mostRestrictiveTraceVisibility('public', 'friends')).toBe('friends');
    expect(mostRestrictiveTraceVisibility('friends', 'collective_anonymized')).toBe(
      'friends'
    );
    expect(mostRestrictiveTraceVisibility('followers', 'friends')).toBe('friends');
  });

  it('échoue fermé sans aucune visibilité', () => {
    expect(mostRestrictiveTraceVisibility()).toBe('private');
  });
});

describe('projectTraceSamples — métadonnées et coupures', () => {
  it('rend la trace exacte au propriétaire, sans masque', () => {
    const projected = projectTraceSamples(line, []);
    expect(projected.masked).toBe(false);
    expect(projected.error).toBeNull();
    expect(projected.segments).toHaveLength(1);
    expect(projected.segments[0]).toEqual(line);
  });

  it('retire début et fin sans jamais livrer les extrémités brutes', () => {
    const projected = projectTraceSamples(
      line,
      resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })
    );

    expect(projected.error).toBeNull();
    expect(projected.masked).toBe(true);
    expect(projected.fullyMasked).toBe(false);
    expect(projected.segments).toHaveLength(1);
    const visible = projected.segments[0];
    expect(visible.length).toBeGreaterThan(2);
    expect(visible[0]).not.toEqual({ lng: 0, lat: 0 });
    expect(visible[visible.length - 1]).not.toEqual({ lng: 0.02, lat: 0 });
    expect(squaredMeters(visible[0], { lng: 0, lat: 0 })).toBeGreaterThan(
      DEFAULT_SHARE_START_MASK_M ** 2
    );
  });

  it('conserve altitude et heure des points d’origine visibles', () => {
    const projected = projectTraceSamples(
      line,
      resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })
    );
    const visible = projected.segments[0];
    expect(visible.some((point) => point.elevationM === 300)).toBe(true);
    expect(visible.some((point) => point.timestamp === '2026-09-12T06:10:00Z')).toBe(true);
  });

  it('coupe une zone en deux morceaux jamais recollés', () => {
    const zone: PrivacyZone = {
      kind: 'circle',
      center: { lng: 0.01, lat: 0 },
      radiusM: 300,
    };
    const projected = projectTraceSamples(line, [{ kind: 'zone', zone }]);

    expect(projected.error).toBeNull();
    expect(projected.segments).toHaveLength(2);
    for (const segment of projected.segments) {
      for (const point of segment) {
        expect(squaredMeters(point, zone.center)).toBeGreaterThan(zone.radiusM ** 2);
      }
    }
  });

  it('masque tout quand la politique l’exige', () => {
    const projected = projectTraceSamples(line, [{ kind: 'all' }]);
    expect(projected.masked).toBe(true);
    expect(projected.fullyMasked).toBe(true);
    expect(projected.error).toBeNull();
    expect(projected.segments).toEqual([]);
    expect(projected.visiblePointCount).toBe(0);
  });

  it('échoue fermé sur une géométrie hors domaine, sans rendre la trace brute', () => {
    const projected = projectTraceSamples(
      [
        { lng: 0, lat: 84, elevationM: 1, timestamp: '2026-09-12T06:00:00Z' },
        { lng: 179.9, lat: 84, elevationM: 2, timestamp: '2026-09-12T06:05:00Z' },
      ],
      resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })
    );

    expect(projected.error).toBe('unsafe_geometry');
    expect(projected.masked).toBe(true);
    expect(projected.segments).toEqual([]);
    expect(projected.visiblePointCount).toBe(0);
  });
});

describe('projectTraceGeometry — fiche partagée', () => {
  const trace = {
    type: 'LineString',
    coordinates: line.map((point) => [point.lng, point.lat]),
  };

  it('rend l’objet d’origine au propriétaire', () => {
    const projected = projectTraceGeometry(trace, []);
    expect(projected.geometry).toBe(trace);
    expect(projected.masked).toBe(false);
    expect(projected.error).toBeNull();
  });

  it('rend une MultiLineString quand une zone coupe la trace', () => {
    const zone: PrivacyZone = {
      kind: 'circle',
      center: { lng: 0.01, lat: 0 },
      radiusM: 300,
    };
    const projected = projectTraceGeometry(trace, [{ kind: 'zone', zone }]);

    expect(projected.error).toBeNull();
    expect(projected.masked).toBe(true);
    const geometry = projected.geometry as {
      type: string;
      coordinates: number[][][];
    };
    expect(geometry.type).toBe('MultiLineString');
    expect(geometry.coordinates).toHaveLength(2);
    expect(geometry.coordinates[0]).not.toEqual(geometry.coordinates[1]);
  });

  it('rend null, sans trace brute, pour une visibilité privée', () => {
    const projected = projectTraceGeometry(
      trace,
      resolveTraceMasks({ viewer: 'visitor', visibility: 'private' })
    );
    expect(projected.geometry).toBeNull();
    expect(projected.masked).toBe(true);
    expect(projected.fullyMasked).toBe(true);
  });

  it('conserve les frontières d’un MultiLineString sans recoller le vide', () => {
    const trace = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [0.005, 0],
          [0.01, 0],
          [0.015, 0],
        ],
        [
          [0.03, 0.02],
          [0.035, 0.02],
          [0.04, 0.02],
          [0.045, 0.02],
        ],
      ],
    };
    const projected = projectTraceGeometry(
      trace,
      resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })
    );

    expect(projected.error).toBeNull();
    expect(projected.masked).toBe(true);
    const geometry = projected.geometry as {
      type: string;
      coordinates: number[][][];
    };
    expect(geometry.type).toBe('MultiLineString');
    expect(geometry.coordinates).toHaveLength(2);
    /* Aucun point interpolé ne relie la fin du premier morceau au début du
       second : leurs coordonnées restent dans leur propre voisinage. */
    expect(geometry.coordinates[0].at(-1)?.[0]).toBeLessThan(0.02);
    expect(geometry.coordinates[1][0][0]).toBeGreaterThan(0.02);
    expect(geometry.coordinates[0].at(-1)).not.toEqual(geometry.coordinates[1][0]);
  });

  it('rend null sur une géométrie refusée', () => {
    const projected = projectTraceGeometry(
      {
        type: 'LineString',
        coordinates: [
          [0, 84],
          [179.9, 84],
        ],
      },
      resolveTraceMasks({ viewer: 'visitor', visibility: 'public' })
    );
    expect(projected.geometry).toBeNull();
    expect(projected.error).toBe('unsafe_geometry');
    expect(projected.segments).toEqual([]);
  });
});
