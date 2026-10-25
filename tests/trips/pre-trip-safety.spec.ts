/**
 * Phase 5 — Contrôles sécurité pré-trip adaptés au pays et à l'activité.
 *   TEST-PHASE5-SAFE-01 : sans contexte réel ⇒ aucun contrôle (zéro invention).
 *   TEST-PHASE5-SAFE-02 : trekking groupe avec parcours difficile ⇒ contrôles complets.
 *   TEST-PHASE5-SAFE-03 : le libellé cite la donnée déclenchante (pays, difficulté, groupe).
 *   TEST-PHASE5-SAFE-04 : pays froid documenté ⇒ contrôle neige/glace, pas ailleurs.
 */
import { describe, it, expect } from 'vitest';
import { buildPreTripSafetyControls } from '@/features/trips/safety/preTripSafetyRules';

describe('Phase 5 — sécurité pré-trip (TEST-PHASE5-SAFE)', () => {
  it('TEST-PHASE5-SAFE-01: sans contexte ⇒ aucun contrôle', () => {
    expect(buildPreTripSafetyControls({})).toEqual([]);
    expect(buildPreTripSafetyControls({ activity: null, countryCode: null })).toEqual([]);
  });

  it('TEST-PHASE5-SAFE-02: contrôles adaptés au parcours et au groupe', () => {
    const controls = buildPreTripSafetyControls({
      activity: 'trekking',
      countryCode: 'FR',
      durationDays: 7,
      partySize: 4,
      route: { name: 'GR20', distanceKm: 180, elevationGainM: 1200, difficulty: 'hard' },
    });

    const codes = controls.map((control) => control.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'safety-plan-shared',
        'safety-checkin',
        'safety-rescue-contacts',
        'safety-weather-window',
        'safety-track-shared',
        'safety-technical-sections',
        'safety-water-effort',
        'safety-group-coordination',
      ])
    );
    // Clés uniques, échéances dans la fenêtre J-30.
    expect(new Set(codes).size).toBe(codes.length);
    for (const control of controls) {
      expect(control.label.trim().length).toBeGreaterThan(10);
      expect(control.reason.trim().length).toBeGreaterThan(10);
      expect(control.dueOffsetDays).toBeGreaterThanOrEqual(0);
      expect(control.dueOffsetDays).toBeLessThanOrEqual(30);
    }
  });

  it('TEST-PHASE5-SAFE-03: le libellé cite la donnée déclenchante', () => {
    const controls = buildPreTripSafetyControls({
      activity: 'trekking',
      countryCode: 'FR',
      durationDays: 7,
      partySize: 4,
      route: { difficulty: 'expert', elevationGainM: 1300 },
    });
    const byCode = new Map(controls.map((control) => [control.code, control]));

    expect(byCode.get('safety-rescue-contacts')?.label).toContain('FR');
    expect(byCode.get('safety-technical-sections')?.label).toContain('expert');
    expect(byCode.get('safety-group-coordination')?.label).toContain('4');
    expect(byCode.get('safety-plan-shared')?.label).toContain('7');
    expect(byCode.get('safety-water-effort')?.label).toMatch(/1[\s\u202f]?300/);
    // Aucun numéro de secours inventé dans le contrôle pays.
    expect(byCode.get('safety-rescue-contacts')?.label).not.toMatch(/\d{3,}/);
  });

  it('TEST-PHASE5-SAFE-04: neige/glace uniquement pour les pays froid documentés', () => {
    const iceland = buildPreTripSafetyControls({ activity: 'hiking', countryCode: 'IS' });
    expect(iceland.some((control) => control.code === 'safety-snow-ice')).toBe(true);
    expect(
      iceland.find((control) => control.code === 'safety-snow-ice')?.label
    ).toContain('IS');

    const france = buildPreTripSafetyControls({ activity: 'hiking', countryCode: 'FR' });
    expect(france.some((control) => control.code === 'safety-snow-ice')).toBe(false);
  });
});
