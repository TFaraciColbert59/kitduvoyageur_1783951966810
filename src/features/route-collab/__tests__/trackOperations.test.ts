import { describe, expect, it } from 'vitest';
import { activePoints, applyWorkspaceOperation, computeRoutingFingerprint, exportWorkspaceGpx } from '../engine';
import { sectionNeedsRouting } from '../engineTrack';
import { validateGpx11 } from '../insights/formats';
import type { RouteOperationInput, RouteWorkspaceState } from '../types';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';

const NOW = '2026-11-22T10:00:00.000Z';
let counter = 0;

function owner(ws: RouteWorkspaceState): RouteWorkspaceState {
  return { ...ws, members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }] };
}

/** Quatre points alignés vers l'est (3 tronçons de 10 km), deux journées : a→c puis c→d. */
function fourPoints(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const a = pt('a', 'a', 45.9, 6.0);
  const b = pt('b', 'b', 45.9, 6.13);
  const c = pt('c', 'c', 45.9, 6.26);
  const d = pt('d', 'd', 45.9, 6.39);
  return owner(
    baseWorkspace({
      sport: 'marche',
      points: [a, b, c, d],
      sections: [section('s1', a, b), section('s2', b, c), section('s3', c, d)],
      stages: [stage('g1', 1, 'a', 'c'), stage('g2', 2, 'c', 'd')],
      ...over,
    }),
  );
}

function apply(ws: RouteWorkspaceState, operation: RouteOperationInput, expectedVersions?: Record<string, number>) {
  counter += 1;
  return applyWorkspaceOperation(
    ws,
    [],
    { opId: `op-${counter}`, baseSeq: ws.headSeq, actorId: 'alice', actorName: 'Alice', operation, expectedVersions },
    NOW,
  ).result;
}

function accepted(ws: RouteWorkspaceState, operation: RouteOperationInput): RouteWorkspaceState {
  const r = apply(ws, operation);
  if (r.status !== 'accepted') throw new Error(`refusée : ${JSON.stringify(r)}`);
  return r.workspace;
}

const ids = (ws: RouteWorkspaceState) => activePoints(ws).map((p) => p.id);
const chain = (ws: RouteWorkspaceState) => ws.sections.map((s) => `${s.fromPointId}>${s.toPointId}`);

describe('5.3 supprimer un point recoud le tracé', () => {
  it('un tronçon routé : les deux voisins deviennent un seul tronçon direct à recalculer', () => {
    const ws = accepted(fourPoints(), { type: 'delete_point', pointId: 'b' });
    expect(ids(ws)).toEqual(['a', 'c', 'd']);
    expect(chain(ws)).toEqual(['a>c', 'c>d']);
    const joined = ws.sections[0];
    // seul le tronçon recousu attend un calcul ; l'autre garde son calcul d'origine.
    expect(sectionNeedsRouting(joined)).toBe(true);
    expect(sectionNeedsRouting(ws.sections[1])).toBe(false);
    expect(joined.routingInputHash).toBe(
      computeRoutingFingerprint({ from: pt('a', 'a', 45.9, 6.0), to: pt('c', 'c', 45.9, 6.26), sport: 'marche', options: {} }),
    );
  });

  it('un tracé à la main ou importé garde sa géométrie, sans trou', () => {
    const a = pt('a', 'a', 45.9, 6.0);
    const b = pt('b', 'b', 45.9, 6.13);
    const c = pt('c', 'c', 45.9, 6.26);
    const ws0 = owner(
      baseWorkspace({
        sport: 'marche',
        points: [a, b, c],
        sections: [
          section('s1', a, b, { mode: 'imported_preserved', routingInputHash: null }),
          section('s2', b, c, { mode: 'imported_preserved', routingInputHash: null }),
        ],
        stages: [stage('g1', 1, 'a', 'c')],
      }),
    );
    const ws = accepted(ws0, { type: 'delete_point', pointId: 'b' });
    expect(chain(ws)).toEqual(['a>c']);
    const coords = ws.sections[0].geometry.coordinates;
    expect(coords[0]).toEqual([6.0, 45.9]);
    expect(coords[coords.length - 1]).toEqual([6.26, 45.9]);
    expect(coords.length).toBe(5); // 3 + 3 - 1 sommet commun
    expect(ws.sections[0].distanceKm).toBeCloseTo(20, 1);
  });

  it('refuse de descendre sous deux points et recale la journée dont la fin disparaît', () => {
    const two = accepted(fourPoints(), { type: 'delete_point', pointId: 'd' });
    expect(apply(accepted(two, { type: 'delete_point', pointId: 'c' }), { type: 'delete_point', pointId: 'b' }).status).toBe('denied');
    // la fin de g1 était c : en supprimant c, g1 se recale sur le voisin qui reste (b).
    const noC = accepted(fourPoints(), { type: 'delete_point', pointId: 'c' });
    const g1 = noC.stages.find((s) => s.id === 'g1');
    expect(g1?.endPointId).toBe('b');
  });
});

describe('5.7 couper et fusionner un tronçon', () => {
  it('coupe au point voulu : deux moitiés, géométrie, D+ et durée conservés', () => {
    const ws0 = fourPoints();
    const s1 = ws0.sections[0];
    const midLon = (6.0 + 6.065) / 2;
    const ws = accepted(ws0, { type: 'split_section', sectionId: 's1', pointId: 'x', lat: 45.9, lon: midLon, name: 'Col' });
    expect(ids(ws)).toEqual(['a', 'x', 'b', 'c', 'd']);
    expect(chain(ws)).toEqual(['a>x', 'x>b', 'b>c', 'c>d']);
    const [left, right] = ws.sections;
    expect(left.distanceKm + right.distanceKm).toBeCloseTo(s1.distanceKm, 2);
    expect((left.ascentM ?? 0) + (right.ascentM ?? 0)).toBe(s1.ascentM);
    expect((left.durationMin ?? 0) + (right.durationMin ?? 0)).toBe(s1.durationMin);
    // le sommet de coupure est partagé : pas de trou
    expect(left.geometry.coordinates.at(-1)).toEqual(right.geometry.coordinates[0]);
    // la valeur répartie au prorata passe en « estimé », jamais en « vérifié »
    expect(left.provenance.confidence).toBe('estimated');
    expect(left.mode).toBe('routed');
  });

  it('refuse un lieu trop loin du tronçon ou un identifiant déjà pris', () => {
    expect(apply(fourPoints(), { type: 'split_section', sectionId: 's1', pointId: 'x', lat: 46.5, lon: 6.06 }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'split_section', sectionId: 's1', pointId: 'a', lat: 45.9, lon: 6.06 }).status).toBe('denied');
  });

  it('fusionne deux tronçons consécutifs sans rien recalculer, géométrie gardée', () => {
    const ws = accepted(fourPoints(), { type: 'merge_sections', sectionId: 's1', withSectionId: 's2' });
    // b sépare s1 et s2 mais c'est aussi la fin de journée ? non : g1 finit en c, g2 commence en c.
    expect(ids(ws)).toEqual(['a', 'c', 'd']);
    expect(chain(ws)).toEqual(['a>c', 'c>d']);
    const merged = ws.sections[0];
    expect(merged.distanceKm).toBeCloseTo(20, 2);
    expect(merged.ascentM).toBe(1200);
    expect(merged.geometry.coordinates.length).toBe(5);
    expect(sectionNeedsRouting(merged)).toBe(false);
  });

  it('refuse de fusionner de part et d’autre d’une coupure de journée ou deux tronçons qui ne se suivent pas', () => {
    expect(apply(fourPoints(), { type: 'merge_sections', sectionId: 's2', withSectionId: 's3' }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'merge_sections', sectionId: 's1', withSectionId: 's3' }).status).toBe('denied');
  });

  it('couper puis fusionner redonne le tracé d’origine (distance et D+)', () => {
    const base = fourPoints();
    const cut = accepted(base, { type: 'split_section', sectionId: 's1', pointId: 'x', lat: 45.9, lon: 6.065 });
    const sec = (id: string) => cut.sections.find((s) => s.toPointId === id)!;
    const back = accepted(cut, { type: 'merge_sections', sectionId: sec('x').id, withSectionId: cut.sections.find((s) => s.fromPointId === 'x')!.id });
    expect(back.sections[0].distanceKm).toBeCloseTo(base.sections[0].distanceKm, 2);
    expect(back.sections[0].ascentM).toBe(base.sections[0].ascentM);
  });
});

describe('5.2 inverser le sens', () => {
  it('retourne tracé, points, journées et nuits ; D+ et D− échangés ; calcul à refaire', () => {
    const night = { id: 'n1', name: 'Refuge X', type: 'refuge' as const, lat: 45.9, lon: 6.26, bookingStatus: 'unknown' as const, provenance: 'OpenStreetMap', lastVerifiedAt: null };
    const ws0 = fourPoints({ stages: [stage('g1', 1, 'a', 'c', { overnightPlace: night }), stage('g2', 2, 'c', 'd')] });
    const ws = accepted(ws0, { type: 'reverse_route' });
    expect(ids(ws).sort()).toEqual(['a', 'b', 'c', 'd']);
    const ordered = activePoints(ws);
    expect(ordered[0].id).toBe('d');
    expect(ws.sections.map((s) => s.fromPointId)).toEqual(['d', 'c', 'b']);
    expect(ws.sections[0].ascentM).toBe(300);
    expect(ws.sections[0].descentM).toBe(600);
    expect(ws.sections.every((s) => sectionNeedsRouting(s))).toBe(true);
    const days = ws.stages.slice().sort((x, y) => x.dayNumber - y.dayNumber);
    expect(days.map((s) => [s.startPointId, s.endPointId])).toEqual([
      ['d', 'c'],
      ['c', 'a'],
    ]);
    // la nuit suit le lieu : Refuge X est en c, désormais à la fin du jour 1
    expect(days[0].overnightPlace?.name).toBe('Refuge X');
    expect(days[1].overnightPlace).toBeNull();
  });
});

describe('6.2 déplacer une coupure', () => {
  it('place la fin de journée sur le tracé, crée le point, efface une nuit devenue fausse', () => {
    const night = { id: 'n1', name: 'Refuge X', type: 'refuge' as const, lat: 45.9, lon: 6.26, bookingStatus: 'unknown' as const, provenance: 'OpenStreetMap', lastVerifiedAt: null };
    const ws0 = fourPoints({ stages: [stage('g1', 1, 'a', 'c', { overnightPlace: night }), stage('g2', 2, 'c', 'd')] });
    const ws = accepted(ws0, { type: 'cut_stage_at', stageId: 'g1', pointId: 'cut1', lat: 45.9, lon: 6.2 });
    const g1 = ws.stages.find((s) => s.id === 'g1')!;
    const g2 = ws.stages.find((s) => s.id === 'g2')!;
    expect(g1.endPointId).toBe('cut1');
    expect(g2.startPointId).toBe('cut1');
    expect(g1.overnightPlace).toBeNull(); // 4 km plus loin que le refuge
    expect(ids(ws)).toContain('cut1');
    expect(chain(ws).length).toBe(4);
  });

  it('réutilise un point existant à moins de 30 m et refuse hors du couloir des deux jours', () => {
    const ws = accepted(fourPoints(), { type: 'cut_stage_at', stageId: 'g1', pointId: 'cutB', lat: 45.9, lon: 6.1301 });
    expect(ws.stages.find((s) => s.id === 'g1')!.endPointId).toBe('b');
    expect(ids(ws)).not.toContain('cutB');
    expect(apply(fourPoints(), { type: 'cut_stage_at', stageId: 'g1', pointId: 'z', lat: 45.9, lon: 5.9 }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'cut_stage_at', stageId: 'g2', pointId: 'z', lat: 45.9, lon: 6.3 }).status).toBe('denied');
  });
});

describe('6.7 jour de repos et étape courte', () => {
  it('insère un jour de repos sans tracé, décale les dates, se retire sans rien perdre', () => {
    const ws0 = fourPoints({ stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-07-10' }), stage('g2', 2, 'c', 'd', { dateIso: '2026-07-11' })] });
    const ws = accepted(ws0, { type: 'insert_rest_day', afterStageId: 'g1', stageId: 'rest1' });
    const days = ws.stages.slice().sort((x, y) => x.dayNumber - y.dayNumber);
    expect(days.map((s) => s.id)).toEqual(['g1', 'rest1', 'g2']);
    expect(days.map((s) => s.dayNumber)).toEqual([1, 2, 3]);
    expect(days[1].kind).toBe('rest');
    expect(days[1].startPointId).toBe(days[1].endPointId);
    expect(days.map((s) => s.dateIso)).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
    expect(days[2].title).toBe('Jour 3');
    expect(ws.sections.length).toBe(3); // aucun tracé ajouté
    const back = accepted(ws, { type: 'remove_stage', stageId: 'rest1' });
    expect(back.stages.map((s) => [s.id, s.dayNumber, s.dateIso])).toEqual([
      ['g1', 1, '2026-07-10'],
      ['g2', 2, '2026-07-11'],
    ]);
  });

  it('refuse un repos en dernier jour et le retrait d’un jour de marche', () => {
    expect(apply(fourPoints(), { type: 'insert_rest_day', afterStageId: 'g2', stageId: 'r' }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'remove_stage', stageId: 'g1' }).status).toBe('denied');
  });

  it('étape courte : aller-retour depuis la même nuit, tracé suivant intact', () => {
    const ws = accepted(fourPoints(), {
      type: 'insert_short_stage',
      afterStageId: 'g1',
      stageId: 'short1',
      turnaroundPointId: 'turn1',
      returnPointId: 'back1',
      lat: 45.93,
      lon: 6.26,
      name: 'Belvédère',
    });
    const days = ws.stages.slice().sort((x, y) => x.dayNumber - y.dayNumber);
    expect(days.map((s) => s.id)).toEqual(['g1', 'short1', 'g2']);
    const short = days[1];
    expect(short.kind).toBe('short');
    expect(short.startPointId).toBe('c');
    expect(short.endPointId).toBe('back1');
    // le jour suivant repart du retour (même lieu que la nuit)
    expect(days[2].startPointId).toBe('back1');
    expect(ids(ws)).toEqual(['a', 'b', 'c', 'turn1', 'back1', 'd']);
    expect(chain(ws)).toEqual(['a>b', 'b>c', 'c>turn1', 'turn1>back1', 'back1>d']);
    const next = ws.sections.find((s) => s.fromPointId === 'back1')!;
    expect(next.geometry.coordinates).toEqual(fourPoints().sections[2].geometry.coordinates);
    // retrait : le tracé redevient celui d'origine
    const back = accepted(ws, { type: 'remove_stage', stageId: 'short1' });
    expect(ids(back)).toEqual(['a', 'b', 'c', 'd']);
    expect(chain(back)).toEqual(['a>b', 'b>c', 'c>d']);
    expect(back.stages.map((s) => [s.id, s.startPointId, s.endPointId])).toEqual([
      ['g1', 'a', 'c'],
      ['g2', 'c', 'd'],
    ]);
    expect(back.sections.find((s) => s.fromPointId === 'c')!.geometry.coordinates).toEqual(
      fourPoints().sections[2].geometry.coordinates,
    );
  });
});

describe('6.5 6.8 horaire, date et fuseau d’une journée', () => {
  it('règle heure, date et fuseau ; la date enchaîne les journées suivantes', () => {
    const ws = accepted(fourPoints(), {
      type: 'set_stage_schedule',
      stageId: 'g1',
      departureTimeLocal: '06:30',
      dateIso: '2026-10-24',
      timezone: 'Europe/Paris',
      chainFollowing: true,
    });
    const g1 = ws.stages.find((s) => s.id === 'g1')!;
    const g2 = ws.stages.find((s) => s.id === 'g2')!;
    expect(g1.departureTimeLocal).toBe('06:30');
    expect(g1.dateIso).toBe('2026-10-24');
    expect(g2.dateIso).toBe('2026-10-25');
  });

  it('refuse une heure, une date ou un fuseau invalides', () => {
    expect(apply(fourPoints(), { type: 'set_stage_schedule', stageId: 'g1', departureTimeLocal: '25:00' }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'set_stage_schedule', stageId: 'g1', dateIso: '2026-02-31' }).status).toBe('denied');
    expect(apply(fourPoints(), { type: 'set_stage_schedule', stageId: 'g1', timezone: 'Mars/Olympus' }).status).toBe('denied');
  });
});

describe('6.1 appliquer un découpage proposé', () => {
  it('pose les coupures sur le tracé et les nuits réelles choisies', () => {
    const night = { id: 'osm:1', name: 'Refuge du Col', type: 'refuge' as const, lat: 45.9, lon: 6.13, bookingStatus: 'unknown' as const, provenance: 'OpenStreetMap', lastVerifiedAt: NOW };
    const ws = accepted(fourPoints(), {
      type: 'apply_stage_split',
      cuts: [
        { pointId: 'k1', lat: 45.9, lon: 6.13, name: 'Refuge du Col', overnightPlace: night },
        { pointId: 'k2', lat: 45.9, lon: 6.3, name: null, overnightPlace: null },
      ],
    });
    const days = ws.stages.slice().sort((x, y) => x.dayNumber - y.dayNumber);
    expect(days.length).toBe(3);
    expect(days[0].overnightPlace?.name).toBe('Refuge du Col');
    expect(days[1].overnightPlace).toBeNull(); // « nuit à trouver »
    expect(days[2].overnightPlace).toBeNull();
    expect(days[0].startPointId).toBe('a');
    expect(days[2].endPointId).toBe('d');
    // la coupure à 6,13 réutilise le point b existant
    expect(days[0].endPointId).toBe('b');
  });

  it('refuse des coupures qui ne se suivent pas', () => {
    expect(
      apply(fourPoints(), {
        type: 'apply_stage_split',
        cuts: [
          { pointId: 'k1', lat: 45.9, lon: 6.3, name: null, overnightPlace: null },
          { pointId: 'k2', lat: 45.9, lon: 6.13, name: null, overnightPlace: null },
        ],
      }).status,
    ).toBe('denied');
  });
});

describe('5.6 points modifiables', () => {
  it('renomme un point et sa note sans toucher au tracé', () => {
    const ws0 = fourPoints();
    const ws = accepted(ws0, { type: 'update_point', pointId: 'b', name: '  Col de la Croix  ', note: 'Source à 200 m' });
    const b = ws.points.find((p) => p.id === 'b')!;
    expect(b.name).toBe('Col de la Croix');
    expect(b.note).toBe('Source à 200 m');
    expect(ws.sections).toEqual(ws0.sections);
    expect(apply(ws0, { type: 'update_point', pointId: 'zz', name: 'x' }).status).toBe('denied');
  });
});

describe('5.5 recalcul jamais écrasé par un vieux résultat', () => {
  const geometry = { type: 'LineString' as const, coordinates: [[6.0, 45.9], [6.13, 45.9]] as [number, number][] };
  const result = (hash: string): RouteOperationInput => ({
    type: 'apply_routing_result',
    sectionId: 's1',
    routingInputHash: hash,
    geometry,
    distanceKm: 11,
    durationMin: 120,
    ascentM: 100,
    descentM: 50,
    provenance: { provider: 'valhalla', calculatedAt: NOW, profile: 'marche', confidence: 'verified' },
  });

  it('un résultat dont l’empreinte n’est plus celle du tronçon est rejeté, avec un message clair', () => {
    const ws0 = fourPoints();
    const old = ws0.sections[0].routingInputHash!;
    // le point est déplacé entre-temps : l'empreinte du tronçon change
    const moved = accepted(ws0, { type: 'move_point', pointId: 'b', lat: 45.91, lon: 6.14 });
    const r = apply(moved, result(old));
    expect(r.status).toBe('stale_routing_discarded');
    if (r.status === 'stale_routing_discarded') {
      expect(r.reason).toMatch(/Calcul rejeté/);
      expect(r.reason).toMatch(/relancez/);
    }
  });

  it('un résultat à l’empreinte courante est accepté', () => {
    const moved = accepted(fourPoints(), { type: 'move_point', pointId: 'b', lat: 45.91, lon: 6.14 });
    const current = moved.sections[0].routingInputHash!;
    const r = apply(moved, result(current));
    expect(r.status).toBe('accepted');
  });

  it('un changement de profil invalide les résultats en vol', () => {
    const ws0 = fourPoints();
    const old = ws0.sections[0].routingInputHash!;
    const changed = accepted(ws0, { type: 'set_sport_profile', sport: 'vtt', routingOptions: {} });
    expect(apply(changed, result(old)).status).toBe('stale_routing_discarded');
  });
});

describe('5.1 profil et options de routage', () => {
  it('le profil et les options changent l’empreinte et marquent les tronçons à recalculer', () => {
    const ws = accepted(fourPoints(), {
      type: 'set_sport_profile',
      sport: 'marche',
      routingOptions: { surfacePref: 'prefer_trails' },
    });
    expect(ws.routingOptions.surfacePref).toBe('prefer_trails');
    expect(ws.sections.every((s) => sectionNeedsRouting(s))).toBe(true);
  });
});

describe('5.9 export complet ou par étape, validé GPX 1.1', () => {
  it('l’export complet et celui d’une étape sont des GPX 1.1 valides', () => {
    const ws = fourPoints();
    expect(validateGpx11(exportWorkspaceGpx(ws)).valid).toBe(true);
    const day = validateGpx11(exportWorkspaceGpx(ws, 'g2'));
    expect(day.errors).toEqual([]);
    expect(day.valid).toBe(true);
  });
});

describe('5.9 import_track', () => {
  it('remplace le tracé par la trace importée, une seule journée, provenance gardée', () => {
    const a = pt('i-a', 'A', 46.0, 6.0);
    const b = pt('i-b', 'Z', 46.0, 6.05);
    const sec = section('i-s', a, b, { mode: 'imported_preserved', routingInputHash: null });
    const ws = accepted(fourPoints(), {
      type: 'import_track',
      points: [a, b],
      sections: [sec],
      sourceOrigin: { kind: 'gpx_import', sourceTitle: 'sortie.gpx' },
    });
    expect(ids(ws)).toEqual(['i-a', 'i-b']);
    expect(ws.sections.map((s) => s.id)).toEqual(['i-s']);
    expect(ws.stages.length).toBe(1);
    expect(ws.stages[0].startPointId).toBe('i-a');
    expect(ws.sourceOrigin.kind).toBe('gpx_import');
  });

  it('une trace dont les identifiants reprennent ceux d’un point retiré ne crée pas de doublon', () => {
    const a = pt('a', 'A', 46.0, 6.0);
    const b = pt('d', 'Z', 46.0, 6.05);
    const sec = section('i-s', a, b, { mode: 'imported_preserved', routingInputHash: null });
    const ws = accepted(fourPoints(), { type: 'import_track', points: [a, b], sections: [sec], sourceOrigin: { kind: 'gpx_import' } });
    expect(ws.points.filter((p) => p.id === 'a').length).toBe(1);
    expect(ids(ws)).toEqual(['a', 'd']);
  });

  it('refuse une trace incohérente', () => {
    const a = pt('i-a', 'A', 46.0, 6.0);
    const b = pt('i-b', 'Z', 46.0, 6.05);
    expect(apply(fourPoints(), { type: 'import_track', points: [a, b], sections: [], sourceOrigin: { kind: 'gpx_import' } }).status).toBe('denied');
  });
});

describe('5.10 revenir à cette version crée une nouvelle séquence', () => {
  it('restaure les points, tronçons et journées de la version sans effacer l’historique', () => {
    const ws0 = fourPoints();
    const snapshot = {
      id: 'rev-v1',
      workspaceId: 'w',
      revisionNo: 1,
      parentRevisionId: null,
      basedOnSeq: 1,
      createdBy: 'alice',
      createdByName: 'Alice',
      createdAt: NOW,
      kind: 'published' as const,
      summary: 'v1',
      points: ws0.points,
      sections: ws0.sections,
      stages: ws0.stages,
      kitSnapshot: [],
      acknowledgedUnknowns: [],
    };
    const withRev: RouteWorkspaceState = { ...ws0, revisions: [snapshot], publishedRevisionNo: 1, publishedRevisionId: 'rev-v1' };
    const edited = accepted(withRev, { type: 'delete_point', pointId: 'b' });
    expect(ids(edited)).toEqual(['a', 'c', 'd']);
    const reverted = accepted(edited, { type: 'revert_to_seq', targetSeq: 1, revisionId: 'rev-v1', reason: 'Retour' });
    expect(ids(reverted)).toEqual(['a', 'b', 'c', 'd']);
    expect(reverted.headSeq).toBe(edited.headSeq + 1);
    expect(reverted.revisions.length).toBe(1);
    expect(chain(reverted)).toEqual(['a>b', 'b>c', 'c>d']);
    expect(apply(edited, { type: 'revert_to_seq', targetSeq: 9, revisionId: 'rev-inconnue', reason: 'x' }).status).toBe('denied');
  });
});
