'use client';

/**
 * Lot A02 — correction de la distance, du dénivelé et des pics GPS
 * (K5.10, S1.23).
 *
 * Chaque méthode est explicite. La saisie manuelle désactive les classements
 * automatiques (le contrat le décide) et l'annulation restaure exactement
 * l'état mesuré d'avant correction.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Satellite, SlidersHorizontal } from 'lucide-react';
import {
  correctDistanceAndElevation,
  smoothGpsSpeedSpikes,
  sportMaxPlausibleSpeedMs,
  type DistanceCorrectionMethod,
  type DistanceElevationCorrectionInput,
  type ElevationCorrectionMethod,
  type LifecycleActivityRecord,
} from '@/features/compte/lifecycle';
import {
  formatDistanceKm,
  formatDuration,
  formatElevation,
  formatNumber,
  formatSpeed,
} from './format';
import { Notice, Segmented } from './primitives';
import { newOperationId, type SubmitResult } from './types';

type Tab = 'distance' | 'elevation' | 'gps';

const SPIKE_REASON_LABELS: Readonly<Record<string, string>> = {
  invalid_coordinates: 'Coordonnées invalides',
  accuracy_exceeded: 'Précision insuffisante',
  short_window_jump: 'Saut sur fenêtre courte',
  exceeds_sport_max_speed: 'Vitesse au-delà du sport',
  isolated_acceleration_spike: 'Accélération isolée',
  non_monotonic_timestamp: 'Horodatage incohérent',
};

export interface CorrectionDistanceDeniveleProps {
  record: LifecycleActivityRecord;
  busy?: boolean;
  onCorrect: (input: DistanceElevationCorrectionInput) => Promise<SubmitResult>;
  onSmoothGps: (maxPlausibleSpeedMs?: number) => Promise<SubmitResult>;
  onRevert: () => Promise<SubmitResult>;
}

export function CorrectionDistanceDenivele({
  record,
  busy = false,
  onCorrect,
  onSmoothGps,
  onRevert,
}: CorrectionDistanceDeniveleProps) {
  const [tab, setTab] = useState<Tab>('distance');
  const [distanceMethod, setDistanceMethod] = useState<DistanceCorrectionMethod>(
    record.correctionState.distanceMethod
  );
  const [manualKm, setManualKm] = useState(
    record.stats.distanceM > 0 ? (record.stats.distanceM / 1000).toFixed(2) : ''
  );
  const [elevationMethod, setElevationMethod] = useState<ElevationCorrectionMethod>(
    record.correctionState.elevationMethod
  );
  const [threshold, setThreshold] = useState('2');
  const [manualGain, setManualGain] = useState(String(Math.round(record.stats.elevationGainM)));
  const [manualLoss, setManualLoss] = useState(String(Math.round(record.stats.elevationLossM)));
  const [gpsKmh, setGpsKmh] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const operationRef = useRef<string | null>(null);

  const manualDistanceM = Number(manualKm.replace(',', '.')) * 1000;
  const thresholdM = Number(threshold.replace(',', '.'));
  const manualGainM = Number(manualGain.replace(',', '.'));
  const manualLossM = Number(manualLoss.replace(',', '.'));
  const gpsMs = gpsKmh.trim() === '' ? undefined : Number(gpsKmh.replace(',', '.')) / 3.6;

  const correctionInput = useMemo<DistanceElevationCorrectionInput | null>(() => {
    if (tab === 'distance') {
      return {
        distanceMethod,
        ...(distanceMethod === 'manual_override' && Number.isFinite(manualDistanceM)
          ? { manualDistanceM }
          : {}),
      };
    }
    if (tab === 'elevation') {
      return {
        elevationMethod,
        ...(elevationMethod === 'threshold_smoothing' && Number.isFinite(thresholdM)
          ? { smoothingThresholdM: thresholdM }
          : {}),
        ...(elevationMethod === 'manual_override' && Number.isFinite(manualGainM)
          ? {
              manualElevationGainM: manualGainM,
              ...(Number.isFinite(manualLossM) ? { manualElevationLossM: manualLossM } : {}),
            }
          : {}),
      };
    }
    return null;
  }, [tab, distanceMethod, manualDistanceM, elevationMethod, thresholdM, manualGainM, manualLossM]);

  const preview = useMemo(() => {
    if (!correctionInput) return null;
    return correctDistanceAndElevation(record, correctionInput);
  }, [record, correctionInput]);

  const gpsPreview = useMemo(() => {
    return smoothGpsSpeedSpikes(record.points, record.sport, {
      maxPlausibleSpeedMs: Number.isFinite(gpsMs) ? gpsMs : undefined,
    });
  }, [record.points, record.sport, gpsMs]);

  const pending = busy || submitting;
  const defaultMaxKmh = Math.round(sportMaxPlausibleSpeedMs(record.sport) * 3.6);

  async function applyCorrection() {
    setError(null);
    if (!correctionInput) return;
    if (preview?.ok === false) {
      setError(preview.error);
      return;
    }
    setSubmitting(true);
    try {
      if (!operationRef.current) operationRef.current = newOperationId();
      const result = await onCorrect({ ...correctionInput, operationId: operationRef.current });
      if (result.ok === false) setError(result.error);
      else operationRef.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  async function applyGps() {
    setError(null);
    if (gpsPreview.spikes.length === 0) {
      setError('Aucun pic GPS de vitesse détecté avec ce seuil.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSmoothGps(Number.isFinite(gpsMs) ? gpsMs : undefined);
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function revert() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onRevert();
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lkv-life__fields" data-testid="correction-distance-denivele">
      <Segmented<Tab>
        label="Type de correction"
        value={tab}
        options={[
          { value: 'distance', label: 'Distance' },
          { value: 'elevation', label: 'Dénivelé' },
          { value: 'gps', label: 'Pics GPS' },
        ]}
        onChange={(next) => {
          setTab(next);
          setError(null);
        }}
      />

      {tab === 'distance' ? (
        <>
          <div className="lkv-life__field">
            <label htmlFor="life-distance-method">Méthode</label>
            <select
              id="life-distance-method"
              value={distanceMethod}
              onChange={(event) =>
                setDistanceMethod(event.target.value as DistanceCorrectionMethod)
              }
            >
              <option value="raw">Distance GPS brute</option>
              <option value="recompute_from_trace">Recalculer depuis la trace</option>
              <option value="manual_override">Saisir une distance</option>
            </select>
          </div>

          {distanceMethod === 'manual_override' ? (
            <div className="lkv-life__field">
              <label htmlFor="life-distance-manual">Distance (km)</label>
              <input
                id="life-distance-manual"
                type="number"
                min={0.01}
                step={0.01}
                inputMode="decimal"
                value={manualKm}
                onChange={(event) => setManualKm(event.target.value)}
              />
            </div>
          ) : null}

          <p className="lkv-life__hint">
            Mesure actuelle : {formatDistanceKm(record.stats.distanceKm)} sur {record.points.length}{' '}
            point(s).
          </p>
        </>
      ) : null}

      {tab === 'elevation' ? (
        <>
          <div className="lkv-life__field">
            <label htmlFor="life-elevation-method">Méthode</label>
            <select
              id="life-elevation-method"
              value={elevationMethod}
              onChange={(event) =>
                setElevationMethod(event.target.value as ElevationCorrectionMethod)
              }
            >
              <option value="raw">Dénivelé brut</option>
              <option value="threshold_smoothing">Lisser par seuil</option>
              <option value="manual_override">Saisir D+ et D−</option>
            </select>
          </div>

          {elevationMethod === 'threshold_smoothing' ? (
            <div className="lkv-life__field">
              <label htmlFor="life-elevation-threshold">Seuil d’hystérésis (m)</label>
              <input
                id="life-elevation-threshold"
                type="number"
                min={0}
                max={50}
                step={0.5}
                inputMode="decimal"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
              />
              <p className="lkv-life__hint">
                Ignore les micro-variations inférieures au seuil. Un seuil élevé lisse le profil,
                sans inventer d’altitude.
              </p>
            </div>
          ) : null}

          {elevationMethod === 'manual_override' ? (
            <>
              <div className="lkv-life__field">
                <label htmlFor="life-elevation-gain">D+ (m)</label>
                <input
                  id="life-elevation-gain"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={manualGain}
                  onChange={(event) => setManualGain(event.target.value)}
                />
              </div>
              <div className="lkv-life__field">
                <label htmlFor="life-elevation-loss">D− (m, facultatif)</label>
                <input
                  id="life-elevation-loss"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={manualLoss}
                  onChange={(event) => setManualLoss(event.target.value)}
                />
              </div>
            </>
          ) : null}

          <Notice tone="info">
            La projection sur un modèle d’altitude (DEM) n’est proposée que lorsqu’un profil DEM est
            fourni par le serveur ; elle n’est jamais simulée ici.
          </Notice>
        </>
      ) : null}

      {tab === 'gps' ? (
        <>
          <div className="lkv-life__field">
            <label htmlFor="life-gps-threshold">Vitesse maximale plausible (km/h)</label>
            <input
              id="life-gps-threshold"
              type="number"
              min={1}
              max={216}
              step={1}
              inputMode="decimal"
              placeholder={String(defaultMaxKmh)}
              value={gpsKmh}
              onChange={(event) => setGpsKmh(event.target.value)}
            />
            <p className="lkv-life__hint">
              Seuil par défaut pour {record.sport} : {defaultMaxKmh} km/h. Un point au-delà est
              écarté du calcul, jamais de la trace d’origine.
            </p>
          </div>

          <div className="lkv-life__compare">
            <div className="lkv-life__compare-card">
              <b>Vitesse max brute</b>
              <p>{formatSpeed(gpsPreview.rawMaxSpeedKmh)}</p>
            </div>
            <div className="lkv-life__compare-card">
              <b>Après correction</b>
              <p>{formatSpeed(gpsPreview.correctedMaxSpeedKmh)}</p>
            </div>
          </div>

          {gpsPreview.spikes.length === 0 ? (
            <Notice tone="ok">Aucun pic de vitesse détecté avec ce seuil.</Notice>
          ) : (
            <>
              <p className="lkv-life__hint">
                {gpsPreview.spikes.length} pic(s) identifié(s) sur {record.points.length} point(s).
              </p>
              <table className="lkv-life__spikes">
                <caption className="lkv-life__sr">Pics GPS détectés</caption>
                <thead>
                  <tr>
                    <th scope="col">Point</th>
                    <th scope="col">Vitesse</th>
                    <th scope="col">Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsPreview.spikes.slice(0, 6).map((spike) => (
                    <tr key={`${spike.pointIndex}-${spike.reason}`}>
                      <td>#{spike.pointIndex}</td>
                      <td>{formatNumber(spike.impliedSpeedMs * 3.6)} km/h</td>
                      <td>{SPIKE_REASON_LABELS[spike.reason] ?? spike.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gpsPreview.spikes.length > 6 ? (
                <p className="lkv-life__hint">+{gpsPreview.spikes.length - 6} autre(s).</p>
              ) : null}
            </>
          )}

          <div className="lkv-life__actions">
            <button
              type="button"
              className="lkv-life__btn"
              data-variant="primary"
              onClick={() => void applyGps()}
              disabled={pending || gpsPreview.spikes.length === 0}
            >
              <Satellite size={15} aria-hidden="true" /> Corriger les pics GPS
            </button>
          </div>
        </>
      ) : null}

      {preview && tab !== 'gps' ? (
        <>
          {preview.ok ? (
            <div className="lkv-life__compare">
              <div className="lkv-life__compare-card">
                <b>Avant</b>
                <p>
                  {formatDistanceKm(record.stats.distanceKm)} ·{' '}
                  {formatElevation(record.stats.elevationGainM)} D+ ·{' '}
                  {formatDuration(record.stats.movingTimeS)}
                </p>
              </div>
              <div className="lkv-life__compare-card">
                <b>Après</b>
                <p>
                  {formatDistanceKm(preview.record.stats.distanceKm)} ·{' '}
                  {formatElevation(preview.record.stats.elevationGainM)} D+ ·{' '}
                  {formatDuration(preview.record.stats.movingTimeS)}
                </p>
              </div>
            </div>
          ) : (
            <Notice tone="warning">{preview.error}</Notice>
          )}

          {preview.ok && !preview.record.recordsEligibility.eligible ? (
            <Notice tone="warning">
              Une saisie manuelle retire cette séance des classements automatiques. Les totaux du
              compte restent corrigés.
            </Notice>
          ) : null}

          <div className="lkv-life__actions">
            <button
              type="button"
              className="lkv-life__btn"
              data-variant="primary"
              onClick={() => void applyCorrection()}
              disabled={pending || preview.ok === false}
            >
              <Check size={15} aria-hidden="true" /> Appliquer la correction
            </button>
          </div>
        </>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <SectionDivider />

      <div className="lkv-life__actions">
        {record.correctionState.previousSnapshot ? (
          <button
            type="button"
            className="lkv-life__btn"
            data-variant="ghost"
            onClick={() => void revert()}
            disabled={pending}
          >
            <RotateCcw size={15} aria-hidden="true" /> Annuler la dernière correction
          </button>
        ) : (
          <p className="lkv-life__hint">
            <SlidersHorizontal
              size={13}
              aria-hidden="true"
              style={{ verticalAlign: '-2px', marginRight: 4 }}
            />
            Aucune correction à annuler pour l’instant.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionDivider() {
  return <div style={{ height: 1, background: 'var(--lkv-border-subtle)' }} aria-hidden="true" />;
}
