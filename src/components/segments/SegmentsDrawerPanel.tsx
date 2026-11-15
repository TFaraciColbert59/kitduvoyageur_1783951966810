'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ActivityTraceForSegments,
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

export interface SegmentsDrawerPanelProps {
  viewerUserId?: string;
  initialQuery?: string;
  nearCenter?: { lat: number; lng: number } | null;
  sourceActivity?: ActivityTraceForSegments;
  initialSelectedSegmentId?: string | null;
  hideSearchList?: boolean;
  onCloseSelected?: () => void;
}

/**
 * Panneau embarquable (drawer / sous-drawer) des segments S01 + classements S02.
 * Gère le chargement HTTP (`/api/segments`), la recherche, les favoris,
 * la création depuis une trace et la fiche complète `SegmentDetail`.
 */
export function SegmentsDrawerPanel({
  viewerUserId: explicitViewerId,
  initialQuery = '',
  nearCenter = null,
  sourceActivity,
  initialSelectedSegmentId = null,
  hideSearchList = false,
  onCloseSelected,
}: SegmentsDrawerPanelProps) {
  const { user } = useAuth();
  const viewerUserId = explicitViewerId ?? user?.id ?? 'anonymous';

  const [segments, setSegments] = useState<SegmentDefinition[]>([]);
  const [efforts, setEfforts] = useState<SegmentEffort[]>([]);
  const [hazardReports, setHazardReports] = useState<SegmentHazardReport[]>([]);
  const [preferences, setPreferences] = useState<UserSegmentPreferences>(() => ({
    userId: viewerUserId,
    starredSegmentIds: [],
    hiddenSegmentIds: [],
  }));
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedSegmentId);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (initialQuery.trim()) params.set('q', initialQuery.trim());
      if (nearCenter) {
        params.set('lat', String(nearCenter.lat));
        params.set('lng', String(nearCenter.lng));
      }
      const res = await apiRequest<{
        segments: SegmentDefinition[];
        preferences?: UserSegmentPreferences;
      }>(`/api/segments?${params.toString()}`);
      setSegments(res.segments ?? []);
      if (res.preferences) setPreferences(res.preferences);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Segments indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [initialQuery, nearCenter]);

  useEffect(() => {
    if (!hideSearchList) {
      void loadList();
    } else {
      setLoading(false);
    }
  }, [hideSearchList, loadList]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void apiRequest<{
      segment: SegmentDefinition;
      hazardReports?: SegmentHazardReport[];
      efforts?: SegmentEffort[];
      preferences?: UserSegmentPreferences;
    }>(`/api/segments/${encodeURIComponent(selectedId)}`)
      .then((res) => {
        if (!active) return;
        setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
        if (res.efforts) {
          setEfforts((cur) => [
            ...res.efforts!,
            ...cur.filter((e) => e.segmentId !== res.segment.id),
          ]);
        }
        if (res.hazardReports) {
          setHazardReports((cur) => [
            ...res.hazardReports!,
            ...cur.filter((r) => r.segmentId !== res.segment.id),
          ]);
        }
        if (res.preferences) setPreferences(res.preferences);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Fiche segment indisponible.');
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedSegment = segments.find((s) => s.id === selectedId) ?? null;

  const handleCreate = async (submission: SegmentFormSubmission) => {
    const activity = submission.activity ?? sourceActivity;
    if (!activity) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ segment: SegmentDefinition; mergedInto?: string | null }>(
        '/api/segments',
        {
          method: 'POST',
          body: JSON.stringify({
            name: submission.name,
            activity,
            startPointIndex: submission.startPointIndex ?? 0,
            endPointIndex: submission.endPointIndex ?? Math.max(0, activity.points.length - 1),
            visibility: submission.visibility,
            sport: submission.sport,
            surface: submission.surface,
          }),
        }
      );
      setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
      setSelectedId(res.segment.id);
      setMode('list');
      setNotice(
        res.mergedInto
          ? 'Segment fusionné avec le segment canonique existant.'
          : 'Segment créé et classé.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (segment: SegmentDefinition, submission: SegmentFormSubmission) => {
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
      const res = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${encodeURIComponent(segment.id)}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
      setMode('list');
      setNotice('Segment mis à jour.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (segment: SegmentDefinition) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/segments/${encodeURIComponent(segment.id)}`, { method: 'DELETE' });
      setSegments((cur) => cur.filter((s) => s.id !== segment.id));
      setSelectedId(null);
      setMode('list');
      setNotice('Segment supprimé.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleVisibilityChange = async (
    segment: SegmentDefinition,
    visibility: SegmentVisibility
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${encodeURIComponent(segment.id)}`,
        { method: 'PATCH', body: JSON.stringify({ visibility }) }
      );
      setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
      setNotice(visibility === 'private' ? 'Segment passé en privé.' : 'Segment publié.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Visibilité impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleHazardReport = async (
    segment: SegmentDefinition,
    _localResult: SubmitSegmentHazardResult,
    input: { category: SegmentHazardCategory; description: string }
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{
        segment: SegmentDefinition;
        report?: SegmentHazardReport;
      }>(`/api/segments/${encodeURIComponent(segment.id)}/hazard`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
      if (res.report) setHazardReports((cur) => [res.report!, ...cur]);
      setNotice('Signalement de danger enregistré.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Signalement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleResolveHazard = async (segment: SegmentDefinition) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ segment: SegmentDefinition }>(
        `/api/segments/${encodeURIComponent(segment.id)}/hazard`,
        { method: 'DELETE' }
      );
      setSegments((cur) => [res.segment, ...cur.filter((s) => s.id !== res.segment.id)]);
      setNotice('Statut de danger levé.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Résolution impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleFlagEffort = async (
    segment: SegmentDefinition,
    effort: SegmentEffort,
    input: { category: EffortFlagCategory; comment: string }
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ effort: SegmentEffort }>(
        `/api/segments/${encodeURIComponent(segment.id)}/flags`,
        { method: 'POST', body: JSON.stringify({ effortId: effort.effortId, ...input }) }
      );
      setEfforts((cur) => [res.effort, ...cur.filter((e) => e.effortId !== res.effort.effortId)]);
      setNotice('Signalement anti-triche enregistré.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Signalement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleContestEffort = async (
    segment: SegmentDefinition,
    effort: SegmentEffort,
    input: { justification: string }
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ effort: SegmentEffort }>(
        `/api/segments/${encodeURIComponent(segment.id)}/contest`,
        { method: 'POST', body: JSON.stringify({ effortId: effort.effortId, ...input }) }
      );
      setEfforts((cur) => [res.effort, ...cur.filter((e) => e.effortId !== res.effort.effortId)]);
      setNotice('Contestation envoyée.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Contestation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreferencesChange = async (next: UserSegmentPreferences) => {
    const prevStarred = new Set(preferences.starredSegmentIds);
    const nextStarred = new Set(next.starredSegmentIds);
    const prevHidden = new Set(preferences.hiddenSegmentIds);
    const nextHidden = new Set(next.hiddenSegmentIds);
    setPreferences(next);

    for (const id of new Set([...prevStarred, ...nextStarred])) {
      if (prevStarred.has(id) !== nextStarred.has(id)) {
        await apiRequest(`/api/segments/${encodeURIComponent(id)}/star`, {
          method: 'POST',
          body: JSON.stringify({ starred: nextStarred.has(id) }),
        }).catch(() => undefined);
      }
    }
    for (const id of new Set([...prevHidden, ...nextHidden])) {
      if (prevHidden.has(id) !== nextHidden.has(id)) {
        await apiRequest(`/api/segments/${encodeURIComponent(id)}/hide`, {
          method: 'POST',
          body: JSON.stringify({ hidden: nextHidden.has(id) }),
        }).catch(() => undefined);
      }
    }
  };

  if (mode === 'create') {
    return (
      <div className="lkdv-seg-panel">
        {error ? <p role="alert" className="lkdv-seg-error">{error}</p> : null}
        <SegmentCreateEditForm
          mode="create"
          viewerUserId={viewerUserId}
          activity={sourceActivity}
          busy={busy}
          serverError={error}
          onSubmit={(_seg, submission) => void handleCreate(submission)}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  if (mode === 'edit' && selectedSegment) {
    return (
      <div className="lkdv-seg-panel">
        <SegmentCreateEditForm
          mode="edit"
          viewerUserId={viewerUserId}
          segment={selectedSegment}
          activity={sourceActivity}
          busy={busy}
          serverError={error}
          onSubmit={(seg, submission) => void handleEdit(seg, submission)}
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  if (selectedSegment) {
    return (
      <div className="lkdv-seg-panel">
        {notice ? <p role="status" className="lkdv-seg-notice">{notice}</p> : null}
        {error ? <p role="alert" className="lkdv-seg-error">{error}</p> : null}
        <SegmentDetail
          segment={selectedSegment}
          efforts={efforts}
          hazardReports={hazardReports}
          preferences={preferences}
          viewerUserId={viewerUserId}
          busy={busy}
          onClose={() => {
            setSelectedId(null);
            onCloseSelected?.();
          }}
          onEdit={() => setMode('edit')}
          onDelete={() => void handleDelete(selectedSegment)}
          onVisibilityChange={(vis) => void handleVisibilityChange(selectedSegment, vis)}
          onHazardReport={(result, input) => void handleHazardReport(selectedSegment, result, input)}
          onResolveHazard={() => void handleResolveHazard(selectedSegment)}
          onFlagEffort={(effort, input) => void handleFlagEffort(selectedSegment, effort, input)}
          onContestEffort={(effort, input) => void handleContestEffort(selectedSegment, effort, input)}
        />
      </div>
    );
  }

  if (loading) {
    return <p className="lkdv-seg-muted" role="status">Chargement des segments…</p>;
  }

  return (
    <div className="lkdv-seg-panel">
      {notice ? <p role="status" className="lkdv-seg-notice">{notice}</p> : null}
      {error ? (
        <div role="alert" className="lkdv-seg-error">
          {error}{' '}
          <button type="button" className="lkdv-seg-btn ghost small" onClick={() => void loadList()}>
            Réessayer
          </button>
        </div>
      ) : null}
      <SegmentList
        segments={segments}
        viewerUserId={viewerUserId}
        preferences={preferences}
        initialQuery={initialQuery}
        onPreferencesChange={(next) => void handlePreferencesChange(next)}
        onSelect={(seg) => setSelectedId(seg.id)}
        onCreate={() => setMode('create')}
      />
    </div>
  );
}

export default SegmentsDrawerPanel;
