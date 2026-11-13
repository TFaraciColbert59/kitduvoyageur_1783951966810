'use client';

/**
 * Lot N01 / K4.02 & S3.11 — Bannière de guidage virage par virage.
 *
 * Consomme directement `TurnByTurnState` du contrat : instruction primaire,
 * distance formatée, manœuvre secondaire, contresens, état hors ligne et
 * indicateur d'annonce vocale. Aucun recalcul métier ici.
 */

import React from 'react';
import {
  formatNavigationDistance,
  maneuverActionLabel,
  type TurnByTurnState,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import { ManeuverGlyph } from './glyphs';
import { GuidanceBadge, cx } from './primitives';
import styles from './guidanceUi.module.css';

const STAGE_LABEL: Readonly<Record<TurnByTurnState['stage'], string | null>> = {
  none: null,
  'pre-announce': 'Bientôt',
  approaching: 'Approche',
  imminent: 'Maintenant',
  passed: null,
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export interface TurnByTurnBannerProps {
  state: TurnByTurnState;
  /** Masque la ligne « Puis … » sur les écrans très compacts. */
  showSecondary?: boolean;
  className?: string;
}

export function TurnByTurnBanner({
  state,
  showSecondary = true,
  className,
}: TurnByTurnBannerProps) {
  const maneuver = state.nextManeuver;

  if (!maneuver || state.maneuvers.length === 0) {
    return (
      <section
        className={cx(styles.banner, styles.bannerEmpty, className)}
        aria-label="Guidage virage par virage"
        role="status"
      >
        <div className={styles.row}>
          <span className={styles.waypointIcon}>
            <XpIcon name="nav" size={18} />
          </span>
          <div className={styles.headingBlock}>
            <p className={styles.instruction}>Aucun guidage actif</p>
            <p className={styles.subtitle}>
              Choisissez un parcours pour recevoir les instructions virage par virage.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const instruction =
    maneuver.rawInstruction || maneuverActionLabel(maneuver.kind, maneuver.streetName);
  const distance =
    state.formattedDistanceToNext ??
    formatNavigationDistance(state.distanceToNextM, 'metric');
  const stageLabel = STAGE_LABEL[state.stage];
  const progressM = state.progress?.alongTrackM ?? 0;
  const totalTrackM = state.maneuvers.reduce(
    (max, item) => Math.max(max, item.alongTrackM),
    0,
  );
  const progressRatio = totalTrackM > 0 ? clampRatio(progressM / totalTrackM) : 0;
  const secondary = state.secondaryManeuver;
  const secondaryDistanceM = secondary
    ? Math.max(0, secondary.alongTrackM - progressM)
    : null;

  return (
    <section
      className={cx(styles.banner, className)}
      aria-label="Guidage virage par virage"
      aria-live={state.stage === 'imminent' ? 'assertive' : 'polite'}
      data-stage={state.stage}
    >
      <div className={styles.bannerTop}>
        <div className={styles.row} style={{ gap: 6 }}>
          {stageLabel ? (
            <GuidanceBadge tone={state.stage === 'imminent' ? 'warning' : 'neutral'} onDark>
              {stageLabel}
            </GuidanceBadge>
          ) : (
            <span className={styles.eyebrow} style={{ color: 'var(--lkv-on-dark-muted)' }}>
              Prochaine instruction
            </span>
          )}
          {state.offlineReady ? (
            <span className={cx(styles.badge, styles.pillOnDark)}>
              <XpIcon name="offline" size={12} />
              Hors ligne
            </span>
          ) : null}
          {state.shouldSpeak ? (
            <span className={cx(styles.badge, styles.pillOnDark)}>
              <XpIcon name="vol" size={12} />
              Annonce
            </span>
          ) : null}
        </div>
        <span className={cx(styles.badge, styles.pillOnDark)}>
          {maneuver.kind === 'arrive'
            ? 'Arrivée'
            : maneuver.kind === 'depart'
              ? 'Départ'
              : maneuver.kind === 'straight'
                ? 'Tout droit'
                : maneuver.kind === 'waypoint'
                  ? 'Repère'
                  : `Virage ${maneuver.index}`}
        </span>
      </div>

      <div className={styles.bannerMain}>
        <span className={styles.maneuverIcon}>
          <ManeuverGlyph kind={maneuver.kind} size={30} />
        </span>
        <div className={styles.grow}>
          <p className={styles.instruction}>{instruction}</p>
          {showSecondary && secondary ? (
            <p className={styles.secondary} style={{ marginTop: 4 }}>
              Puis {lowerFirst(maneuverActionLabel(secondary.kind, secondary.streetName))} dans{' '}
              {formatNavigationDistance(secondaryDistanceM, 'metric')}
            </p>
          ) : null}
        </div>
        <span className={styles.bannerDistance} aria-label={`Distance avant la manœuvre : ${distance}`}>
          {distance}
        </span>
      </div>

      {state.reverseDirection ? (
        <div className={cx(styles.warning, styles.dangerBox)} role="alert">
          <XpIcon name="alert" size={16} />
          <span>Sens inverse détecté : faites demi-tour pour reprendre le parcours.</span>
        </div>
      ) : null}

      <div
        className={styles.bannerProgress}
        role="progressbar"
        aria-label="Progression sur le parcours"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressRatio * 100)}
      >
        <div className={styles.bannerProgressFill} style={{ width: `${progressRatio * 100}%` }} />
      </div>

      <span className={styles.srOnly}>
        {instruction}. Distance restante {distance}.
        {showSecondary
          ? ` Puis ${
              secondary
                ? lowerFirst(maneuverActionLabel(secondary.kind, secondary.streetName))
                : 'arrivée à destination'
            }.`
          : null}
      </span>
    </section>
  );
}
