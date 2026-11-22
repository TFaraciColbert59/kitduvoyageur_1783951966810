import { describe, expect, it } from 'vitest';
import { activePoints, applyWorkspaceOperation, computeRoutingFingerprint } from '../engine';
import {
  describeOperation,
  groupGesture,
  planUndo,
  type JournalEntry,
} from '../undo';
import type { RouteOperationInput, RouteWorkspaceState } from '../types';

const NOW = '2026-11-18T10:00:00.000Z';

function makeWorkspace(): RouteWorkspaceState {
  const w = 'ws-undo';
  const a = { lat: 45.05, lon: 5.51 };
  const b = { lat: 45.07, lon: 5.53 };
  const c = { lat: 45.09, lon: 5.56 };
  const fp = (from: typeof a, to: typeof a) =>
    computeRoutingFingerprint({ from, to, sport: 'marche', options: {} });
  const prov = { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' as const };
  return {
    id: w,
    tripId: 't',
    title: 'Undo',
    status: 'draft',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: 0,
    reviewedSeq: null,
    publishedRevisionId: null,
    publishedRevisionNo: null,
    sourceOrigin: { kind: 'blank', importedAt: NOW },
    points: [
      { id: 'pa', workspaceId: w, kind: 'start', orderKey: 'A', ...a, name: 'A', entityVersion: 1 },
      { id: 'pb', workspaceId: w, kind: 'via', orderKey: 'M', ...b, name: 'B', entityVersion: 1 },
      { id: 'pc', workspaceId: w, kind: 'finish', orderKey: 'Z', ...c, name: 'C', entityVersion: 1 },
    ],
    sections: [
      {
        id: 'sec-ab',
        workspaceId: w,
        fromPointId: 'pa',
        toPointId: 'pb',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.51, 45.05], [5.515, 45.06], [5.52, 45.065], [5.53, 45.07]] },
        distanceKm: 3.4,
        durationMin: 55,
        ascentM: 210,
        descentM: 40,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: fp(a, b),
        provenance: prov,
        warnings: [],
        entityVersion: 1,
      },
      {
        id: 'sec-bc',
        workspaceId: w,
        fromPointId: 'pb',
        toPointId: 'pc',
        mode: 'routed',
        geometry: { type: 'LineString', coordinates: [[5.53, 45.07], [5.545, 45.08], [5.56, 45.09]] },
        distanceKm: 3.9,
        durationMin: 60,
        ascentM: 150,
        descentM: 90,
        surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail', source: 'OSM' }],
        routingInputHash: fp(b, c),
        provenance: prov,
        warnings: [],
        entityVersion: 1,
      },
    ],
    stages: [
      {
        id: 'st1',
        workspaceId: w,
        orderKey: '001',
        dayNumber: 1,
        title: 'Jour 1',
        dateIso: null,
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pa',
        endPointId: 'pb',
        overnightPlace: null,
        notes: 'avant',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
      {
        id: 'st2',
        workspaceId: w,
        orderKey: '002',
        dayNumber: 2,
        title: 'Jour 2',
        dateIso: null,
        departureTimeLocal: '08:30',
        timezone: 'Europe/Paris',
        startPointId: 'pb',
        endPointId: 'pc',
        overnightPlace: null,
        notes: '',
        waterObservations: [],
        weatherSlice: null,
        hazards: [],
        entityVersion: 1,
      },
    ],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: NOW,
  };
}

let counter = 0;
function submit(ws: RouteWorkspaceState, operation: RouteOperationInput, expected: Record<string, number> = {}) {
  counter += 1;
  const { result } = applyWorkspaceOperation(
    ws,
    [],
    { opId: `op-${counter}`, baseSeq: ws.headSeq, actorId: 'u1', actorName: 'Alice', operation, expectedVersions: expected },
    NOW
  );
  if (result.status !== 'accepted') throw new Error(`opération refusée : ${result.status}`);
  return result.workspace;
}

function entryOf(
  before: RouteWorkspaceState,
  operation: RouteOperationInput,
  extra: Partial<JournalEntry> = {}
): { entry: JournalEntry; after: RouteWorkspaceState } {
  const after = submit(before, operation);
  return { entry: { operation, before, after, at: 0, ...extra }, after };
}

/** Rejoue le plan d'annulation, opération après opération, comme le ferait l'atelier. */
function undoWith(after: RouteWorkspaceState, entries: JournalEntry[]) {
  let n = 0;
  const plan = planUndo(entries, { newPointId: () => `pt-back-${(n += 1)}` });
  if (!plan.ok) throw new Error(plan.reason);
  let ws = after;
  for (const s of plan.steps) ws = submit(ws, s.operation, { ...s.expectedVersions });
  return { ws, plan };
}

/** Ce qui compte pour l'utilisateur : points actifs (position, nom), tronçons (géométrie, distance, D+). */
function shape(ws: RouteWorkspaceState) {
  const pts = activePoints(ws);
  return {
    points: pts.map((p) => [p.name ?? null, p.lat, p.lon, p.kind]),
    legs: pts.slice(1).map((p, i) => {
      const s = ws.sections.find((x) => x.fromPointId === pts[i].id && x.toPointId === p.id);
      return s
        ? [s.mode, s.geometry.coordinates, s.distanceKm, s.ascentM, s.durationMin, s.provenance.provider]
        : null;
    }),
  };
}

describe('undo · opération inverse soumise comme nouvelle opération', () => {
  it('ajout : le point est retiré et le tronçon d’origine retrouve son tracé', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, {
      type: 'insert_point',
      pointId: 'pn',
      afterPointId: 'pa',
      lat: 45.055,
      lon: 5.515,
      name: 'Nouveau',
    });
    expect(activePoints(after)).toHaveLength(4);
    const { ws } = undoWith(after, [entry]);
    expect(shape(ws)).toEqual(shape(base));
    expect(ws.headSeq).toBe(after.headSeq + 2);
  });

  it('suppression : le point revient à sa place, avec ses deux tronçons', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'delete_point', pointId: 'pb' });
    expect(activePoints(after)).toHaveLength(2);
    const { ws, plan } = undoWith(after, [entry]);
    expect(plan.ok && plan.label).toBe('suppression d’un point');
    expect(shape(ws)).toEqual(shape(base));
  });

  it('suppression du dernier point : rétablie en fin de tracé', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'delete_point', pointId: 'pc' });
    const { ws } = undoWith(after, [entry]);
    expect(shape(ws)).toEqual(shape(base));
  });

  it('suppression du premier point : dite non rétablissable, jamais approximée', () => {
    const base = makeWorkspace();
    const { entry } = entryOf(base, { type: 'delete_point', pointId: 'pa' });
    const plan = planUndo([entry], { newPointId: () => 'x' });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toMatch(/premier point/);
  });

  it('déplacement : le point et les tronçons voisins reprennent leur tracé calculé', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'move_point', pointId: 'pb', lat: 45.075, lon: 5.54 });
    expect(shape(after)).not.toEqual(shape(base));
    const { ws } = undoWith(after, [entry]);
    expect(shape(ws)).toEqual(shape(base));
  });

  it('recalcul : le tronçon retrouve son ancien résultat (l’empreinte courante reste valable)', () => {
    const base = makeWorkspace();
    const fp = base.sections[0].routingInputHash as string;
    const { entry, after } = entryOf(base, {
      type: 'apply_routing_result',
      sectionId: 'sec-ab',
      routingInputHash: fp,
      geometry: { type: 'LineString', coordinates: [[5.51, 45.05], [5.53, 45.07]] },
      distanceKm: 2.9,
      durationMin: 40,
      ascentM: 90,
      descentM: 10,
      provenance: { provider: 'autre', calculatedAt: NOW, profile: 'marche', confidence: 'verified' },
    });
    expect(after.sections[0].distanceKm).toBe(2.9);
    const { ws } = undoWith(after, [entry]);
    expect(shape(ws)).toEqual(shape(base));
  });

  it('découpage : le nombre de journées et leurs coupures reviennent', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'split_days', targetDays: 1 });
    expect(after.stages).toHaveLength(1);
    const { ws, plan } = undoWith(after, [entry]);
    expect(plan.ok && plan.label).toBe('découpage en 1 jour');
    expect(ws.stages.map((s) => [s.startPointId, s.endPointId])).toEqual([
      ['pa', 'pb'],
      ['pb', 'pc'],
    ]);
  });

  it('inversion du sens : l’ordre et les tracés calculés sont rétablis', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'reverse_route' });
    expect(activePoints(after).map((p) => p.id)).toEqual(['pc', 'pb', 'pa']);
    const { ws } = undoWith(after, [entry]);
    expect(shape(ws)).toEqual(shape(base));
  });

  it('boucle : le point de fermeture est retiré et la forme revient à « aller simple »', () => {
    const base = makeWorkspace();
    const { entry, after } = entryOf(base, { type: 'set_shape_mode', shapeMode: 'loop' });
    expect(activePoints(after)).toHaveLength(4);
    const { ws } = undoWith(after, [entry]);
    expect(ws.shapeMode).toBe('one_way');
    expect(shape(ws)).toEqual(shape(base));
  });

  it('note de journée, nuit et profil : l’ancienne valeur revient', () => {
    const base = makeWorkspace();
    const note = entryOf(base, { type: 'update_stage_note', stageId: 'st1', notes: 'après' });
    expect(undoWith(note.after, [note.entry]).ws.stages[0].notes).toBe('avant');
    const sport = entryOf(base, {
      type: 'set_sport_profile',
      sport: 'vtt',
      routingOptions: { avoidSteps: true },
    });
    const back = undoWith(sport.after, [sport.entry]).ws;
    expect(back.sport).toBe('marche');
    expect(back.routingOptions).toEqual({});
  });

  it('geste : ajout puis recollage au réseau s’annulent d’un seul « Annuler »', () => {
    const base = makeWorkspace();
    const ins = entryOf(base, {
      type: 'insert_point',
      pointId: 'pn',
      afterPointId: 'pb',
      lat: 45.08,
      lon: 5.54,
      name: 'Nouveau',
    });
    const newSec = ins.after.sections.find((s) => s.toPointId === 'pn')!;
    const recalc = entryOf(ins.after, {
      type: 'apply_routing_result',
      sectionId: newSec.id,
      routingInputHash: newSec.routingInputHash as string,
      geometry: { type: 'LineString', coordinates: [[5.53, 45.07], [5.535, 45.075], [5.54, 45.08]] },
      distanceKm: 1.6,
      durationMin: 25,
      ascentM: 30,
      descentM: 5,
      provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' },
    }, { derived: true });
    const group = groupGesture([ins.entry, recalc.entry]);
    expect(group).toHaveLength(2);
    const { ws } = undoWith(recalc.after, group);
    expect(shape(ws)).toEqual(shape(base));
  });

  it('variante ajoutée, retour à une version : non annulables, avec la raison', () => {
    const base = makeWorkspace();
    const variant = {
      id: 'v1', baseRevisionNo: 0, scope: 'section' as const, title: 'Détour', replacements: [],
      deltaDistanceKm: 1, deltaAscentM: null, deltaDurationMin: null, status: 'draft' as const,
      createdBy: 'u1', createdAt: NOW,
    };
    const { entry } = entryOf(base, { type: 'add_variant', variant });
    const plan = planUndo([entry], { newPointId: () => 'x' });
    expect(plan.ok).toBe(false);
    expect(planUndo([], { newPointId: () => 'x' }).ok).toBe(false);
  });
});

describe('undo · regroupement des gestes et libellés', () => {
  const dummy = (over: Partial<JournalEntry> = {}): JournalEntry => ({
    operation: { type: 'reverse_route' },
    before: makeWorkspace(),
    at: 0,
    ...over,
  });

  it('une opération dérivée rejoint son geste, même tardive ; deux gestes ne fusionnent jamais', () => {
    const a = dummy({ at: 1 });
    const b = dummy({ at: 2 });
    const derived = dummy({ at: 60_000, derived: true });
    expect(groupGesture([a, b, derived])).toEqual([b, derived]);
    expect(groupGesture([a, b])).toEqual([b]);
  });

  it('un identifiant de geste commun regroupe plusieurs opérations de l’utilisateur', () => {
    const g1 = dummy({ gesture: 'g' });
    const g2 = dummy({ gesture: 'g' });
    const other = dummy({ gesture: 'h' });
    expect(groupGesture([other, g1, g2])).toEqual([g1, g2]);
    expect(groupGesture([])).toEqual([]);
  });

  it('nomme chaque opération en français', () => {
    expect(describeOperation({ type: 'insert_point', pointId: 'x', afterPointId: null, lat: 0, lon: 0 })).toBe('ajout d’un point');
    expect(describeOperation({ type: 'split_days', targetDays: 3 })).toBe('découpage en 3 jours');
    expect(describeOperation({ type: 'apply_routing_result', sectionId: 's', routingInputHash: 'h', geometry: { type: 'LineString', coordinates: [] }, distanceKm: 0, durationMin: null, ascentM: null, descentM: null, provenance: { provider: null, calculatedAt: null, profile: null, confidence: 'unknown' } })).toBe('recalcul d’un tronçon');
  });
});
