import { describe, expect, it } from 'vitest';
import { applyWorkspaceOperation, computeRoutingFingerprint } from '../engine';
import { ROUTE_PROFILE_CHOICES, activeProfileId, describeRouting, patchRoutingOptions, profileOperation, routingQueryParams, surfaceChoiceOf } from '../routingProfiles';
import { alternativeSurfaces, buildRoutingVariants, fetchElevationStats, fetchRoutedLegs, variantTarget, type FetchLike } from '../routeClient';
import { compareVariant, compareVariants, staleReason, surfaceKnownShare } from '../variantCompare';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';

const NOW = '2026-11-22T10:00:00.000Z';

function ws(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const a = pt('a', 'a', 45.9, 6.0);
  const b = pt('b', 'b', 45.9, 6.13);
  const c = pt('c', 'c', 45.9, 6.26);
  return {
    ...baseWorkspace({
      sport: 'marche',
      points: [a, b, c],
      sections: [section('s1', a, b), section('s2', b, c)],
      stages: [stage('g1', 1, 'a', 'b'), stage('g2', 2, 'b', 'c')],
      ...over,
    }),
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
  };
}

/** Faux routeur : renvoie une géométrie plus longue pour « prefer_trails », la même sinon. */
function fakeFetch(calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const u = new URL(url, 'http://x');
    if (u.pathname === '/api/route') {
      const pts = (u.searchParams.get('points') ?? '').split(';').map((p) => p.split(',').map(Number) as [number, number]);
      const trails = u.searchParams.get('surfacePref') === 'prefer_trails';
      const legs = pts.slice(0, -1).map((from, i) => {
        const to = pts[i + 1];
        const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + (trails ? 0.01 : 0)];
        const geometry = trails ? [from, [from[0] + 0.01, from[1] + 0.01], mid, [to[0] - 0.01, to[1] + 0.01], to] : [from, mid, to];
        return { distanceKm: trails ? 12.5 : 10, durationMin: trails ? 170 : 150, geometry };
      });
      return { ok: true, json: async () => ({ status: 'ok', provider: 'valhalla', legs }) };
    }
    if (u.pathname === '/api/elevation') {
      const n = (u.searchParams.get('points') ?? '').split(';').length;
      return { ok: true, json: async () => ({ status: 'ok', elevations: Array.from({ length: n }, (_, i) => 1000 + i * 20) }) };
    }
    return { ok: false, json: async () => ({}) };
  };
}

describe('5.1 profils de routage et options transmises à /api/route', () => {
  it('cinq profils, chacun un sport que /api/route accepte', () => {
    expect(ROUTE_PROFILE_CHOICES.map((c) => c.id)).toEqual(['rando', 'trail', 'velo_route', 'vtt', 'gravel']);
    expect(new Set(ROUTE_PROFILE_CHOICES.map((c) => c.sport))).toEqual(new Set(['marche', 'route', 'vtt', 'gravel']));
  });

  it('le trail est la rando avec « sentiers d’abord » ; le profil actif se relit', () => {
    const trail = profileOperation('trail', undefined);
    expect(trail.sport).toBe('marche');
    expect(trail.routingOptions?.surfacePref).toBe('prefer_trails');
    expect(activeProfileId('marche', trail.routingOptions)).toBe('trail');
    expect(activeProfileId('marche', {})).toBe('rando');
    expect(activeProfileId('vtt', {})).toBe('vtt');
  });

  it('« éviter les routes » et « préférer les sentiers » sont des préférences souples et n’emportent pas le reste', () => {
    const o = patchRoutingOptions('marche', { avoidSteps: true }, { surface: 'avoid_roads' });
    expect(o.surfacePref).toBe('prefer_unpaved');
    expect(o.avoidSteps).toBe(true);
    expect(surfaceChoiceOf(o)).toBe('avoid_roads');
    expect(describeRouting('marche', o)).toMatch(/préférence souple/);
    expect(describeRouting('marche', undefined)).toMatch(/par défaut/);
  });

  it('la requête ne porte que des clés connues de /api/route', () => {
    const qs = routingQueryParams([[6, 45.9], [6.1, 45.9]], 'vtt', { surfacePref: 'prefer_trails', avoidSteps: true, avoidFerries: true });
    const allowed = new Set(['points', 'mode', 'sport', 'ebike', 'surfacePref', 'avoidSteps', 'avoidFerries', 'snap']);
    for (const k of qs.keys()) expect(allowed.has(k)).toBe(true);
    expect(qs.get('surfacePref')).toBe('prefer_trails');
    expect(qs.get('avoidSteps')).toBe('1');
    expect(qs.get('sport')).toBe('vtt');
    expect(qs.get('snap')).toBe('1');
  });

  it('changer d’option change l’empreinte : un résultat calculé avant est rejeté', () => {
    const w = ws();
    const old = w.sections[0].routingInputHash!;
    const r = applyWorkspaceOperation(
      w,
      [],
      { opId: 'p1', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: profileOperation('trail', w.routingOptions) },
      NOW,
    ).result;
    expect(r.status).toBe('accepted');
    if (r.status !== 'accepted') return;
    const fp = computeRoutingFingerprint({ from: pt('a', 'a', 45.9, 6.0), to: pt('b', 'b', 45.9, 6.13), sport: 'marche', options: { surfacePref: 'prefer_trails' } });
    expect(r.workspace.sections[0].routingInputHash).toBe(fp);
    expect(r.workspace.sections[0].routingInputHash).not.toBe(old);
  });
});

describe('routeClient', () => {
  it('fetchRoutedLegs relaie les options et rend un tronçon par couple de points', async () => {
    const calls: string[] = [];
    const res = await fetchRoutedLegs([[6, 45.9], [6.1, 45.9], [6.2, 45.9]], 'marche', { surfacePref: 'prefer_trails' }, fakeFetch(calls));
    expect(res?.legs.length).toBe(2);
    expect(calls[0]).toContain('surfacePref=prefer_trails');
  });

  it('sans réponse du routeur : null, jamais un tracé inventé', async () => {
    expect(await fetchRoutedLegs([[6, 45.9], [6.1, 45.9]], 'marche', undefined, async () => ({ ok: false, json: async () => ({}) }))).toBeNull();
    expect(await fetchRoutedLegs([[6, 45.9], [6.1, 45.9]], 'marche', undefined, async () => { throw new Error('réseau'); })).toBeNull();
    expect(await fetchRoutedLegs([[6, 45.9], [6.1, 45.9], [6.2, 45.9]], 'marche', undefined, async () => ({ ok: true, json: async () => ({ status: 'ok', legs: [{ distanceKm: 1, geometry: [[0, 0], [1, 1]] }] }) }))).toBeNull();
  });

  it('fetchElevationStats : D+ et D− mesurés, null si l’altitude manque', async () => {
    const stats = await fetchElevationStats([[6, 45.9], [6.05, 45.9], [6.1, 45.9]], fakeFetch());
    expect(stats?.ascentM).toBeGreaterThan(0);
    expect(await fetchElevationStats([[6, 45.9], [6.1, 45.9]], async () => ({ ok: true, json: async () => ({ status: 'ok', elevations: [null, null] }) }))).toBeNull();
  });
});

describe('5.8 variantes côte à côte', () => {
  it('variantTarget : tronçon, journée, itinéraire ; refus d’un repos et d’une portée trop longue', () => {
    const w = ws({ stages: [stage('g1', 1, 'a', 'b'), stage('r', 2, 'b', 'b', { kind: 'rest' }), stage('g2', 3, 'b', 'c')] });
    const sec = variantTarget(w, 'section', 's2');
    expect('error' in sec).toBe(false);
    if (!('error' in sec)) expect(sec.points.map((p) => p.id)).toEqual(['b', 'c']);
    const day = variantTarget(w, 'stage', 'g1');
    if (!('error' in day)) expect(day.sections.map((s) => s.id)).toEqual(['s1']);
    const all = variantTarget(w, 'route', null);
    if (!('error' in all)) expect(all.sections.length).toBe(2);
    expect('error' in variantTarget(w, 'stage', 'r')).toBe(true);
    expect('error' in variantTarget(w, 'section', 'zz')).toBe(true);
  });

  it('crée de vraies variantes à partir du routeur et ne garde pas celle qui redonne le même tracé', async () => {
    const w = ws();
    const target = variantTarget(w, 'section', 's1');
    if ('error' in target) throw new Error(target.error);
    const out = await buildRoutingVariants({ workspace: w, target, createdBy: 'alice', nowIso: NOW, idSeed: 'x', fetchFn: fakeFetch() });
    expect(out.variants.length).toBe(1); // seul « sentiers d'abord » diffère dans le faux routeur
    const v = out.variants[0];
    expect(v.title).toMatch(/Préférer les sentiers/);
    expect(v.deltaDistanceKm).toBeCloseTo(2.5, 2);
    expect(v.deltaDurationMin).toBe(20);
    expect(v.deltaAscentM).not.toBeNull();
    expect(v.replacements[0].provenance.provider).toMatch(/valhalla/);
    expect(out.notes.some((n) => /même tracé/.test(n))).toBe(true);
    expect(alternativeSurfaces(w.routingOptions).length).toBe(3);
  });

  it('routeur muet : aucune variante, un message par préférence', async () => {
    const w = ws();
    const target = variantTarget(w, 'section', 's1');
    if ('error' in target) throw new Error(target.error);
    const out = await buildRoutingVariants({ workspace: w, target, createdBy: 'alice', nowIso: NOW, idSeed: 'x', fetchFn: async () => ({ ok: false, json: async () => ({}) }) });
    expect(out.variants).toEqual([]);
    expect(out.notes.length).toBe(3);
  });

  it('compare : écarts de km, D+, durée et surface, inconnu jamais compté comme zéro', async () => {
    const w = ws();
    const target = variantTarget(w, 'section', 's1');
    if ('error' in target) throw new Error(target.error);
    const { variants } = await buildRoutingVariants({ workspace: w, target, createdBy: 'alice', nowIso: NOW, idSeed: 'x', fetchFn: fakeFetch() });
    const withVariant: RouteWorkspaceState = { ...w, variants };
    const cmp = compareVariants(withVariant)[0];
    const row = (id: string) => cmp.rows.find((r) => r.id === id)!;
    expect(row('distance').base).toBe('10 km');
    expect(row('distance').variant).toBe('12,5 km');
    expect(row('distance').delta).toBe('+2,5 km');
    expect(row('distance').tone).toBe('warn');
    expect(row('duration').delta).toBe('+20 min');
    expect(row('surface').variant).toBe('inconnue');
    expect(row('surface').base).toBe('100 % connue');
    expect(cmp.stale).toBeNull();

    const unknownAscent = { ...withVariant, sections: [{ ...withVariant.sections[0], ascentM: null }, withVariant.sections[1]] };
    const cmp2 = compareVariant(unknownAscent, variants[0]);
    expect(cmp2.rows.find((r) => r.id === 'ascent')!.base).toBe('inconnu');
    expect(cmp2.rows.find((r) => r.id === 'ascent')!.delta).toBeNull();
  });

  it('une variante périmée (point déplacé) est signalée et refusée par le moteur', async () => {
    const w = ws();
    const target = variantTarget(w, 'section', 's1');
    if ('error' in target) throw new Error(target.error);
    const { variants } = await buildRoutingVariants({ workspace: w, target, createdBy: 'alice', nowIso: NOW, idSeed: 'x', fetchFn: fakeFetch() });
    const withVariant: RouteWorkspaceState = { ...w, variants };
    expect(staleReason(withVariant, variants[0])).toBeNull();
    const moved = applyWorkspaceOperation(withVariant, [], { opId: 'm1', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: { type: 'move_point', pointId: 'b', lat: 45.95, lon: 6.2 } }, NOW).result;
    if (moved.status !== 'accepted') throw new Error('refusé');
    expect(staleReason(moved.workspace, variants[0])).toMatch(/point a bougé/);
    const apply = applyWorkspaceOperation(moved.workspace, [], { opId: 'a1', baseSeq: moved.workspace.headSeq, actorId: 'alice', actorName: 'Alice', operation: { type: 'apply_variant', variantId: variants[0].id } }, NOW).result;
    expect(apply.status).toBe('denied');
  });

  it('appliquer une variante remplace la géométrie, vide la surface et garde le tracé continu', async () => {
    const w = ws();
    const target = variantTarget(w, 'section', 's1');
    if ('error' in target) throw new Error(target.error);
    const { variants } = await buildRoutingVariants({ workspace: w, target, createdBy: 'alice', nowIso: NOW, idSeed: 'x', fetchFn: fakeFetch() });
    const r = applyWorkspaceOperation({ ...w, variants }, [], { opId: 'a2', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: { type: 'apply_variant', variantId: variants[0].id } }, NOW).result;
    if (r.status !== 'accepted') throw new Error(JSON.stringify(r));
    const s1 = r.workspace.sections.find((s) => s.id === 's1')!;
    expect(s1.distanceKm).toBe(12.5);
    expect(s1.surfaceSegments).toEqual([{ fromRatio: 0, toRatio: 1, surface: 'unknown', source: null }]);
    expect(r.workspace.variants[0].status).toBe('accepted');
    expect(compareVariants(r.workspace)).toEqual([]); // plus proposée
  });

  it('surfaceKnownShare', () => {
    expect(surfaceKnownShare({ surfaceSegments: [{ fromRatio: 0, toRatio: 0.5, surface: 'trail' }, { fromRatio: 0.5, toRatio: 1, surface: 'unknown' }] })).toBeCloseTo(0.5);
    expect(surfaceKnownShare({ surfaceSegments: [] })).toBe(0);
  });
});
