'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingDetail } from '@/features/compte/server/sorties';
import {
  OUTING_METRIC_KEYS,
  OUTING_METRIC_LABELS,
  SHARED_SUMMARY_METRICS,
  metricVisibilityKeys,
  type OutingMetricKey,
} from '@/features/compte/domain/metricVisibility';
import { formatDuration, formatNumber } from './shared';

export interface OutingMetricSettingsProps {
  detail: OutingDetail;
  saving: boolean;
  onSave: (keys: OutingMetricKey[]) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Aperçu honnête de la valeur réelle. `null` signifie « aucune donnée
 * enregistrée pour cette sortie » : l'interface ne fabrique ni zéro ni valeur
 * de démonstration. Le profil altimétrique n'a pas de valeur scalaire : il est
 * annoncé disponible seulement si la trace porte au moins une altitude.
 */
function metricPreview(detail: OutingDetail, key: OutingMetricKey): string | null {
  const finite = (value: number | null | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  switch (key) {
    case 'distance': {
      const value = finite(detail.km);
      return value === null ? null : `${formatNumber(value)} km`;
    }
    case 'elevation': {
      const hasElevation = (detail.traceSegments ?? []).some((segment) =>
        segment.some(
          (point) =>
            typeof point.elevationM === 'number' && Number.isFinite(point.elevationM)
        )
      );
      return hasElevation ? 'Profil disponible' : null;
    }
    case 'elevationGain': {
      const value = finite(detail.dplus);
      return value === null ? null : `+${formatNumber(value)} m`;
    }
    case 'maxAltitude': {
      const value = finite(detail.maxAlt);
      return value === null ? null : `${formatNumber(value)} m`;
    }
    case 'duration': {
      const value = finite(detail.durationS);
      return value === null ? null : formatDuration(value);
    }
    case 'pace': {
      const value = finite(detail.paceMinPerKm);
      return value === null ? null : `${formatNumber(value)} min/km`;
    }
    case 'movingTime': {
      const value = finite(detail.movingTimeS);
      return value === null ? null : formatDuration(value);
    }
    case 'heartRate': {
      const value = finite(detail.heartRateBpm);
      return value === null ? null : `${formatNumber(value)} bpm`;
    }
    case 'power': {
      const value = finite(detail.powerW);
      return value === null ? null : `${formatNumber(value)} W`;
    }
    case 'cadence': {
      const value = finite(detail.cadenceRpm);
      return value === null ? null : `${formatNumber(value)} rpm`;
    }
    case 'calories': {
      const value = finite(detail.caloriesKcal);
      return value === null ? null : `${formatNumber(value)} kcal`;
    }
    default:
      return null;
  }
}

/**
 * Réglage propriétaire des métriques partagées.
 *
 * Le composant ne décide jamais de la politique : il propose les clés connues,
 * envoie la sélection au serveur et relit le DTO projeté. Une métrique sans
 * donnée reste réglable, mais son aperçu dit qu'aucune valeur n'existe ; aucune
 * valeur n'est simulée pour remplir la ligne.
 */
export function OutingMetricSettings({
  detail,
  saving,
  onSave,
  onReset,
  onClose,
}: OutingMetricSettingsProps) {
  const sharePolicy = detail.shareMetricVisibility ?? SHARED_SUMMARY_METRICS;
  const policySignature = useMemo(
    () =>
      OUTING_METRIC_KEYS.map((key) =>
        sharePolicy[key] === true ? '1' : '0'
      ).join(''),
    [sharePolicy]
  );
  const [selected, setSelected] = useState<Set<OutingMetricKey>>(
    () => new Set(metricVisibilityKeys(sharePolicy))
  );
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setSelected(new Set(metricVisibilityKeys(sharePolicy)));
  }, [detail.id, policySignature, sharePolicy]);

  const toggle = (key: OutingMetricKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedKeys = OUTING_METRIC_KEYS.filter((key) => selected.has(key));

  return (
    <section className="lkdv-sortie-metrics" aria-label="Métriques partagées">
      <p className="lkdv-sortie-metrics-note">
        Choisis ce que les personnes qui voient cette sortie peuvent lire. Une
        métrique décochée reste visible pour toi seul. Les valeurs absentes ne
        sont jamais inventées.
      </p>
      {detail.visibility === 'private' ? (
        <p className="lkdv-sortie-metrics-warning">
          Cette sortie est privée : aucun tiers ne la voit. Le réglage
          s’appliquera si tu la partages plus tard.
        </p>
      ) : null}

      <fieldset className="lkdv-sortie-metrics-list">
        <legend className="lkdv-sortie-metrics-legend">
          Métriques visibles par les tiers
        </legend>
        {OUTING_METRIC_KEYS.map((key) => {
          const checked = selected.has(key);
          const preview = metricPreview(detail, key);
          return (
            <label
              key={key}
              className={`lkdv-sortie-metric-row ${checked ? 'on' : 'off'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(key)}
                disabled={saving}
                className="lkdv-sortie-metric-check"
              />
              <span className="lkdv-sortie-metric-copy">
                <b>{OUTING_METRIC_LABELS[key]}</b>
                <small>{preview ?? 'Aucune donnée enregistrée'}</small>
              </span>
              <span
                className={`lkdv-sortie-metric-state ${checked ? 'on' : 'off'}`}
                aria-hidden="true"
              >
                {checked ? 'Visible' : 'Masqué'}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="lkdv-sortie-metrics-actions">
        <ActionPill
          label="Réinitialiser le réglage de partage"
          icon={<RotateCcw />}
          text="Réinitialiser"
          onClick={() => setConfirmReset(true)}
          disabled={saving}
        />
        <ActionPill
          label="Fermer le réglage de partage"
          icon={<X />}
          text="Fermer"
          onClick={onClose}
          disabled={saving}
        />
        <ActionPill
          tone="primary"
          label="Enregistrer les métriques partagées"
          icon={<Check />}
          text="Enregistrer"
          onClick={() => onSave(selectedKeys)}
          busy={saving}
        />
      </div>

      {confirmReset ? (
        <div className="lkdv-sortie-metrics-confirm" role="alert">
          <p>
            Rétablir le socle par défaut ? Il publie aux tiers autorisés la
            distance, le profil, le dénivelé, l’altitude maximale et la durée.
            Les autres métriques redeviennent masquées.
          </p>
          <div className="lkdv-sortie-metrics-actions">
            <ActionPill
              label="Annuler la réinitialisation"
              icon={<X />}
              text="Annuler"
              onClick={() => setConfirmReset(false)}
              disabled={saving}
            />
            <ActionPill
              tone="danger"
              label="Confirmer la réinitialisation du partage"
              icon={<RotateCcw />}
              text="Rétablir"
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
              disabled={saving}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default OutingMetricSettings;
