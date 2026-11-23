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

  it('supprime les clés inconnues (rien d’inattendu n’atteint la base)', () => {
    const res = RouteOperationSchema.parse({ type: 'delete_point', pointId: 'p1', evil: '<script>' });
    expect(res).toEqual({ type: 'delete_point', pointId: 'p1' });
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
  it('accepte un instantané vide ou partiel et ignore les clés racine inconnues', () => {
    expect(InitialWorkspaceSchema.safeParse({}).success).toBe(true);
    const parsed = InitialWorkspaceSchema.parse({ points: [point], status: 'published', headSeq: 99 });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('headSeq');
  });

  it('refuse coordonnées hors bornes, types inattendus et listes démesurées', () => {
    expect(InitialWorkspaceSchema.safeParse({ points: [{ ...point, lat: -91 }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: [{ ...point, kind: 'inconnu' }] }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ points: {} }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ stages: new Array(401).fill({}) }).success).toBe(false);
    expect(InitialWorkspaceSchema.safeParse({ members: [{ userId: 'u', displayName: 'U', role: 'root' }] }).success).toBe(false);
  });
});
