'use client';

import React from 'react';
import Spinner from '@/components/ui/Spinner';
import Icon from '@/components/ui/Icon';
import type { TrophyBadge, TrophyShowcase } from '@/features/rankings/types';
import type { TrophiesPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  InlineNotice,
  PanelTitle,
  RankingsCard,
  RankingsEmpty,
  StatTile,
} from './ui';
import { formatDate, formatInteger, trophyCategoryLabel } from './format';
import { useRankingsApi } from './useRankingsApi';

function trophyIcon(category: TrophyBadge['category']): string {
  switch (category) {
    case 'challenge_finisher':
      return 'award';
    case 'local_legend_crown':
      return 'crown';
    case 'period_podium':
      return 'star';
    case 'peak_milestone':
      return 'mountain';
  }
}

export function TrophiesView({ showcase }: { showcase: TrophyShowcase }) {
  const sorted = showcase.trophies
    .slice()
    .sort((a, b) => Date.parse(b.awardedAt) - Date.parse(a.awardedAt));

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Trophées"
        title="La vitrine des preuves"
        description="Un trophée ne s’achète pas : il vient d’un défi terminé, d’une couronne locale, d’un podium ou d’un palier de sommets. Une correction le révoque."
      />

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatTile
          label="Actifs"
          value={formatInteger(showcase.totalActiveTrophies)}
          detail={`${showcase.totalActiveTrophies} trophée${showcase.totalActiveTrophies > 1 ? 's' : ''} vérifié${showcase.totalActiveTrophies > 1 ? 's' : ''}`}
          icon={<Icon name="award" size={16} />}
        />
        <StatTile
          label="Couronnes & podiums"
          value={formatInteger(showcase.crownsCount)}
          detail={`${showcase.finisherBadgesCount} défi${showcase.finisherBadgesCount > 1 ? 's' : ''} terminé${showcase.finisherBadgesCount > 1 ? 's' : ''}`}
          icon={<Icon name="crown" size={16} />}
        />
      </div>

      {sorted.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="award"
            title="Aucun trophée pour l’instant"
            description="Terminez un défi, prenez une couronne Local Legend ou conquérez un sommet : la vitrine se remplit par la preuve, jamais par le hasard."
            actionLabel="Voir les défis"
            actionHref="/rankings?tab=challenges"
          />
        </RankingsCard>
      ) : (
        <RankingsCard className="overflow-hidden">
          <ul aria-label="Trophées" className="divide-y divide-[color:var(--glass-rim)]">
            {sorted.map((trophy) => (
              <li
                key={trophy.id}
                className={`flex items-start gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] ${
                  trophy.isRevoked ? 'opacity-60' : ''
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                    trophy.isRevoked
                      ? 'border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-tertiary)]'
                      : 'border-[color:var(--lkv-secondary)]/40 bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary-subtle)]'
                  }`}
                >
                  <Icon name={trophyIcon(trophy.category)} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--glass-label)]">
                      {trophy.title}
                    </p>
                    <span className="rounded-full border border-[color:var(--glass-rim)] px-2 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--glass-label-tertiary)]">
                      {trophyCategoryLabel(trophy.category)}
                    </span>
                    {trophy.isRevoked && (
                      <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.1em] text-[color:var(--lkv-danger)]">
                        Révoqué
                      </span>
                    )}
                  </div>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                    {trophy.subtitle} · {formatDate(trophy.awardedAt)}
                    {typeof trophy.rank === 'number' ? ` · rang ${trophy.rank}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </RankingsCard>
      )}

      <InlineNotice tone="privacy">
        Un trophée n’est compté que tant que sa preuve reste valide. Une activité
        corrigée, supprimée ou signalée ne peut plus le financer ; un trophée révoqué
        fourni par le moteur reste affiché avec son statut, jamais compté comme actif.
      </InlineNotice>
    </div>
  );
}

export function TrophiesPanel() {
  const { status, data, error, reload } = useRankingsApi<TrophiesPayload>(
    '/api/rankings/trophies'
  );

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des trophées" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Trophées indisponibles.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data && <TrophiesView showcase={data.showcase} />}
    </div>
  );
}

export default TrophiesPanel;
