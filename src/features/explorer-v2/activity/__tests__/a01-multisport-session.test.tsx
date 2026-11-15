// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  REHAB_VARIANTS,
  SPORT_FAMILIES,
  getSportVariant,
  startAvailability,
} from '@/features/explorer-v2/sheet/sportSelection';
import { AUTO_PAUSE_BY_SPORT } from '@/features/explorer-v2/activity/tracker';
import {
  computeSwimPace,
  createManualRehabActivity,
  isRehabModeEnabled,
  setRehabModeEnabled,
  SkiSessionEngine,
  validateManualActivityInput,
} from '@/features/explorer-v2/activity/modes';
import {
  readStoredPoolLengthM,
  writeStoredPoolLengthM,
} from '@/features/explorer-v2/sheet/SpecializedModePanels';
import { ManualActivityDrawer } from '@/components/compte/drawer/sortie/ManualActivityDrawer';

describe('Lot A01 — Session multisport et reprise GPS (8 IDs)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('S1.02 / S1.09 / S1.10 / S1.11 : débloque les variantes multisport, indoor, natation et glisse', () => {
    const ids = SPORT_FAMILIES.flatMap((f) => f.variants.map((v) => v.id));
    for (const id of [
      'course-tapis',
      'velo-home-trainer',
      'velo-virtuel',
      'natation-piscine',
      'natation-eau-libre',
      'rameur-indoor',
      'ski-alpin',
      'ski-fond',
      'snowboard',
      'escalade-salle',
    ]) {
      expect(ids).toContain(id);
      const resolved = getSportVariant(id);
      expect(resolved).not.toBeNull();
    }

    // GPS non requis -> immédiatement prêt même si GPS refusé/indisponible
    const tapis = getSportVariant('course-tapis')!;
    expect(tapis.requiresGps).toBe(false);
    expect(
      startAvailability(tapis, { gpsAvailable: false, locationPermission: 'denied' })
    ).toEqual({
      status: 'ready',
      startable: true,
      reason: null,
      missingMetrics: [],
    });

    const piscine = getSportVariant('natation-piscine')!;
    expect(piscine.requiresGps).toBe(false);
    expect(
      startAvailability(piscine, { gpsAvailable: false, locationPermission: 'denied' }).status
    ).toBe('ready');

    // GPS requis -> bloqué quand GPS refusé
    const trail = getSportVariant('trail-10k')!;
    expect(trail.requiresGps).toBe(true);
    expect(
      startAvailability(trail, { gpsAvailable: true, locationPermission: 'denied' }).status
    ).toBe('blocked');
  });

  it('S1.05 : expose des seuils d’auto-pause distincts par famille sportive', () => {
    expect(AUTO_PAUSE_BY_SPORT.course.durationS).toBeLessThan(
      AUTO_PAUSE_BY_SPORT.rando.durationS
    );
    expect(AUTO_PAUSE_BY_SPORT.course.speedThresholdMs).toBeLessThan(
      AUTO_PAUSE_BY_SPORT.velo.speedThresholdMs
    );
  });

  it('S1.10 : natation piscine & eau libre — longueur mémorisée et allure /100m exacte', () => {
    writeStoredPoolLengthM(50);
    expect(readStoredPoolLengthM()).toBe(50);
    writeStoredPoolLengthM(25);
    expect(readStoredPoolLengthM()).toBe(25);

    const pace = computeSwimPace(1500, 1800);
    expect(pace.pacePer100m.value).toBeCloseTo(120, 1);
    expect(pace.pacePer100m.formatted).toBe('2:00 /100m');
  });

  it('S1.11 : détecte les descentes ski/snowboard et exclut le D+ des remontées', () => {
    const baseMs = Date.UTC(2026, 1, 10, 9, 0, 0);
    const engine = new SkiSessionEngine({ startedAtMs: baseMs });

    // Phase remontée mécanique (+120 m) -> ignorée pour elevGainM ski alpin
    engine.addFix({ t: baseMs, lat: 45.9, lng: 6.86, ele: 1800, acc: 5, speed: 3.5 });
    engine.addFix({ t: baseMs + 25_000, lat: 45.905, lng: 6.862, ele: 1920, acc: 5, speed: 4.0 });

    // Phase descente soutenue (-220 m, ~11 m/s) -> 1 descente détectée
    engine.addFix({ t: baseMs + 40_000, lat: 45.908, lng: 6.865, ele: 1920, acc: 5, speed: 10 });
    engine.addFix({ t: baseMs + 55_000, lat: 45.912, lng: 6.868, ele: 1810, acc: 5, speed: 12 });
    engine.addFix({ t: baseMs + 70_000, lat: 45.916, lng: 6.87, ele: 1700, acc: 5, speed: 11 });
    // Arrêt bas de piste
    engine.addFix({ t: baseMs + 95_000, lat: 45.916, lng: 6.87, ele: 1700, acc: 5, speed: 0.2 });

    const snap = engine.getLiveSnapshot();
    expect(snap.runsCount).toBeGreaterThanOrEqual(1);
    expect(snap.verticalDropM).toBeGreaterThanOrEqual(200);
    expect(snap.elevGainM).toBe(0);
  });

  it('S1.12 : mode rééducation activé conditionnellement avec bodyZone et douleur', () => {
    expect(isRehabModeEnabled()).toBe(false);
    setRehabModeEnabled(true);
    expect(isRehabModeEnabled()).toBe(true);
    expect(REHAB_VARIANTS.map((v) => v.id)).toContain('rehab-marche');

    const res = createManualRehabActivity({
      rehabVariant: 'rehab-marche',
      startedAt: '2026-06-10T09:00:00.000Z',
      durationS: 1800,
      distance: 1200,
      distanceUnit: 'm',
      painLevel: 3,
      bodyZone: 'genou',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.summary.details.bodyZone).toBe('genou');
      expect(res.summary.details.painLevel).toBe(3);
    }
  });

  it('S1.08 / K6.15 : validation saisie manuelle & soumission idempotente dans ManualActivityDrawer', async () => {
    const manualRes = validateManualActivityInput({
      sportOrVariant: 'course-tapis',
      startedAt: '2026-06-10T08:00:00.000Z',
      durationS: 2700,
      distance: 8500,
      distanceUnit: 'm',
      elevGain: 50,
      title: 'Fractionné tapis',
      perceivedExertion: 7,
    });
    expect(manualRes.ok).toBe(true);
    if (manualRes.ok) {
      expect(manualRes.value.mapping.selection.variantId).toBe('course-tapis');
      expect(manualRes.value.distanceM).toBe(8500);
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        id: '11111111-1111-4111-8111-111111111111',
        deduplicated: false,
        record: { id: '11111111-1111-4111-8111-111111111111', title: 'Séance tapis A01' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onCreated = vi.fn();
    render(<ManualActivityDrawer onCreated={onCreated} />);

    fireEvent.change(screen.getByPlaceholderText(/Séance tapis/i), {
      target: { value: 'Séance tapis A01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer l’activité/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/activities/manual');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.clientSessionId).toBeTruthy();
    expect(onCreated).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
