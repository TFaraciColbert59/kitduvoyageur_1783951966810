'use client';

/**
 * Lot A02 — recadrage et fractionnement avec aperçu (K5.07, S1.22).
 *
 * Les aperçus sont calculés par le contrat (`previewCropActivityTrace`,
 * `splitActivityTrace`) sur la géométrie réelle : distances, D+ et temps
 * affichés avant validation sont ceux qui seront écrits. Aucune écriture
 * n'est faite tant que l'utilisateur n'a pas confirmé.
 */

import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Scissors, SplitSquareVertical } from 'lucide-react';
import {
  previewCropActivityTrace,
  splitActivityTrace,
  type CropBounds,
  type LifecycleActivityRecord,
  type SplitActivitySpec,
} from '@/features/compte/lifecycle';
import { formatDistanceKm, formatDuration, formatElevation, formatNumber } from './format';
import {
  buildTraceGeometry,
  distanceAtIndex,
  hasGeometryChanges,
  pointIndexToRatio,
  ratioToPointIndex,
} from './trace';
import { Notice, Segmented } from './primitives';
import { newOperationId, type SubmitResult } from './types';

type Mode = 'crop' | 'split';

export interface RecadrageFractionnementProps {
  record: LifecycleActivityRecord;
  busy?: boolean;
  onApplyCrop: (bounds: CropBounds) => Promise<SubmitResult>;
  onApplySplit: (spec: SplitActivitySpec) => Promise<SubmitResult>;
  onRestoreOriginal: () => Promise<SubmitResult>;
}

function safeTime(points: readonly { timestamp: string | null }[], index: number): string | null {
  return points[Math.min(points.length - 1, Math.max(0, index))]?.timestamp ?? null;
}

export function RecadrageFractionnement({
  record,
  busy = false,
  onApplyCrop,
  onApplySplit,
  onRestoreOriginal,
}: RecadrageFractionnementProps) {
  const [mode, setMode] = useState<Mode>('crop');
  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [partTitles, setPartTitles] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const operationRef = useRef<string | null>(null);

  const points = record.points;
  const startIndex = ratioToPointIndex(points, startRatio);
  const endIndex = ratioToPointIndex(points, endRatio);
  const splitIndex = ratioToPointIndex(points, splitRatio);

  const cropPreview = useMemo(() => {
    if (points.length < 3 || startIndex >= endIndex) return null;
    const outcome = previewCropActivityTrace(record, { startIndex, endIndex });
    return outcome.ok ? outcome.preview : null;
  }, [record, points.length, startIndex, endIndex]);

  const splitPreview = useMemo(() => {
    if (points.length < 3) return null;
    const bounded = Math.min(points.length - 2, Math.max(1, splitIndex));
    const outcome = splitActivityTrace(record, { splitIndices: [bounded] });
    return outcome.ok ? outcome : null;
  }, [record, points.length, splitIndex]);

  const originalGeometry = useMemo(() => buildTraceGeometry(points, 340, 104), [points]);
  const croppedGeometry = useMemo(
    () => (cropPreview ? buildTraceGeometry(cropPreview.croppedPoints, 340, 72) : null),
    [cropPreview]
  );

  const cropChanged = points.length > 1 && (startIndex > 0 || endIndex < points.length - 1);
  const canRestore = hasGeometryChanges(record);
  const pending = busy || submitting;

  function ensureOperationId(): string {
    if (!operationRef.current) operationRef.current = newOperationId();
    return operationRef.current;
  }

  async function applyCrop() {
    setError(null);
    if (!cropPreview || !cropChanged) {
      setError('Choisis une portion plus courte que la trace actuelle.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onApplyCrop({
        startIndex: cropPreview.resolvedStartIndex,
        endIndex: cropPreview.resolvedEndIndex,
        operationId: ensureOperationId(),
      });
      if (result.ok === false) setError(result.error);
      else operationRef.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  async function applySplit() {
    setError(null);
    if (!splitPreview) {
      setError('La trace doit contenir au moins 3 points pour être fractionnée.');
      return;
    }
    const bounded = Math.min(points.length - 2, Math.max(1, splitIndex));
    setSubmitting(true);
    try {
      const titles = partTitles.map((title) => title.trim()).filter(Boolean);
      const result = await onApplySplit({
        splitIndices: [bounded],
        operationId: ensureOperationId(),
        ...(titles.length > 0 ? { partTitles: titles } : {}),
      });
      if (result.ok === false) setError(result.error);
      else operationRef.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  async function restoreOriginal() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onRestoreOriginal();
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (points.length < 3) {
    return (
      <div data-testid="recadrage-fractionnement">
        <Notice tone="info">
          Cette séance contient moins de trois points GPS : le recadrage et le fractionnement
          exigent une trace mesurée.
        </Notice>
      </div>
    );
  }

  return (
    <div className="lkv-life__fields" data-testid="recadrage-fractionnement">
      <Segmented<Mode>
        label="Action sur la trace"
        value={mode}
        options={[
          { value: 'crop', label: 'Recadrer' },
          { value: 'split', label: 'Fractionner' },
        ]}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
      />

      {mode === 'crop' ? (
        <>
          <div className="lkv-life__field">
            <label htmlFor="life-crop-start">Début conservé</label>
            <div className="lkv-life__range-row">
              <input
                id="life-crop-start"
                type="range"
                min={0}
                max={0.999}
                step={0.001}
                value={startRatio}
                onChange={(event) => {
                  const next = Math.min(Number(event.target.value), endRatio - 0.001);
                  setStartRatio(Math.max(0, next));
                }}
              />
              <output htmlFor="life-crop-start">
                {formatDistanceKm(distanceAtIndex(points, startIndex) / 1000)}
              </output>
            </div>
            <p className="lkv-life__hint">{safeTime(points, startIndex) ?? 'Heure non mesurée'}</p>
          </div>

          <div className="lkv-life__field">
            <label htmlFor="life-crop-end">Fin conservée</label>
            <div className="lkv-life__range-row">
              <input
                id="life-crop-end"
                type="range"
                min={0.001}
                max={1}
                step={0.001}
                value={endRatio}
                onChange={(event) => {
                  const next = Math.max(Number(event.target.value), startRatio + 0.001);
                  setEndRatio(Math.min(1, next));
                }}
              />
              <output htmlFor="life-crop-end">
                {formatDistanceKm(distanceAtIndex(points, endIndex) / 1000)}
              </output>
            </div>
            <p className="lkv-life__hint">{safeTime(points, endIndex) ?? 'Heure non mesurée'}</p>
          </div>

          <svg
            className="lkv-life__profile"
            viewBox="0 0 340 104"
            preserveAspectRatio="none"
            role="img"
            aria-label="Trace complète et portion conservée"
          >
            <rect
              className="selection"
              x={6 + pointIndexToRatio(points, startIndex) * 328}
              y={6}
              width={Math.max(
                1,
                (pointIndexToRatio(points, endIndex) - pointIndexToRatio(points, startIndex)) * 328
              )}
              height={92}
            />
            <path className="line" d={originalGeometry.path} />
          </svg>

          {cropPreview ? (
            <div className="lkv-life__compare">
              <div className="lkv-life__compare-card">
                <b>Avant</b>
                <p>
                  {formatDistanceKm(cropPreview.beforeStats.distanceKm)} ·{' '}
                  {formatElevation(cropPreview.beforeStats.elevationGainM)} D+ ·{' '}
                  {formatDuration(cropPreview.beforeStats.movingTimeS)}
                </p>
              </div>
              <div className="lkv-life__compare-card">
                <b>Après</b>
                <p>
                  {formatDistanceKm(cropPreview.afterStats.distanceKm)} ·{' '}
                  {formatElevation(cropPreview.afterStats.elevationGainM)} D+ ·{' '}
                  {formatDuration(cropPreview.afterStats.movingTimeS)}
                </p>
              </div>
            </div>
          ) : null}

          {cropPreview ? (
            <p className="lkv-life__hint">
              Retiré : {formatNumber(cropPreview.trimmedDistanceM)} m et{' '}
              {formatDuration(cropPreview.trimmedDurationS)}.
              {cropPreview.removedStartPoints > 0
                ? ` ${cropPreview.removedStartPoints} point(s) au début.`
                : ''}
              {cropPreview.removedEndPoints > 0
                ? ` ${cropPreview.removedEndPoints} point(s) à la fin.`
                : ''}
            </p>
          ) : null}

          {cropPreview?.invalidatesRecords ? (
            <Notice tone="warning">
              Les records établis sur la portion retirée seront invalidés. La trace brute d’origine
              reste conservée et pourra être restaurée.
            </Notice>
          ) : null}

          {croppedGeometry?.path ? (
            <svg
              className="lkv-life__profile"
              viewBox="0 0 340 72"
              preserveAspectRatio="none"
              role="img"
              aria-label="Aperçu de la trace conservée"
            >
              <path className="line" d={croppedGeometry.path} />
            </svg>
          ) : null}

          <div className="lkv-life__actions">
            <button
              type="button"
              className="lkv-life__btn"
              data-variant="primary"
              onClick={() => void applyCrop()}
              disabled={pending || !cropChanged || !cropPreview}
            >
              <Check size={15} aria-hidden="true" /> Appliquer le recadrage
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="lkv-life__field">
            <label htmlFor="life-split-at">Point de coupure</label>
            <div className="lkv-life__range-row">
              <input
                id="life-split-at"
                type="range"
                min={0.05}
                max={0.95}
                step={0.005}
                value={splitRatio}
                onChange={(event) => setSplitRatio(Number(event.target.value))}
              />
              <output htmlFor="life-split-at">
                {formatDistanceKm(distanceAtIndex(points, splitIndex) / 1000)}
              </output>
            </div>
            <p className="lkv-life__hint">{safeTime(points, splitIndex) ?? 'Heure non mesurée'}</p>
          </div>

          <svg
            className="lkv-life__profile"
            viewBox="0 0 340 104"
            preserveAspectRatio="none"
            role="img"
            aria-label="Trace complète et point de fractionnement"
          >
            <path className="line" d={originalGeometry.path} />
            <line
              className="cursor"
              x1={6 + splitRatio * 328}
              y1={6}
              x2={6 + splitRatio * 328}
              y2={98}
            />
          </svg>

          {splitPreview ? (
            <>
              <table className="lkv-life__split-table">
                <caption className="lkv-life__sr">Aperçu des tronçons</caption>
                <thead>
                  <tr>
                    <th scope="col">Tronçon</th>
                    <th scope="col">Distance</th>
                    <th scope="col">D+</th>
                    <th scope="col">Temps</th>
                  </tr>
                </thead>
                <tbody>
                  {splitPreview.parts.map((part, index) => (
                    <tr key={part.id}>
                      <td>{index + 1}</td>
                      <td>{formatDistanceKm(part.stats.distanceKm)}</td>
                      <td>{formatElevation(part.stats.elevationGainM)}</td>
                      <td>{formatDuration(part.stats.movingTimeS)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="lkv-life__fields">
                {splitPreview.parts.map((part, index) => (
                  <div className="lkv-life__field" key={part.id}>
                    <label htmlFor={`life-part-${index}`}>
                      Titre du tronçon {index + 1} (facultatif)
                    </label>
                    <input
                      id={`life-part-${index}`}
                      type="text"
                      maxLength={120}
                      value={partTitles[index] ?? ''}
                      placeholder={part.title}
                      onChange={(event) =>
                        setPartTitles((current) => {
                          const next = [...current];
                          next[index] = event.target.value;
                          return next;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Notice tone="warning">
              Le point de coupure doit laisser au moins deux points de chaque côté.
            </Notice>
          )}

          <Notice tone="warning">
            Le parent conserve son identifiant pour le premier tronçon, les suivants sont créés
            comme séances liées. La trace d’origine reste conservée, mais le fractionnement ne se
            défait pas en un geste.
          </Notice>

          <div className="lkv-life__actions">
            <button
              type="button"
              className="lkv-life__btn"
              data-variant="primary"
              onClick={() => void applySplit()}
              disabled={pending || !splitPreview}
            >
              <SplitSquareVertical size={15} aria-hidden="true" /> Fractionner en{' '}
              {splitPreview?.parts.length ?? 2} parties
            </button>
          </div>
        </>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {canRestore ? (
        <div className="lkv-life__actions">
          <button
            type="button"
            className="lkv-life__btn"
            data-variant="ghost"
            onClick={() => void restoreOriginal()}
            disabled={pending}
          >
            <ArrowLeft size={15} aria-hidden="true" /> Restaurer la trace d’origine
          </button>
        </div>
      ) : null}

      <p className="lkv-life__hint">
        <Scissors size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
        Les statistiques sont recalculées depuis les points conservés, jamais depuis une estimation.
      </p>
    </div>
  );
}
