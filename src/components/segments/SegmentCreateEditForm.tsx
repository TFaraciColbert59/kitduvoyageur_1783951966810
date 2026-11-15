'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileUp, ShieldAlert } from 'lucide-react';
import {
  createSegmentFromActivity,
  updateSegment,
  type ActivityTraceForSegments,
  type SegmentDefinition,
  type SegmentSport,
  type SegmentVisibility,
} from '@/features/segments';
import { SegmentStats } from './SegmentBadges';
import {
  SEGMENT_ERROR_MESSAGES,
  SPORTS,
  SPORT_LABELS,
} from './format';
import { parseActivityTraceJson } from './traceImport';

export interface SegmentFormSubmission {
  activity?: ActivityTraceForSegments;
  startPointIndex?: number;
  endPointIndex?: number;
  boundsChanged: boolean;
  name: string;
  visibility: SegmentVisibility;
  sport: SegmentSport;
  surface: string | null;
}

export interface SegmentCreateEditFormProps {
  mode: 'create' | 'edit';
  viewerUserId: string;
  segment?: SegmentDefinition;
  activity?: ActivityTraceForSegments;
  initialStartPointIndex?: number;
  initialEndPointIndex?: number;
  busy?: boolean;
  serverError?: string | null;
  onSubmit: (segment: SegmentDefinition, submission: SegmentFormSubmission) => void;
  onCancel?: () => void;
}

/**
 * S4.02 — création et édition d'un segment. Le formulaire ne calcule rien
 * lui-même : il délègue au contrat (`createSegmentFromActivity` / `updateSegment`)
 * et n'affiche que le résultat validé.
 */
export function SegmentCreateEditForm({
  mode,
  viewerUserId,
  segment,
  activity,
  initialStartPointIndex,
  initialEndPointIndex,
  busy = false,
  serverError,
  onSubmit,
  onCancel,
}: SegmentCreateEditFormProps) {
  const [importedActivity, setImportedActivity] = useState<ActivityTraceForSegments | null>(
    activity ?? null
  );
  const [rawTrace, setRawTrace] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [name, setName] = useState(segment?.name ?? '');
  const [sport, setSport] = useState<SegmentSport>(segment?.sport ?? activity?.sport ?? 'running');
  const [surface, setSurface] = useState(segment?.surface ?? '');
  const [visibility, setVisibility] = useState<SegmentVisibility>(segment?.visibility ?? 'public');
  const [startIndex, setStartIndex] = useState(initialStartPointIndex ?? 0);
  const [endIndex, setEndIndex] = useState(initialEndPointIndex ?? 0);
  const [boundsEnabled, setBoundsEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveActivity = activity ?? importedActivity;

  useEffect(() => {
    if (!activity) return;
    setImportedActivity(activity);
    setSport((current) => (mode === 'create' ? activity.sport : current));
    setEndIndex((current) => (current > 0 ? current : activity.points.length - 1));
  }, [activity, mode]);

  useEffect(() => {
    if (!effectiveActivity) return;
    setEndIndex((current) =>
      current > 0 && current < effectiveActivity.points.length
        ? current
        : effectiveActivity.points.length - 1
    );
  }, [effectiveActivity]);

  const preview = useMemo(() => {
    if (!name.trim()) {
      return { ok: false as const, error: 'invalid_name' as const };
    }

    if (mode === 'edit' && segment) {
      const result = updateSegment({
        segment,
        actorUserId: viewerUserId,
        name,
        sport,
        surface: surface.trim() ? surface.trim() : null,
        visibility,
        ...(boundsEnabled && effectiveActivity
          ? {
              newBounds: {
                activity: effectiveActivity,
                startPointIndex: startIndex,
                endPointIndex: endIndex,
              },
            }
          : {}),
      });
      return result.ok
        ? { ok: true as const, segment: result.segment, recompute: result.requiresEffortRecomputation }
        : { ok: false as const, error: result.error ?? ('invalid_bounds' as const) };
    }

    if (!effectiveActivity) return null;
    const result = createSegmentFromActivity({
      name,
      activity: effectiveActivity,
      startPointIndex: startIndex,
      endPointIndex: endIndex,
      visibility,
      sport,
      surface: surface.trim() ? surface.trim() : null,
    });
    return result.ok && result.segment
      ? { ok: true as const, segment: result.segment, recompute: false }
      : { ok: false as const, error: result.error ?? ('invalid_bounds' as const) };
  }, [
    name,
    mode,
    segment,
    viewerUserId,
    sport,
    surface,
    visibility,
    boundsEnabled,
    effectiveActivity,
    startIndex,
    endIndex,
  ]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseActivityTraceJson(text, viewerUserId);
      if (!parsed.ok) {
        setImportError(parsed.error);
        return;
      }
      setImportedActivity(parsed.activity);
      setSport(parsed.activity.sport);
      setStartIndex(0);
      setEndIndex(parsed.activity.points.length - 1);
    } catch {
      setImportError('Impossible de lire ce fichier.');
    }
  }

  function loadRawTrace() {
    const parsed = parseActivityTraceJson(rawTrace, viewerUserId);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }
    setImportError(null);
    setImportedActivity(parsed.activity);
    setSport(parsed.activity.sport);
    setStartIndex(0);
    setEndIndex(parsed.activity.points.length - 1);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!preview) {
      setFormError('Importez une trace GPS avant de créer le segment.');
      return;
    }
    if (!preview.ok) {
      setFormError(SEGMENT_ERROR_MESSAGES[preview.error]);
      return;
    }
    onSubmit(preview.segment, {
      activity:
        mode === 'create' || boundsEnabled ? effectiveActivity ?? undefined : undefined,
      startPointIndex: startIndex,
      endPointIndex: endIndex,
      boundsChanged: mode === 'edit' && boundsEnabled,
      name,
      visibility,
      sport,
      surface: surface.trim() ? surface.trim() : null,
    });
  }

  const maxIndex = effectiveActivity ? effectiveActivity.points.length - 1 : 0;
  const showBounds = mode === 'create' || boundsEnabled;

  return (
    <form className="lkdv-seg-form" onSubmit={handleSubmit} aria-label="Formulaire de segment">
      <header className="lkdv-seg-form-head">
        <div>
          <p className="lkdv-seg-eyebrow">{mode === 'create' ? 'S4.02 · Création' : 'S4.02 · Édition'}</p>
          <h2>{mode === 'create' ? 'Nouveau segment' : 'Modifier le segment'}</h2>
        </div>
        {onCancel ? (
          <button type="button" className="lkdv-seg-btn ghost" onClick={onCancel}>
            Annuler
          </button>
        ) : null}
      </header>

      {mode === 'create' && !effectiveActivity ? (
        <fieldset className="lkdv-seg-import">
          <legend>Trace GPS source</legend>
          <p>
            Importez l’export JSON de votre activité : le segment est découpé entre deux bornes, sans
            jamais inventer de point.
          </p>
          <label className="lkdv-seg-file">
            <FileUp size={18} aria-hidden="true" />
            <span>Choisir un fichier JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            <span>… ou coller la trace</span>
            <textarea
              rows={5}
              value={rawTrace}
              onChange={(event) => setRawTrace(event.target.value)}
              placeholder='{"sport":"running","points":[{"lat":45.1,"lng":6.2,"timestamp":"…"}]}'
            />
          </label>
          <button type="button" className="lkdv-seg-btn" onClick={loadRawTrace}>
            Charger la trace
          </button>
          {importError ? (
            <p className="lkdv-seg-error" role="alert">
              {importError}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <label>
        <span>Nom du segment</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={3}
          maxLength={120}
          required
          aria-invalid={Boolean(formError) && name.trim().length < 3}
          placeholder="Montée du Belvédère"
        />
      </label>

      <div className="lkdv-seg-form-grid">
        <label>
          <span>Sport</span>
          <select value={sport} onChange={(event) => setSport(event.target.value as SegmentSport)}>
            {SPORTS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {SPORT_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Surface (facultatif)</span>
          <input
            value={surface}
            onChange={(event) => setSurface(event.target.value)}
            maxLength={80}
            placeholder="route, sentier, gravier…"
          />
        </label>
      </div>

      <fieldset className="lkdv-seg-visibility">
        <legend>Visibilité</legend>
        <label>
          <input
            type="radio"
            name="segment-visibility"
            value="public"
            checked={visibility === 'public'}
            onChange={() => setVisibility('public')}
          />
          <span>Public — visible et classable</span>
        </label>
        <label>
          <input
            type="radio"
            name="segment-visibility"
            value="private"
            checked={visibility === 'private'}
            onChange={() => setVisibility('private')}
          />
          <span>Privé — visible par vous seul</span>
        </label>
      </fieldset>

      {effectiveActivity && mode === 'edit' ? (
        <label className="lkdv-seg-toggle">
          <input
            type="checkbox"
            checked={boundsEnabled}
            onChange={(event) => setBoundsEnabled(event.target.checked)}
          />
          <span>Redéfinir les bornes sur la trace source</span>
        </label>
      ) : null}

      {showBounds && effectiveActivity ? (
        <div className="lkdv-seg-form-grid">
          <label>
            <span>Point de départ</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, maxIndex - 2)}
              value={startIndex}
              onChange={(event) => setStartIndex(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Point d’arrivée</span>
            <input
              type="number"
              min={Math.min(maxIndex, 2)}
              max={maxIndex}
              value={endIndex}
              onChange={(event) => setEndIndex(Number(event.target.value))}
            />
          </label>
        </div>
      ) : null}

      {effectiveActivity ? (
        <p className="lkdv-seg-form-hint">
          {effectiveActivity.points.length} points · géométrie recalculée par le contrat
        </p>
      ) : null}

      {preview?.ok ? (
        <section className="lkdv-seg-preview" aria-label="Aperçu du segment">
          <header>
            <strong>Aperçu</strong>
            {preview.recompute ? <span className="lkdv-seg-badge danger">Version +1</span> : null}
          </header>
          <SegmentStats segment={preview.segment} />
          {preview.recompute ? (
            <p className="lkdv-seg-form-hint">
              Les bornes ou le sport changent : les efforts seront recalculés.
            </p>
          ) : null}
        </section>
      ) : null}

      {formError || (preview && !preview.ok) ? (
        <p className="lkdv-seg-error" role="alert">
          {formError ??
            (preview && !preview.ok ? SEGMENT_ERROR_MESSAGES[preview.error] : 'Segment invalide.')}
        </p>
      ) : null}

      {visibility === 'public' ? (
        <p className="lkdv-seg-form-note">
          <ShieldAlert size={15} aria-hidden="true" />
          Un segment public ne peut pas traverser une zone de confidentialité masquée.
        </p>
      ) : null}

      {serverError ? (
        <p className="lkdv-seg-error" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="lkdv-seg-form-actions">
        <button type="submit" className="lkdv-seg-btn primary" disabled={busy || !preview?.ok}>
          {busy ? 'Enregistrement…' : mode === 'create' ? 'Créer le segment' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

export default SegmentCreateEditForm;
