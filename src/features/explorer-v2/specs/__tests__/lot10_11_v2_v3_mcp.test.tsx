// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActivityProfileSpecSchema } from '../activityProfileSpec.schema';
import { listActivityProfiles, resolveActivityProfile } from '../resolveActivityProfile';
import { V1_ACTIVITY_PROFILES } from '../v1Profiles.seed';
import { V2_ACTIVITY_PROFILES } from '../v2Profiles.seed';
import { V3_ACTIVITY_PROFILES } from '../v3Profiles.seed';
import { StrengthLoggerHevyView } from '../../redesign/views/StrengthLoggerHevyView';
import { PoolLapsSwolfView } from '../../redesign/views/PoolLapsSwolfView';
import { SkiRunsLiftsView } from '../../redesign/views/SkiRunsLiftsView';
import { MultisportLegsView } from '../../redesign/views/MultisportLegsView';
import { RehabArt9ConsentModal } from '../../redesign/views/RehabArt9ConsentModal';
import { executeActivityInsightMcpTool } from '../../mcp/activityInsightMcpTool';
import { buildEnhancedGpxXml, buildFitExportManifest } from '../../export/gpxAndFitExport';

describe('Lots 10 & 11 — 49 Profils V1/V2/V3, Vues Spécialisées, RGPD Art. 9, MCP & GPX/FIT', () => {
  afterEach(() => {
    cleanup();
  });

  it('enregistre exactement 49 profils canoniques (13 V1 + 29 V2 + 7 V3) tous valides Zod', () => {
    expect(V1_ACTIVITY_PROFILES).toHaveLength(13);
    expect(V2_ACTIVITY_PROFILES).toHaveLength(29);
    expect(V3_ACTIVITY_PROFILES).toHaveLength(7);

    const all = listActivityProfiles();
    expect(all).toHaveLength(49);

    for (const spec of all) {
      const parsed = ActivityProfileSpecSchema.safeParse(spec);
      expect(parsed.success, `Invalid spec ${spec.identity.slugId}`).toBe(true);
    }

    // Vérification RGPD Art. 9 strict sur les profils réhab
    const rehabMob = resolveActivityProfile('rehab_physio_mobility');
    expect(rehabMob.privacyAndCompliance.rgpdArt9SensitiveHealth).toBe(true);
    expect(rehabMob.privacyAndCompliance.defaultVisibility).toBe('private');
    expect(rehabMob.privacyAndCompliance.aiInsightAllowedDefault).toBe(false);
    expect(rehabMob.algorithms.antiCheat.leaderboardEligible).toBe(false);
  });

  it('les 4 vues spécialisées (Hevy, Pool SWOLF, Ski Lifts, Multisport) & modal RGPD Art. 9 fonctionnent', () => {
    // 1. StrengthLoggerHevyView
    const onLogSet = vi.fn();
    render(<StrengthLoggerHevyView onLogSet={onLogSet} />);
    fireEvent.click(screen.getByRole('button', { name: /Valider la série/i }));
    expect(onLogSet).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 60, reps: 8 }), 480);
    cleanup();

    // 2. PoolLapsSwolfView
    const onLap = vi.fn();
    render(<PoolLapsSwolfView onLapRecorded={onLap} />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter 1 longueur/i }));
    expect(onLap).toHaveBeenCalledWith(expect.objectContaining({ lengthM: 25, swolf: 42 }), 25);
    cleanup();

    // 3. SkiRunsLiftsView
    render(
      <SkiRunsLiftsView
        runsCount={8}
        verticalDescentM={3450}
        liftAscentExcludedM={3400}
        maxSpeedKmh={68.4}
        beraRiskLevel={3}
        currentlyOnLift
      />,
    );
    expect(screen.getByTestId('xp20-view-ski-runs-lifts').textContent).toContain('BERA 3/5');
    expect(screen.getByTestId('xp20-view-ski-runs-lifts').textContent).toContain('3400 m');
    cleanup();

    // 4. MultisportLegsView
    const onTransition = vi.fn();
    render(<MultisportLegsView onTransition={onTransition} />);
    fireEvent.click(screen.getByRole('button', { name: /Passer à : Transition T1/i }));
    expect(onTransition).toHaveBeenCalledWith(1, expect.any(Array));
    cleanup();

    // 5. RehabArt9ConsentModal
    const onAccept = vi.fn();
    render(
      <RehabArt9ConsentModal
        open
        onOpenChange={vi.fn()}
        sportLabel="Rééducation Kiné"
        onConsentAccepted={onAccept}
      />,
    );
    const submitBtn = screen.getByRole('button', { name: /Activer le suivi confidentiel/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submitBtn);
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'rehab_health_art9' }),
    );
  });

  it('l’outil MCP interne bloque Art. 9 et Strava API, et génère un payload < 450 tokens', () => {
    const ok = executeActivityInsightMcpTool({
      sportSlug: 'indoor_rowing',
      sourceOrigin: 'lkdv_native',
      distanceM: 5000,
      movingS: 1200,
      elevGainM: 0,
      avgHrBpm: 162,
      rpe: 8,
    });
    expect(ok.allowed).toBe(true);
    if (ok.allowed) {
      expect(ok.estimatedTokens).toBeLessThan(450);
      expect(ok.payload.primarySpeedUnit).toBe('min_per_500m');
    }

    const art9 = executeActivityInsightMcpTool({
      sportSlug: 'rehab_physio_mobility',
      sourceOrigin: 'lkdv_native',
      distanceM: 0,
      movingS: 1800,
      elevGainM: 0,
    });
    expect(art9).toEqual({ allowed: false, reason: 'rgpd_art9_sensitive' });

    const strava = executeActivityInsightMcpTool({
      sportSlug: 'sailing',
      sourceOrigin: 'strava_api',
      distanceM: 12_000,
      movingS: 3600,
      elevGainM: 0,
    });
    expect(strava).toEqual({ allowed: false, reason: 'strava_api_prohibition' });
  });

  it('exporte un GPX 1.1 avec TrackPointExtension (HR/Cadence/Power) et un manifeste FIT', () => {
    const bike = resolveActivityProfile('road_cycling');
    const xml = buildEnhancedGpxXml({
      title: 'Col du Galibier',
      profile: bike,
      points: [
        { lat: 45.064, lng: 6.407, ele: 2642, t: 1_700_000_000_000, hr: 168, cad: 84, powerW: 255 },
      ],
      waypoints: [{ lat: 45.064, lng: 6.407, label: 'Sommet', kind: 'viewpoint' }],
    });
    expect(xml).toContain('<gpxtpx:hr>168</gpxtpx:hr>');
    expect(xml).toContain('<gpxtpx:cad>84</gpxtpx:cad>');
    expect(xml).toContain('<power>255</power>');
    expect(xml).toContain('<wpt lat="45.064000"');

    const fit = buildFitExportManifest({
      sessionId: 'sess-fit-1',
      profile: bike,
      startedAtMs: 1_700_000_000_000,
      distanceM: 42_000,
      movingS: 5_400,
      elevGainM: 1_250,
    });
    expect(fit.fitSport).toBe(2);
    expect(fit.totalAscentM).toBe(1250);
  });
});
