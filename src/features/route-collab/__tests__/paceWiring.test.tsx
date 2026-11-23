// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import { buildAnalysis, type AnalysisInput } from '../analyse/analysis';
import { usablePerformanceProfile } from '../analyse/effort';
import { RouteCollabWorkspace } from '../components/RouteCollabWorkspace';
import { resetPlacesForTests } from '../components/workspace/stages/useStagePlaces';
import { defaultPace, describePace, NO_PLACES, paceOf, readDays } from '../dayReading';
import { groupPace } from '../insights/pace';
import { baseWorkspace, pt, section, stage } from '../insights/__tests__/fixtures';
import { paceMemberFromProfile, paceProfileFromRow, type UserPaceProfile } from '../paceProfile';
import { buildProfileModel } from '../profileLink';
import type { RouteWorkspaceState } from '../types';

const PROFILE: UserPaceProfile = { flatSpeedKmh: 5.2, ascentMPerHour: 450, calibrationLevel: 'personalization', sampleCount: 12 };

function performance(over: Partial<PerformanceProfile> = {}): PerformanceProfile {
  return {
    userId: '00000000-0000-4000-8000-000000000001',
    activityType: 'hiking',
    flatSpeedKmH: 5.2,
    ascentSpeedMPerHour: 450,
    descentSpeedMPerHour: 700,
    gradeResponse: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
    surfaceResponse: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
    fatigueCurve: { points: [{ x: 0, value: 0 }], decayPerHour: 0 },
    pauseModel: { pauseMinutesPerHour: 5, pauseMinutesPerAscentM: 0, minPauseMinutes: 0 },
    packResponse: { points: [{ x: 0, value: 1 }], interpolate: 'linear' },
    confidence: { score: 0.8, level: 'high', sampleCount: 12, method: 'test', reasons: [] },
    sampleCount: 12,
    calibrationLevel: 'personalization',
    modelVersion: 'test',
    computedAt: '2026-11-01T10:00:00.000Z',
    ...over,
  };
}

function withElevation(): RouteWorkspaceState {
  const ws = baseWorkspace({ sport: 'marche' });
  const sections = [
    { ...ws.sections[0], elevationSamples: [1000, 1100, 1300] as Array<number | null>, ascentM: 300, descentM: 0 },
    { ...ws.sections[1], elevationSamples: [1300, 1250, 1100] as Array<number | null>, ascentM: 0, descentM: 200 },
  ];
  return { ...ws, sections };
}

function analysisInput(ws: RouteWorkspaceState, over: Partial<AnalysisInput> = {}): AnalysisInput {
  const profile = buildProfileModel({ orderedPoints: ws.points, sections: ws.sections, stages: ws.stages });
  return {
    workspace: ws,
    profile,
    days: readDays(ws, { pace: defaultPace(), places: NO_PLACES, party: 1 }),
    members: [{ id: 'u1', name: 'Ana' }],
    currentUserId: 'u1',
    now: new Date('2026-07-05T10:00:00Z'),
    waterByStage: {},
    remote: { weather: null, fire: null },
    ...over,
  };
}

describe('10.8 / 6.4 : allure apprise des sorties, dite', () => {
  it('le profil fixe l’allure du groupe et la méthode dit « d’après tes sorties »', () => {
    const member = paceMemberFromProfile('u1', 'Alice', PROFILE);
    const g = groupPace([member]);
    expect(g.fromProfile).toBe(true);
    expect(g.params).toEqual({ speedKmh: 5.2, ascentMPerHour: 450 });
    expect(g.method).toMatch(/d’après tes sorties/);
    expect(describePace(g, [member])).toMatch(/Calculé d’après tes sorties \(5\.2 km\/h, 12 sorties\)/);
  });

  it('montée absente du profil : la valeur standard est dite, pas présentée comme apprise', () => {
    const g = groupPace([paceMemberFromProfile('u1', 'Alice', { ...PROFILE, ascentMPerHour: null })]);
    expect(g.params.ascentMPerHour).toBe(600);
    expect(g.method).toMatch(/montée : valeur standard/);
  });

  it('un autre membre plus lent reprend la main : ce n’est plus « d’après tes sorties »', () => {
    const slow = paceOf([paceMemberFromProfile('u1', 'Alice', PROFILE), { id: 'u2', name: 'Paul', speedKmh: 3 }]);
    expect(slow.fromProfile).toBe(false);
    expect(describePace(slow, [{ id: 'u2', name: 'Paul', speedKmh: 3 }])).toMatch(/Calculé sur Paul/);
  });

  it('les autres membres restent « sans allure renseignée » : leur profil n’est jamais lu', () => {
    const members = [paceMemberFromProfile('u1', 'Alice', PROFILE), { id: 'u2', name: 'Paul' }];
    expect(describePace(paceOf(members), members)).toMatch(/1 membre sans allure renseignée/);
  });

  it('un profil à froid ou vide n’est pas une allure (comportement actuel : standard, dit)', () => {
    expect(paceProfileFromRow({ flat_speed_kmh: 4, ascent_speed_m_per_h: 300, calibration_level: 'cold', sample_count: 0 })).toBeNull();
    expect(groupPace([]).fromProfile).toBe(false);
  });
});

describe('7.1 : la prédiction utilise le profil quand il est utilisable', () => {
  it('profil utilisable : temps d’après les sorties, plus court que l’allure standard', () => {
    const ws = withElevation();
    const standard = buildAnalysis(analysisInput(ws)).effort;
    const personal = buildAnalysis(analysisInput(ws, { performanceProfile: performance() })).effort;
    expect(standard.timeBasis).toEqual({ kind: 'standard', reason: 'aucun profil de sorties : allure standard du moteur' });
    expect(personal.timeBasis).toEqual({ kind: 'profile', sampleCount: 12 });
    expect(personal.p50Min as number).toBeLessThan(standard.p50Min as number);
    expect(personal.method).toMatch(/d’après tes sorties/);
    expect(personal.assumptions.join(' ')).toMatch(/Temps prédit d’après tes sorties \(12 sorties\)/);
    expect(standard.assumptions.join(' ')).toMatch(/Temps prédit non personnalisé/);
  });

  it('profil à froid ou peu fiable : comportement actuel, raison dite', () => {
    const ws = withElevation();
    const standard = buildAnalysis(analysisInput(ws)).effort;
    const cold = buildAnalysis(analysisInput(ws, { performanceProfile: performance({ calibrationLevel: 'cold', sampleCount: 0 }) })).effort;
    expect(cold.p50Min).toBe(standard.p50Min);
    expect(cold.timeBasis).toEqual({ kind: 'standard', reason: 'profil de sorties encore « à froid » : allure standard du moteur' });
    const weak = performance({ confidence: { score: 0.3, level: 'low', sampleCount: 2, method: 'test', reasons: [] } });
    expect(usablePerformanceProfile(weak)).toBeNull();
    const low = buildAnalysis(analysisInput(ws, { performanceProfile: weak })).effort;
    expect(low.p50Min).toBe(standard.p50Min);
    expect(low.timeBasis).toEqual({ kind: 'standard', reason: 'profil de sorties trop peu fiable : allure standard du moteur' });
  });

  it('l’allure du membre vient du profil : le groupe le compte', () => {
    const ws = withElevation();
    const a = buildAnalysis(analysisInput(ws, { members: [{ id: 'u1', name: 'Ana', flatSpeedKmh: 5.2, ascentMPerH: 450, paceSource: 'profile' }] })).effort;
    expect(a.group?.profileCount).toBe(1);
    expect(a.group?.declaredCount).toBe(1);
  });
});

function wsUi(): RouteWorkspaceState {
  const a = { ...pt('a', 'a', 45.9, 6.0), name: 'Départ', kind: 'start' as const };
  const b = { ...pt('b', 'b', 45.9, 6.13), name: 'Col' };
  const c = { ...pt('c', 'c', 45.9, 6.26), name: 'Arrivée', kind: 'finish' as const };
  return {
    ...baseWorkspace({
      id: 'w-pace',
      sport: 'marche',
      points: [a, b, c],
      sections: [section('s1', a, b), section('s2', b, c)],
      stages: [stage('g1', 1, 'a', 'c', { dateIso: '2026-10-24', departureTimeLocal: '08:00' })],
    }),
    members: [
      { userId: 'u1', displayName: 'Alice', role: 'owner' },
      { userId: 'u2', displayName: 'Paul', role: 'participant' },
    ],
  };
}

describe('6.4 monté dans l’espace : la page fournit le profil', () => {
  beforeEach(() => {
    resetPlacesForTests();
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const open = async (extra: Partial<React.ComponentProps<typeof RouteCollabWorkspace>>) => {
    render(<RouteCollabWorkspace initialWorkspace={wsUi()} currentUserId="u1" currentUserName="Alice" forceNoWebGL {...extra} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Étapes' }));
    return screen.findByTestId('pace-setting');
  };

  it('avec un profil : « d’après tes sorties », et l’autre membre est dit sans allure', async () => {
    const box = await open({ paceProfile: PROFILE, performanceProfile: performance() });
    expect(within(box).getByText(/Calculé d’après tes sorties \(5\.2 km\/h, 12 sorties\) ; 1 membre sans allure renseignée/)).toBeTruthy();
  });

  it('sans profil : allure standard, comme avant', async () => {
    const box = await open({});
    expect(box.textContent).toMatch(/Allure standard \(4 km\/h\)/);
  });
});
