import React from 'react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import type { SegmentDefinition } from '@/features/segments';
import { formatDistance, formatElevation, formatGrade, SPORT_LABELS } from './format';

export function SegmentBadges({ segment }: { segment: SegmentDefinition }) {
  return (
    <div className="lkdv-seg-badges">
      <span className="lkdv-seg-badge sport">{SPORT_LABELS[segment.sport]}</span>
      {segment.verified ? (
        <span className="lkdv-seg-badge verified">
          <ShieldCheck size={13} aria-hidden="true" /> Vérifié
        </span>
      ) : null}
      {segment.visibility === 'private' ? (
        <span className="lkdv-seg-badge private">
          <Lock size={12} aria-hidden="true" /> Privé
        </span>
      ) : null}
      {segment.hazardous ? (
        <span className="lkdv-seg-badge danger">
          <AlertTriangle size={13} aria-hidden="true" /> Dangereux
        </span>
      ) : null}
    </div>
  );
}

export function SegmentStats({
  segment,
  compact = false,
}: {
  segment: SegmentDefinition;
  compact?: boolean;
}) {
  return (
    <dl className={`lkdv-seg-stats${compact ? ' is-compact' : ''}`}>
      <div>
        <dt>Distance</dt>
        <dd>{formatDistance(segment.lengthM)}</dd>
      </div>
      <div>
        <dt>D+</dt>
        <dd>{formatElevation(segment.elevationGainM)}</dd>
      </div>
      <div>
        <dt>Pente moy.</dt>
        <dd>{formatGrade(segment.meanGradePct)}</dd>
      </div>
      {!compact ? (
        <div>
          <dt>Pente max</dt>
          <dd>{formatGrade(segment.maxGradePct)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function SegmentEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lkdv-seg-empty" role="status">
      <span className="lkdv-seg-empty-icon" aria-hidden="true">
        ⌁
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
