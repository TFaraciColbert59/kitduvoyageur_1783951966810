import { describe, expect, it } from 'vitest';
import { baseWorkspace, kit } from '../../insights/__tests__/fixtures';
import { defaultPace, NO_PLACES, readDays } from '../../dayReading';
import { buildProfileModel } from '../../profileLink';
import type { RouteWorkspaceState, WaterObservation } from '../../types';
import { alertsFromFire, alertsFromOfficial, readAlerts, type FireAlertPayload } from '../alerts';
import { buildAnalysis, dayPassages, packOf, trackForFire, type AnalysisInput } from '../analysis';
import { passageWeatherOf, pickPassageHour } from '../passageWeather';
import { dataSourceAttrs, UNKNOWN_DATE } from '../provenance';

const NOW = new Date('2026-07-05T10:00:00Z');

function withElevation(over: Partial<RouteWorkspaceState> = {}): RouteWorkspaceState {
  const ws = baseWorkspace({ sport: 'marche', ...over });
  const sections = [
    { ...ws.sections[0], elevationSamples: [1000, 1100, 1300] as Array<number | null>, ascentM: 300, descentM: 0 },
    { ...ws.sections[1], elevationSamples: [1300, 1250, 1100] as Array<number | null>, ascentM: 0, descentM: 200 },
  ];
  return { ...ws, sections };
}

function input(ws: RouteWorkspaceState, over: Partial<AnalysisInput> = {}): AnalysisInput {
  const profile = buildProfileModel({ orderedPoints: ws.points, sections: ws.sections, stages: ws.stages });
  const days = readDays(ws, { pace: defaultPace(), places: NO_PLACES, party: 1 });
  return {
    workspace: ws,
    profile,
    days,
    members: [{ id: 'u1', name: 'Ana' }],
    currentUserId: 'u1',
    now: NOW,
    waterByStage: {},
    remote: { weather: null, fire: null },
    ...over,
  };
}

describe('buildAnalysis · moteur d’effort branché (7.1)', () => {
  it('score 0 à 100, temps p50 ≤ p90, une ligne par jour, groupe lu par le moteur', () => {
    const a = buildAnalysis(input(withElevation()));
    expect(a.effort.status).toBe('ok');
    expect(a.effort.scorePct).toBeGreaterThanOrEqual(0);
    expect(a.effort.scorePct).toBeLessThanOrEqual(100);
    expect(a.effort.days).toHaveLength(2);
    expect(a.effort.p50Min).toBeGreaterThan(0);
    expect(a.effort.p90Min as number).toBeGreaterThanOrEqual(a.effort.p50Min as number);
    expect(a.effort.group?.memberCount).toBe(1);
    // L'allure de la personne n'est pas renseignée : le moteur retient l'allure standard, et l'écran le dit.
    expect(a.effort.group?.declaredCount).toBe(0);
    expect(a.effort.assumptions.join(' ')).toMatch(/Sac inconnu/);
    expect(a.effort.assumptions.join(' ')).toMatch(/Météo non chargée/);
  });

  it('sans dénivelé connu : aucun score, la raison est dite', () => {
    const ws = baseWorkspace({ sport: 'marche' });
    const bare = { ...ws, sections: ws.sections.map((s) => ({ ...s, ascentM: null, descentM: null, elevationSamples: undefined })) };
    const a = buildAnalysis(input(bare));
    expect(a.effort.scorePct).toBeNull();
    expect(a.effort.reason).toMatch(/Dénivelé inconnu/);
  });

  it('pas la marche : score non calculé (moteur calibré marche)', () => {
    const a = buildAnalysis(input(withElevation({ sport: 'vtt' })));
    expect(a.effort.scorePct).toBeNull();
    expect(a.effort.reason).toMatch(/calibré pour la marche/);
  });

  it('le sac attribué à la personne entre dans le calcul, les objets sans poids sont dits', () => {
    const items = [kit('k1', { shared: false, assigneeUserId: 'u1', weightGrams: 8000 }), kit('k2', { shared: false, assigneeUserId: 'u1', weightGrams: null })];
    expect(packOf(items, 'u1')).toEqual({ weightKg: 8, unweightedCount: 1 });
    expect(packOf(items, 'u2')).toEqual({ weightKg: null, unweightedCount: 0 });
    const a = buildAnalysis(input(withElevation({ kitItems: items })));
    expect(a.pack.weightKg).toBe(8);
    expect(a.effort.assumptions.join(' ')).toMatch(/1 objet\(s\) du sac sans poids/);
  });

  it('la température lue à MET Norway entre dans le calcul', () => {
    const w = passageWeatherOf(
      { day: 1, dateIso: '2026-07-10', lat: 45.9, lon: 6.1, passageLocal: '12:00', timezone: 'Europe/Paris', basis: 'midday' },
      { hours: [{ time: '2026-07-10T12:00', tempC: 21, precipPct: null, precipMm: 0, windKmh: 5, gustKmh: null, code: 1, freezingM: null, isDay: true }] },
      { horizon: '2026-07-14', fetchedAt: '2026-07-05T10:00:00Z' },
    );
    const a = buildAnalysis(input(withElevation(), { remote: { weather: [w], fire: null } }));
    expect(a.effort.assumptions.join(' ')).not.toMatch(/Météo non chargée/);
  });
});

describe('buildAnalysis · difficulté, profil, surfaces (7.2, 7.3, 7.7)', () => {
  it('la cote vient du moteur de difficulté avec au plus trois facteurs « Pourquoi ? »', () => {
    const a = buildAnalysis(input(withElevation()));
    expect(a.difficulty.status).toBe('known');
    expect(a.difficulty.top3.length).toBeGreaterThan(0);
    expect(a.difficulty.top3.length).toBeLessThanOrEqual(3);
    expect(a.difficulty.why).toMatch(/^Cote \d sur 5/);
  });

  it('pentes par bande et zone sans altitude dite avec ses kilomètres', () => {
    const ws = withElevation();
    const noAlt = { ...ws, sections: [ws.sections[0], { ...ws.sections[1], elevationSamples: undefined, ascentM: null, descentM: null }] };
    const a = buildAnalysis(input(noAlt));
    expect(a.slopes.some((s) => s.band !== 'inconnu')).toBe(true);
    expect(a.gaps.length).toBeGreaterThan(0);
    expect(a.gaps[0].day).toBe(2);
    expect(a.slopeShares.inconnu).toBeGreaterThan(0);
  });

  it('surfaces en pourcentage, l’inconnu reste inconnu', () => {
    const ws = withElevation();
    const mixed = { ...ws, sections: [{ ...ws.sections[0], surfaceSegments: [{ fromRatio: 0, toRatio: 0.5, surface: 'paved' as const }] }, ws.sections[1]] };
    const a = buildAnalysis(input(mixed));
    expect(a.surfaces.overall.pct?.goudron).toBe(25);
    expect(a.surfaces.overall.pct?.inconnu).toBe(25);
    expect(a.surfaces.overall.pct?.sentier).toBe(50);
  });
});

describe('buildAnalysis · météo au passage, eau, alertes, lumière, synthèse (7.4 à 7.10)', () => {
  const hours = [
    { time: '2026-07-10T09:00', tempC: 12, precipPct: null, precipMm: 0, windKmh: 8, gustKmh: null, code: 1, freezingM: null, isDay: true },
    { time: '2026-07-10T15:00', tempC: 19, precipPct: 30, precipMm: 0.2, windKmh: 14, gustKmh: 25, code: 61, freezingM: null, isDay: true },
  ];

  it('choisit l’heure la plus proche du passage et dit l’écart', () => {
    expect(pickPassageHour(hours, '2026-07-10', '10:00')?.hour.time).toBe('2026-07-10T09:00');
    const w = passageWeatherOf(
      { day: 1, dateIso: '2026-07-10', lat: 45.9, lon: 6.1, passageLocal: '12:00', timezone: 'Europe/Paris', basis: 'midday' },
      { hours },
      { horizon: '2026-07-14', fetchedAt: '2026-07-05T10:00:00Z' },
    );
    // 12:00 est à 180 min de 09:00 et de 15:00 : créneau voisin, donc approximatif et dit.
    expect(w.deltaMin).toBe(180);
    expect(w.approximate).toBe(true);
    expect(w.fetchedAt).toBe('2026-07-05T10:00:00Z');
    expect(w.horizon).toBe('2026-07-14');
  });

  it('au-delà de l’horizon la météo est inconnue, jamais comblée', () => {
    const w = passageWeatherOf(
      { day: 1, dateIso: '2026-09-01', lat: 45.9, lon: 6.1, passageLocal: '12:00', timezone: 'Europe/Paris', basis: 'midday' },
      null,
      { horizon: '2026-07-14', fetchedAt: '2026-07-05T10:00:00Z' },
    );
    expect(w.status).toBe('out_of_horizon');
    expect(w.tempC).toBeNull();
    expect(w.reason).toMatch(/2026-07-14/);
  });

  it('un point de passage et une heure par jour daté, milieu de journée', () => {
    const ws = withElevation();
    const i = input(ws);
    const passages = dayPassages(i.days, i.profile);
    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({ day: 1, dateIso: '2026-07-10', timezone: 'Europe/Paris', basis: 'midday' });
    expect(passages[0].passageLocal > '08:00').toBe(true);
    const undated = { ...ws, stages: ws.stages.map((s) => ({ ...s, dateIso: null })) };
    const j = input(undated);
    expect(dayPassages(j.days, j.profile)).toEqual([]);
  });

  it('eau : trois niveaux, jamais « disponible » sur une simple carte', () => {
    const osm: WaterObservation = { id: 'o1', name: 'Fontaine', lat: 45.9, lon: 6.05, status: 'unknown', potableClaim: 'unknown', observedAt: '2026-07-05T09:00:00Z', source: 'osm' };
    const declared: WaterObservation = { ...osm, id: 'o2', name: 'Source', potableClaim: 'yes', source: 'user', status: 'unknown', observedAt: '2026-01-01T00:00:00Z' };
    const confirmed: WaterObservation = { ...osm, id: 'o3', name: 'Ruisseau', status: 'flowing', source: 'user', observedAt: '2026-07-01T00:00:00Z' };
    const ws = withElevation();
    const a = buildAnalysis(input(ws, { waterByStage: { g1: [osm, declared, confirmed] } }));
    const d1 = a.water.find((w) => w.day === 1)!;
    expect(d1.counts).toEqual({ mapped: 1, potability_declared: 1, confirmed_recent: 1 });
    expect(d1.rows.map((r) => r.evidence.label)).toEqual(['Cartographiée', 'Potabilité déclarée', 'Confirmée récemment']);
    expect(d1.provenance.at).toBe('2026-07-05T09:00:00Z');
  });

  it('lumière : lever, coucher et marge à l’arrivée par étape', () => {
    const a = buildAnalysis(input(withElevation()));
    const d = a.daylight[0];
    expect(d.sunriseLocal).toMatch(/^\d{2}:\d{2}$/);
    expect(d.sunsetLocal).toMatch(/^\d{2}:\d{2}$/);
    expect(d.marginMin).not.toBeNull();
    expect(d.provenance.at).toBe('2026-07-10');
    const undated = withElevation();
    const b = buildAnalysis(input({ ...undated, stages: undated.stages.map((s) => ({ ...s, dateIso: null })) }));
    expect(b.daylight[0].marginMin).toBeNull();
    expect(b.daylight[0].reason).toBe('date inconnue');
  });

  it('alertes : source, date de relevé, fin de validité, expirée distinguée', () => {
    const ws = withElevation();
    const stages = ws.stages.map((s, i) =>
      i === 0
        ? {
            ...s,
            hazards: [
              { id: 'h1', title: 'Sentier fermé', type: 'closure' as const, severitySource: 'arrêté', observedAt: '2026-07-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z', source: 'Mairie' },
              { id: 'h2', title: 'Vigilance orages', type: 'weather_alert' as const, severitySource: 'jaune', observedAt: '2026-06-01T00:00:00Z', expiresAt: '2026-06-02T00:00:00Z', source: 'Météo-France' },
              { id: 'h3', title: 'Éboulis', type: 'terrain' as const, severitySource: 'x', observedAt: '2026-07-02T00:00:00Z', expiresAt: null, source: 'Gardien' },
            ],
          }
        : s,
    );
    const a = buildAnalysis(input({ ...ws, stages }));
    expect(a.alerts.alerts).toHaveLength(3);
    expect(a.alerts.active.map((x) => x.id)).toEqual(['hazard:h3', 'hazard:h1']);
    const closed = a.alerts.alerts.find((x) => x.id === 'hazard:h1')!;
    expect(closed).toMatchObject({ kind: 'closure', source: 'Mairie', validUntil: '2026-08-01T00:00:00Z', expired: false });
    const vig = a.alerts.alerts.find((x) => x.id === 'hazard:h2')!;
    expect(vig).toMatchObject({ kind: 'vigilance', expired: true });
    expect(a.alerts.alerts.find((x) => x.id === 'hazard:h3')?.validUntil).toBeNull();
    expect(a.alerts.expiredCount).toBe(1);
    expect(a.synthesis.blocking.join(' ')).toMatch(/fermeture/);
  });

  it('feux : source indisponible n’est jamais « aucun feu » ; un point chaud n’est pas une fermeture', () => {
    const none = readAlerts([], { status: 'unavailable', source: null, retrievedAt: null, reason: 'Source feux actifs non configurée', impacts: [] }, NOW);
    expect(none.alerts).toEqual([]);
    expect(none.gaps.join(' ')).toMatch(/non configurée/);
    const fire: FireAlertPayload = {
      status: 'alerts', source: 'NASA FIRMS', retrievedAt: '2026-07-05T09:00:00Z', reason: null,
      impacts: [{ incidentId: 'f1', kind: 'hotspot', severity: 'info', label: 'Point chaud satellite', message: 'Point chaud à proximité : ce n’est pas une fermeture de sentier.', fromKm: 1, toKm: 2, observedAt: '2026-07-04T00:00:00Z', validUntil: null, source: 'NASA FIRMS (VIIRS)' }],
    };
    const [al] = alertsFromFire(fire, NOW);
    expect(al).toMatchObject({ kind: 'fire', severity: 'info', validUntil: null, observedAt: '2026-07-04T00:00:00Z' });
    const a = buildAnalysis(input(withElevation(), { remote: { weather: null, fire } }));
    expect(a.synthesis.blocking.join(' ')).not.toMatch(/fermeture/);
  });

  it('vigilance officielle : fin de validité lue, statut sans flux jamais « aucune alerte »', () => {
    const off = { status: 'lues' as const, service: 'Météo-France', readAt: '2026-07-05T08:00:00Z', alerts: [{ id: 'a', source: 'Météo-France via Meteoalarm', hazard: 'orages', level: 'rouge' as const, area: 'Savoie', onset: null, expires: '2026-07-04T00:00:00Z', sent: '2026-07-03T00:00:00Z', fetchedAt: '2026-07-05T08:00:00Z', headline: null }] };
    const [a] = alertsFromOfficial(off, NOW);
    expect(a).toMatchObject({ kind: 'vigilance', severity: 'critical', expired: true, validUntil: '2026-07-04T00:00:00Z', observedAt: '2026-07-03T00:00:00Z' });
    const none = readAlerts([], null, NOW, { status: 'non_couvert', service: null, readAt: null, alerts: [] });
    expect(none.alerts).toEqual([]);
    expect(none.gaps.join(' ')).toMatch(/pas de flux utilisable/);
  });

  it('synthèse en trois lignes et provenance sur chaque bloc (7.9)', () => {
    const a = buildAnalysis(input(withElevation()));
    expect(Object.keys(a.synthesis).sort()).toEqual(['blocking', 'ok', 'toCheck']);
    for (const p of [a.effortProvenance, a.difficultyProvenance, a.profileProvenance, a.surfaceProvenance, a.synthesisProvenance, a.daylight[0].provenance]) {
      expect(p.source.length).toBeGreaterThan(3);
      expect(dataSourceAttrs(p)['data-source-at']).toMatch(/^\d{4}-\d{2}-\d{2}|date inconnue/);
    }
    expect(dataSourceAttrs({ source: 'x', at: null })['data-source-at']).toBe(UNKNOWN_DATE);
    expect(a.profileProvenance.at).toBe('2026-01-01T00:00:00Z');
  });

  it('tracé envoyé aux feux : borné à 300 points', () => {
    const i = input(withElevation());
    const long = { ...i.profile, points: Array.from({ length: 1000 }, (_, k) => ({ ...i.profile.points[0], lon: 6 + k / 1e4 })) };
    expect(trackForFire(long).length).toBeLessThanOrEqual(300);
    expect(trackForFire({ ...i.profile, points: [] })).toEqual([]);
  });
});
