'use client';

import React, { useMemo } from 'react';
import { GitCompareArrows, Trophy } from 'lucide-react';
import {
  buildPersonalEffortHistory,
  type SegmentEffort,
} from '@/features/segments';
import { SegmentEmptyState } from './SegmentBadges';
import {
  EXCLUSION_LABELS,
  formatClock,
  formatDateTime,
  formatDelta,
} from './format';

export interface SegmentEffortHistoryProps {
  efforts: SegmentEffort[];
  segmentId: string;
  userId: string;
  onCompare?: (effort: SegmentEffort) => void;
  onContest?: (effort: SegmentEffort) => void;
}

/** S4.07 — historique personnel, records (#1/#2/#3) et accès à la comparaison. */
export function SegmentEffortHistory({
  efforts,
  segmentId,
  userId,
  onCompare,
  onContest,
}: SegmentEffortHistoryProps) {
  const summary = useMemo(
    () => buildPersonalEffortHistory(efforts, segmentId, userId),
    [efforts, segmentId, userId]
  );

  if (summary.totalValidEfforts === 0 && summary.effortsChronological.length === 0) {
    return (
      <SegmentEmptyState
        title="Aucun effort"
        description="Vos passages sur ce segment apparaîtront ici après une activité GPS."
      />
    );
  }

  const chronological = [...summary.effortsChronological].reverse();

  return (
    <section className="lkdv-seg-history" aria-labelledby="segment-history-title">
      <header className="lkdv-seg-history-head">
        <div>
          <p className="lkdv-seg-eyebrow">S4.07 · Mes efforts</p>
          <h3 id="segment-history-title">Historique personnel</h3>
        </div>
        {summary.bestEffort ? (
          <div className="lkdv-seg-pr">
            <Trophy size={18} aria-hidden="true" />
            <div>
              <span>Record personnel</span>
              <strong>{formatClock(summary.bestEffort.elapsedDurationS)}</strong>
            </div>
          </div>
        ) : null}
      </header>

      <div className="lkdv-seg-history-stats">
        <div>
          <span>Efforts valides</span>
          <strong>{summary.totalValidEfforts}</strong>
        </div>
        <div>
          <span>Progression</span>
          <strong>
            {summary.improvementFromFirstS === null
              ? '—'
              : summary.improvementFromFirstS > 0
                ? `−${formatDelta(summary.improvementFromFirstS)}`
                : '0 s'}
          </strong>
        </div>
        <div>
          <span>Dernier passage</span>
          <strong>
            {summary.latestEffort ? formatClock(summary.latestEffort.elapsedDurationS) : '—'}
          </strong>
        </div>
      </div>

      <ol className="lkdv-seg-efforts">
        {chronological.map((effort) => {
          const isValid = effort.status === 'valid' && effort.exclusionReasons.length === 0;
          return (
            <li key={effort.effortId} className={isValid ? 'is-valid' : 'is-excluded'}>
              <div className="lkdv-seg-effort-main">
                <span className="lkdv-seg-effort-date">{formatDateTime(effort.enteredAt)}</span>
                <strong>{formatClock(effort.elapsedDurationS)}</strong>
                <span className="lkdv-seg-effort-speed">{effort.avgSpeedKmh.toFixed(1)} km/h</span>
                {effort.isPersonalRecord ? (
                  <span className="lkdv-seg-badge gold">PR #1</span>
                ) : effort.personalRank ? (
                  <span className="lkdv-seg-badge">PR #{effort.personalRank}</span>
                ) : null}
                {!isValid ? <span className="lkdv-seg-badge danger">{effort.status}</span> : null}
              </div>

              {!isValid && effort.exclusionReasons.length > 0 ? (
                <p className="lkdv-seg-effort-reasons">
                  {effort.exclusionReasons.map((reason) => EXCLUSION_LABELS[reason]).join(' · ')}
                </p>
              ) : null}

              <div className="lkdv-seg-effort-actions">
                {onCompare && isValid ? (
                  <button
                    type="button"
                    className="lkdv-seg-btn ghost small"
                    onClick={() => onCompare(effort)}
                  >
                    <GitCompareArrows size={15} aria-hidden="true" />
                    Comparer
                  </button>
                ) : null}
                {onContest && !isValid ? (
                  <button
                    type="button"
                    className="lkdv-seg-btn ghost small"
                    onClick={() => onContest(effort)}
                  >
                    Contester
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default SegmentEffortHistory;
