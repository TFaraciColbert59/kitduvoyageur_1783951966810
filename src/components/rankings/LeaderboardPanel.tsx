'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import type {
  LeaderboardMetric,
  PeriodLeaderboardResult,
  SportCategory,
} from '@/features/rankings/types';
import type { LeaderboardPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  FilterSelect,
  InlineNotice,
  PanelTitle,
  RankBadge,
  RankingAvatar,
  RankingsCard,
  RankingsEmpty,
  SegmentedControl,
  StatTile,
} from './ui';
import { formatInteger, formatMetric, metricLabel, periodLabel, sportLabel } from './format';
import { useRankingsApi } from './useRankingsApi';

const SPORTS: SportCategory[] = [
  'all',
  'running',
  'trail',
  'hiking',
  'walking',
  'cycling',
  'gravel',
  'mtb',
  'swimming',
  'skiing',
  'other',
];
const METRICS: LeaderboardMetric[] = [
  'distanceMeters',
  'elevationGainMeters',
  'durationSec',
  'activityCount',
];

export interface LeaderboardViewProps {
  result: PeriodLeaderboardResult;
  period: 'weekly' | 'monthly';
  sport: SportCategory;
  metric: LeaderboardMetric;
  onPeriodChange: (period: 'weekly' | 'monthly') => void;
  onSportChange: (sport: SportCategory) => void;
  onMetricChange: (metric: LeaderboardMetric) => void;
}

export function LeaderboardView({
  result,
  period,
  sport,
  metric,
  onPeriodChange,
  onSportChange,
  onMetricChange,
}: LeaderboardViewProps) {
  const currentUserVisible = result.entries.some((entry) => entry.isCurrentUser);
  const showPinnedUser = result.currentUserEntry !== null && !currentUserVisible;

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Classements"
        title="La cordée du moment"
        description="Distance, dénivelé, durée ou sorties : le même contrat de confidentialité pour chaque semaine et chaque mois."
      />

      <RankingsCard className="space-y-[var(--space-3)] p-[var(--space-4)]">
        <SegmentedControl
          label="Période du classement"
          value={period}
          onChange={onPeriodChange}
          options={[
            { value: 'weekly', label: 'Semaine' },
            { value: 'monthly', label: 'Mois' },
          ]}
        />
        <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
          <FilterSelect
            label="Sport"
            value={sport}
            onChange={onSportChange}
            options={SPORTS.map((value) => ({ value, label: sportLabel(value) }))}
          />
          <FilterSelect
            label="Métrique"
            value={metric}
            onChange={onMetricChange}
            options={METRICS.map((value) => ({ value, label: metricLabel(value) }))}
          />
        </div>
        <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em] text-[color:var(--glass-label-tertiary)]">
          {result.window.periodKey} · {periodLabel(period)} · {result.totalParticipants}{' '}
          participant{result.totalParticipants > 1 ? 's' : ''}
        </p>
      </RankingsCard>

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatTile
          label="Participants"
          value={formatInteger(result.totalParticipants)}
          detail={`${sportLabel(result.sport)} · ${metricLabel(result.metric)}`}
        />
        <StatTile
          label="Votre rang"
          value={result.currentUserEntry ? `#${result.currentUserEntry.rank}` : '—'}
          detail={
            result.currentUserEntry
              ? formatMetric(result.currentUserEntry.metricValue, result.metric)
              : 'Aucune activité publique sur la période'
          }
        />
      </div>

      {showPinnedUser && result.currentUserEntry && (
        <RankingsCard className="p-[var(--space-2)]">
          <EntryRow entry={result.currentUserEntry} metric={result.metric} pinned />
        </RankingsCard>
      )}

      {result.entries.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="users"
            title="Personne n’est encore classé"
            description="Aucune activité publique validée sur cette période. Un classement vide est un résultat honnête, pas un zéro inventé."
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      ) : (
        <RankingsCard as="section" className="overflow-hidden">
          <ul aria-label={`Classement ${periodLabel(period)}`} className="divide-y divide-[color:var(--glass-rim)]">
            {result.entries.map((entry) => (
              <li key={entry.userId}>
                <EntryRow entry={entry} metric={result.metric} />
              </li>
            ))}
          </ul>
        </RankingsCard>
      )}

      <InlineNotice tone="privacy">
        Seules les activités publiques et validées sont classées. Les comptes privés,
        les personnes bloquées et celles qui refusent les classements sont exclus avant
        tout calcul, jamais après.
      </InlineNotice>
    </div>
  );
}

function EntryRow({
  entry,
  metric,
  pinned = false,
}: {
  entry: PeriodLeaderboardResult['entries'][number];
  metric: LeaderboardMetric;
  pinned?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] ${
        entry.isCurrentUser ? 'bg-[color:var(--lkv-secondary)]/10' : ''
      }`}
    >
      <RankBadge rank={entry.rank} />
      <RankingAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--glass-label)]">
          {entry.isCurrentUser ? (
            entry.displayName
          ) : (
            <Link href={`/profil/${entry.userId}`} className="truncate hover:underline">
              {entry.displayName}
            </Link>
          )}
          {entry.isCurrentUser && (
            <span className="rounded-full bg-[color:var(--lkv-secondary)]/20 px-2 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--lkv-secondary-subtle)]">
              Vous
            </span>
          )}
          {pinned && (
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
              hors top
            </span>
          )}
        </p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
          {formatInteger(entry.activityCount)} sortie{entry.activityCount > 1 ? 's' : ''} ·{' '}
          {formatMetric(entry.totalElevationGainMeters, 'elevationGainMeters')} D+
        </p>
      </div>
      <p className="shrink-0 text-right font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--glass-label)]">
        {formatMetric(entry.metricValue, metric)}
      </p>
    </div>
  );
}

export function LeaderboardPanel() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [sport, setSport] = useState<SportCategory>('all');
  const [metric, setMetric] = useState<LeaderboardMetric>('distanceMeters');

  const url = useMemo(
    () =>
      `/api/rankings/leaderboard?period=${period}&sport=${sport}&metric=${metric}&limit=25`,
    [period, sport, metric]
  );
  const { status, data, error, reload } = useRankingsApi<LeaderboardPayload>(url);

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement du classement" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Classement indisponible.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && (
        <LeaderboardView
          result={data.result}
          period={period}
          sport={sport}
          metric={metric}
          onPeriodChange={setPeriod}
          onSportChange={setSport}
          onMetricChange={setMetric}
        />
      )}
    </div>
  );
}

export default LeaderboardPanel;
