import { describe, expect, it } from 'vitest';
import { computeRouteImpact } from '../../engine';
import { baseWorkspace, kit, stage } from '../../insights/__tests__/fixtures';
import type { OvernightPlace, RouteRevisionSnapshot, RouteWorkspaceState } from '../../types';
import { clearHandoff, cockpitHref, handoffBody, handoffFromRevision, readHandoffFor, writeHandoff, HANDOFF_MAX_AGE_MS } from '../activityHandoff';
import { comparePlanToActual, overlayPaths, type RecordedSession } from '../carnetCompare';
import { formatBytes, packAnnouncement } from '../packInfo';
import { canSeeParticipants, participantRows, participantsSummary } from '../participants';
import { publishPreview } from '../publishSummary';
import { departReading } from '../readiness';
import { inferDependsOn, mergeTripKit, tripItemToKitItem, type TripItemRow } from '../tripKit';

const members = [
  { userId: 'u1', displayName: 'Alice' },
  { userId: 'u2', displayName: 'Bob' },
];
const row = (id: string, name: string, over: Partial<TripItemRow> = {}): TripItemRow => ({ id, item_name: name, category: null, quantity: 1, weight_grams: 500, ownership: 'personal', owner_id: 'u1', ...over });
const place = (type: OvernightPlace['type']): OvernightPlace => ({ id: 'n1', name: 'Nuit', type, lat: 45.9, lon: 6.13, bookingStatus: 'unknown', provenance: 'test', lastVerifiedAt: null });

describe('9.1 · le sac vient du kit du voyage (trip_items)', () => {
  it('un objet du voyage devient un objet de l’itinéraire à identifiant stable, importé une seule fois', () => {
    const rows = [row('a', 'Tente 2 places', { ownership: 'shared', owner_id: null, weight_grams: 1800 }), row('b', 'Lampe frontale')];
    const first = mergeTripKit([], rows, members);
    expect(first.added.map((i) => i.id)).toEqual(['trip-item-a', 'trip-item-b']);
    expect(first.added[0]).toMatchObject({ shared: true, assigneeUserId: null, status: 'unassigned', weightGrams: 1800 });
    expect(first.added[1]).toMatchObject({ shared: false, assigneeUserId: 'u1', assigneeName: 'Alice', status: 'confirmed' });
    const again = mergeTripKit(first.items, rows, members);
    expect(again.added).toEqual([]);
    expect(again.items).toHaveLength(2);
    expect(again.refreshed).toBe(0);
  });

  it('une attribution faite dans l’itinéraire n’est pas écrasée ; le poids suit le sac du voyage', () => {
    const imported = mergeTripKit([], [row('a', 'Tente', { ownership: 'shared', owner_id: null })], members).items;
    const assigned = imported.map((i) => ({ ...i, assigneeUserId: 'u2', assigneeName: 'Bob', status: 'confirmed' as const }));
    const next = mergeTripKit(assigned, [row('a', 'Tente', { ownership: 'shared', owner_id: null, weight_grams: 1500 })], members);
    expect(next.items[0]).toMatchObject({ assigneeUserId: 'u2', weightGrams: 1500, status: 'confirmed' });
    expect(next.refreshed).toBe(1);
  });

  it('un objet retiré du voyage est gardé et signalé ; un objet sans règle n’est jamais revérifié, et c’est dit', () => {
    const first = mergeTripKit([], [row('a', 'Tente'), row('z', 'Carnet de notes')], members);
    const next = mergeTripKit(first.items, [row('z', 'Carnet de notes')], members);
    expect(next.orphanIds).toEqual(['trip-item-a']);
    expect(next.items).toHaveLength(2);
    expect(next.neverRechecked).toBe(1);
    expect(tripItemToKitItem(row('q', 'Truc'), members).dependsOn).toEqual([]);
    expect(inferDependsOn('Réchaud à gaz', null)).toEqual(['overnight']);
    expect(inferDependsOn('Filtre à eau', 'hydratation')).toEqual(['water']);
  });
});

describe('9.2 · seuls les objets touchés sont à revérifier', () => {
  it('passer d’un refuge à un bivouac marque la tente et le réchaud, pas le reste du sac', () => {
    const items = mergeTripKit([], [row('t', 'Tente'), row('r', 'Réchaud'), row('l', 'Lampe frontale'), row('f', 'Filtre à eau'), row('c', 'Carnet')], members).items;
    const before: RouteWorkspaceState = baseWorkspace({ kitItems: items, stages: [stage('g1', 1, 'a', 'b', { overnightPlace: place('refuge') }), stage('g2', 2, 'b', 'c')] });
    const after: RouteWorkspaceState = { ...before, stages: [stage('g1', 1, 'a', 'b', { overnightPlace: place('bivouac') }), stage('g2', 2, 'b', 'c')] };
    const impact = computeRouteImpact(before, after);
    expect(impact.kitItemsToRevalidate.map((k) => k.itemName).sort()).toEqual(['Réchaud', 'Tente']);
  });
});

describe('9.7 · une seule liste de départ : celle du HUB', () => {
  const ws = baseWorkspace({ publishedRevisionNo: 2, kitItems: [kit('k1', { assigneeUserId: 'u1', shared: false })] });
  it('le score ne porte que sur ce qui est connu, les inconnus sont comptés', () => {
    const r = departReading({ workspace: ws, pack: null, checklist: null, safetyContacts: null, participants: null });
    expect(r.facts.find((f) => f.id === 'checklist')?.state).toBe('unknown');
    expect(r.facts.find((f) => f.id === 'safety')?.state).toBe('unknown');
    expect(r.unknownCount).toBe(2);
    expect(r.facts.find((f) => f.id === 'pack')?.state).toBe('todo');
    expect(r.scorePct).toBe(75);
  });
  it('la checklist du HUB faite et un contact : prêt', () => {
    const pack = { manifest: { revisionNo: 2 } } as never;
    const r = departReading({ workspace: ws, pack, checklist: { total: 5, done: 5 }, safetyContacts: 1, participants: { ready: 2, total: 2 } });
    expect(r.scorePct).toBe(100);
    expect(r.label).toBe('Prêt pour le départ');
    expect(departReading({ workspace: ws, pack, checklist: { total: 5, done: 3 }, safetyContacts: 0, participants: null }).facts.find((f) => f.id === 'checklist')?.detail).toBe('3 sur 5 faits');
  });
});

describe('9.4 · publier avec le résumé des changements sur la version relue', () => {
  const rev = (ws: RouteWorkspaceState): RouteRevisionSnapshot => ({
    id: 'rev1', workspaceId: ws.id, revisionNo: 1, parentRevisionId: null, basedOnSeq: 1, createdBy: 'u1', createdByName: 'A', createdAt: '2026-07-02T00:00:00Z', kind: 'published', summary: 'v1',
    points: ws.points, sections: ws.sections, stages: ws.stages, kitSnapshot: ws.kitItems, acknowledgedUnknowns: [],
  });
  it('première version : chiffres du plan', () => {
    const p = publishPreview(baseWorkspace());
    expect(p.first).toBe(true);
    expect(p.nextNo).toBe(1);
    expect(p.summary).toMatch(/^Première version : .* km, 2 étapes, 0 objet/);
  });
  it('version suivante : écart par jour, nuit déplacée, objets à revérifier', () => {
    const base = baseWorkspace({ kitItems: [kit('t', { name: 'Tente', dependsOn: ['overnight'] })], stages: [stage('g1', 1, 'a', 'b', { overnightPlace: place('refuge') }), stage('g2', 2, 'b', 'c')] });
    const published = { ...base, publishedRevisionNo: 1, publishedRevisionId: 'rev1', revisions: [rev(base)] };
    const longer = { ...published, headSeq: 7, sections: [{ ...base.sections[0], distanceKm: 14 }, base.sections[1]], stages: [stage('g1', 1, 'a', 'b', { overnightPlace: { ...place('bivouac'), id: 'n2' } }), stage('g2', 2, 'b', 'c')], kitItems: [kit('t', { name: 'Tente', dependsOn: ['overnight'], status: 'needs_revalidation' })] };
    const p = publishPreview(longer);
    expect(p.first).toBe(false);
    expect(p.nextNo).toBe(2);
    expect(p.basedOnSeq).toBe(7);
    expect(p.sentence).toMatch(/\+4 km le jour 1/);
    expect(p.sentence).toMatch(/nuit déplacée/);
    expect(p.sentence).toMatch(/1 objet à revérifier/);
    expect(p.summary.length).toBeLessThanOrEqual(240);
    expect(publishPreview({ ...published }).sentence).toBe('Aucun changement relevé');
  });
});

describe('9.5 · état de chaque participant, vu par l’organisateur', () => {
  const ws = baseWorkspace({
    publishedRevisionNo: 2,
    members: [
      { userId: 'u1', displayName: 'Alice', role: 'owner' },
      { userId: 'u2', displayName: 'Bob', role: 'participant' },
      { userId: 'u3', displayName: 'Chloé', role: 'participant' },
      { userId: 'u4', displayName: 'Dan', role: 'participant' },
    ],
    participantPacks: [
      { userId: 'u1', displayName: 'Alice', preparedRevisionNo: 2, downloadedRevisionNo: 2, verifiedLocalAt: '2026-07-02T00:00:00Z', status: 'ready' },
      { userId: 'u2', displayName: 'Bob', preparedRevisionNo: 1, downloadedRevisionNo: 1, verifiedLocalAt: '2026-07-01T00:00:00Z', status: 'outdated' },
    ],
  });
  it('prêt, « v1 téléchargée · v2 disponible », « pas encore ouvert »', () => {
    const rows = participantRows(ws);
    expect(rows.map((r) => r.label)).toEqual(['Prêt · v2', 'v1 téléchargée · v2 disponible', 'Pas encore ouvert', 'Pas encore ouvert']);
    expect(participantsSummary(rows)).toEqual({ ready: 1, total: 4 });
  });
  it('seul l’organisateur voit les autres', () => {
    expect(canSeeParticipants(ws, 'u1')).toBe(true);
    expect(canSeeParticipants(ws, 'u2')).toBe(false);
    expect(canSeeParticipants(ws, 'inconnu')).toBe(false);
  });
});

describe('9.6 · taille annoncée avant le téléchargement', () => {
  it('manifeste de la dernière version, sinon estimation, sinon inconnue', () => {
    const ws = baseWorkspace();
    expect(formatBytes(1536)).toBe('1,5 Ko');
    expect(formatBytes(2_621_440)).toBe('2,5 Mo');
    expect(packAnnouncement(ws, { revisionNo: 3, estimatedBytes: 20480 } as never)).toMatchObject({ basis: 'manifest', text: 'Pack v3 : environ 20,0 Ko' });
    const est = packAnnouncement(ws, null);
    expect(est.basis).toBe('estimate');
    expect(est.bytes).toBeGreaterThan(0);
    expect(est.mapNote).toMatch(/Fonds de carte non inclus/);
    expect(packAnnouncement({ ...ws, points: [] }, null)).toMatchObject({ basis: 'none', bytes: null });
  });
});

describe('9.8 · démarrer l’activité depuis la version', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  const ws = baseWorkspace({ kitItems: [kit('k1', { assigneeUserId: 'u1' })] });
  const revision = { id: 'rev1', workspaceId: 'w', revisionNo: 2, kitSnapshot: ws.kitItems } as unknown as RouteRevisionSnapshot;
  it('la passation lie version et sac au voyage, expire et ne sert qu’à ce voyage', () => {
    const s = store();
    const h = handoffFromRevision('trip-1', revision, '2026-07-05T08:00:00Z');
    expect(writeHandoff(h, s)).toBe(true);
    const now = Date.parse('2026-07-05T09:00:00Z');
    expect(readHandoffFor('trip-1', now, s)).toMatchObject({ workspaceId: 'w', revisionId: 'rev1', revisionNo: 2 });
    expect(readHandoffFor('trip-2', now, s)).toBeNull();
    expect(readHandoffFor('trip-1', now + HANDOFF_MAX_AGE_MS + 1000, s)).toBeNull();
    expect(handoffBody(readHandoffFor('trip-1', now, s))).toMatchObject({ routeWorkspaceId: 'w', routeRevisionId: 'rev1' });
    expect(handoffBody(null)).toEqual({});
    clearHandoff(s);
    expect(readHandoffFor('trip-1', now, s)).toBeNull();
    expect(cockpitHref('abc')).toBe('/randonnee-active?tripId=abc');
  });
});

describe('9.9 · carnet : plan contre réel', () => {
  const plan = baseWorkspace({ kitItems: [kit('k1', { name: 'Tente', weightGrams: 1000 }), kit('k2', { name: 'Réchaud', weightGrams: 400 })] });
  const ordered = plan.stages;
  const sample = (lon: number, t: string | null) => ({ lat: 45.9, lon, t });
  const session = (track: ReturnType<typeof sample>[], over: Partial<RecordedSession> = {}): RecordedSession => ({
    sessionId: 's1', startedAt: '2026-07-10T08:00:00Z', endedAt: '2026-07-10T18:00:00Z', distanceKm: 18, durationSeconds: 36000, elevationGainM: 900, track, kitSnapshot: [{ id: 'k1', name: 'Tente', category: 'x', weightGrams: 1000, quantity: 1, shared: true, assigneeUserId: 'u1' }, { id: 'k9', name: 'Thermos', category: 'x', weightGrams: 300, quantity: 1, shared: false, assigneeUserId: 'u1' }], routeRevisionId: 'rev1', ...over,
  });
  it('écart de distance, temps par jour, sac emporté contre sac prévu', () => {
    const track = [sample(6.0, '2026-07-10T08:00:00Z'), sample(6.065, '2026-07-10T09:30:00Z'), sample(6.13, '2026-07-10T11:00:00Z'), sample(6.2, '2026-07-10T12:30:00Z'), sample(6.26, '2026-07-10T14:00:00Z')];
    const r = comparePlanToActual({ points: plan.points, sections: plan.sections, stages: ordered, kitSnapshot: plan.kitItems }, session(track));
    expect(r.plannedKm).toBe(20);
    expect(r.deltaKm).toBe(-2);
    expect(r.days[0]).toMatchObject({ day: 1, reached: true, plannedMin: 150, actualMin: 180, deltaMin: 30 });
    expect(r.days[1]).toMatchObject({ day: 2, reached: true, actualMin: 180, deltaMin: 30 });
    expect(r.kit).toMatchObject({ planned: 2, carried: 2, missing: ['Réchaud'], extra: ['Thermos'], plannedGrams: 1400, carriedGrams: 1300 });
  });
  it('un arrêt de plus de 2 h (nuit) n’est pas compté dans le temps réel', () => {
    const track = [sample(6.0, '2026-07-10T08:00:00Z'), sample(6.13, '2026-07-10T10:00:00Z'), sample(6.2, '2026-07-11T07:00:00Z'), sample(6.26, '2026-07-11T08:30:00Z')];
    const r = comparePlanToActual({ points: plan.points, sections: plan.sections, stages: ordered }, session(track));
    expect(r.days[0].actualMin).toBe(120);
    expect(r.days[1].actualMin).toBe(90);
  });
  it('sans horodatage ou sans arrivée atteinte : aucun écart inventé', () => {
    const noTime = comparePlanToActual({ points: plan.points, sections: plan.sections, stages: ordered }, session([sample(6.0, null), sample(6.13, null), sample(6.26, null)]));
    expect(noTime.days.every((d) => d.reached && d.actualMin === null && d.deltaMin === null)).toBe(true);
    expect(noTime.days[0].reason).toBe('trace sans horodatage');
    const short = comparePlanToActual({ points: plan.points, sections: plan.sections, stages: ordered }, session([sample(6.0, '2026-07-10T08:00:00Z'), sample(6.05, '2026-07-10T09:00:00Z')], { kitSnapshot: null }));
    expect(short.days[0]).toMatchObject({ reached: false, reason: 'arrivée non atteinte par la trace', deltaMin: null });
    expect(short.kit.carried).toBeNull();
    expect(short.kit.missing).toEqual([]);
  });
  it('superposition : deux chemins SVG dans le même cadre', () => {
    const o = overlayPaths([[6, 45.9], [6.26, 45.9]], [[6.01, 45.9005], [6.25, 45.9]], 300, 160);
    expect(o?.plannedPath).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(o?.actualPath.startsWith('M')).toBe(true);
    expect(overlayPaths([], [], 300, 160)).toBeNull();
    expect(overlayPaths([[6, 45.9], [6.2, 45.9]], [], 300, 160)?.actualPath).toBe('');
  });
});
