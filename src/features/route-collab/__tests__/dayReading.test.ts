import { describe, expect, it } from 'vitest';
import type { RoutePoi } from '@/features/compas/engine/routePois';
import { applyWorkspaceOperation } from '../engine';
import { NO_PLACES, dateLabelOf, defaultPace, describePace, paceOf, readDays, type DayPlaces } from '../dayReading';
import { PLACES_SOURCE, bailoutCandidatesFrom, nightOptionsFor, overnightCandidatesFrom, overnightFromNote, overnightFromStay, samplePointsAlong, suppliesAlong, waterObservationsFrom } from '../nights';
import { proposeStageSplit } from '../insights/stageSplit';
import { cutOperation, previewCut, profileData, rangeStats } from '../profileCuts';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import type { RouteWorkspaceState } from '../types';
import { orderedLegs, trackVertices } from '../insights/shared';

const NOW = '2026-11-22T10:00:00.000Z';

let id = 100;
const poi = (category: RoutePoi['category'], lat: number, lon: number, name: string | null = null): RoutePoi => ({ id: (id += 1), name, category, lat, lon, distanceM: 0, elevationM: null });

/** Quatre points vers l'est (3 × 10 km), deux jours : a→c (20 km, 1 200 m D+) puis c→d (10 km, 600 m D+). */
function ws(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const a = pt('a', 'a', 45.9, 6.0);
  const b = pt('b', 'b', 45.9, 6.13);
  const c = pt('c', 'c', 45.9, 6.26);
  const d = pt('d', 'd', 45.9, 6.39);
  return {
    ...baseWorkspace({
      sport: 'marche',
      points: [{ ...a, name: 'Départ' }, b, { ...c, name: 'Col' }, { ...d, name: 'Arrivée' }],
      sections: [section('s1', a, b), section('s2', b, c), section('s3', c, d)],
      stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24' }), stage('g2', 2, 'c', 'd', { dateIso: '2026-10-25' })],
      ...over,
    }),
    members: [{ userId: 'alice', displayName: 'Alice', role: 'owner' }],
  };
}

const ready = (pois: RoutePoi[]): DayPlaces => ({ status: 'ready', pois, fetchedAt: NOW });
const opts = (places: DayPlaces = NO_PLACES, pace = defaultPace()) => ({ pace, places, party: 3 });

describe('6.4 durées sur le plus lent', () => {
  it('Naismith avec l’allure du plus lent : plus long qu’avec l’allure standard', () => {
    const standard = readDays(ws(), opts())[0].duration;
    expect(standard.minutes).toBe(Math.round((20 / 4) * 60 + (1200 / 600) * 60)); // 420
    expect(standard.method).toMatch(/Naismith 4 km\/h \+ 600 m\/h/);
    expect(standard.method).toMatch(/non renseignée/);
    const slow = paceOf([{ id: 'u1', name: 'Marie', speedKmh: 3 }, { id: 'u2', name: 'Paul', speedKmh: 5 }, { id: 'u3', name: 'Léa' }]);
    const d = readDays(ws(), opts(NO_PLACES, slow))[0].duration;
    expect(d.minutes).toBe(Math.round((20 / 3) * 60 + 120));
    expect(d.minutes!).toBeGreaterThan(standard.minutes!);
    expect(d.method).toMatch(/allure du plus lent/);
    expect(describePace(slow, [{ id: 'u1', name: 'Marie', speedKmh: 3 }])).toMatch(/Calculé sur Marie \(3 km\/h\)/);
    expect(describePace(slow, [])).toMatch(/1 membre sans allure/);
    expect(describePace(defaultPace(), [])).toMatch(/Allure standard/);
  });

  it('une allure renseignée à la main compte comme un membre', () => {
    const p = paceOf([], 2.5);
    expect(p.params.speedKmh).toBe(2.5);
    expect(describePace(p, [{ id: 'manual', speedKmh: 2.5 }])).toMatch(/allure renseignée/);
  });

  it('D+ inconnu : durée minimale annoncée, jamais un D+ nul', () => {
    const w = ws();
    const noAsc = { ...w, sections: w.sections.map((s) => ({ ...s, ascentM: null })) };
    const d = readDays(noAsc, opts())[0];
    expect(d.ascentM).toBeNull();
    expect(d.duration.lowerBound).toBe(true);
    expect(d.duration.minutes).toBe(300);
  });

  it('à vélo : la durée du routeur, pas Naismith', () => {
    const d = readDays(ws({ sport: 'vtt' }), opts())[0].duration;
    expect(d.basis).toBe('router');
    expect(d.minutes).toBe(300);
  });
});

describe('6.5 heure de départ et coucher du soleil', () => {
  it('arrivée tôt : pas en retard ; départ tardif : arrivée après le coucher (orange)', () => {
    const early = readDays(ws(), opts())[0];
    expect(early.arrival.known).toBe(true);
    expect(early.arrival.late).toBe(false);
    expect(early.arrival.arrivalLocal).toBe('15:00');
    expect(early.arrival.sunsetLocal).toMatch(/^\d\d:\d\d$/);
    const lateWs = ws({ stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', departureTimeLocal: '14:30' }), stage('g2', 2, 'c', 'd', { dateIso: '2026-10-25' })] });
    const late = readDays(lateWs, opts())[0];
    expect(late.arrival.arrivalLocal).toBe('21:30');
    expect(late.arrival.late).toBe(true);
    expect(late.arrival.marginMin!).toBeLessThan(0);
  });

  it('l’heure de départ se règle par jour et le calcul suit', () => {
    const r = applyWorkspaceOperation(ws(), [], { opId: 's', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: { type: 'set_stage_schedule', stageId: 'g1', departureTimeLocal: '13:00' } }, NOW).result;
    if (r.status !== 'accepted') throw new Error('refusé');
    expect(readDays(r.workspace, opts())[0].arrival.arrivalLocal).toBe('20:00');
  });

  it('sans date : arrivée inconnue, dite', () => {
    const d = readDays(ws({ stages: [stage('g1', 1, 'a', 'c', { dateIso: null }), stage('g2', 2, 'c', 'd', { dateIso: null })] }), opts())[0];
    expect(d.arrival.known).toBe(false);
    expect(d.arrival.reason).toBe('date inconnue');
  });
});

describe('6.8 date et fuseau local', () => {
  it('la date s’écrit dans le fuseau du lieu et signale le changement d’heure', () => {
    expect(dateLabelOf('2026-10-24', 'Europe/Paris')).toBe('samedi 24 octobre 2026');
    const days = readDays(ws(), opts());
    expect(days[0].dayLengthHours).toBe(24);
    expect(days[0].dstChange).toBeNull();
    expect(days[1].dateIso).toBe('2026-10-25');
    expect(days[1].dstChange).toBe('back');
    expect(days[1].dayLengthHours).toBe(25);
  });

  it('un autre fuseau est respecté', () => {
    const w = ws({ stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', timezone: 'Pacific/Auckland' }), stage('g2', 2, 'c', 'd', { dateIso: '2026-10-25' })] });
    expect(readDays(w, opts())[0].timezone).toBe('Pacific/Auckland');
    expect(dateLabelOf('2026-10-24', 'Pacific/Auckland')).toBe('samedi 24 octobre 2026');
    expect(dateLabelOf(null, 'Europe/Paris')).toBeNull();
  });
});

describe('6.3 nuits réelles uniquement', () => {
  const refuge = poi('refuge', 45.9, 6.27, 'Refuge du Col');
  const hotel = poi('hebergement', 45.91, 6.265, 'Hôtel des Cimes');
  const camping = poi('camping', 45.9, 6.255, 'Camping du Lac');
  const faraway = poi('refuge', 46.4, 7.5, 'Refuge lointain');

  it('lieux classés comme le Compas v5, prix = repère du barème dit comme tel', () => {
    const options = nightOptionsFor({ arrival: { lat: 45.9, lon: 6.26 }, pois: [refuge, hotel, camping, faraway], noted: null, party: 3 });
    expect(options.map((o) => o.name)).not.toContain('Refuge lointain');
    expect(options.length).toBe(3);
    const priced = options.find((o) => o.name === 'Hôtel des Cimes')!;
    expect(priced.price?.basis).toBe('bareme');
    expect(options.find((o) => o.name === 'Camping du Lac')!.price).toBeNull();
    expect(options.every((o) => o.id.startsWith('osm:'))).toBe(true);
  });

  it('retenir un lieu garde sa position, sa source et son repère de barème', () => {
    const [first] = nightOptionsFor({ arrival: { lat: 45.9, lon: 6.26 }, pois: [refuge], noted: null, party: 2 });
    const night = overnightFromStay(first, NOW);
    expect(night).toMatchObject({ name: 'Refuge du Col', type: 'refuge', provenance: 'OpenStreetMap', lastVerifiedAt: NOW, bookingStatus: 'unknown' });
    expect(night.priceHint?.basis).toBe('bareme');
    expect(PLACES_SOURCE).toMatch(/OpenStreetMap/);
  });

  it('une nuit notée à la main est dite « saisie voyageur »', () => {
    const n = overnightFromNote('  Chez Marthe  ', 'gite', { lat: 45.9, lon: 6.26 }, NOW);
    expect(n.provenance).toBe('Saisie voyageur');
    expect(n.name).toBe('Chez Marthe');
  });

  it('sans lieu réel : « nuit à trouver », jamais un lieu inventé ; avant lecture : inconnu', () => {
    const none = readDays(ws(), opts(ready([])))[0].night;
    expect(none.status).toBe('to_find');
    expect(readDays(ws(), opts(NO_PLACES))[0].night).toEqual({ status: 'unknown', reason: 'not_loaded' });
    expect(readDays(ws(), opts({ status: 'loading', pois: [], fetchedAt: null }))[0].night).toEqual({ status: 'unknown', reason: 'loading' });
    expect(readDays(ws(), opts({ status: 'error', pois: [], fetchedAt: null }))[0].night).toEqual({ status: 'unknown', reason: 'error' });
    expect(readDays(ws(), opts(ready([])))[1].night.status).toBe('last');
  });

  it('avec des lieux relevés : candidats ; une nuit retenue passe en tête', () => {
    const cand = readDays(ws(), opts(ready([refuge, hotel])))[0].night;
    expect(cand.status).toBe('candidates');
    const chosen = overnightFromStay(nightOptionsFor({ arrival: { lat: 45.9, lon: 6.26 }, pois: [hotel], noted: null, party: 1 })[0], NOW);
    const withNight = ws({ stages: [stage('g1', 1, 'a', 'c', { overnightPlace: chosen }), stage('g2', 2, 'c', 'd')] });
    const n = readDays(withNight, opts(ready([refuge, hotel])))[0].night;
    expect(n.status).toBe('chosen');
    if (n.status === 'chosen') expect(n.options[0].name).toBe('Hôtel des Cimes');
  });

  it('lieux de nuit pour proposer un découpage : refuges, campings, hébergements seulement', () => {
    const cands = overnightCandidatesFrom([refuge, hotel, camping, poi('water', 45.9, 6.1), poi('resto', 45.9, 6.1)]);
    expect(cands.map((c) => c.type).sort()).toEqual(['camp', 'gite', 'refuge']);
  });
});

describe('6.1 découpage proposé et expliqué', () => {
  it('« 2 jours de … » avec la règle, les seuils modifiables et une nuit réelle', () => {
    const w = ws();
    const refuge = poi('refuge', 45.9, 6.195, 'Refuge du Col');
    const p = proposeStageSplit(w, { days: 2, maxHoursPerDay: 7, maxAscentPerDay: 1200, overnightCandidates: overnightCandidatesFrom([refuge]) });
    expect(p.ok).toBe(true);
    expect(p.stages.length).toBe(2);
    expect(p.stages[0].overnight?.name).toBe('Refuge du Col');
    expect(p.explanation).toMatch(/2 jours de .* h, nuit au refuge Refuge du Col/);
    expect(p.rule).toMatch(/Naismith/);
    expect(p.thresholds.maxHoursPerDay).toBe(7);
    const none = proposeStageSplit(w, { days: 2, maxHoursPerDay: 7, maxAscentPerDay: 1200, overnightCandidates: [] });
    expect(none.stages[0].overnightStatus).toBe('to_find');
    expect(none.explanation).toMatch(/nuit à trouver/);
  });

  it('seuils : sous un seuil bas, plus de jours ; le moteur applique la proposition', () => {
    const w = ws();
    const p = proposeStageSplit(w, { maxHoursPerDay: 4, maxAscentPerDay: 5000, overnightCandidates: [] });
    expect(p.stages.length).toBeGreaterThanOrEqual(2);
    const r = applyWorkspaceOperation(w, [], {
      opId: 'sp',
      baseSeq: 1,
      actorId: 'alice',
      actorName: 'Alice',
      operation: {
        type: 'apply_stage_split',
        cuts: p.stages.slice(0, -1).map((st, i) => ({ pointId: `cut-${i}`, lat: st.endLat, lon: st.endLon, name: null, overnightPlace: null })),
      },
    }, NOW).result;
    expect(r.status).toBe('accepted');
    if (r.status === 'accepted') expect(r.workspace.stages.length).toBe(p.stages.length);
  });
});

describe('6.6 eau et ravitaillement par jour', () => {
  it('plus longue distance sans eau d’une journée, à partir des seuls points relevés', () => {
    const w1 = poi('water', 45.9, 6.05, 'Source A');
    const w2 = poi('water', 45.9, 6.2, 'Fontaine B');
    const day = readDays(ws(), opts(ready([w1, w2])))[0];
    expect(day.waterPointCount).toBe(2);
    expect(day.water.status).toBe('known');
    expect(day.water.gapKm).toBeGreaterThan(5);
    expect(day.water.method).toMatch(/Distance entre points d'eau/);
  });

  it('aucun point relevé : « pas de donnée », jamais « aucune eau »', () => {
    const day = readDays(ws(), opts(ready([])))[0];
    expect(day.water.status).toBe('no_water_data');
    expect(day.water.gapKm).toBeNull();
  });

  it('un point déclaré à sec ne compte pas ; observations de l’étape et d’OpenStreetMap se cumulent', () => {
    const obs = { id: 'u1', name: 'Torrent', lat: 45.9, lon: 6.1, status: 'dry' as const, potableClaim: 'unknown' as const, observedAt: null, source: 'user' as const };
    const w = ws({ stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', waterObservations: [obs] }), stage('g2', 2, 'c', 'd')] });
    expect(readDays(w, opts(ready([])))[0].water.status).toBe('no_water_data');
    expect(waterObservationsFrom([poi('water', 45.9, 6.1)], NOW)[0]).toMatchObject({ status: 'unknown', potableClaim: 'unknown', source: 'osm' });
  });

  it('ravitaillement : commerces et restaurants à moins de 1 km du tracé, dans l’ordre', () => {
    const shop = poi('commerce', 45.903, 6.2, 'Épicerie');
    const resto = poi('resto', 45.9, 6.06, 'Auberge');
    const far = poi('commerce', 46.2, 6.2, 'Loin');
    const day = readDays(ws(), opts(ready([shop, resto, far])))[0];
    expect(day.supplies.map((s) => s.name)).toEqual(['Auberge', 'Épicerie']);
    expect(suppliesAlong(trackVertices(orderedLegs(ws())), [far])).toEqual([]);
  });
});

describe('6.10 repli par jour', () => {
  it('la sortie réelle la plus proche du tracé du jour', () => {
    const bus = poi('transport', 45.905, 6.2, 'Arrêt Les Prés');
    const parking = poi('parking', 45.95, 6.05, 'Parking du col');
    const day = readDays(ws(), opts(ready([bus, parking])))[0];
    expect(day.bailout.status).toBe('found');
    expect(day.bailout.label).toBe('Arrêt Les Prés');
    expect(day.bailout.hit?.distanceKm).toBeLessThan(1);
    expect(bailoutCandidatesFrom([bus, parking]).map((c) => c.kind)).toEqual(['transport_stop', 'road']);
  });

  it('aucun candidat réel : « Repli non évalué », avec la raison', () => {
    const idle = readDays(ws(), opts())[0].bailout;
    expect(idle).toMatchObject({ status: 'not_evaluated', label: 'Repli non évalué', reason: 'lieux pas encore relevés' });
    const none = readDays(ws(), opts(ready([poi('water', 45.9, 6.1)])))[0].bailout;
    expect(none).toMatchObject({ status: 'not_evaluated', label: 'Repli non évalué' });
    expect(none.reason).toMatch(/aucune route ni arrêt/);
  });
});

describe('6.7 jour de repos et étape courte dans la lecture', () => {
  it('un jour de repos : 0 km, 0 min, pas d’arrivée ni de repli, nuit gardée', () => {
    const night = overnightFromNote('Gîte de Pralognan', 'gite', { lat: 45.9, lon: 6.26 }, NOW);
    const r = applyWorkspaceOperation(ws({ stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', overnightPlace: night }), stage('g2', 2, 'c', 'd', { dateIso: '2026-10-25' })] }), [], { opId: 'r', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: { type: 'insert_rest_day', afterStageId: 'g1', stageId: 'rest' } }, NOW).result;
    if (r.status !== 'accepted') throw new Error('refusé');
    const days = readDays(r.workspace, opts());
    expect(days.map((d) => d.kind)).toEqual(['walk', 'rest', 'walk']);
    expect(days[1]).toMatchObject({ distanceKm: 0, ascentM: 0 });
    expect(days[1].duration).toMatchObject({ minutes: 0, basis: 'rest' });
    expect(days[1].arrival.known).toBe(false);
    expect(days[1].night.status).toBe('chosen');
    expect(days[2].dateIso).toBe('2026-10-26');
  });
});

describe('6.2 coupure déplacée sur le profil', () => {
  it('liste les coupures déplaçables avec leurs bornes', () => {
    const data = profileData(ws());
    expect(data.totalKm).toBeCloseTo(30, 0);
    expect(data.cuts.length).toBe(1);
    expect(data.cuts[0]).toMatchObject({ stageId: 'g1', movable: true });
    expect(data.cuts[0].km).toBeCloseTo(20, 0);
    expect(data.cuts[0].minKm).toBeGreaterThan(0);
    expect(data.cuts[0].maxKm).toBeLessThan(30);
  });

  it('aperçu immédiat sur les deux jours ; la somme des deux jours reste celle du tracé', () => {
    const w = ws();
    const pace = defaultPace().params;
    const p = previewCut(w, 'g1', 15, pace)!;
    expect(p.before.distanceKm).toBeCloseTo(15, 1);
    expect(p.after.distanceKm).toBeCloseTo(15, 1);
    expect(p.before.distanceKm + p.after.distanceKm).toBeCloseTo(30, 1);
    expect(p.before.durationMin).toBe(Math.round((15 / 4) * 60 + ((p.before.ascentM ?? 0) / 600) * 60));
    // reculer la coupure raccourcit le jour 1 et allonge le jour 2
    const earlier = previewCut(w, 'g1', 10, pace)!;
    expect(earlier.before.distanceKm).toBeLessThan(p.before.distanceKm);
    expect(earlier.after.distanceKm).toBeGreaterThan(p.after.distanceKm);
    expect(earlier.before.durationMin!).toBeLessThan(p.before.durationMin!);
  });

  it('borne la coupure dans les limites et refuse une coupure verrouillée (repos)', () => {
    const w = ws();
    const pace = defaultPace().params;
    const far = previewCut(w, 'g1', 999, pace)!;
    expect(far.km).toBeLessThan(30);
    const rest = applyWorkspaceOperation(w, [], { opId: 'r2', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: { type: 'insert_rest_day', afterStageId: 'g1', stageId: 'rest' } }, NOW).result;
    if (rest.status !== 'accepted') throw new Error('refusé');
    expect(previewCut(rest.workspace, 'g1', 15, pace)).toBeNull();
    expect(profileData(rest.workspace).cuts.every((c) => !c.movable)).toBe(true);
  });

  it('le geste validé déplace la coupure : les deux jours changent, pas les autres', () => {
    const w = ws();
    const op = cutOperation(w, 'g1', 14, 'cut-x', defaultPace().params)!;
    const r = applyWorkspaceOperation(w, [], { opId: 'c', baseSeq: 1, actorId: 'alice', actorName: 'Alice', operation: op }, NOW).result;
    if (r.status !== 'accepted') throw new Error(JSON.stringify(r));
    const days = readDays(r.workspace, opts());
    expect(days[0].distanceKm!).toBeCloseTo(14, 0);
    expect(days[1].distanceKm!).toBeCloseTo(16, 0);
  });

  it('rangeStats : D+ inconnu gardé inconnu', () => {
    const w = ws();
    const noAsc = { ...w, sections: w.sections.map((s, i) => (i === 0 ? { ...s, ascentM: null } : s)) };
    const v = trackVertices(orderedLegs(noAsc));
    expect(rangeStats(v, 0, 5, defaultPace().params, null).ascentM).toBeNull();
    expect(rangeStats(v, 12, 20, defaultPace().params, null).ascentM).not.toBeNull();
  });

  it('points d’échantillonnage le long d’un tracé', () => {
    const v = trackVertices(orderedLegs(ws()));
    expect(samplePointsAlong(v, 3).length).toBe(3);
    expect(samplePointsAlong([], 3)).toEqual([]);
  });
});

describe('6.3 nuit d’un découpage proposé', () => {
  it('un candidat réel devient une nuit avec sa source et son repère de barème', async () => {
    const { overnightFromCandidate } = await import('../nights');
    const n = overnightFromCandidate({ id: 'osm:9', name: 'Refuge X', type: 'refuge', lat: 45.9, lon: 6.2 }, NOW);
    expect(n).toMatchObject({ id: 'osm:9', provenance: 'OpenStreetMap', bookingStatus: 'unknown', lastVerifiedAt: NOW });
    expect(n.priceHint?.basis).toBe('bareme');
    const camp = overnightFromCandidate({ id: 'osm:10', name: 'Camp', type: 'camp', lat: 45.9, lon: 6.2 }, NOW);
    expect(camp.priceHint).toBeNull();
  });
});
