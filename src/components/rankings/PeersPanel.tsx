'use client';

import React, { useMemo, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import Icon from '@/components/ui/Icon';
import type {
  PeerComparisonResult,
  PeerProgressionSnapshot,
  SportCategory,
} from '@/features/rankings/types';
import type { PeersPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  FilterSelect,
  InlineNotice,
  PanelTitle,
  RankingAvatar,
  RankingsCard,
  RankingsEmpty,
  SegmentedControl,
  StatTile,
} from './ui';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatInteger,
  formatMetric,
  periodLabel,
  sportLabel,
} from './format';
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

function signed(value: number | null, formatter: (input: number | null) => string): string {
  if (value === null) return '—';
  if (value === 0) return 'égalité';
  return `${value > 0 ? '+' : '−'}${formatter(Math.abs(value))}`;
}

export interface PeersViewProps {
  result: PeerComparisonResult;
  period: 'weekly' | 'monthly';
  sport: SportCategory;
  onPeriodChange: (period: 'weekly' | 'monthly') => void;
  onSportChange: (sport: SportCategory) => void;
}

export function PeersView({
  result,
  period,
  sport,
  onPeriodChange,
  onSportChange,
}: PeersViewProps) {
  const current = result.currentUser;

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Comparaison"
        title="Vous et vos pairs"
        description="Uniquement les amitiés mutuelles, jamais les comptes bloqués ou privés. Une métrique absente reste « — », pas un zéro."
      />

      <RankingsCard className="space-y-[var(--space-3)] p-[var(--space-4)]">
        <SegmentedControl
          label="Période de comparaison"
          value={period}
          onChange={onPeriodChange}
          options={[
            { value: 'weekly', label: 'Semaine' },
            { value: 'monthly', label: 'Mois' },
          ]}
        />
        <FilterSelect
          label="Sport"
          value={sport}
          onChange={onSportChange}
          options={SPORTS.map((value) => ({ value, label: sportLabel(value) }))}
        />
        <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em] text-[color:var(--glass-label-tertiary)]">
          {result.window.periodKey} · {periodLabel(period)} · {formatInteger(result.peers.length)}{' '}
          pair{result.peers.length > 1 ? 's' : ''}
        </p>
      </RankingsCard>

      <SnapshotCard snapshot={current} title="Votre progression" />

      {result.peers.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="users"
            title="Aucun pair à comparer"
            description="La comparaison n’utilise que les amitiés mutuelles. Ajoutez un pair depuis la communauté pour ouvrir une comparaison réciproque."
            actionLabel="Communauté"
            actionHref="/communaute"
          />
        </RankingsCard>
      ) : (
        <ul className="space-y-[var(--space-2)]" aria-label="Comparaison avec les pairs">
          {result.peers.map((peer, index) => {
            const delta = result.deltas.find((item) => item.peerUserId === peer.userId);
            return (
              <li key={peer.userId}>
                <RankingsCard className="p-[var(--space-3)]">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <RankingAvatar name={peer.displayName} avatarUrl={peer.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--glass-label)]">
                        {peer.displayName}
                      </p>
                      <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                        {formatInteger(peer.activityCount)} sortie{peer.activityCount > 1 ? 's' : ''} ·{' '}
                        {formatDistance(peer.totalDistanceMeters)} · {formatElevation(peer.totalElevationGainMeters)} D+
                      </p>
                    </div>
                  </div>
                  <dl className="mt-[var(--space-2)] grid grid-cols-3 gap-[var(--space-2)] border-t border-[color:var(--glass-rim)] pt-[var(--space-2)]">
                    <div>
                      <dt className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                        Distance
                      </dt>
                      <dd className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">
                        {signed(delta?.distanceDeltaMeters ?? null, formatDistance)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                        Dénivelé
                      </dt>
                      <dd className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">
                        {signed(delta?.elevationDeltaMeters ?? null, formatElevation)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.08em] text-[color:var(--glass-label-tertiary)]">
                        Durée
                      </dt>
                      <dd className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">
                        {signed(delta?.durationDeltaSec ?? null, formatDuration)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-1 text-right text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-tertiary)]">
                    {index === 0 ? 'Pair le plus proche' : 'Pair autorisé'} ·{' '}
                    {formatMetric(peer.totalDistanceMeters, 'distanceMeters')}
                  </p>
                </RankingsCard>
              </li>
            );
          })}
        </ul>
      )}

      {result.excludedPeerCount > 0 && (
        <InlineNotice tone="privacy">
          {result.excludedPeerCount} pair{result.excludedPeerCount > 1 ? 's' : ''} exclu
          {result.excludedPeerCount > 1 ? 's' : ''} de la comparaison : blocage, refus de
          comparaison ou absence d’autorisation mutuelle. Le nombre est annoncé, jamais masqué.
        </InlineNotice>
      )}

      {result.peers.length > 0 && (
        <InlineNotice tone="privacy">
          Les deltas sont toujours « vous moins le pair ». Une valeur absente reste « — » ;
          nous ne la remplaçons jamais par zéro.
        </InlineNotice>
      )}
    </div>
  );
}

function SnapshotCard({
  snapshot,
  title,
}: {
  snapshot: PeerProgressionSnapshot;
  title: string;
}) {
  return (
    <RankingsCard className="p-[var(--space-4)]">
      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
        <RankingAvatar name={snapshot.displayName} avatarUrl={snapshot.avatarUrl} size={44} />
        <div>
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em] text-[color:var(--glass-label-tertiary)]">
            {title}
          </p>
          <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--glass-label)]">
            {snapshot.displayName}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[var(--space-2)] sm:grid-cols-4">
        <StatTile label="Sorties" value={formatInteger(snapshot.activityCount)} />
        <StatTile label="Distance" value={formatDistance(snapshot.totalDistanceMeters)} />
        <StatTile label="Dénivelé" value={formatElevation(snapshot.totalElevationGainMeters)} />
        <StatTile label="Sommets" value={formatInteger(snapshot.conqueredPeaksCount)} />
      </div>
      <p className="mt-2 flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
        <Icon name="award" size={14} />
        {snapshot.activeTrophiesCount > 0
          ? `${formatInteger(snapshot.activeTrophiesCount)} trophée${
              snapshot.activeTrophiesCount > 1 ? 's' : ''
            } actif${snapshot.activeTrophiesCount > 1 ? 's' : ''}`
          : 'Trophées non agrégés pour cette comparaison'}
        {snapshot.totalDurationSec !== null ? ` · ${formatDuration(snapshot.totalDurationSec)}` : ''}
      </p>
    </RankingsCard>
  );
}

export function PeersPanel() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [sport, setSport] = useState<SportCategory>('all');
  const url = useMemo(
    () => `/api/rankings/peers?period=${period}&sport=${sport}`,
    [period, sport]
  );
  const { status, data, error, reload } = useRankingsApi<PeersPayload>(url);

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement de la comparaison" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Comparaison indisponible.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && (
        <PeersView
          result={data.result}
          period={period}
          sport={sport}
          onPeriodChange={setPeriod}
          onSportChange={setSport}
        />
      )}
    </div>
  );
}

export default PeersPanel;
