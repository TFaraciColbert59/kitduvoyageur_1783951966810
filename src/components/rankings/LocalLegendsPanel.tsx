'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Spinner from '@/components/ui/Spinner';
import Icon from '@/components/ui/Icon';
import type { LocalLegendResult } from '@/features/rankings/types';
import type { LegendTargetOption, LocalLegendsPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  FilterSelect,
  InlineNotice,
  PanelTitle,
  RankBadge,
  RankingAvatar,
  RankingsCard,
  RankingsEmpty,
  StatTile,
} from './ui';
import { formatDate, formatInteger, plural } from './format';
import { useRankingsApi } from './useRankingsApi';

export interface LocalLegendsViewProps {
  result: LocalLegendResult;
  targets: LegendTargetOption[];
  onTargetChange: (target: LegendTargetOption) => void;
}

export function LocalLegendsView({
  result,
  targets,
  onTargetChange,
}: LocalLegendsViewProps) {
  const selected = `${result.target.targetType}:${result.target.targetId}`;
  const selectedKnown = targets.some(
    (target) => `${target.targetType}:${target.targetId}` === selected
  );
  const options = selectedKnown
    ? targets
    : [{ ...result.target, effortCount: result.currentUserEffortCount }, ...targets];
  const leader = result.leader;

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Local Legends"
        title="La légende du sentier"
        description="90 jours glissants, un minimum de passages : le plus régulier sur ce tracé devient la légende locale. Aucun classement éternel."
      />

      <RankingsCard className="space-y-[var(--space-3)] p-[var(--space-4)]">
        {targets.length > 0 ? (
          <FilterSelect
            label="Tracé"
            value={selected}
            onChange={(value) => {
              const target = targets.find(
                (item) => `${item.targetType}:${item.targetId}` === value
              );
              if (target) onTargetChange(target);
            }}
            options={options.map((target) => ({
              value: `${target.targetType}:${target.targetId}`,
              label: `${target.targetType === 'route' ? 'Itinéraire' : 'Segment'} · ${target.name}`,
            }))}
          />
        ) : (
          <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--glass-label-secondary)]">
            Cible : {result.target.name}
          </p>
        )}
        <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.12em] text-[color:var(--glass-label-tertiary)]">
          Fenêtre {result.windowDays} j · minimum {result.minEffortsRequired}{' '}
          {plural(result.minEffortsRequired, 'passage')} · {result.target.sport}
        </p>
      </RankingsCard>

      {result.currentUserOptedOut ? (
        <InlineNotice tone="privacy">
          Vous avez refusé de figurer dans les Local Legends. Vos passages restent
          privés et ne sont ni classés ni comptés pour une couronne.
        </InlineNotice>
      ) : (
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          <StatTile
            label="Vos passages"
            value={formatInteger(result.currentUserEffortCount)}
            detail={`sur ${result.windowDays} jours`}
          />
          <StatTile
            label="Pour détrôner"
            value={
              result.effortsToDethrone === null
                ? '—'
                : result.effortsToDethrone === 0
                  ? 'Couronne'
                  : `${result.effortsToDethrone}`
            }
            detail={
              result.effortsToDethrone === 0
                ? 'Vous êtes la légende actuelle'
                : result.leader
                  ? `Leader : ${result.leader.displayName}`
                  : 'Aucun leader qualifié'
            }
          />
        </div>
      )}

      {leader ? (
        <RankingsCard className="p-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--lkv-secondary)]/40 bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary-subtle)]">
              <Icon name="crown" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--glass-label-tertiary)]">
                Légende actuelle
              </p>
              <p className="truncate font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--glass-label)]">
                {leader.displayName}
              </p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
                {leader.effortCount} {plural(leader.effortCount, 'passage')} · dernier{' '}
                {formatDate(leader.lastEffortAt)}
              </p>
            </div>
            {leader.isCurrentUser && (
              <span className="rounded-full bg-[color:var(--lkv-secondary)]/20 px-2 py-1 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--lkv-secondary-subtle)]">
                Vous
              </span>
            )}
          </div>
        </RankingsCard>
      ) : (
        <RankingsCard>
          <RankingsEmpty
            icon="crown"
            title="Aucune légende qualifiée"
            description={`Il faut au moins ${result.minEffortsRequired} passages sur ${result.windowDays} jours pour prendre la couronne. Le premier passage ne suffit pas.`}
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      )}

      {result.entries.length > 0 && (
        <RankingsCard className="overflow-hidden">
          <ul aria-label={`Passages sur ${result.target.name}`} className="divide-y divide-[color:var(--glass-rim)]">
            {result.entries.map((entry) => (
              <li
                key={entry.userId}
                className={`flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] ${
                  entry.isCurrentUser ? 'bg-[color:var(--lkv-secondary)]/10' : ''
                }`}
              >
                <RankBadge rank={entry.rank} />
                <RankingAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--glass-label)]">
                    {entry.isCurrentUser ? (
                      entry.displayName
                    ) : (
                      <Link href={`/profil/${entry.userId}`} className="hover:underline">
                        {entry.displayName}
                      </Link>
                    )}
                    {entry.isLegend && (
                      <span className="ml-2 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--lkv-secondary-subtle)]">
                        légende
                      </span>
                    )}
                  </p>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                    {entry.effortCount} {plural(entry.effortCount, 'passage')} · {formatDate(entry.lastEffortAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </RankingsCard>
      )}

      <InlineNotice tone="privacy">
        Un passage privé, une activité signalée ou un compte bloqué ne compte jamais.
        La couronne se recalcule à chaque consultation ; elle ne se conserve pas.
      </InlineNotice>
    </div>
  );
}

export function LocalLegendsPanel() {
  const [target, setTarget] = useState<{ targetType: 'route' | 'segment'; targetId: string } | null>(
    null
  );
  const url = useMemo(() => {
    const params = new URLSearchParams({
      targetType: target?.targetType ?? 'route',
      windowDays: '90',
      minEfforts: '2',
    });
    if (target) params.set('targetId', target.targetId);
    return `/api/rankings/local-legends?${params.toString()}`;
  }, [target]);
  const { status, data, error, reload } = useRankingsApi<LocalLegendsPayload>(url);

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des Local Legends" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Local Legends indisponibles.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && data.result && (
        <LocalLegendsView
          result={data.result}
          targets={data.targets}
          onTargetChange={(next) =>
            setTarget({ targetType: next.targetType, targetId: next.targetId })
          }
        />
      )}
      {status !== 'loading' && data && !data.result && (
        <RankingsCard>
          <RankingsEmpty
            icon="route"
            title="Aucun tracé pratiqué"
            description="Les Local Legends s’appuient sur vos itinéraires réellement enregistrés. Enregistrez une sortie pour ouvrir votre premier classement de sentier."
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      )}
    </div>
  );
}

export default LocalLegendsPanel;
