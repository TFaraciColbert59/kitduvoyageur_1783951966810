// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  ChallengeProgressState,
  ChallengeRule,
  PeerComparisonResult,
  PeriodLeaderboardResult,
  PeakBaggingSummary,
  TrophyShowcase,
} from '@/features/rankings/types';
import { LeaderboardView } from '../LeaderboardPanel';
import { PeakBaggingView } from '../PeakBaggingPanel';
import { ChallengesView } from '../ChallengesPanel';
import { TrophiesView } from '../TrophiesPanel';
import { PeersView } from '../PeersPanel';

afterEach(cleanup);

const WINDOW = {
  kind: 'weekly' as const,
  startsAt: '2026-11-09T00:00:00.000Z',
  endsAt: '2026-11-15T23:59:59.999Z',
  periodKey: '2026-W46',
};

const LEADERBOARD: PeriodLeaderboardResult = {
  window: WINDOW,
  sport: 'hiking',
  metric: 'distanceMeters',
  totalParticipants: 2,
  entries: [
    {
      rank: 1,
      userId: 'u2',
      displayName: 'Bob',
      avatarUrl: null,
      metricValue: 20000,
      activityCount: 2,
      totalDistanceMeters: 20000,
      totalElevationGainMeters: 300,
      totalDurationSec: 7200,
      isCurrentUser: false,
    },
    {
      rank: 2,
      userId: 'u1',
      displayName: 'Alice',
      avatarUrl: null,
      metricValue: 12000,
      activityCount: 1,
      totalDistanceMeters: 12000,
      totalElevationGainMeters: 100,
      totalDurationSec: 3600,
      isCurrentUser: true,
    },
  ],
  currentUserEntry: null,
};
LEADERBOARD.currentUserEntry = LEADERBOARD.entries[1];

describe('vues rankings', () => {
  it('classement : rend les lignes, le rang courant et change de période', () => {
    const onPeriodChange = vi.fn();
    render(
      <LeaderboardView
        result={LEADERBOARD}
        period="weekly"
        sport="hiking"
        metric="distanceMeters"
        onPeriodChange={onPeriodChange}
        onSportChange={() => {}}
        onMetricChange={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'La cordée du moment' })).toBeTruthy();
    expect(screen.getByText('2026-W46 · Cette semaine · 2 participants')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Classement Cette semaine' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Vous')).toBeTruthy();
    expect(screen.getByText('20 km')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mois' }));
    expect(onPeriodChange).toHaveBeenCalledWith('monthly');
  });

  it('classement vide : un état vide explicite, jamais un zéro inventé', () => {
    render(
      <LeaderboardView
        result={{ ...LEADERBOARD, entries: [], totalParticipants: 0, currentUserEntry: null }}
        period="weekly"
        sport="all"
        metric="distanceMeters"
        onPeriodChange={() => {}}
        onSportChange={() => {}}
        onMetricChange={() => {}}
      />
    );
    expect(screen.getByText('Personne n’est encore classé')).toBeTruthy();
    expect(screen.getByText(/Un classement vide est un résultat honnête/)).toBeTruthy();
  });

  it('Peak Bagging : filtre les sommets conquis sans masquer le catalogue', () => {
    const summary: PeakBaggingSummary = {
      userId: 'u1',
      totalPeaksInCatalog: 2,
      conqueredPeaksCount: 1,
      completionPct: 50,
      totalAscentsCount: 1,
      highestConqueredPeakMeters: 2500,
      cumulativePeakElevationMeters: 2500,
      entries: [
        {
          peakId: 'p1',
          name: 'Pic A',
          elevationMeters: 2500,
          region: 'Alpes',
          isConquered: true,
          ascentCount: 1,
          firstAscentAt: '2026-11-10T08:00:00.000Z',
          lastAscentAt: '2026-11-10T08:00:00.000Z',
        },
        {
          peakId: 'p2',
          name: 'Pic B',
          elevationMeters: 3000,
          region: 'Alpes',
          isConquered: false,
          ascentCount: 0,
          firstAscentAt: null,
          lastAscentAt: null,
        },
      ],
    };
    render(<PeakBaggingView summary={summary} />);

    expect(screen.getByRole('heading', { name: 'Les sommets conquis' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Sommets conquis : 1 sur 2' })).toBeTruthy();
    expect(screen.getByText('Pic A')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'À conquérir (1)' }));
    expect(screen.queryByText('Pic A')).toBeNull();
    expect(screen.getByText('Pic B')).toBeTruthy();
  });

  it('défis : progression sourcée et « suivi indisponible » distinct de zéro', () => {
    const progress: ChallengeProgressState = {
      ruleId: 'c1',
      ruleVersion: 1,
      userId: 'u1',
      currentValue: 12000,
      targetValue: 20000,
      progressPct: 60,
      isCompleted: false,
      completedAt: null,
      badgeAwarded: false,
      appliedActivityIds: ['a1'],
      ledger: [],
    };
    const rule: ChallengeRule = {
      id: 'c1',
      version: 1,
      kind: 'public',
      title: '20 km',
      description: 'Cumuler 20 km',
      sport: 'hiking',
      criterion: 'distance_meters',
      targetValue: 20000,
      unit: 'm',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-12-31T23:59:59.999Z',
      rewardBadgeId: 'b1',
      rewardTitle: 'Finisher',
      rewardPoints: 100,
    };
    render(
      <ChallengesView
        items={[
          { rule, trackable: true, progress, leaderboard: null },
          { rule: { ...rule, id: 'c2', title: 'Kit léger' }, trackable: false, progress: null, leaderboard: null },
        ]}
      />
    );

    expect(screen.getByText(/12.?000 \/ 20.?000 m/)).toBeTruthy();
    expect(screen.getByText('60 %')).toBeTruthy();
    expect(screen.getByText('Kit léger')).toBeTruthy();
    expect(screen.getByText(/Suivi indisponible/)).toBeTruthy();
  });

  it('trophées : un trophée révoqué reste visible et n’est pas actif', () => {
    const showcase: TrophyShowcase = {
      userId: 'u1',
      totalActiveTrophies: 1,
      crownsCount: 1,
      finisherBadgesCount: 1,
      peakMilestonesCount: 0,
      trophies: [
        {
          id: 't1',
          category: 'challenge_finisher',
          title: 'Finisher 20 km',
          subtitle: 'Défi 20 km',
          awardedAt: '2026-11-10T08:00:00.000Z',
          sourceId: 'c1',
          isRevoked: false,
        },
        {
          id: 't2',
          category: 'local_legend_crown',
          title: 'Couronne GR 20',
          subtitle: '3 passages',
          awardedAt: '2026-11-11T08:00:00.000Z',
          sourceId: '12',
          isRevoked: true,
        },
      ],
    };
    render(<TrophiesView showcase={showcase} />);
    expect(screen.getByText('Révoqué')).toBeTruthy();
    expect(screen.getByText('Finisher 20 km')).toBeTruthy();
    expect(screen.getByText('Couronne GR 20')).toBeTruthy();
  });

  it('pairs : les deltas absents restent des tirets et les exclusions sont annoncées', () => {
    const result: PeerComparisonResult = {
      window: WINDOW,
      sport: 'hiking',
      currentUser: {
        userId: 'u1',
        displayName: 'Alice',
        avatarUrl: null,
        isCurrentUser: true,
        activityCount: 1,
        totalDistanceMeters: 12000,
        totalElevationGainMeters: null,
        totalDurationSec: 3600,
        conqueredPeaksCount: 1,
        activeTrophiesCount: 0,
      },
      peers: [
        {
          userId: 'u2',
          displayName: 'Bob',
          avatarUrl: null,
          isCurrentUser: false,
          activityCount: 2,
          totalDistanceMeters: 10000,
          totalElevationGainMeters: 200,
          totalDurationSec: 7200,
          conqueredPeaksCount: 0,
          activeTrophiesCount: 0,
        },
      ],
      deltas: [
        {
          peerUserId: 'u2',
          peerDisplayName: 'Bob',
          distanceDeltaMeters: 2000,
          elevationDeltaMeters: null,
          durationDeltaSec: -3600,
          activityCountDelta: -1,
        },
      ],
      excludedPeerCount: 2,
    };
    render(
      <PeersView
        result={result}
        period="weekly"
        sport="hiking"
        onPeriodChange={() => {}}
        onSportChange={() => {}}
      />
    );
    expect(screen.getByText('+2 km')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2 pairs exclus de la comparaison/)).toBeTruthy();
    expect(screen.getByText(/Une valeur absente reste/)).toBeTruthy();
  });
});
