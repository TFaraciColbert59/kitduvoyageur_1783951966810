// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resolveActivityProfile } from '../../../specs/resolveActivityProfile';
import {
  SummaryExpertAnalysisSubDrawer,
  type SummaryTrackPoint,
} from '../SummaryExpertAnalysisSubDrawer';

vi.mock('recharts', () => {
  const MockBox = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-mock">{children}</div>
  );
  return {
    ResponsiveContainer: MockBox,
    ComposedChart: MockBox,
    BarChart: MockBox,
    RadarChart: MockBox,
    Area: () => null,
    Line: () => null,
    Bar: () => null,
    Cell: () => null,
    Radar: () => null,
    PolarGrid: () => null,
    PolarAngleAxis: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

const mockBuildProfile = vi.fn();
vi.mock('../../../geo/profile', () => ({
  buildProfile: (...args: unknown[]) => mockBuildProfile(...args),
}));

vi.mock('../../../activity/localSession', () => ({
  readSessionPoints: vi.fn().mockResolvedValue([]),
  readAllFinishedSessions: vi.fn().mockResolvedValue([]),
}));

function makeTestPoints(count = 40): SummaryTrackPoint[] {
  const startMs = Date.UTC(2026, 6, 18, 7, 0, 0);
  return Array.from({ length: count }, (_, i) => ({
    lat: 45.88 + i * 0.0004,
    lng: 6.86 + i * 0.0001,
    ele: 1000 + i * 8,
    t: startMs + i * 30_000,
    hr: 138 + (i % 15),
    acc: 6,
  }));
}

describe('SummaryExpertAnalysisSubDrawer — Studio 6 sous-volets Liquid Glass', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    mockBuildProfile.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('navigue entre les 6 sous-volets, bascule les courbes, déclenche le recalage DEM, édite les seuils, scanne les segments au clic et exporte GPX/FIT', async () => {
    const profile = resolveActivityProfile('hiking');
    const points = makeTestPoints(50);
    const onExportGpxContent = vi.fn();
    const onExportFitContent = vi.fn();

    mockBuildProfile.mockResolvedValue({
      id: 1,
      points: [
        { d: 0, ele: 1010 },
        { d: 2400, ele: 1410 },
      ],
      distance_m: 2400,
      gain_m: 400,
      loss_m: 0,
      min_m: 1010,
      max_m: 1410,
      source: 'aws-terrarium',
    });

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        validEfforts: [
          {
            effortId: 'eff-1',
            uniquenessKey: 'act:seg-col-01:v1:occ0',
            segmentId: 'seg-col-01',
            segmentVersion: 1,
            activityId: 'act-1',
            activityVersion: 1,
            userId: 'user-123',
            sport: 'hiking',
            direction: 'forward',
            occurrenceIndex: 0,
            status: 'valid',
            exclusionReasons: [],
            startPointIndex: 2,
            endPointIndex: 35,
            enteredAt: new Date(Date.UTC(2026, 6, 18, 7, 1)).toISOString(),
            exitedAt: new Date(Date.UTC(2026, 6, 18, 7, 8)).toISOString(),
            elapsedDurationS: 435,
            movingDurationS: 420,
            pausedDurationS: 15,
            coveredDistanceM: 1200,
            coverageRatio: 0.98,
            maxCorridorDeviationM: 8,
            elevationGainM: 145,
            elevationLossM: 5,
            avgSpeedKmh: 10.3,
            maxSpeedKmh: 14.2,
            avgHeartRateBpm: 152,
            maxHeartRateBpm: 168,
            avgPowerW: null,
            avgCadenceRpm: null,
            mapMatchQuality: 0.96,
            gpsQuality: 0.95,
            visibility: 'public',
            eligibleForPublicLeaderboard: true,
            personalRank: 1,
            isPersonalRecord: true,
          },
        ],
        counts: { valid: 1, total: 1 },
      }),
    });

    render(
      <SummaryExpertAnalysisSubDrawer
        open
        onOpenChange={vi.fn()}
        profile={profile}
        points={points}
        distanceM={2400}
        movingS={1500}
        elevGainM={400}
        rpe={7}
        userId="user-123"
        onExportGpxContent={onExportGpxContent}
        onExportFitContent={onExportFitContent}
      />,
    );

    // 1. Sub-panel 1 (Overview) active by default
    expect(screen.getByTestId('xp20-exp-panel-overview')).toBeTruthy();
    // Must NOT call /api/segments/detect on mount
    expect(fetchSpy).not.toHaveBeenCalled();

    // 2. Switch to Curves & Telemetry
    fireEvent.click(screen.getByTestId('xp20-exp-tab-curves'));
    expect(screen.getByTestId('xp20-exp-panel-curves')).toBeTruthy();
    expect(screen.getByTestId('xp20-exp-inline-trace')).toBeTruthy();

    // Toggle grade channel on
    const gradeBtn = screen.getByTestId('xp20-exp-channel-grade');
    fireEvent.click(gradeBtn);
    expect(gradeBtn.getAttribute('aria-pressed')).toBe('true');

    // Trigger 1-tap DEM recalibration
    fireEvent.click(screen.getByTestId('xp20-exp-dem-recalibrate-btn'));
    await waitFor(() => {
      expect(mockBuildProfile).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('xp20-exp-dem-message').textContent).toContain('AWS Terrarium');
    });

    // 3. Switch to Relief & Climbs
    fireEvent.click(screen.getByTestId('xp20-exp-tab-relief'));
    expect(screen.getByTestId('xp20-exp-panel-relief')).toBeTruthy();

    // 4. Switch to Pacing, Splits & Records + opt-in segment detection (real SegmentEffort schema)
    fireEvent.click(screen.getByTestId('xp20-exp-tab-pacing'));
    expect(screen.getByTestId('xp20-exp-panel-pacing')).toBeTruthy();

    // Switch splits to miles and verify /mi formatting
    fireEvent.click(screen.getByRole('tab', { name: 'mi' }));
    expect(screen.getByTestId('xp20-exp-panel-pacing').textContent).toContain('/mi');

    fireEvent.click(screen.getByTestId('xp20-exp-detect-segments-btn'));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/segments/detect',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(screen.getByTestId('xp20-exp-segments-status').textContent).toContain('1 segment');
      const segList = screen.getByTestId('xp20-exp-segments-list').textContent ?? '';
      expect(segList).toContain('1.20 km');
      expect(segList).toContain('7:00');
      expect(segList).toContain('10.3 km/h');
      expect(segList).toContain('+145 m');
      expect(segList).toContain('PR');
    });

    // 5. Switch to Physio & Load + inline collapsible thresholds editor (incl. fcRest persistence)
    fireEvent.click(screen.getByTestId('xp20-exp-tab-physio'));
    expect(screen.getByTestId('xp20-exp-panel-physio')).toBeTruthy();
    fireEvent.click(screen.getByTestId('xp20-exp-thresholds-toggle'));
    expect(screen.getByTestId('xp20-exp-thresholds-form')).toBeTruthy();
    const fcRestInput = screen.getByLabelText(/FC repos/i) as HTMLInputElement;
    fireEvent.change(fcRestInput, { target: { value: '48' } });
    fireEvent.click(screen.getByTestId('xp20-exp-thresholds-save'));
    expect(window.localStorage.getItem('lkdv.metrics.zoneConfigs.v1')).toBeTruthy();
    expect(window.localStorage.getItem('lkdv.metrics.physioExtras.v1')).toContain('"fcRest":48');
    expect(screen.getByTestId('xp20-exp-thresholds-toggle').textContent).toContain('FC 48–');

    // 6. Switch to Environment & Recovery + exports GPX/FIT
    fireEvent.click(screen.getByTestId('xp20-exp-tab-env'));
    expect(screen.getByTestId('xp20-exp-panel-env')).toBeTruthy();
    fireEvent.click(screen.getByTestId('xp20-exp-export-gpx-btn'));
    expect(onExportGpxContent).toHaveBeenCalledTimes(1);
    expect(onExportGpxContent.mock.calls[0][0]).toContain('<gpx version="1.1"');

    fireEvent.click(screen.getByTestId('xp20-exp-export-fit-btn'));
    expect(onExportFitContent).toHaveBeenCalledTimes(1);
    expect(onExportFitContent.mock.calls[0][0]).toContain('"fitSport"');
  });

  it('bloque le pont IA sur un profil RGPD Art. 9 dans le volet Synthèse', () => {
    const base = resolveActivityProfile('hiking');
    const rgpdProfile = {
      ...base,
      privacyAndCompliance: {
        ...base.privacyAndCompliance,
        rgpdArt9SensitiveHealth: true,
        aiInsightAllowedDefault: false,
      },
    };

    render(
      <SummaryExpertAnalysisSubDrawer
        open
        onOpenChange={vi.fn()}
        profile={rgpdProfile}
        points={[]}
        distanceM={1500}
        movingS={1200}
        elevGainM={20}
      />,
    );

    expect(screen.getByTestId('xp20-exp-rgpd-blocked')).toBeTruthy();
    expect(screen.queryByTestId('outing-post-activity-insight')).toBeNull();
  });

  it('surligne une montée Cat 1-5 sur la carte au clic et gère une sortie 0 point sans crash sur les 6 volets', () => {
    const profile = resolveActivityProfile('hiking');
    const points = makeTestPoints(60);
    const onHighlightSegment = vi.fn();

    const { unmount } = render(
      <SummaryExpertAnalysisSubDrawer
        open
        onOpenChange={vi.fn()}
        profile={profile}
        points={points}
        distanceM={2800}
        movingS={1800}
        elevGainM={470}
        onHighlightSegment={onHighlightSegment}
      />,
    );

    // Relief tab -> click first detected climb -> onHighlightSegment receives >= 2 coords
    fireEvent.click(screen.getByTestId('xp20-exp-tab-relief'));
    const climbButtons = screen.getAllByTestId(/^xp20-exp-climb-/);
    expect(climbButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(climbButtons[0]);
    expect(onHighlightSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinates: expect.arrayContaining([expect.any(Array)]),
      }),
    );

    // Switching away from Relief tab MUST clear map highlight (no stale highlight stuck on MapLibre)
    fireEvent.click(screen.getByTestId('xp20-exp-tab-pacing'));
    expect(onHighlightSegment).toHaveBeenLastCalledWith(null);

    // Unauthenticated user clicking "Détecter les segments" does not call fetch
    fireEvent.click(screen.getByTestId('xp20-exp-detect-segments-btn'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('xp20-exp-segments-status').textContent).toContain('Connectez-vous');

    unmount();

    // 0-point indoor outing navigates cleanly across all 6 tabs
    render(
      <SummaryExpertAnalysisSubDrawer
        open
        onOpenChange={vi.fn()}
        profile={resolveActivityProfile('strength_training')}
        points={[]}
        distanceM={0}
        movingS={1800}
        elevGainM={0}
        rpe={6}
      />,
    );
    for (const tabId of ['overview', 'curves', 'relief', 'pacing', 'physio', 'env'] as const) {
      fireEvent.click(screen.getByTestId(`xp20-exp-tab-${tabId}`));
      expect(screen.getByTestId(`xp20-exp-panel-${tabId}`)).toBeTruthy();
    }
  });

  it('utilise le scope non-fixe xp20-exp-scope (jamais xp20-root) avec hauteur confortable 78dvh–92dvh, corps scrollable et remise à zéro du scroll au changement d’onglet', () => {
    const profile = resolveActivityProfile('hiking');
    render(
      <SummaryExpertAnalysisSubDrawer
        open
        onOpenChange={vi.fn()}
        profile={profile}
        points={makeTestPoints(20)}
        distanceM={2000}
        movingS={1200}
        elevGainM={180}
        contrast="night-red"
        glovesMode
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-hud-contrast')).toBe('night-red');
    expect(dialog.getAttribute('data-gloves-mode')).toBe('true');
    expect((dialog as HTMLElement).style.maxHeight).toBe('92dvh');
    expect((dialog as HTMLElement).style.minHeight).toBe('78dvh');

    const stickyHeader = screen.getByTestId('xp20-exp-sticky-header');
    const bodyRoot = screen.getByTestId('xp20-exp-analysis-root');

    // Guard against fixed positioning regression inside portaled ExplorerNestedSubDrawer
    expect(stickyHeader.classList.contains('xp20-exp-scope')).toBe(true);
    expect(stickyHeader.classList.contains('xp20-root')).toBe(false);
    expect(bodyRoot.classList.contains('xp20-exp-scope')).toBe(true);
    expect(bodyRoot.classList.contains('xp20-root')).toBe(false);
    expect(dialog.querySelector('.xp20-root')).toBeNull();

    // Sticky 6-tab bar lives in stickyHeader, scrollable body lives in .xp20-nested-body
    const tablist = screen.getByRole('tablist', { name: /Sous-volets d'analyse avancée/i });
    expect(stickyHeader.contains(tablist)).toBe(true);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(bodyRoot.getAttribute('role')).toBe('tabpanel');
    expect(bodyRoot.getAttribute('aria-labelledby')).toBe('xp20-exp-tab-btn-overview');
    expect(tabs[0].getAttribute('aria-controls')).toBe('xp20-exp-tabpanel-overview');

    const scrollBody = dialog.querySelector('.xp20-nested-body') as HTMLElement | null;
    expect(scrollBody).toBeTruthy();
    expect(scrollBody?.contains(bodyRoot)).toBe(true);
    expect(scrollBody?.contains(tablist)).toBe(false);

    // Scrolling deep inside tab 1 then switching to tab 2 must reset scrollTop to 0
    if (scrollBody) {
      scrollBody.scrollTop = 420;
      expect(scrollBody.scrollTop).toBe(420);
    }
    fireEvent.click(screen.getByTestId('xp20-exp-tab-curves'));
    expect(scrollBody?.scrollTop).toBe(0);
    expect(bodyRoot.getAttribute('aria-labelledby')).toBe('xp20-exp-tab-btn-curves');
  });
});
