import { describe, expect, it } from 'vitest';
import {
  InitialWorkspaceSchema,
  RouteOperationSchema,
  operationSizeLimit,
} from '../_schemas';

const point = { id: 'p1', kind: 'start', orderKey: 'A', lat: 45.05, lon: 5.51, entityVersion: 1 };

describe('RouteOperationSchema (union discriminée de RouteOperationInput)', () => {
  it('accepte des opérations valides et refuse un type inconnu', () => {
    expect(RouteOperationSchema.safeParse({ type: 'move_point', pointId: 'p1', lat: 45, lon: 5 }).success).toBe(true);
    expect(RouteOperationSchema.safeParse({ type: 'reverse_route' }).success).toBe(true);
    expect(RouteOperationSchema.safeParse({ type: 'update_stage_note', stageId: 's', notes: 'ok' }).success).toBe(true);
    expect(RouteOperationSchema.safeParse({ type: 'drop_database' }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({}).success).toBe(false);
  });

  it('borne les coordonnées, les longueurs et les champs obligatoires', () => {
    expect(RouteOperationSchema.safeParse({ type: 'move_point', pointId: 'p1', lat: 91, lon: 5 }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'move_point', pointId: 'p1', lat: 45, lon: 181 }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'move_point', pointId: 'p1', lat: 45 }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'update_stage_note', stageId: 's', notes: 'x'.repeat(5001) }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'split_days', targetDays: 0 }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'set_shape_mode', shapeMode: 'spiral' }).success).toBe(false);
  });

  it('refuse les clés inconnues (jamais supprimées en silence)', () => {
    expect(RouteOperationSchema.safeParse({ type: 'delete_point', pointId: 'p1', evil: '<script>' }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'delete_point', pointId: 'p1' }).success).toBe(true);
    expect(
      RouteOperationSchema.safeParse({ type: 'insert_point', pointId: 'p', afterPointId: null, lat: 1, lon: 1, extra: 1 }).success,
    ).toBe(false);
  });

  it('import_track : points et tronçons validés, taille limite plus large', () => {
    const op = {
      type: 'import_track',
      points: [point],
      sections: [],
      sourceOrigin: { kind: 'gpx_import', originalGpxXml: '<gpx/>' },
    };
    expect(RouteOperationSchema.safeParse(op).success).toBe(true);
    expect(RouteOperationSchema.safeParse({ ...op, points: [{ ...point, lat: 200 }] }).success).toBe(false);
    expect(operationSizeLimit('import_track')).toBeGreaterThan(operationSizeLimit('move_point'));
  });
});

describe('InitialWorkspaceSchema (instantané initial)', () => {
  it('accepte un instantané vide ou partiel et ignore les clés RACINE inconnues (le client envoie l’état complet)', () => {
    expect(InitialWorkspaceSchema.safeParse({}).success).toBe(true);
    const parsed = InitialWorkspaceSchema.parse({ points: [point], status: 'published', headSeq: 99 });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('headSeq');
  });

  it('refuse coordonnées hors bornes, types inattendus et listes démesurées', () => {
    expect(InitialWorkspaceSchema.safeParse({ points: [{ ...point, lat: -91 }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: [{ ...point, kind: 'inconnu' }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: {} }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ stages: new Array(61).fill({}) }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: new Array(2001).fill(point) }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: new Array(2000).fill(point) }).success).toBe(true);
    expect(InitialWorkspaceSchema.safeParse({ members: [{ userId: 'u', displayName: 'U', role: 'root' }] }).success).toBe(false);
  });
});

describe('schémas stricts (clés inconnues refusées dans les entités)', () => {
  it('un point, un tronçon ou un objet de kit avec une clé inconnue est refusé', () => {
    expect(InitialWorkspaceSchema.safeParse({ points: [point] }).success).toBe(true);
    expect(InitialWorkspaceSchema.safeParse({ points: [{ ...point, secret: 'x' }] }).success).toBe(false);
    expect(
      InitialWorkspaceSchema.safeParse({ kitItems: [{ id: 'k', name: 'n', category: 'c', weightGrams: 1, quantity: 1, shared: false, assigneeUserId: null, assigneeName: null, dependsOn: [], status: 'confirmed', extra: 1 }] }).success,
    ).toBe(false);
  });

  it('variantes, propositions et commentaires sont typés (plus de passthrough)', () => {
    expect(InitialWorkspaceSchema.safeParse({ comments: [{ id: 'c1', anything: true }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ proposals: [{ id: 'p1', anything: true }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ variants: [{ id: 'v1', anything: true }] }).success).toBe(false);
    const comment = {
      id: 'c1', workspaceId: 'w', createdBy: 'u', authorName: 'U', body: 'Salut', baseRevisionNo: 0, status: 'open',
      createdAt: '2026-11-22T10:00:00.000Z',
      anchor: { anchorType: 'point', entityId: 'p1', entityVersion: 1, originalLat: 45, originalLon: 5, maxRelocateMeters: 200 },
    };
    expect(InitialWorkspaceSchema.safeParse({ comments: [comment] }).success).toBe(true);
    expect(InitialWorkspaceSchema.safeParse({ comments: [{ ...comment, extra: 1 }] }).success).toBe(false);
  });

  it('la géométrie reste tolérante (RouteGeometry porte une signature d’index) mais bornée', () => {
    const section = (coordinates: Array<[number, number]>, extra: Record<string, unknown> = {}) => ({
      id: 's1', fromPointId: 'a', toPointId: 'b', mode: 'routed', distanceKm: 1, durationMin: null, ascentM: null, descentM: null,
      surfaceSegments: [], routingInputHash: null, provenance: { provider: null, calculatedAt: null, profile: null, confidence: 'unknown' },
      warnings: [], entityVersion: 1, geometry: { type: 'LineString', coordinates, ...extra },
    });
    expect(InitialWorkspaceSchema.safeParse({ sections: [section([[5, 45], [5.1, 45.1]], { bbox: [1, 2, 3, 4] })] }).success).toBe(true);
    expect(InitialWorkspaceSchema.safeParse({ sections: [section([[5, 91]])] }).success).toBe(false);
  });

  it('plafond de coordonnées au total (miroir de la base : 80 000)', () => {
    const big = Array.from({ length: 20_000 }, () => [5, 45] as [number, number]);
    const section = (id: string) => ({
      id, fromPointId: 'a', toPointId: 'b', mode: 'routed', distanceKm: 1, durationMin: null, ascentM: null, descentM: null,
      surfaceSegments: [], routingInputHash: null, provenance: { provider: null, calculatedAt: null, profile: null, confidence: 'unknown' },
      warnings: [], entityVersion: 1, geometry: { type: 'LineString', coordinates: big },
    });
    const five = ['a', 'b', 'c', 'd'].map(section);
    expect(InitialWorkspaceSchema.safeParse({ sections: five }).success).toBe(true);
    expect(InitialWorkspaceSchema.safeParse({ sections: [...five, section('f')] }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'import_track', points: [point], sections: [...five, section('f')], sourceOrigin: { kind: 'gpx_import' } }).success).toBe(false);
    expect(RouteOperationSchema.safeParse({ type: 'import_track', points: [point], sections: five, sourceOrigin: { kind: 'gpx_import' } }).success).toBe(true);
  });
});
