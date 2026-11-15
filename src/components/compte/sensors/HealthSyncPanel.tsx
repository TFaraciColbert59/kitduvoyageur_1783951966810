'use client';

import React from 'react';
import { ArrowDownToLine, HeartPulse, RefreshCw, ShieldAlert, Watch } from 'lucide-react';
import Button from '@/components/ui/Button';
import { getMissingHealthScopes } from '@/features/sensors';
import type {
  HealthBridgeAvailability,
  HealthConsentState,
  HealthWorkoutReadResult,
} from '@/features/sensors';
import SensorStatusBadge, { type SensorStatusTone } from './SensorStatusBadge';
import { healthBridgeStatusLabel } from './sensorFormat';
import { joinScopeLabels } from './healthScopeView';

export type HealthBusyAction = 'permissions' | 'read' | null;

function availabilityTone(status: HealthBridgeAvailability['status']): SensorStatusTone {
  switch (status) {
    case 'available':
      return 'success';
    case 'permission_denied':
      return 'danger';
    case 'permission_required':
      return 'info';
    case 'native_bridge_unavailable':
      return 'warning';
  }
}

function providerLabel(availability: HealthBridgeAvailability | null): string {
  if (!availability?.provider) return 'Aucun fournisseur natif';
  return availability.provider === 'apple_healthkit' ? 'Apple HealthKit' : 'Health Connect';
}

function platformLabel(availability: HealthBridgeAvailability | null): string {
  switch (availability?.platform) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    default:
      return 'Web';
  }
}

function formatWorkoutDate(startedAtMs: number): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(startedAtMs));
  } catch {
    return new Date(startedAtMs).toISOString();
  }
}

function formatDistance(distanceM: number | null): string | null {
  if (distanceM === null || !Number.isFinite(distanceM)) return null;
  return `${(distanceM / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`;
}

export interface HealthSyncPanelProps {
  availability: HealthBridgeAvailability | null;
  availabilityLoading?: boolean;
  consentState: HealthConsentState;
  readResult: HealthWorkoutReadResult | null;
  busyAction?: HealthBusyAction;
  error?: string | null;
  onRequestPermissions: () => void;
  onReadWorkouts: () => void;
}

/**
 * Pont Santé : l'écran n'affiche que ce que le pont natif déclare. Sur Web,
 * les actions sont désactivées avec la raison exacte, sans séance factice.
 */
export function HealthSyncPanel({
  availability,
  availabilityLoading = false,
  consentState,
  readResult,
  busyAction = null,
  error = null,
  onRequestPermissions,
  onReadWorkouts,
}: HealthSyncPanelProps) {
  const grantedScopes = Object.values(consentState.grants)
    .filter((grant) => grant.granted)
    .map((grant) => grant.scope);
  const missingRead = getMissingHealthScopes(consentState, ['workouts_read']);
  const missingWrite = getMissingHealthScopes(consentState, ['workouts_write']);
  const bridgeUnavailable = availability?.status === 'native_bridge_unavailable';
  const busy = busyAction !== null;

  return (
    <section className="lkdv-sensor-panel lkv-glass" aria-labelledby="lkdv-health-sync-title">
      <header className="lkdv-sensor-panel-head">
        <span className="lkdv-sensor-panel-ico" aria-hidden="true">
          <Watch size={17} />
        </span>
        <div>
          <h2 id="lkdv-health-sync-title">Pont Santé P01</h2>
          <p>
            {providerLabel(availability)} · {platformLabel(availability)}
          </p>
        </div>
        {availabilityLoading ? (
          <span className="lkdv-sensor-loading" role="status">
            <RefreshCw size={13} aria-hidden="true" /> Vérification
          </span>
        ) : availability ? (
          <SensorStatusBadge
            label={healthBridgeStatusLabel(availability.status)}
            tone={availabilityTone(availability.status)}
          />
        ) : (
          <SensorStatusBadge label="Non vérifié" tone="neutral" />
        )}
      </header>

      {availability?.reason ? (
        <p className="lkdv-sensor-sync-reason" role="status">
          {availability.reason}
        </p>
      ) : null}

      <div className="lkdv-sensor-sync-requirements">
        <div data-ok={missingRead.length === 0}>
          <b>Lecture</b>
          <span>
            {missingRead.length === 0
              ? 'Autorisée'
              : `Manque : ${joinScopeLabels(missingRead)}`}
          </span>
        </div>
        <div data-ok={missingWrite.length === 0}>
          <b>Écriture</b>
          <span>
            {missingWrite.length === 0
              ? 'Autorisée'
              : `Manque : ${joinScopeLabels(missingWrite)}`}
          </span>
        </div>
      </div>

      <div className="lkdv-sensor-sync-actions">
        <Button
          size="sm"
          variant="secondary"
          icon={<HeartPulse size={15} />}
          onClick={onRequestPermissions}
          loading={busyAction === 'permissions'}
          disabled={busy || bridgeUnavailable || grantedScopes.length === 0}
        >
          Demander au système
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<ArrowDownToLine size={15} />}
          onClick={onReadWorkouts}
          loading={busyAction === 'read'}
          disabled={busy || bridgeUnavailable || missingRead.length > 0}
        >
          Lire mes séances
        </Button>
      </div>

      {grantedScopes.length === 0 ? (
        <p className="lkdv-sensor-sync-hint">
          Cochez au moins un scope ci-dessous pour demander l’autorisation au système.
        </p>
      ) : null}

      {error ? (
        <p className="lkdv-sensor-sync-error" role="alert">
          <ShieldAlert size={14} aria-hidden="true" /> {error}
        </p>
      ) : null}

      {readResult ? (
        <div className="lkdv-sensor-workouts" aria-live="polite">
          <p>
            <b>{readResult.workouts.length}</b> séance(s) retenue(s),{' '}
            <b>{readResult.deduplicatedCount}</b> doublon(s) écarté(s).
          </p>
          {readResult.workouts.length > 0 ? (
            <ul>
              {readResult.workouts.slice(0, 5).map((workout, index) => {
                const distance = formatDistance(workout.distanceM);
                return (
                  <li key={workout.externalId ?? workout.lkdvSessionId ?? `${index}`}>
                    <span>
                      <b>{workout.sport}</b> · {formatWorkoutDate(workout.startedAtMs)}
                    </span>
                    {distance ? <span>{distance}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="lkdv-sensor-sync-hint">Aucune nouvelle séance réelle à importer.</p>
          )}
        </div>
      ) : null}

      <p className="lkdv-sensor-panel-note">
        L’écriture depuis LKDV part du récapitulatif d’une séance réelle, jamais d’un formulaire
        vide. Aucune séance n’est inventée pour remplir cet écran.
      </p>
    </section>
  );
}

export default HealthSyncPanel;
