'use client';

import React, { useMemo, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import Icon from '@/components/ui/Icon';
import type { ChallengeItem, ChallengesPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  InlineNotice,
  PanelTitle,
  ProgressBar,
  RankingsCard,
  RankingsEmpty,
  SegmentedControl,
} from './ui';
import { challengeKindLabel, formatDate, formatInteger, formatPct } from './format';
import { useRankingsApi } from './useRankingsApi';

type ChallengeFilter = 'all' | 'active' | 'done';

function challengeStatus(item: ChallengeItem): 'upcoming' | 'active' | 'ended' {
  const now = Date.now();
  if (Date.parse(item.rule.startsAt) > now) return 'upcoming';
  if (Date.parse(item.rule.endsAt) < now) return 'ended';
  return 'active';
}

export function ChallengesView({ items }: { items: ChallengeItem[] }) {
  const [filter, setFilter] = useState<ChallengeFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'done') return items.filter((item) => item.progress?.isCompleted === true);
    if (filter === 'active') {
      return items.filter(
        (item) => challengeStatus(item) === 'active' && item.progress?.isCompleted !== true
      );
    }
    return items;
  }, [filter, items]);

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Défis"
        title="Les défis de la saison"
        description="Chaque progression est une somme d’activités validées, rejouable sans double comptage. Une correction ou un signalement annule le gain."
      />

      <SegmentedControl
        label="Filtrer les défis"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `Tous (${items.length})` },
          { value: 'active', label: 'En cours' },
          { value: 'done', label: 'Terminés' },
        ]}
      />

      {filtered.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="flame"
            title={filter === 'done' ? 'Aucun défi terminé' : 'Aucun défi disponible'}
            description={
              filter === 'done'
                ? 'Les défis terminés apparaîtront ici avec leur badge. Un défi non prouvé ne compte pas.'
                : 'Le catalogue de défis est vide pour cette saison. Nous n’inventons pas de défi de démonstration.'
            }
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      ) : (
        <ul className="space-y-[var(--space-3)]" aria-label="Défis">
          {filtered.map((item) => (
            <li key={`${item.rule.id}:v${item.rule.version}`}>
              <ChallengeCard item={item} />
            </li>
          ))}
        </ul>
      )}

      <InlineNotice tone="privacy">
        Un défi dont la grandeur n’est pas fournie par la base reste visible mais
        n’affiche aucune progression. « Non suivi » n’est pas « zéro ».
      </InlineNotice>
    </div>
  );
}

function ChallengeCard({ item }: { item: ChallengeItem }) {
  const status = challengeStatus(item);
  const progress = item.progress;
  const completed = progress?.isCompleted === true;

  return (
    <RankingsCard className="p-[var(--space-4)]">
      <div className="flex items-start gap-[var(--space-3)]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-secondary)]">
          <Icon name={completed ? 'award' : 'flame'} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--glass-label)]">
              {item.rule.title}
            </h3>
            <span className="rounded-full border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-2 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
              {challengeKindLabel(item.rule.kind)}
            </span>
            {status === 'ended' && !completed && (
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
                Clôturé
              </span>
            )}
          </div>
          <p className="mt-1 text-[length:var(--lkv-text-footnote)] leading-relaxed text-[color:var(--glass-label-secondary)]">
            {item.rule.description}
          </p>
        </div>
      </div>

      {item.trackable && progress ? (
        <div className="mt-[var(--space-3)]">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--glass-label)]">
              {formatInteger(progress.currentValue)} / {formatInteger(progress.targetValue)}{' '}
              {item.rule.unit}
            </p>
            <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
              {formatPct(progress.progressPct)}
            </p>
          </div>
          <ProgressBar
            value={progress.currentValue}
            max={Math.max(1, progress.targetValue)}
            label={`Progression du défi ${item.rule.title}`}
          />
          <p className="mt-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
            {completed
              ? `Terminé le ${formatDate(progress.completedAt)} · ${formatInteger(item.rule.rewardPoints)} points`
              : `Récompense : ${item.rule.rewardTitle} · ${formatInteger(item.rule.rewardPoints)} points`}
          </p>
        </div>
      ) : item.trackable ? (
        <p className="mt-[var(--space-3)] rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
          Connectez-vous pour suivre ce défi. Sans session, aucune progression
          personnelle n’est calculée.
        </p>
      ) : (
        <p className="mt-[var(--space-3)] rounded-[var(--lkv-radius-tile)] border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]">
          Suivi indisponible : la base ne fournit pas encore la grandeur mesurée pour ce défi.
          Aucune progression n’est affichée.
        </p>
      )}

      {item.leaderboard && item.leaderboard.length > 0 && (
        <div className="mt-[var(--space-3)] border-t border-[color:var(--glass-rim)] pt-[var(--space-2)]">
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
            Top 3
          </p>
          <ol className="mt-1 space-y-1">
            {item.leaderboard.slice(0, 3).map((entry) => (
              <li
                key={entry.userId}
                className="flex items-center justify-between gap-3 text-[length:var(--lkv-text-caption)] text-[color:var(--glass-label-secondary)]"
              >
                <span className="truncate">
                  {entry.rank}. {entry.displayName}
                  {entry.isCurrentUser ? ' (vous)' : ''}
                </span>
                <span className="shrink-0 font-semibold text-[color:var(--glass-label)]">
                  {formatInteger(entry.metricValue)} {item.rule.unit}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </RankingsCard>
  );
}

export function ChallengesPanel() {
  const { status, data, error, reload } = useRankingsApi<ChallengesPayload>(
    '/api/rankings/challenges'
  );

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des défis" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Défis indisponibles.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && <ChallengesView items={data.items} />}
    </div>
  );
}

export default ChallengesPanel;
