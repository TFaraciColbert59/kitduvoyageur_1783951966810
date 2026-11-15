'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import {
  sanitizeLeaderboardFilters,
  type LeaderboardFilterQuery,
  type LocalLegendResult,
  type SegmentLeaderboardResult,
} from '@/features/leaderboards';
import type {
  AntiCheatSummary,
  FiltersResponse,
  LocalLegendResponse,
  SegmentLeaderboardResponse,
  LeaderboardSegmentView,
} from '@/lib/leaderboards/types';
import {
  AntiCheatNotice,
  LeaderboardFilters,
  LeaderboardTable,
  LocalLegendsPanel,
} from '@/components/leaderboards';
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

  // S02 leaderboards & Local Legends state (S4.05, S4.06, S4.08)
  const [s02Filters, setS02Filters] = useState<LeaderboardFilterQuery>({});
  const [s02Capabilities, setS02Capabilities] = useState<FiltersResponse | null>(null);
  const [s02Leaderboard, setS02Leaderboard] = useState<SegmentLeaderboardResult | null>(null);
  const [s02SegmentView, setS02SegmentView] = useState<LeaderboardSegmentView | null>(null);
  const [s02LocalLegend, setS02LocalLegend] = useState<LocalLegendResult | null>(null);
  const [s02AntiCheat, setS02AntiCheat] = useState<AntiCheatSummary | null>(null);
  const [s02Loading, setS02Loading] = useState(false);
  const [s02Error, setS02Error] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'leaderboard' || segment.visibility === 'private' || segment.deletedAt) return;
    const controller = new AbortController();
    let active = true;
    setS02Loading(true);
    setS02Error(null);

    const params = new URLSearchParams();
    if (s02Filters.period) params.set('period', s02Filters.period);
    if (s02Filters.scope) params.set('scope', s02Filters.scope);
    if (s02Filters.clubId) params.set('clubId', s02Filters.clubId);
    if (s02Filters.gender) params.set('gender', s02Filters.gender);

    const legendParams = new URLSearchParams();
    if (s02Filters.scope) legendParams.set('scope', s02Filters.scope);
    if (s02Filters.clubId) legendParams.set('clubId', s02Filters.clubId);

    void Promise.all([
      fetch(`/api/leaderboards/filters`, { signal: controller.signal, cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<FiltersResponse>) : null))
        .catch(() => null),
      fetch(
        `/api/leaderboards/segments/${encodeURIComponent(segment.id)}?${params.toString()}`,
        { signal: controller.signal, cache: 'no-store' }
      ).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) {
          const payload = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || 'Classement filtré indisponible.');
        }
        return (await r.json()) as SegmentLeaderboardResponse;
      }),
      fetch(
        `/api/leaderboards/segments/${encodeURIComponent(segment.id)}/local-legends?${legendParams.toString()}`,
        { signal: controller.signal, cache: 'no-store' }
      )
        .then((r) => (r.ok ? (r.json() as Promise<LocalLegendResponse>) : null))
        .catch(() => null),
    ])
      .then(([filtersRes, lbRes, llRes]) => {
        if (!active) return;
        if (filtersRes) setS02Capabilities(filtersRes);
        if (lbRes) {
          setS02SegmentView(lbRes.segment);
          setS02Leaderboard(lbRes.leaderboard);
          setS02AntiCheat(lbRes.antiCheat);
        } else {
          setS02Leaderboard(null);
          setS02AntiCheat(null);
        }
        if (llRes) setS02LocalLegend(llRes.localLegend);
      })
      .catch((caught) => {
        if (!active || (caught instanceof DOMException && caught.name === 'AbortError')) return;
        setS02Error(caught instanceof Error ? caught.message : 'Erreur classement S02.');
      })
      .finally(() => {
        if (active) setS02Loading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [tab, segment.id, segment.visibility, segment.deletedAt, s02Filters]);

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
          ) : s02Leaderboard && s02SegmentView ? (
            <div className="lkdv-seg-panel">
              {s02Capabilities ? (
                <LeaderboardFilters
                  filters={sanitizeLeaderboardFilters(s02Filters)}
                  capabilities={s02Capabilities.capabilities}
                  clubOptions={s02Capabilities.clubOptions}
                  isAuthenticated={Boolean(viewerUserId && viewerUserId !== 'anonymous')}
                  disabled={s02Loading}
                  onChange={(next) => setS02Filters((prev) => ({ ...prev, ...next }))}
                />
              ) : null}
              {s02Error ? (
                <p className="lkdv-seg-muted" role="alert">
                  {s02Error}
                </p>
              ) : null}
              <LeaderboardTable
                entries={s02Leaderboard.entries}
                viewerEntry={s02Leaderboard.viewerEntry}
                sport={s02Leaderboard.sport}
              />
              {s02LocalLegend ? (
                <LocalLegendsPanel result={s02LocalLegend} segment={s02SegmentView} />
              ) : null}
              {s02AntiCheat ? <AntiCheatNotice summary={s02AntiCheat} /> : null}
            </div>
          ) : leaderboard.entries.length === 0 ? (
            <div className="lkdv-seg-empty" role="status">
              <strong>{s02Loading ? 'Chargement du classement…' : 'Aucun temps classé'}</strong>
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
