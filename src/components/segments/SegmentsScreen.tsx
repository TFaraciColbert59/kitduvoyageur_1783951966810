'use client';

import React, { useMemo, useState } from 'react';
import AppShell from '@/components/shell/AppShell';
import type {
  EffortFlagCategory,
  SegmentDefinition,
  SegmentEffort,
  SegmentHazardCategory,
  SegmentHazardReport,
  SegmentVisibility,
  SubmitSegmentHazardResult,
  UserSegmentPreferences,
} from '@/features/segments';
import { apiRequest } from './api';
import { SegmentCreateEditForm, type SegmentFormSubmission } from './SegmentCreateEditForm';
import { SegmentDetail } from './SegmentDetail';
import { SegmentList } from './SegmentList';
import './segments.css';

export interface SegmentsScreenProps {
  viewerUserId: string;
  initialSegments: SegmentDefinition[];
  initialEfforts: SegmentEffort[];
  initialHazardReports: SegmentHazardReport[];
  initialPreferences: UserSegmentPreferences;
}

function upsertById<T extends { id?: string; effortId?: string }>(items: T[], next: T): T[] {
  const key = (item: T) => item.id ?? item.effortId ?? '';
  return [next, ...items.filter((item) => key(item) !== key(next))];
}

export function SegmentsScreen({
  viewerUserId,
  initialSegments,
  initialEfforts,
  initialHazardReports,
  initialPreferences,
}: SegmentsScreenProps) {
  const [segments, setSegments] = useState(initialSegments);
  const [efforts, setEfforts] = useState(initialEfforts);
  const [hazardReports, setHazardReports] = useState(initialHazardReports);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === selectedId) ?? null,
    [segments, selectedId]
  );

  const ownEfforts = useMemo(
    () => efforts.filter((effort) => effort.userId === viewerUserId),
    [efforts, viewerUserId]
  );
  const personalRecords = ownEfforts.filter((effort) => effort.isPersonalRecord).length;

  async function refreshAfterMutation(message: string) {
    setNotice(message);
    setError(null);
  }

  async function handleCreate(segment: SegmentDefinition, submission: SegmentFormSubmission) {
    if (!submission.activity) {
      setError('Importez une trace GPS avant de créer le segment.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ segment: SegmentDefinition; mergedInto: string | null }>(
        '/api/segments',
        {
          method: 'POST',
          body: JSON.stringify({
            name: submission.name,
            activity: submission.activity,
            startPointIndex: submission.startPointIndex,
            endPointIndex: submission.endPointIndex,
            visibility: submission.visibility,
            sport: submission.sport,
            surface: submission.surface,
          }),
        }
      );
      setSegments((current) => {
        const withoutDuplicate = current.filter(
          (candidate) =>
            candidate.id !== segment.id &&
            candidate.id !== response.segment.id &&
            candidate.id !== response.mergedInto
        );
        return [response.segment, ...withoutDuplicate];
      });
      setSelectedId(response.segment.id);
      setMode('list');
      await refreshAfterMutation(
        response.mergedInto
          ? 'Segment fusionné dans le segment canonique existant.'
          : 'Segment créé.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(segment: SegmentDefinition, submission: SegmentFormSubmission) {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: submission.name,
        sport: submission.sport,
        surface: submission.surface,
        visibility: submission.visibility,
      };
      if (submission.boundsChanged && submission.activity) {
        body.newBounds = {
          activity: submission.activity,
          startPointIndex: submission.startPointIndex,
          endPointIndex: submission.endPointIndex,
        };
      }
      const response = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${segment.id}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      setSegments((current) => upsertById(current, response.segment));
      setMode('list');
      await refreshAfterMutation('Segment mis à jour.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(segment: SegmentDefinition) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/segments/${segment.id}`, { method: 'DELETE' });
      setSegments((current) => current.filter((candidate) => candidate.id !== segment.id));
      setEfforts((current) => current.filter((effort) => effort.segmentId !== segment.id));
      setSelectedId(null);
      setMode('list');
      await refreshAfterMutation('Segment supprimé.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVisibilityChange(segment: SegmentDefinition, visibility: SegmentVisibility) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${segment.id}`,
        { method: 'PATCH', body: JSON.stringify({ visibility }) }
      );
      setSegments((current) => upsertById(current, response.segment));
      await refreshAfterMutation(
        visibility === 'private' ? 'Segment passé en privé.' : 'Segment publié.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Changement de visibilité impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePreferences(next: UserSegmentPreferences) {
    const previous = preferences;
    const addedStar = next.starredSegmentIds.find(
      (id) => !previous.starredSegmentIds.includes(id)
    );
    const removedStar = previous.starredSegmentIds.find(
      (id) => !next.starredSegmentIds.includes(id)
    );
    const addedHidden = next.hiddenSegmentIds.find(
      (id) => !previous.hiddenSegmentIds.includes(id)
    );
    const removedHidden = previous.hiddenSegmentIds.find(
      (id) => !next.hiddenSegmentIds.includes(id)
    );

    const segmentId = addedStar ?? removedStar ?? addedHidden ?? removedHidden;
    if (!segmentId) return;
    const action = addedStar ? 'star' : removedStar ? 'unstar' : addedHidden ? 'hide' : 'unhide';

    setPreferences(next);
    try {
      const response = await apiRequest<{ preferences: UserSegmentPreferences }>(
        '/api/segments/preferences',
        { method: 'PATCH', body: JSON.stringify({ segmentId, action }) }
      );
      setPreferences(response.preferences);
    } catch (caught) {
      setPreferences(previous);
      setError(caught instanceof Error ? caught.message : 'Préférence non enregistrée.');
    }
  }

  async function handleHazardReport(
    segment: SegmentDefinition,
    result: SubmitSegmentHazardResult,
    input: { category: SegmentHazardCategory; description: string }
  ) {
    setBusy(true);
    setError(null);
    const previousSegment = segment;
    const previousReports = hazardReports;
    if (result.report) {
      setHazardReports((current) => [...current, result.report!]);
      setSegments((current) => upsertById(current, result.updatedSegment));
    }
    try {
      const response = await apiRequest<{
        segment: SegmentDefinition;
        report: SegmentHazardReport;
      }>(`/api/segments/${segment.id}/hazard`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setSegments((current) => upsertById(current, response.segment));
      setHazardReports((current) => [
        ...current.filter((report) => report.reportId !== response.report.reportId),
        response.report,
      ]);
      await refreshAfterMutation('Danger signalé : classement et notifications suspendus.');
    } catch (caught) {
      setSegments((current) => upsertById(current, previousSegment));
      setHazardReports(previousReports);
      setError(caught instanceof Error ? caught.message : 'Signalement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveHazard(segment: SegmentDefinition) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${segment.id}/hazard`,
        { method: 'DELETE' }
      );
      setSegments((current) => upsertById(current, response.segment));
      setHazardReports((current) =>
        current.map((report) =>
          report.segmentId === segment.id &&
          (report.status === 'active' || report.status === 'pending')
            ? { ...report, status: 'resolved' }
            : report
        )
      );
      await refreshAfterMutation('Danger levé.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Levée du danger impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFlagEffort(
    segment: SegmentDefinition,
    effort: SegmentEffort,
    input: { category: EffortFlagCategory; comment: string }
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ effort: SegmentEffort }>(
        `/api/segments/${segment.id}/flags`,
        {
          method: 'POST',
          body: JSON.stringify({ effortId: effort.effortId, ...input }),
        }
      );
      setEfforts((current) => upsertById(current, response.effort));
      await refreshAfterMutation('Effort signalé. La revue est ouverte.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Signalement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handleContestEffort(
    segment: SegmentDefinition,
    effort: SegmentEffort,
    input: { justification: string }
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiRequest<{ effort: SegmentEffort }>(
        `/api/segments/${segment.id}/contest`,
        {
          method: 'POST',
          body: JSON.stringify({ effortId: effort.effortId, justification: input.justification }),
        }
      );
      setEfforts((current) => upsertById(current, response.effort));
      await refreshAfterMutation('Contestation envoyée.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Contestation impossible.');
    } finally {
      setBusy(false);
    }
  }

  const formSegment = selectedSegment ?? undefined;

  return (
    <AppShell>
      <div className={`lkdv-seg-screen${selectedSegment ? ' has-selection' : ''}`}>
        <header className="lkdv-seg-hero">
          <div>
            <p className="lkdv-seg-eyebrow">S4.01 → S4.12 · Segments sportifs</p>
            <h1>Vos passages, vos records.</h1>
            <p>
              Détection GPS, classements vérifiés, historique personnel et sécurité du terrain.
            </p>
          </div>
          <div className="lkdv-seg-hero-stats" aria-label="Résumé des segments">
            <div>
              <strong>{segments.length}</strong>
              <span>segments</span>
            </div>
            <div>
              <strong>{personalRecords}</strong>
              <span>records</span>
            </div>
            <div>
              <strong>{preferences.starredSegmentIds.length}</strong>
              <span>favoris</span>
            </div>
          </div>
        </header>

        {error ? (
          <div className="lkdv-seg-alert danger" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Fermer l’erreur">
              ✕
            </button>
          </div>
        ) : null}
        {notice ? (
          <div className="lkdv-seg-alert success" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fermer le message">
              ✕
            </button>
          </div>
        ) : null}

        {mode === 'create' ? (
          <SegmentCreateEditForm
            mode="create"
            viewerUserId={viewerUserId}
            busy={busy}
            serverError={error}
            onSubmit={(segment, submission) => void handleCreate(segment, submission)}
            onCancel={() => setMode('list')}
          />
        ) : mode === 'edit' && formSegment ? (
          <SegmentCreateEditForm
            mode="edit"
            viewerUserId={viewerUserId}
            segment={formSegment}
            busy={busy}
            serverError={error}
            onSubmit={(segment, submission) => void handleEdit(segment, submission)}
            onCancel={() => setMode('list')}
          />
        ) : (
          <div className={`lkdv-seg-layout${selectedSegment ? ' has-selection' : ''}`}>
            <SegmentList
              segments={segments}
              viewerUserId={viewerUserId}
              preferences={preferences}
              selectedSegmentId={selectedId}
              onPreferencesChange={(next) => void handlePreferences(next)}
              onSelect={(segment) => setSelectedId(segment.id)}
              onCreate={() => {
                setMode('create');
                setNotice(null);
              }}
            />

            <div className="lkdv-seg-detail-slot">
              {selectedSegment ? (
                <SegmentDetail
                  segment={selectedSegment}
                  efforts={efforts}
                  hazardReports={hazardReports.filter(
                    (report) => report.segmentId === selectedSegment.id
                  )}
                  preferences={preferences}
                  viewerUserId={viewerUserId}
                  busy={busy}
                  onClose={() => setSelectedId(null)}
                  onEdit={() => setMode('edit')}
                  onDelete={() => void handleDelete(selectedSegment)}
                  onVisibilityChange={(visibility) =>
                    void handleVisibilityChange(selectedSegment, visibility)
                  }
                  onHazardReport={(result, input) =>
                    void handleHazardReport(selectedSegment, result, input)
                  }
                  onResolveHazard={() => void handleResolveHazard(selectedSegment)}
                  onFlagEffort={(effort, input) =>
                    void handleFlagEffort(selectedSegment, effort, input)
                  }
                  onContestEffort={(effort, input) =>
                    void handleContestEffort(selectedSegment, effort, input)
                  }
                />
              ) : (
                <aside className="lkdv-seg-placeholder">
                  <p className="lkdv-seg-eyebrow">Détail</p>
                  <strong>Sélectionnez un segment</strong>
                  <p>
                    Historique, records, classement vérifié, comparaison point par point et
                    signalement de danger s’affichent ici.
                  </p>
                </aside>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default SegmentsScreen;
