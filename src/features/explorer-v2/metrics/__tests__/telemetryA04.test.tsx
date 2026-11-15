// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OutingDetail, OutingImportSample, OutingPoint } from '@/features/compte/server/sorties';
import { ALL_OUTING_METRICS } from '@/features/compte/domain/metricVisibility';
import {
  computeSlopeAdjustedPace,
  minettiCostRatio,
  readSlopeAdjustedPace,
} from '@/features/explorer-v2/activity/slopeAdjustedPace';
import {
  computeCyclingPowerSkills,
  computePowerCurve,
  estimateFtpFromPowerCurve,
} from '@/features/explorer-v2/metrics/powerCurve';
import {
  analyzeOutingTelemetry,
  buildDefaultZoneSet,
  readOutingRpe,
  saveLocalZoneSet,
  saveOutingRpe,
} from '@/features/explorer-v2/metrics/telemetryAnalysis';
import { OutingTrace } from '@/components/compte/drawer/sortie/OutingTrace';
import { OutingSummary } from '@/components/compte/drawer/sortie/OutingSummary';
import { SlopeAdjustedPacePanel } from '@/features/explorer-v2/sheet/SlopeAdjustedPace';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function buildRunningPointsAndSamples(): {
  points: OutingPoint[];
  samples: OutingImportSample[];
} {
  const points: OutingPoint[] = [];
  const samples: OutingImportSample[] = [];
  const startMs = Date.UTC(2026, 4, 1, 8, 0, 0);
  // 2.4 km en course avec une montée nette (+6% sur la seconde moitié)
  for (let i = 0; i <= 120; i += 1) {
    const tMs = startMs + i * 6_000; // 12 min total
    const distKm = i * 0.02; // 20m par pas -> 2.4 km
    const lat = 45.18 + distKm * 0.00899;
    const lng = 5.72;
    const ele = i <= 60 ? 250 : 250 + (i - 60) * 1.2; // +72m sur 1.2 km = +6%
    const iso = new Date(tMs).toISOString();
    const speedMps = i >= 20 && i <= 35 ? 4.4 : i >= 70 && i <= 85 ? 4.3 : 3.2;
    const hr = i >= 20 && i <= 85 ? 168 : 142;
    points.push({ lat, lng, elevationM: ele, timestamp: iso });
    samples.push({
      index: i,
      origin: 'device',
      recordedAt: iso,
      lapIndex: null,
      distanceM: Math.round(distKm * 1000),
      altitudeM: ele,
      speedMps,
      heartRateBpm: hr,
      cadenceRpm: null,
      cadenceSpm: 174,
      powerW: null,
      temperatureC: 14,
    });
  }
  return { points, samples };
}

function makeBaseOuting(overrides: Partial<OutingDetail> = {}): OutingDetail {
  const { points, samples } = buildRunningPointsAndSamples();
  return {
    id: '00000000-0000-4000-8000-000000000a04',
    title: 'Fractionné en côte Bastille',
    date: '2026-05-01T08:00:00Z',
    sport: 'trail',
    km: 2.4,
    dplus: 72,
    durationS: 720,
    movingTimeS: 720,
    paceMinPerKm: 5.0,
    maxAlt: 322,
    massif: 'Chartreuse',
    notes: 'Bonnes sensations',
    visibility: 'private',
    audience: 'private',
    status: 'published',
    verified: true,
    canEdit: true,
    coverUrl: null,
    weather: null,
    points,
    samples,
    summary: null,
    laps: null,
    heartRateBpm: 156,
    powerW: null,
    cadenceRpm: 87,
    caloriesKcal: null,
    metricVisibility: ALL_OUTING_METRICS,
    photos: [],
    photosUnavailable: false,
    participants: [{ id: 'u1', name: 'Camille', handle: 'camille', avatarUrl: null, isOwner: true }],
    gear: [],
    kit: null,
    missingGear: [],
    kudos: { count: 0, mine: false },
    comments: [],
    metricsMasked: false,
    hiddenMetrics: [],
    shareMetricsConfigured: false,
    provenance: null,
    ...overrides,
  } as OutingDetail;
}

describe('Lot A04 — Télémétrie, splits, zones, GAP, puissance et RPE', () => {
  it('S2.09 : calcule le GAP Minetti (estimé, sans équivalence propriétaire) et reste indisponible sans altitude', () => {
    expect(minettiCostRatio(0)).toBeCloseTo(1, 3);
    expect(minettiCostRatio(0.1)).toBeGreaterThan(1.4);

    const { points } = buildRunningPointsAndSamples();
    const gapPoints = points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      elevationM: p.elevationM,
      timestampMs: Date.parse(p.timestamp!),
    }));
    const res = computeSlopeAdjustedPace('trail', gapPoints);
    expect(res?.status).toBe('available');
    if (res && res.status === 'available') {
      expect(res.quality).toBe('estimated');
      expect(res.method).toBe('minetti-2002-v1');
      expect(res.proprietaryEquivalent).toBe(false);
      expect(res.gapPaceSecondsPerKm).toBeLessThan(res.rawPaceSecondsPerKm);
    }

    const noEle = readSlopeAdjustedPace('course', gapPoints.map((p) => ({ ...p, elevationM: null })));
    expect(noEle?.status).toBe('unavailable');
    expect(readSlopeAdjustedPace('velo', gapPoints)).toBeNull();
  });

  it('S2.13 & S2.14 : courbe de puissance MMP gap-aware, FTP >= 20 min et Power Skills cycliste', () => {
    const startMs = Date.UTC(2026, 4, 1, 9, 0, 0);
    // 25 min continu à 260 W avec sprint initial de 15s à 700 W
    const samples = Array.from({ length: 300 }, (_, i) => ({
      atMs: startMs + i * 5_000,
      watts: i <= 3 ? 700 : 260,
      quality: 'measured' as const,
    }));
    const curve = computePowerCurve(samples, { bodyWeightKg: 70 });
    expect(curve.status).toBe('available');
    expect(curve.quality).toBe('measured');
    expect(curve.points.find((p) => p.durationS === 15)?.watts).toBe(700);

    const ftp = estimateFtpFromPowerCurve(curve, 70);
    expect(ftp.status).toBe('available');
    expect(ftp.ftpW).toBeGreaterThanOrEqual(245);
    expect(ftp.ftpW).toBeLessThanOrEqual(255);

    // Sortie trop courte (<20 min) : FTP non fabriquée
    const shortCurve = computePowerCurve(samples.slice(0, 60));
    const shortFtp = estimateFtpFromPowerCurve(shortCurve);
    expect(shortFtp.status).toBe('unavailable');

    const skills = computeCyclingPowerSkills(curve, { bodyWeightKg: 70 });
    expect(skills.status).toBe('available');
    expect(skills.skills).toHaveLength(4);
    expect(skills.profile).toBeTruthy();
  });

  it('K5.08, K5.09, S2.04–S2.12 : OutingTrace et OutingSummary raccordent courbes synchronisées, splits km/mi, GAP, zones et RPE', () => {
    const hrZones = buildDefaultZoneSet('heartRate', 'trail', 190);
    saveLocalZoneSet(hrZones);
    const detail = makeBaseOuting();

    const bundle = analyzeOutingTelemetry({
      outingId: detail.id,
      sport: detail.sport,
      segments: [detail.points],
      samples: detail.samples,
      durationS: detail.durationS,
      movingTimeS: detail.movingTimeS,
      measuredHrBpm: detail.heartRateBpm,
      zoneSets: [hrZones],
      rpe: 7,
    });
    expect(bundle.kmSplits.length).toBeGreaterThanOrEqual(2);
    expect(bundle.kmSplits.some((s) => s.isFastest)).toBe(true);
    expect(bundle.miSplits.length).toBeGreaterThanOrEqual(1);
    expect(bundle.energyAndSteps.caloriesQuality).toBe('estimated');
    expect(bundle.energyAndSteps.steps).toBeGreaterThan(1000);
    expect(bundle.hrZones).not.toBeNull();
    expect(bundle.relativeEffort?.score).toBeGreaterThan(0);

    // Rendu OutingTrace + interaction curseur synchronisé + bascule km/mi
    render(<OutingTrace detail={detail} onExport={vi.fn()} />);
    expect(screen.getByTestId('synchronized-trace-curves')).toBeTruthy();
    expect(screen.getByTestId('outing-gap-section')).toBeTruthy();
    expect(screen.getByTestId('outing-splits-section')).toBeTruthy();
    expect(screen.getByTestId('outing-hr-zones')).toBeTruthy();

    const slider = screen.getByLabelText('Parcourir la trace et les courbes');
    fireEvent.change(slider, { target: { value: '25' } });
    expect(screen.getByTestId('synchronized-cursor-readout')).toBeTruthy();
    expect(screen.getByTestId('trace-active-cursor')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'mi' }));
    expect(screen.getByText(/mi 1/i)).toBeTruthy();

    cleanup();

    // Rendu OutingSummary + saisie RPE 8/10
    const onSave = vi.fn();
    render(
      <OutingSummary
        detail={detail}
        saving={false}
        onSave={onSave}
        onSaveMetrics={vi.fn()}
        onResetMetrics={vi.fn()}
        onShare={vi.fn()}
        onExport={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('outing-effort-rpe')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(readOutingRpe(detail.id)).toBe(8);
    saveOutingRpe(detail.id, null);
  });

  it('S2.08 : estime la puissance vélo avec mention explicite estimée si aucun capteur', () => {
    const startMs = Date.UTC(2026, 4, 2, 10, 0, 0);
    const points: OutingPoint[] = [];
    const samples: OutingImportSample[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const tMs = startMs + i * 10_000; // 10 min
      const distKm = i * 0.08; // ~28.8 km/h
      const iso = new Date(tMs).toISOString();
      points.push({ lat: 45.2 + distKm * 0.00899, lng: 5.7, elevationM: 210 + i * 0.5, timestamp: iso });
      samples.push({
        index: i,
        origin: 'device',
        recordedAt: iso,
        lapIndex: null,
        distanceM: Math.round(distKm * 1000),
        altitudeM: 210 + i * 0.5,
        speedMps: 8.0,
        heartRateBpm: 152,
        cadenceRpm: 88,
        cadenceSpm: null,
        powerW: null,
        temperatureC: 18,
      });
    }
    const bikeDetail = makeBaseOuting({
      id: '00000000-0000-4000-8000-000000000b1ke',
      sport: 'velo',
      km: 4.8,
      dplus: 30,
      durationS: 600,
      movingTimeS: 600,
      paceMinPerKm: 2.08,
      points,
      samples,
    });
    const res = analyzeOutingTelemetry({
      outingId: bikeDetail.id,
      sport: 'velo',
      segments: [points],
      samples,
      durationS: 600,
      movingTimeS: 600,
      measuredHrBpm: 152,
    });
    expect(res.powerAnalysis.status).toBe('available');
    expect(res.powerAnalysis.quality).toBe('estimated');
    expect(res.powerAnalysis.averageW).toBeGreaterThan(80);
  });

  it('SlopeAdjustedPacePanel affiche la valeur calculée si des points sont fournis et reste indisponible sinon', () => {
    render(<SlopeAdjustedPacePanel sport="course" />);
    expect(screen.getByText('indisponible')).toBeTruthy();
    cleanup();

    const { points } = buildRunningPointsAndSamples();
    render(
      <SlopeAdjustedPacePanel
        sport="trail"
        points={points.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          elevationM: p.elevationM,
          timestampMs: Date.parse(p.timestamp!),
        }))}
      />
    );
    expect(screen.getByText('estimée')).toBeTruthy();
    expect(screen.getByText(/Allure équivalente sur plat :/)).toBeTruthy();
  });
});
