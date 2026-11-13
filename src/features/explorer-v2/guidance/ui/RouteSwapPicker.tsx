'use client';

/**
 * Lot N01 / K4.10 — Sélecteur de changement de parcours en direct.
 *
 * La séance n’est jamais recréée : le panneau affiche les cumuls conservés
 * (distance, durée, D+, tours) et demande une confirmation explicite avant
 * d’appeler `onSwap`. La purge de l’ancien état reste dans le moteur.
 */

import React from 'react';
import {
  formatNavigationDistance,
  formatNavigationDuration,
  formatNavigationElevation,
  type ActiveRecordingSnapshot,
  type NavigationUnits,
  type NewRouteSelectionInput,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import {
  GuidanceBadge,
  GuidanceButton,
  GuidanceEmpty,
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceStat,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

const STATUS_LABEL: Readonly<Record<NewRouteSelectionInput['status'], string>> = {
  ready: 'Prêt',
  loading: 'Chargement du tracé…',
  unavailable: 'Tracé indisponible',
};

export interface RouteSwapPickerProps {
  recording: ActiveRecordingSnapshot;
  routes: readonly NewRouteSelectionInput[];
  currentRouteId?: string | null;
  units?: NavigationUnits;
  busy?: boolean;
  onSwap?: (route: NewRouteSelectionInput) => void;
  className?: string;
}

export function RouteSwapPicker({
  recording,
  routes,
  currentRouteId = null,
  units = 'metric',
  busy = false,
  onSwap,
  className,
}: RouteSwapPickerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const selected =
    routes.find((route) => route.id === selectedId) ??
    routes.find((route) => route.id === currentRouteId) ??
    routes.find((route) => route.status === 'ready') ??
    null;

  const current = currentRouteId ? routes.find((route) => route.id === currentRouteId) : null;
  const isCurrent = Boolean(selected && current && selected.id === current.id);
  const canSwap = Boolean(selected && selected.status === 'ready' && !isCurrent && !busy && onSwap);
  const completedLaps = recording.laps.filter((lap) => lap.completed).length;

  const choose = (route: NewRouteSelectionInput) => {
    if (route.status !== 'ready') return;
    setSelectedId(route.id);
    setPending(false);
  };

  const confirm = () => {
    if (!selected || !canSwap) return;
    onSwap?.(selected);
    setPending(false);
  };

  return (
    <GuidancePanel className={cx(styles.swapPanel, className)} ariaLabel="Changer de parcours">
      <GuidancePanelHeader
        eyebrow="Parcours"
        title="Changer de parcours"
        subtitle="La séance continue : distance, durée et tours sont conservés."
        action={
          <GuidanceBadge tone="success" icon="shield">
            Séance conservée
          </GuidanceBadge>
        }
      />

      <div className={styles.statGrid}>
        <GuidanceStat
          label="Distance"
          value={formatNavigationDistance(recording.distanceM, units)}
        />
        <GuidanceStat label="Durée" value={formatNavigationDuration(recording.movingS)} />
        <GuidanceStat
          label="Dénivelé"
          value={formatNavigationElevation(recording.elevGainM, units, true)}
        />
      </div>

      {completedLaps > 0 ? (
        <p className={styles.subtitle}>
          {`${completedLaps} tour${completedLaps > 1 ? 's' : ''} conservé${completedLaps > 1 ? 's' : ''}`}
          {recording.paused ? ' · séance en pause' : ''}
        </p>
      ) : recording.paused ? (
        <p className={styles.subtitle}>Séance en pause</p>
      ) : null}

      {routes.length === 0 ? (
        <GuidanceEmpty>Aucun autre parcours disponible pour le moment.</GuidanceEmpty>
      ) : (
        <div className={styles.routeList} role="radiogroup" aria-label="Parcours disponibles">
          {routes.map((route) => {
            const isSelected = selected?.id === route.id;
            const routeIsCurrent = route.id === currentRouteId;
            const disabled = route.status !== 'ready' || routeIsCurrent || busy;
            const statusText = routeIsCurrent
              ? 'Parcours actuel'
              : STATUS_LABEL[route.status];

            return (
              <button
                key={route.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={styles.routeOption}
                disabled={disabled}
                onClick={() => choose(route)}
              >
                <span className={styles.routeRadio} aria-hidden="true" />
                <span className={styles.routeBody}>
                  <span className={styles.routeName}>{route.name?.trim() || 'Parcours sans nom'}</span>
                  <span className={styles.routeStatus}>{statusText}</span>
                </span>
                {route.status === 'loading' ? (
                  <XpIcon name="clock" size={16} />
                ) : routeIsCurrent ? (
                  <XpIcon name="check" size={16} />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {pending ? (
        <div
          className={styles.confirmBox}
          role="alertdialog"
          aria-label="Confirmer le changement de parcours"
        >
          <p className={styles.confirmText}>
            Remplacer « {current?.name?.trim() || 'le parcours actuel'} » par «{' '}
            {selected?.name?.trim() || 'ce parcours'} » ? La séance en cours ne sera pas coupée.
          </p>
          <div className={styles.confirmActions}>
            <GuidanceButton variant="secondary" onClick={() => setPending(false)}>
              Annuler
            </GuidanceButton>
            <GuidanceButton onClick={confirm} disabled={!canSwap}>
              Confirmer
            </GuidanceButton>
          </div>
        </div>
      ) : (
        <GuidanceButton
          fullWidth
          disabled={!canSwap}
          onClick={() => setPending(true)}
        >
          <XpIcon name="repeat" size={16} />
          Changer de parcours
        </GuidanceButton>
      )}

      {isCurrent ? (
        <p className={styles.subtitle}>Ce parcours est déjà celui de la séance en cours.</p>
      ) : null}
    </GuidancePanel>
  );
}
