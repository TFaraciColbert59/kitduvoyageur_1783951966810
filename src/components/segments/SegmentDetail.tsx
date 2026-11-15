'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Flag,
  Lock,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  buildSegmentLeaderboard,
  compareSegmentEfforts,
  type SegmentDefinition,
  type SegmentEffort,
  type SegmentHazardCategory,
  type EffortFlagCategory,
  type SegmentHazardReport,
  type SegmentVisibility,
  type SubmitSegmentHazardResult,
  type UserSegmentPreferences,
} from '@/features/segments';
import { SegmentBadges, SegmentStats } from './SegmentBadges';
import { SegmentEffortComparison } from './SegmentEffortComparison';
import { SegmentEffortFlagForm } from './SegmentEffortFlagForm';
import { SegmentEffortHistory } from './SegmentEffortHistory';
import { SegmentHazardReportForm } from './SegmentHazardReportForm';
import {
  athleteLabel,
  formatClock,
  formatDateTime,
  formatDelta,
  HAZARD_LABELS,
} from './format';

type DetailTab = 'efforts' | 'leaderboard' | 'safety';

export interface SegmentDetailProps {
  segment: SegmentDefinition;
  efforts: SegmentEffort[];
  hazardReports: SegmentHazardReport[];
  preferences: UserSegmentPreferences;
  viewerUserId: string;
  busy?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onVisibilityChange: (visibility: SegmentVisibility) => void;
  onHazardReport: (
    result: SubmitSegmentHazardResult,
    input: { category: SegmentHazardCategory; description: string }
  ) => void;
  onResolveHazard: () => void;
  onFlagEffort: (effort: SegmentEffort, input: { category: EffortFlagCategory; comment: string }) => void;
  onContestEffort: (effort: SegmentEffort, input: { justification: string }) => void;
}

/** Écran de détail d'un segment : efforts, classement, sécurité et comparaison. */
export function SegmentDetail({
  segment,
  efforts,
  hazardReports,
  preferences,
  viewerUserId,
  busy = false,
  onClose,
  onEdit,
  onDelete,
  onVisibilityChange,
  onHazardReport,
  onResolveHazard,
  onFlagEffort,
  onContestEffort,
}: SegmentDetailProps) {
  const [tab, setTab] = useState<DetailTab>('efforts');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedEffortId, setSelectedEffortId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = segment.createdByUserId === viewerUserId;
  const segmentEfforts = useMemo(
    () => efforts.filter((effort) => effort.segmentId === segment.id),
    [efforts, segment.id]
  );
  const leaderboard = useMemo(
    () =>
      buildSegmentLeaderboard({
        segment,
        efforts: segmentEfforts,
        viewerUserId,
        scope: 'community',
        limit: 50,
      }),
    [segment, segmentEfforts, viewerUserId]
  );
  const comparison = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const first = segmentEfforts.find((effort) => effort.effortId === compareIds[0]);
    const second = segmentEfforts.find((effort) => effort.effortId === compareIds[1]);
    if (!first || !second) return null;
    return compareSegmentEfforts({
      segment,
      candidateEffort: first,
      referenceEffort: second,
      stepsCount: 21,
    });
  }, [compareIds, segment, segmentEfforts]);

  const flagTarget = selectedEffortId
    ? segmentEfforts.find((effort) => effort.effortId === selectedEffortId) ?? null
    : null;

  function toggleCompare(effort: SegmentEffort) {
    setCompareIds((current) => {
      if (current.includes(effort.effortId)) {
        return current.filter((id) => id !== effort.effortId);
      }
      return current.length < 2
        ? [...current, effort.effortId]
        : [current[1], effort.effortId];
    });
  }

  return (
    <section className="lkdv-seg-detail" aria-labelledby="segment-detail-title">
      <header className="lkdv-seg-detail-head">
        <button type="button" className="lkdv-seg-icon-btn" aria-label="Retour aux segments" onClick={onClose}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="lkdv-seg-detail-title">
          <p className="lkdv-seg-eyebrow">Fiche segment</p>
          <h2 id="segment-detail-title">{segment.name}</h2>
          <SegmentBadges segment={segment} />
          {preferences.starredSegmentIds.includes(segment.id) ? (
            <span className="lkdv-seg-badge gold">Favori</span>
          ) : null}
        </div>
        {isOwner ? (
          <div className="lkdv-seg-detail-actions">
            <button type="button" className="lkdv-seg-icon-btn" aria-label="Modifier le segment" onClick={onEdit}>
              <Pencil size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lkdv-seg-icon-btn"
              aria-label={
                segment.visibility === 'public'
                  ? 'Rendre le segment privé'
                  : 'Rendre le segment public'
              }
              onClick={() =>
                onVisibilityChange(segment.visibility === 'public' ? 'private' : 'public')
              }
            >
              <Lock size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="lkdv-seg-icon-btn danger"
              aria-label="Supprimer le segment"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {confirmDelete ? (
        <div className="lkdv-seg-confirm" role="alertdialog" aria-label="Confirmer la suppression">
          <p>Supprimer ce segment et retirer ses efforts du classement ?</p>
          <div>
            <button type="button" className="lkdv-seg-btn ghost" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
            <button type="button" className="lkdv-seg-btn danger" onClick={onDelete} disabled={busy}>
              Supprimer
            </button>
          </div>
        </div>
      ) : null}

      <SegmentStats segment={segment} />

      {segment.hazardous ? (
        <div className="lkdv-seg-hazard-banner compact" role="status">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Classement suspendu</strong>
            <p>
              {segment.hazardCategory
                ? HAZARD_LABELS[segment.hazardCategory]
                : 'Danger signalé sur ce segment.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="lkdv-seg-tabs" role="tablist" aria-label="Détail du segment">
        <button
          type="button"
          role="tab"
          id="segment-tab-efforts"
          aria-selected={tab === 'efforts'}
          aria-controls="segment-panel-efforts"
          className={tab === 'efforts' ? 'is-active' : ''}
          onClick={() => setTab('efforts')}
        >
          Mes efforts
        </button>
        <button
          type="button"
          role="tab"
          id="segment-tab-leaderboard"
          aria-selected={tab === 'leaderboard'}
          aria-controls="segment-panel-leaderboard"
          className={tab === 'leaderboard' ? 'is-active' : ''}
          onClick={() => setTab('leaderboard')}
        >
          <Users size={15} aria-hidden="true" /> Classement
        </button>
        <button
          type="button"
          role="tab"
          id="segment-tab-safety"
          aria-selected={tab === 'safety'}
          aria-controls="segment-panel-safety"
          className={tab === 'safety' ? 'is-active' : ''}
          onClick={() => setTab('safety')}
        >
          Sécurité
        </button>
      </div>

      {tab === 'efforts' ? (
        <div
          id="segment-panel-efforts"
          role="tabpanel"
          aria-labelledby="segment-tab-efforts"
          className="lkdv-seg-panel"
        >
          {compareIds.length > 0 ? (
            <div className="lkdv-seg-compare-bar">
              <span>
                {compareIds.length === 1
                  ? 'Sélectionnez un second passage à comparer.'
                  : 'Deux passages sélectionnés.'}
              </span>
              <button type="button" className="lkdv-seg-btn ghost small" onClick={() => setCompareIds([])}>
                Effacer
              </button>
            </div>
          ) : null}
          <SegmentEffortHistory
            efforts={segmentEfforts}
            segmentId={segment.id}
            userId={viewerUserId}
            onCompare={toggleCompare}
            onContest={(effort) => setSelectedEffortId(effort.effortId)}
          />
          {comparison ? (
            <SegmentEffortComparison
              result={comparison}
              candidateLabel="Passage A"
              referenceLabel="Passage B"
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'leaderboard' ? (
        <div
          id="segment-panel-leaderboard"
          role="tabpanel"
          aria-labelledby="segment-tab-leaderboard"
          className="lkdv-seg-panel"
        >
          {!leaderboard.leaderboardEnabled ? (
            <div className="lkdv-seg-empty" role="status">
              <strong>Classement indisponible</strong>
              <p>
                {leaderboard.disabledReason === 'segment_hazardous'
                  ? 'Segment dangereux : le classement et les notifications sont désactivés.'
                  : leaderboard.disabledReason === 'segment_private'
                    ? 'Ce segment est privé.'
                    : 'Ce segment a été supprimé.'}
              </p>
            </div>
          ) : leaderboard.entries.length === 0 ? (
            <div className="lkdv-seg-empty" role="status">
              <strong>Aucun temps classé</strong>
              <p>Les efforts publics validés apparaîtront ici.</p>
            </div>
          ) : (
            <table className="lkdv-seg-table">
              <caption className="lkdv-seg-visually-hidden">
                Classement communautaire du segment
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col">Athlète</th>
                  <th scope="col">Temps</th>
                  <th scope="col">Écart</th>
                  <th scope="col">Date</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.entries.map((entry) => {
                  const effort = segmentEfforts.find(
                    (candidate) => candidate.effortId === entry.effortId
                  );
                  return (
                    <tr key={entry.effortId}>
                      <th scope="row">{entry.rank}</th>
                      <td>{athleteLabel(entry.userId, viewerUserId)}</td>
                      <td>{formatClock(entry.elapsedDurationS)}</td>
                      <td>{entry.deltaFromLeaderS === 0 ? '—' : `+${formatDelta(entry.deltaFromLeaderS)}`}</td>
                      <td>{formatDateTime(entry.enteredAt)}</td>
                      <td>
                        {effort && effort.userId !== viewerUserId ? (
                          <button
                            type="button"
                            className="lkdv-seg-btn ghost small"
                            onClick={() => setSelectedEffortId(entry.effortId)}
                          >
                            <Flag size={14} aria-hidden="true" /> Signaler
                          </button>
                        ) : (
                          <span className="lkdv-seg-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

        </div>
      ) : null}

      {tab === 'safety' ? (
        <div
          id="segment-panel-safety"
          role="tabpanel"
          aria-labelledby="segment-tab-safety"
          className="lkdv-seg-panel"
        >
          <SegmentHazardReportForm
            segment={segment}
            existingReports={hazardReports}
            viewerUserId={viewerUserId}
            busy={busy}
            onReport={onHazardReport}
            onResolve={isOwner ? onResolveHazard : undefined}
          />
        </div>
      ) : null}

      {flagTarget ? (
        <div className="lkdv-seg-panel">
          <SegmentEffortFlagForm
            segment={segment}
            effort={flagTarget}
            viewerUserId={viewerUserId}
            existingFlags={[]}
            busy={busy}
            onFlag={(input) => onFlagEffort(flagTarget, input)}
            onContest={(input) => onContestEffort(flagTarget, input)}
          />
        </div>
      ) : null}
    </section>
  );
}

export default SegmentDetail;
