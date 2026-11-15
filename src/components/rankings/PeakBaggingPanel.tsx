'use client';

import React, { useMemo, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import type { PeakBaggingSummary } from '@/features/rankings/types';
import type { PeaksPayload } from '@/lib/rankings/types';
import {
  ErrorPanel,
  InlineNotice,
  PanelTitle,
  ProgressBar,
  RankingsCard,
  RankingsEmpty,
  SegmentedControl,
  StatTile,
} from './ui';
import { formatDate, formatElevation, formatInteger, formatPct, plural } from './format';
import { useRankingsApi } from './useRankingsApi';

type PeakFilter = 'all' | 'conquered' | 'todo';

const PAGE_SIZE = 40;

export function PeakBaggingView({ summary }: { summary: PeakBaggingSummary }) {
  const [filter, setFilter] = useState<PeakFilter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (filter === 'conquered') return summary.entries.filter((entry) => entry.isConquered);
    if (filter === 'todo') return summary.entries.filter((entry) => !entry.isConquered);
    return summary.entries;
  }, [filter, summary.entries]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="space-y-[var(--space-4)]">
      <PanelTitle
        eyebrow="Peak Bagging"
        title="Les sommets conquis"
        description="Un sommet compte quand une trace GPS validée passe à moins de 50 m du point culminant. La liste reste vide tant que la preuve n’existe pas."
      />

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatTile
          label="Conquis"
          value={`${formatInteger(summary.conqueredPeaksCount)} / ${formatInteger(summary.totalPeaksInCatalog)}`}
          detail={`${formatPct(summary.completionPct)} du catalogue`}
          icon={<Icon name="mountain" size={16} />}
        />
        <StatTile
          label="Plus haut sommet"
          value={formatElevation(summary.highestConqueredPeakMeters)}
          detail={
            summary.cumulativePeakElevationMeters > 0
              ? `${formatElevation(summary.cumulativePeakElevationMeters)} cumulés`
              : 'Aucune ascension validée'
          }
        />
      </div>

      <RankingsCard className="p-[var(--space-4)]">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--glass-label)]">
            Progression du catalogue
          </p>
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
            {formatPct(summary.completionPct)}
          </p>
        </div>
        <ProgressBar
          value={summary.conqueredPeaksCount}
          max={Math.max(1, summary.totalPeaksInCatalog)}
          label={`Sommets conquis : ${summary.conqueredPeaksCount} sur ${summary.totalPeaksInCatalog}`}
        />
        <p className="mt-2 text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
          {summary.totalAscentsCount} {plural(summary.totalAscentsCount, 'ascension validée', 'ascensions validées')}
        </p>
      </RankingsCard>

      <SegmentedControl
        label="Filtrer les sommets"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setVisible(PAGE_SIZE);
        }}
        options={[
          { value: 'all', label: `Tous (${summary.entries.length})` },
          { value: 'conquered', label: `Conquis (${summary.conqueredPeaksCount})` },
          { value: 'todo', label: `À conquérir (${summary.entries.length - summary.conqueredPeaksCount})` },
        ]}
      />

      {summary.entries.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="mountain"
            title="Catalogue de sommets vide"
            description="Aucun sommet n’est disponible dans le référentiel. Nous n’affichons pas de liste inventée pour remplir l’écran."
            actionLabel="Explorer"
            actionHref="/explorer"
          />
        </RankingsCard>
      ) : filtered.length === 0 ? (
        <RankingsCard>
          <RankingsEmpty
            icon="mountain"
            title={filter === 'conquered' ? 'Aucun sommet conquis' : 'Tous les sommets sont conquis'}
            description={
              filter === 'conquered'
                ? 'Vos traces validées ne passent encore à proximité d’aucun sommet du catalogue.'
                : 'Le catalogue est entièrement conquis. La preuve GPS reste la seule source de vérité.'
            }
          />
        </RankingsCard>
      ) : (
        <>
          <RankingsCard className="overflow-hidden">
            <ul aria-label="Sommets du catalogue" className="divide-y divide-[color:var(--glass-rim)]">
              {shown.map((peak) => (
                <li
                  key={peak.peakId}
                  className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)]"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                      peak.isConquered
                        ? 'border-[color:var(--lkv-secondary)]/45 bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary-subtle)]'
                        : 'border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] text-[color:var(--glass-label-tertiary)]'
                    }`}
                  >
                    <Icon name={peak.isConquered ? 'check-circle2' : 'mountain'} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--glass-label)]">
                      {peak.name}
                    </p>
                    <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-secondary)]">
                      {formatElevation(peak.elevationMeters)}
                      {peak.region ? ` · ${peak.region}` : ''}
                      {peak.isConquered
                        ? ` · ${peak.ascentCount} ${plural(peak.ascentCount, 'ascension')}`
                        : ' · non conquis'}
                    </p>
                  </div>
                  {peak.isConquered && (
                    <span className="text-right text-[length:var(--lkv-text-caption-2)] text-[color:var(--glass-label-tertiary)]">
                      {formatDate(peak.firstAscentAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </RankingsCard>

          {filtered.length > shown.length && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setVisible((value) => value + PAGE_SIZE)}
              >
                Afficher {Math.min(PAGE_SIZE, filtered.length - shown.length)}{' '}
                {plural(Math.min(PAGE_SIZE, filtered.length - shown.length), 'sommet')} de plus
              </Button>
            </div>
          )}
        </>
      )}

      <InlineNotice tone="privacy">
        Les coordonnées GPS de vos traces ne quittent jamais le serveur. Seul le
        résultat — sommet, date, distance minimale — est conservé et affiché.
      </InlineNotice>
    </div>
  );
}

export function PeakBaggingPanel() {
  const { status, data, error, reload } = useRankingsApi<PeaksPayload>('/api/rankings/peaks');

  return (
    <div className="space-y-[var(--space-4)]">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement du Peak Bagging" />
        </div>
      )}
      {status === 'error' && (
        <RankingsCard>
          <ErrorPanel message={error || 'Peak Bagging indisponible.'} onRetry={reload} />
        </RankingsCard>
      )}
      {status !== 'loading' && data?.summary && <PeakBaggingView summary={data.summary} />}
      {status !== 'loading' && data && !data.summary && (
        <RankingsCard>
          <RankingsEmpty
            icon="mountain"
            title="Connectez-vous pour vos sommets"
            description="Le Peak Bagging s’appuie sur vos traces personnelles. Sans session, aucun sommet ne peut être vérifié."
            actionLabel="Se connecter"
            actionHref="/connexion"
          />
        </RankingsCard>
      )}
    </div>
  );
}

export default PeakBaggingPanel;
