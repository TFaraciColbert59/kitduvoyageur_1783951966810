import React from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import type { SegmentLeaderboardSummary } from '@/lib/leaderboards/types';
import {
  formatCompactDuration,
  formatDistance,
  formatElevation,
  formatEffortCount,
  sportLabel,
} from '@/lib/leaderboards/format';

export interface LeaderboardSummaryListProps {
  segments: ReadonlyArray<SegmentLeaderboardSummary>;
}

function SummaryCard({ summary }: { summary: SegmentLeaderboardSummary }) {
  const { segment } = summary;
  return (
    <Link className="lkb-card" href={`/classements/${encodeURIComponent(segment.segmentId)}`}>
      <div className="lkb-card-head">
        <div>
          <p className="lkb-eyebrow">
            {sportLabel(segment.sport)}
            {segment.region ? ` · ${segment.region}` : ''}
          </p>
          <h2 className="lkb-card-title">{segment.name}</h2>
        </div>
        <span className="lkb-card-arrow" aria-hidden="true">
          →
        </span>
      </div>

      <div className="lkb-card-meta">
        <span>{formatDistance(segment.distanceM)}</span>
        <span>{formatElevation(segment.elevationGainM)}</span>
        <span>{formatEffortCount(summary.totalEntries)}</span>
      </div>

      {summary.topEntries.length === 0 ? (
        <p className="lkb-card-empty">Aucun passage classé pour l’instant.</p>
      ) : (
        <ol className="lkb-mini-list" aria-label={`Top 3 de ${segment.name}`}>
          {summary.topEntries.map((entry) => (
            <li key={entry.effortId} className="lkb-mini-row">
              <span className="lkb-mini-rank">{entry.rank}</span>
              <span className="lkb-mini-name">{entry.displayName}</span>
              {entry.title && <span className="lkb-mini-title">{entry.title}</span>}
              <span className="lkb-mini-time">{formatCompactDuration(entry.elapsedTimeS)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="lkb-card-foot">
        {summary.localLegend ? (
          <span className="lkb-legend-chip">Local Legend · {summary.localLegend.displayName}</span>
        ) : (
          <span className="lkb-card-muted">Local Legend en attente de passages</span>
        )}
        {summary.rejectedCount > 0 && (
          <span className="lkb-card-muted">
            {summary.rejectedCount} écarté{summary.rejectedCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Index des classements : cartes de segments, top 3, titres et mention Local
 * Legend autorisée. Aucune valeur n'est inventée : un index vide reste vide.
 */
export function LeaderboardSummaryList({ segments }: LeaderboardSummaryListProps) {
  if (segments.length === 0) {
    return (
      <EmptyState
        title="Aucun classement disponible"
        description="Les classements apparaissent dès qu’un segment vérifié reçoit des passages publics et consentis."
      />
    );
  }

  return (
    <div className="lkb-grid">
      {segments.map((summary) => (
        <SummaryCard key={summary.segment.segmentId} summary={summary} />
      ))}
    </div>
  );
}
