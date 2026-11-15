'use client';

/**
 * Lot N01 / K4.11 — Éditeur de champs personnalisables, zoom et écran maintenu.
 *
 * Contrôlé par `NavigationDisplayPreferences` : chaque geste émet les nouvelles
 * préférences complètes. Les métriques capteur absentes restent explicitement
 * indisponibles (`—`, « capteur non branché »), jamais inventées.
 */

import React from 'react';
import {
  CUSTOM_METRIC_LABELS,
  MAX_CUSTOM_FIELDS,
  MIN_CUSTOM_FIELDS,
  SUPPORTED_GPS_DERIVED_METRICS,
  evaluateCustomFieldValues,
  updateCustomFields,
  type CustomFieldValue,
  type CustomizableMetricKey,
  type LiveMetricsSnapshotForFields,
  type NavigationDisplayPreferences,
  type NavigationUnits,
  type WakeLockState,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import {
  GuidanceBadge,
  GuidanceButton,
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceSwitch,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

const ALL_METRICS = Object.keys(CUSTOM_METRIC_LABELS) as CustomizableMetricKey[];

const UNAVAILABLE_LABEL: Readonly<Record<NonNullable<CustomFieldValue['unavailableReason']>, string>> = {
  sensor_not_connected: 'Capteur non branché',
  route_required: 'Parcours requis',
  no_movement_yet: 'En attente de mouvement',
};

function previewFor(
  value: CustomFieldValue | undefined,
): string {
  if (!value) return '—';
  if (!value.available) {
    return UNAVAILABLE_LABEL[value.unavailableReason ?? 'sensor_not_connected'];
  }
  return value.unitLabel ? `${value.formattedValue} ${value.unitLabel}` : value.formattedValue;
}

export interface CustomFieldsEditorProps {
  preferences: NavigationDisplayPreferences;
  metrics?: LiveMetricsSnapshotForFields | null;
  wakeLock?: WakeLockState | null;
  units?: NavigationUnits;
  onChange?: (next: NavigationDisplayPreferences) => void;
  onDone?: () => void;
  className?: string;
}

export function CustomFieldsEditor({
  preferences,
  metrics = null,
  wakeLock = null,
  units,
  onChange,
  onDone,
  className,
}: CustomFieldsEditorProps) {
  const fields = preferences.fields;
  const effectiveUnits = metrics?.units ?? units ?? 'metric';
  const values = metrics
    ? evaluateCustomFieldValues(fields, { ...metrics, units: effectiveUnits })
    : [];
  const valueByKey = new Map(values.map((value) => [value.key, value]));
  const atMax = fields.length >= MAX_CUSTOM_FIELDS;
  const canRemove = fields.length > MIN_CUSTOM_FIELDS;

  const emitFields = (nextFields: readonly CustomizableMetricKey[]) => {
    const bounded = updateCustomFields(preferences, nextFields);
    onChange?.({ ...preferences, fields: bounded.fields });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    emitFields(next);
  };

  const remove = (index: number) => {
    if (!canRemove) return;
    emitFields(fields.filter((_, current) => current !== index));
  };

  const add = (key: CustomizableMetricKey) => {
    if (fields.includes(key) || atMax) return;
    emitFields([...fields, key]);
  };

  const wakeLockLabel = wakeLock
    ? wakeLock.active
      ? 'Écran maintenu allumé'
      : wakeLock.supported === false
        ? 'Non pris en charge par cet appareil'
        : wakeLock.enabled
          ? 'Autorisation en cours…'
          : 'Désactivé'
    : 'Maintien pendant la sortie';

  return (
    <GuidancePanel className={cx(styles.fieldsPanel, className)} ariaLabel="Champs personnalisables">
      <GuidancePanelHeader
        eyebrow="Affichage"
        title="Champs personnalisables"
        subtitle="Choisissez jusqu’à 6 métriques et leur ordre d’affichage pendant la sortie."
        action={
          <GuidanceBadge tone={atMax ? 'warning' : 'neutral'}>
            {`${fields.length}/${MAX_CUSTOM_FIELDS}`}
          </GuidanceBadge>
        }
      />

      {fields.length === 0 ? (
        <p className={styles.subtitle}>Aucun champ sélectionné.</p>
      ) : (
        <ul className={styles.fieldList} aria-label="Champs affichés">
          {fields.map((key, index) => {
            const value = valueByKey.get(key);
            return (
              <li key={key} className={styles.fieldRow}>
                <span className={styles.fieldIndex} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.fieldBody}>
                  <span className={styles.fieldLabel}>{CUSTOM_METRIC_LABELS[key] ?? key}</span>
                  <span className={styles.fieldPreview}>
                    {metrics ? previewFor(value) : 'Aperçu en direct indisponible'}
                  </span>
                </span>
                <span className={styles.fieldActions}>
                  <button
                    type="button"
                    className={styles.fieldRowButton}
                    aria-label={`Monter ${CUSTOM_METRIC_LABELS[key] ?? key}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className={styles.fieldRowButton}
                    aria-label={`Descendre ${CUSTOM_METRIC_LABELS[key] ?? key}`}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    className={styles.fieldRowButton}
                    aria-label={`Retirer ${CUSTOM_METRIC_LABELS[key] ?? key}`}
                    disabled={!canRemove}
                    onClick={() => remove(index)}
                  >
                    <XpIcon name="x" size={15} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.stack} style={{ gap: 8 }}>
        <p className={styles.sectionLabel}>Ajouter un champ</p>
        <div className={styles.addGrid}>
          {ALL_METRICS.filter((key) => !fields.includes(key)).map((key) => {
            const sensorOnly = !SUPPORTED_GPS_DERIVED_METRICS.has(key);
            return (
              <button
                key={key}
                type="button"
                className={cx(styles.chip, sensorOnly && styles.chipSensor)}
                disabled={atMax}
                onClick={() => add(key)}
                title={sensorOnly ? 'Capteur externe : valeur indisponible sans capteur' : undefined}
              >
                <span aria-hidden="true">+</span>
                {CUSTOM_METRIC_LABELS[key]}
                {sensorOnly ? <span className={styles.srOnly}> (capteur requis)</span> : null}
              </button>
            );
          })}
        </div>
        {atMax ? (
          <p className={styles.sensorNote}>
            Maximum atteint : retirez un champ pour en ajouter un autre.
          </p>
        ) : null}
        <p className={styles.sensorNote}>
          Les métriques capteur (fréquence cardiaque, puissance, cadence) restent à « — » tant
          qu’aucun capteur n’est connecté.
        </p>
      </div>

      <hr className={styles.divider} />

      <GuidanceSwitch
        label="Zoom automatique"
        hint="La carte ajuste le niveau de zoom à votre vitesse."
        checked={preferences.autoZoomEnabled}
        onToggle={(next) =>
          onChange?.({
            ...preferences,
            autoZoomEnabled: next,
            manualZoomOverride: next ? preferences.manualZoomOverride : null,
          })
        }
      />
      <GuidanceSwitch
        label="Garder l’écran allumé"
        hint={wakeLockLabel}
        checked={preferences.keepScreenAwake}
        onToggle={(next) => onChange?.({ ...preferences, keepScreenAwake: next })}
      />

      {onDone ? (
        <GuidanceButton variant="secondary" fullWidth onClick={onDone}>
          Terminé
        </GuidanceButton>
      ) : null}
    </GuidancePanel>
  );
}
