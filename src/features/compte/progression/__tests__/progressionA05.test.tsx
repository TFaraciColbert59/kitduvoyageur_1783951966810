// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ALL_OUTING_METRICS } from '@/features/compte/domain/metricVisibility';
import type { OutingDetail } from '@/features/compte/server/sorties';
import type { ProgressionSession } from '@/features/compte/progression/engine';
import { computeTrainingLoad } from '@/features/compte/progression/trainingLoad';
import { computeActivityStreaks } from '@/features/compte/progression/streaks';
import {
  computeRacePredictions,
  computeRunningBestEfforts,
} from '@/features/compte/progression/runningRecords';
import {
  detectOutingHighlights,
  readDeclaredRecords,
  saveDeclaredRecord,
} from '@/features/compte/progression/declaredRecords';
import { findComparableOutings } from '@/features/compte/progression/comparableOutings';
import { readPrepFocus, savePrepFocus } from '@/features/compte/progression/prepFocus';
import { buildActivityRecap, buildRecapShareSvg } from '@/features/compte/progression/recaps';
import { ProgressionDrawer } from '@/components/compte/drawer/progression/ProgressionDrawer';
import { OutingSummary } from '@/components/compte/drawer/sortie/OutingSummary';
import { OutingTrace } from '@/components/compte/drawer/sortie/OutingTrace';
import { writeProgressionSessionsSnapshot } from '@/components/compte/drawer/progression/ProgressionAdvancedSections';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function buildSampleSessions(now = new Date('2026-05-15T10:00:00Z')): ProgressionSession[] {
  const day = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  return [
    {
      id: 's-1',
      title: 'Sortie Chartreuse Chamechaude',
      startedAt: day(0),
      endedAt: day(0),
      km: 12.0,
      dplus: 850,
      durationS: 4800,
      sport: 'trail',
      massif: 'Chartreuse',
    },
    {
      id: 's-2',
      title: '10 km quais de l’Isère',
      startedAt: day(1),
      endedAt: day(1),
      km: 10.0,
      dplus: 25,
      durationS: 2700, // 45:00
      sport: 'course',
      massif: 'Grenoble',
    },
    {
      id: 's-3',
      title: 'Sortie Chartreuse Chamechaude',
      startedAt: day(7),
      endedAt: day(7),
      km: 12.1,
      dplus: 840,
      durationS: 5100, // 5 min plus lente
      sport: 'trail',
      massif: 'Chartreuse',
    },
    {
      id: 's-4',
      title: 'Boucle Vercors Col de la Croix',
      startedAt: day(14),
      endedAt: day(14),
      km: 68.0,
      dplus: 1320,
      durationS: 9600,
      sport: 'velo',
      massif: 'Vercors',
    },
  ];
}

describe('Lot A05 — Progression, records, charge, streaks, prédictions & récaps', () => {
  it('S2.15, S2.21, S2.22, S2.27, S2.20, S2.39 : calculs métier complets et honnêtes', () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const sessions = buildSampleSessions(now);
    const tz = 'Europe/Paris';

    // S2.15 Fitness/Fatigue/Forme
    const load = computeTrainingLoad(sessions, tz, 56, now);
    expect(load.status).toBe('available');
    expect(load.fitnessCtl).toBeGreaterThan(0);
    expect(load.fatigueAtl).toBeGreaterThan(0);
    expect(load.series.length).toBe(56);
    expect(computeTrainingLoad([], tz, 56, now).status).toBe('unavailable');

    // S2.21 Activity streaks
    const streaks = computeActivityStreaks(sessions, tz, now);
    expect(streaks.global.currentDayStreak).toBe(2);
    expect(streaks.global.currentWeekStreak).toBe(3);

    // S2.22 & S2.27 Running best efforts & Riegel race predictions
    const runEfforts = computeRunningBestEfforts(sessions, tz);
    const tenK = runEfforts.find((r) => r.targetId === '10k');
    expect(tenK?.estimatedTimeS).toBe(2700);
    expect(tenK?.quality).toBe('measured');
    expect(runEfforts.find((r) => r.targetId === 'marathon')?.quality).toBe('unavailable');

    const preds = computeRacePredictions(sessions, tz, now);
    expect(preds.status).toBe('available');
    expect(preds.predictions).toHaveLength(4);
    expect(preds.predictions.find((p) => p.targetId === 'half')?.predictedTimeS).toBeGreaterThan(5400);

    // S2.20 Prep focus
    savePrepFocus('user-a05', {
      title: 'Ut4M 40 Chartreuse',
      discipline: 'trail',
      focus: 'denivele',
      targetDate: '2026-08-20',
      weeklySessionsTarget: 4,
    });
    expect(readPrepFocus('user-a05')?.focus).toBe('denivele');

    // S2.39 Recap + SVG
    const recap = buildActivityRecap(sessions, 'month', '2026-05', tz);
    expect(recap.sessionsCount).toBe(4);
    expect(recap.totalKm).toBeCloseTo(102.1, 1);
    const svg = buildRecapShareSvg(recap);
    expect(svg).toContain('<svg');
    expect(svg).toContain('4 sorties');
  });

  it('S2.24, S2.25, S2.26 : records déclarés, exploits de séance et sorties comparables dans Sortie', () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const sessions = buildSampleSessions(now);
    writeProgressionSessionsSnapshot(sessions);

    saveDeclaredRecord('user-a05', {
      sport: 'course',
      category: 'chrono_10k_s',
      label: 'Record 10 km',
      value: 2580,
      unit: 's',
      achievedDate: '2025-10-12',
      note: 'Grenoble Ekiden',
    });
    expect(readDeclaredRecords('user-a05')).toHaveLength(1);

    const detail = {
      id: 's-new-record',
      title: 'Sortie Chartreuse Chamechaude',
      date: now.toISOString(),
      startedAt: now.toISOString(),
      endedAt: now.toISOString(),
      sport: 'trail',
      km: 21.0,
      dplus: 1450,
      durationS: 4600,
      movingTimeS: 4550,
      paceMinPerKm: 3.65,
      maxAlt: 2082,
      massif: 'Chartreuse',
      routeName: 'Chamechaude',
      notes: '',
      visibility: 'private',
      audience: 'private',
      status: 'done',
      verified: true,
      canEdit: true,
      coverUrl: null,
      weather: null,
      points: [
        { lat: 45.28, lng: 5.79, elevationM: 1320, timestamp: now.toISOString() },
        { lat: 45.29, lng: 5.8, elevationM: 2082, timestamp: new Date(now.getTime() + 4600_000).toISOString() },
      ],
      samples: null,
      summary: null,
      laps: null,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      caloriesKcal: null,
      metricVisibility: ALL_OUTING_METRICS,
      photos: [],
      photosUnavailable: false,
      participants: [],
      gear: [],
      kit: null,
      missingGear: [],
      kudos: { count: 0, mine: false },
      comments: [],
      metricsMasked: false,
      hiddenMetrics: [],
      shareMetricsConfigured: false,
      provenance: null,
    } as unknown as OutingDetail;

    const highlights = detectOutingHighlights(detail, sessions);
    expect(highlights.some((h) => h.id === 'best-distance')).toBe(true);
    expect(highlights.some((h) => h.id === 'best-dplus')).toBe(true);
    expect(highlights.some((h) => h.id === 'high-alt')).toBe(true);

    const comparables = findComparableOutings(detail, sessions, 'Europe/Paris');
    expect(comparables.length).toBeGreaterThanOrEqual(2);

    render(
      <OutingSummary
        detail={detail}
        saving={false}
        onSave={() => {}}
        onSaveMetrics={() => {}}
        onResetMetrics={() => {}}
        onShare={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByTestId('outing-highlights-section')).toBeTruthy();
    cleanup();

    render(<OutingTrace detail={detail} onExport={() => {}} />);
    expect(screen.getByTestId('outing-comparable-section')).toBeTruthy();
  });

  it('K5.11 & ProgressionDrawer : rendu des 5 onglets, filtre sport, streaks, charge, focus et récap', () => {
    const now = new Date();
    const sessions = buildSampleSessions(now);

    render(
      <ProgressionDrawer
        initialView="calendar"
        sessions={sessions}
        goals={[]}
        timeZone="Europe/Paris"
        accountKey="user-a05"
      />
    );

    expect(screen.getByTestId('activity-streaks-card')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Statistiques' }));
    expect(screen.getByTestId('fitness-fatigue-card')).toBeTruthy();
    expect(screen.getByTestId('shareable-recap-card')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vélo' }));
    expect(screen.getByText('1 séance(s)')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Objectifs' }));
    expect(screen.getByTestId('prep-focus-card')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Records' }));
    expect(screen.getByTestId('running-best-efforts-card')).toBeTruthy();
    expect(screen.getByTestId('race-predictions-card')).toBeTruthy();
    expect(screen.getByTestId('declared-records-card')).toBeTruthy();
  });
});
