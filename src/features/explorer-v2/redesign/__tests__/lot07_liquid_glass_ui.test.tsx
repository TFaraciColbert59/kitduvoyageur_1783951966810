// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resolveActivityProfile } from '../../specs/resolveActivityProfile';
import { ExplorerSportLaunchSheet } from '../ExplorerSportLaunchSheet';
import { ExplorerPreFlightSheet } from '../ExplorerPreFlightSheet';
import { ExplorerSummarySheet } from '../ExplorerSummarySheet';
import { GpsPeekCapsule } from '../hud/GpsPeekCapsule';
import { GpsCockpitGrid } from '../hud/GpsCockpitGrid';
import { GpsSafetySosSubDrawer } from '../hud/GpsSafetySosSubDrawer';
import { HoldToConfirmButton } from '../primitives/HoldToConfirmButton';

vi.mock('@number-flow/react', () => ({
  default: ({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) => (
    <span>
      {prefix ?? ''}
      {value}
      {suffix ?? ''}
    </span>
  ),
  NumberFlowGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/carnet/v2/CarnetDrawerMotion', () => ({
  StackSlideView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedNumber: ({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) => (
    <span>
      {prefix ?? ''}
      {value}
      {suffix ?? ''}
    </span>
  ),
}));

describe('Lot 07 — Liquid Glass UI & Progressive Disclosure Expert Sub-Drawers', () => {
  afterEach(() => {
    cleanup();
  });

  it('ExplorerSportLaunchSheet affiche le Hero 1-tap et les 4 favoris', () => {
    const onSelectSport = vi.fn();
    render(
      <ExplorerSportLaunchSheet
        lastUsedSlug="trail_running"
        onSelectSport={onSelectSport}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('xp20-sport-launch-sheet').textContent).toContain('Trail');
    const launchBtn = screen.getByRole('button', { name: /Lancer/i });
    fireEvent.click(launchBtn);
    expect(onSelectSport).toHaveBeenCalledWith('trail', expect.objectContaining({ catalogSlug: 'trail_running' }));
  });

  it('ExplorerPreFlightSheet expose des pilules >= 44px et le bouton Réglages experts', () => {
    render(
      <ExplorerPreFlightSheet
        sport="trail"
        onChangeSport={vi.fn()}
        gpsReady
        onLaunch={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const pills = screen.getAllByRole('radio');
    expect(pills.length).toBeGreaterThanOrEqual(5);
    expect((pills[0] as HTMLElement).style.minHeight).toBe('44px');
    expect(screen.getByTestId('xp20-preflight-expert-trigger')).toBeTruthy();
  });

  it('GpsPeekCapsule applique les unités natives anti-km/h (min/km course, m/h alpinisme, km/h vélo) et Rain-Lock', () => {
    const runProfile = resolveActivityProfile('running');
    const { rerender } = render(
      <GpsPeekCapsule
        profile={runProfile}
        distanceM={5000}
        movingS={1500}
        elevGainM={40}
        paused={false}
        onTogglePause={vi.fn()}
        onMarkWaypoint={vi.fn()}
        onExpandCockpit={vi.fn()}
      />,
    );
    expect(screen.getByTestId('xp20-gps-peek-capsule').textContent).toContain('min/km');

    const alpProfile = resolveActivityProfile('mountaineering');
    rerender(
      <GpsPeekCapsule
        profile={alpProfile}
        distanceM={4000}
        movingS={3600}
        elevGainM={650}
        paused={false}
        rainLockActive
        onTogglePause={vi.fn()}
        onMarkWaypoint={vi.fn()}
        onExpandCockpit={vi.fn()}
        onUnlockRainLock={vi.fn()}
      />,
    );
    expect(screen.getByTestId('xp20-gps-peek-capsule').textContent).toContain('m/h');
    expect(screen.getByText(/Déverrouiller écran pluie/i)).toBeTruthy();
  });

  it('GpsCockpitGrid rend les champs configurés par ActivityProfileSpec', () => {
    const bikeProfile = resolveActivityProfile('road_cycling');
    render(
      <GpsCockpitGrid
        profile={bikeProfile}
        telemetry={{
          distanceM: 32_500,
          movingS: 3600,
          elevGainM: 420,
          powerW: 215,
          heartRateBpm: 148,
          cadenceRpm: 88,
        }}
      />,
    );
    const grid = screen.getByTestId('xp20-cockpit-grid');
    expect(grid.textContent).toContain('km/h');
    expect(grid.textContent).toContain('32.5');
  });

  it('GpsSafetySosSubDrawer affiche WGS84, DMS, tel://112 et sms:114 sans appel automatique', () => {
    render(
      <GpsSafetySosSubDrawer
        open
        onOpenChange={vi.fn()}
        coords={[6.8694, 45.8326]}
        altitudeM={3842}
        accuracyM={6}
        nearestRefuge={{ name: 'Refuge du Goûter', distanceM: 1200 }}
      />,
    );
    const card = screen.getByTestId('xp20-sos-card');
    expect(card.textContent).toContain('45.83260, 6.86940');
    expect(card.textContent).toContain('Refuge du Goûter');
    const callLink = screen.getByRole('link', { name: /Appeler 112/i });
    expect(callLink.getAttribute('href')).toBe('tel://112');
    const smsLink = screen.getByRole('link', { name: /SMS 114/i });
    expect(smsLink.getAttribute('href')).toMatch(/^sms:114\?body=/);
  });

  it('ExplorerSummarySheet expose RPE 1..10, métrique native sport et les 2 sous-tiroirs experts', () => {
    render(
      <ExplorerSummarySheet
        summary={{
          sport: 'course',
          startedAt: Date.now() - 1_800_000,
          endedAt: Date.now(),
          paused: false,
          autoPaused: false,
          distanceM: 6000,
          elevGainM: 50,
          movingS: 1800,
          selection: { variantId: 'running', variantLabel: 'Course à pied' } as never,
        }}
        units="metric"
        activityTrack={null}
        onRetrySync={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio').length).toBe(10);
    expect(screen.getByTestId('xp20-summary-sheet').textContent).toContain('min/km');
    expect(screen.getByTestId('xp20-summary-analysis-trigger')).toBeTruthy();
    expect(screen.getByTestId('xp20-summary-privacy-trigger')).toBeTruthy();
  });

  it('HoldToConfirmButton déclenche onConfirm au clavier (accessibilité)', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton label="Terminer" holdMs={1200} onConfirm={onConfirm} />);
    const btn = screen.getByRole('button', { name: /Terminer/i });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
