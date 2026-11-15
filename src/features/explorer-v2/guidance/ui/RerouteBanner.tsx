'use client';

/**
 * Lot N01 / K4.05 — Bandeau de sortie de trace et de recalcul.
 *
 * Affiche le libellé produit par le moteur (`RerouteState.bannerLabel`), le cap
 * de retour compensé pour l'écran et l'état du recalcul. En mode hors ligne,
 * aucun itinéraire de détour n'est suggéré : seul le retour au tracé est indiqué.
 */

import React from 'react';
import {
  formatRerouteBannerLabel,
  type NavigationUnits,
  type RerouteState,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import { GuidanceButton, GuidanceSpinner, cx } from './primitives';
import styles from './guidanceUi.module.css';

const SUB_LABEL: Readonly<Record<RerouteState['status'], string | null>> = {
  on_route: null,
  off_route_pending: 'Déviation détectée, vérification en cours.',
  recalculating_online: 'Recherche d’un itinéraire de retour au tracé…',
  recalculated: 'Le guidage reprend sur le tracé recalculé.',
  offline_return_only: 'Aucun réseau : suivez le cap de retour, la trace reste disponible.',
  reroute_failed: 'Le recalcul connecté n’a pas abouti. Le cap de retour reste affiché.',
};

const FAILURE_LABEL: Readonly<Record<NonNullable<RerouteState['failureReason']>, string>> = {
  offline: 'hors ligne',
  provider_unavailable: 'service indisponible',
  off_network: 'zone non couverte',
  rate_limited: 'trop de demandes',
  cooldown_active: 'nouvelle tentative trop tôt',
  no_forward_junction: 'aucune jonction en avant',
  aborted: 'recalcul interrompu',
};

export interface RerouteBannerProps {
  state: RerouteState;
  units?: NavigationUnits;
  onRetry?: () => void;
  className?: string;
}

export function RerouteBanner({
  state,
  units = 'metric',
  onRetry,
  className,
}: RerouteBannerProps) {
  if (state.status === 'on_route') return null;

  const label =
    state.bannerLabel ||
    formatRerouteBannerLabel(
      state.status,
      state.deviationDistanceM,
      state.returnBearingDeg,
      units,
    );
  const screenBearing = state.screenBearingDeg ?? state.returnBearingDeg;
  const subLabel = SUB_LABEL[state.status];
  const canRetry =
    Boolean(onRetry) &&
    (state.status === 'reroute_failed' || state.status === 'off_route_pending') &&
    state.failureReason !== 'offline' &&
    state.failureReason !== 'cooldown_active';
  const assertive = state.status === 'offline_return_only' || state.status === 'reroute_failed';

  return (
    <section
      className={cx(styles.rerouteBanner, className)}
      data-status={state.status}
      role={assertive ? 'alert' : 'status'}
      aria-label="État du recalcul hors itinéraire"
    >
      <span
        className={styles.returnArrow}
        aria-hidden="true"
        title={
          typeof screenBearing === 'number'
            ? `Cap de retour ${Math.round(screenBearing)} degrés`
            : undefined
        }
      >
        {state.status === 'recalculating_online' ? (
          <GuidanceSpinner />
        ) : typeof screenBearing === 'number' ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <g transform={`rotate(${screenBearing} 12 12)`}>
              <path
                d="M12 20V5M6.8 10.2 12 5l5.2 5.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        ) : (
          <XpIcon name="compass" size={20} />
        )}
      </span>

      <div className={styles.grow}>
        <p className={styles.rerouteLabel}>{label}</p>
        {subLabel ? <p className={styles.rerouteSub}>{subLabel}</p> : null}
        {state.failureReason && state.status === 'reroute_failed' ? (
          <p className={styles.rerouteSub}>
            Motif : {FAILURE_LABEL[state.failureReason] ?? state.failureReason}.
          </p>
        ) : null}
      </div>

      {state.status === 'recalculating_online' ? (
        <span className={styles.badge} data-tone="info">
          Recalcul
        </span>
      ) : null}

      {canRetry ? (
        <GuidanceButton variant="secondary" onClick={onRetry}>
          Réessayer
        </GuidanceButton>
      ) : null}
    </section>
  );
}
