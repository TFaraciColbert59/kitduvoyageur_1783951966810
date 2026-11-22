import { describe, expect, it } from 'vitest';
import { activePoints, applyWorkspaceOperation, computeRoutingFingerprint } from '../engine';
import { MAX_SAY_DAYS, parseSayCommand, planSayCommands } from '../sayCommands';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-18T10:00:00.000Z';

function workspace(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const w = 'ws-say';
  const coords = [
    [5.51, 45.05],
    [5.53, 45.07],
    [5.56, 45.09],
  ] as const;
  const prov = { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' as const };
  const fp = (i: number) =>
    computeRoutingFingerprint({
      from: { lon: coords[i][0], lat: coords[i][1] },
      to: { lon: coords[i + 1][0], lat: coords[i + 1][1] },
      sport: 'marche',
      options: {},
    });
  return {
    id: w,
    tripId: 't',
    title: 'Dis-le',
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
      { id: 'pa', workspaceId: w, kind: 'start', orderKey: 'A', lat: 45.05, lon: 5.51, name: 'Corrençon', entityVersion: 1 },
      { id: 'pb', workspaceId: w, kind: 'via', orderKey: 'M', lat: 45.07, lon: 5.53, name: 'Refuge', entityVersion: 1 },
      { id: 'pc', workspaceId: w, kind: 'finish', orderKey: 'Z', lat: 45.09, lon: 5.56, name: 'Villard', entityVersion: 1 },
    ],
    sections: [0, 1].map((i) => ({
      id: `sec-${i}`,
      workspaceId: w,
      fromPointId: ['pa', 'pb'][i],
      toPointId: ['pb', 'pc'][i],
      mode: 'routed' as const,
      geometry: { type: 'LineString' as const, coordinates: [[...coords[i]], [...coords[i + 1]]] as [number, number][] },
      distanceKm: 6,
      durationMin: 100,
      ascentM: 200,
      descentM: 50,
      surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'trail' as const }],
      routingInputHash: fp(i),
      provenance: prov,
      warnings: [],
      entityVersion: 1,
    })),
    stages: [],
    variants: [],
    proposals: [],
    comments: [],
    kitItems: [],
    members: [{ userId: 'u1', displayName: 'Alice', role: 'owner' }, { userId: 'u9', displayName: 'Zoé', role: 'participant' }],
    revisions: [],
    packs: [],
    participantPacks: [],
    updatedAt: NOW,
    ...over,
  };
}

const ctx = { actorId: 'u1', actorName: 'Alice', stamp: 't1', nowIso: NOW };

describe('sayCommands · lecture de la phrase', () => {
  it.each([
    ['coupe en 3 jours', { kind: 'split', days: 3 }],
    ['Coupe-le en trois jours', { kind: 'split', days: 3 }],
    ['découpe sur 4 jours', { kind: 'split', days: 4 }],
    ['inverse le sens', { kind: 'reverse' }],
    ['Fais-le dans l’autre sens', { kind: 'reverse' }],
    ['évite les routes', { kind: 'surface', pref: 'prefer_trails' }],
    ['je préfère les sentiers', { kind: 'surface', pref: 'prefer_trails' }],
    ['privilégie le bitume', { kind: 'surface', pref: 'prefer_paved' }],
    ['évite les escaliers', { kind: 'avoid', what: 'steps' }],
    ['évite les ferries', { kind: 'avoid', what: 'ferries' }],
    ['fais une boucle', { kind: 'shape', shape: 'loop' }],
    ['en aller-retour', { kind: 'shape', shape: 'out_and_back' }],
    ['en aller simple', { kind: 'shape', shape: 'one_way' }],
    ['passe en VTT', { kind: 'sport', sport: 'vtt' }],
    ['en vélo de route', { kind: 'sport', sport: 'route' }],
    ['supprime le dernier point', { kind: 'remove_last' }],
  ])('« %s »', (text, expected) => {
    const parsed = parseSayCommand(text);
    expect(parsed.commands).toEqual([expected]);
    expect(parsed.unknown).toEqual([]);
  });

  it('plusieurs demandes liées par « et » ou « puis », sans doublon', () => {
    const parsed = parseSayCommand('Coupe en 3 jours et évite les routes puis inverse le sens et inverse le sens');
    expect(parsed.commands.map((c) => c.kind)).toEqual(['split', 'surface', 'reverse']);
  });

  it('dit ce qui n’est pas compris et demande une précision plutôt que de deviner', () => {
    expect(parseSayCommand('fais-moi un café').unknown).toEqual(['fais-moi un café']);
    expect(parseSayCommand('').commands).toEqual([]);
    const velo = parseSayCommand('passe à vélo');
    expect(velo.commands).toEqual([]);
    expect(velo.clarify[0]).toMatch(/route, gravel ou VTT/);
    const mixed = parseSayCommand('inverse le sens et danse la polka');
    expect(mixed.commands).toEqual([{ kind: 'reverse' }]);
    expect(mixed.unknown).toEqual(['danse la polka']);
  });
});

describe('sayCommands · opérations et aperçu', () => {
  it('« coupe en 3 jours » : insère le point manquant puis découpe, aperçu chiffré par le moteur', () => {
    const plan = planSayCommands(parseSayCommand('coupe en 3 jours').commands, workspace(), ctx);
    expect(plan.ok).toBe(true);
    expect(plan.steps.map((s) => s.operation.type)).toEqual(['insert_point', 'split_days']);
    expect(plan.preview[0]).toMatch(/^Découpe en 3 jours · environ \d+(,\d)? km par jour/);
    expect(plan.preview.join(' ')).toMatch(/1 point d’étape ajouté/);
    expect(plan.summary.before).toBe('? j · 12 km · D+ 400 m');
    expect(plan.summary.after.startsWith('3 j')).toBe(true);
    expect(plan.recalc).toBe('placeholders');
  });

  it('les opérations du plan sont réellement acceptées par le moteur, dans l’ordre', () => {
    const plan = planSayCommands(parseSayCommand('coupe en 2 jours').commands, workspace(), ctx);
    let ws = workspace();
    for (const [i, s] of plan.steps.entries()) {
      const r = applyWorkspaceOperation(ws, [], { opId: `x${i}`, baseSeq: ws.headSeq, actorId: 'u1', actorName: 'Alice', operation: s.operation }, NOW);
      expect(r.result.status).toBe('accepted');
      if (r.result.status === 'accepted') ws = r.result.workspace;
    }
    expect(ws.stages).toHaveLength(2);
  });

  it('« inverse le sens » : tout est à recalculer, l’aperçu nomme le nouveau départ', () => {
    const plan = planSayCommands([{ kind: 'reverse' }], workspace(), ctx);
    expect(plan.steps.map((s) => s.operation.type)).toEqual(['reverse_route']);
    expect(plan.recalc).toBe('all');
    expect(plan.preview[0]).toContain('« Villard »');
    expect(plan.preview[0]).toContain('« Corrençon »');
  });

  it('« évite les routes » : préférence de sentiers sans promesse, tout recalculé', () => {
    const plan = planSayCommands(parseSayCommand('évite les routes').commands, workspace(), ctx);
    const op = plan.steps[0].operation;
    expect(op.type).toBe('set_sport_profile');
    if (op.type === 'set_sport_profile') expect(op.routingOptions.surfacePref).toBe('prefer_trails');
    expect(plan.preview[0]).toMatch(/pas une garantie/);
    expect(plan.recalc).toBe('all');
  });

  it('refuse ce qui n’a pas d’effet ou n’est pas permis, avec la raison', () => {
    const already = planSayCommands([{ kind: 'shape', shape: 'one_way' }], workspace(), ctx);
    expect(already.ok).toBe(false);
    expect(already.blocked[0]).toMatch(/déjà/);
    const denied = planSayCommands([{ kind: 'reverse' }], workspace(), { ...ctx, actorId: 'u9', actorName: 'Zoé' });
    expect(denied.ok).toBe(false);
    expect(denied.blocked[0]).toMatch(/droit/);
    const empty = planSayCommands([{ kind: 'reverse' }], workspace({ points: [], sections: [] }), ctx);
    expect(empty.blocked[0]).toMatch(/Aucun tracé/);
  });

  it('plafonne le découpage et enchaîne plusieurs demandes sur l’état simulé', () => {
    const plan = planSayCommands([{ kind: 'split', days: 99 }], workspace(), ctx);
    const split = plan.steps.find((s) => s.operation.type === 'split_days')?.operation;
    expect(split && split.type === 'split_days' ? split.targetDays : 0).toBe(MAX_SAY_DAYS);
    const two = planSayCommands([{ kind: 'reverse' }, { kind: 'shape', shape: 'loop' }], workspace(), ctx);
    expect(two.steps.map((s) => s.operation.type)).toEqual(['reverse_route', 'set_shape_mode']);
    expect(activePoints(workspace())).toHaveLength(3);
  });
});
