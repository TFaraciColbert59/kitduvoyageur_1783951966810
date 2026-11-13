'use client';

/**
 * Lot N01 / K4.06 — Boussole et orientation de la carte.
 *
 * Deux modes exclusifs : nord fixe (`north-up`) ou sens du déplacement
 * (`course-up`). La rosace compense le cap caméra ; l'aiguille indique le cap
 * de marche. Le recentrage restaure le suivi automatique après un geste.
 */

import React from 'react';
import {
  bearingLabel,
  normalizeBearingDeg,
  type MapOrientationMode,
  type MapOrientationState,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import { CompassRose } from './glyphs';
import {
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceSegmented,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

export interface OrientationCompassProps {
  orientation: MapOrientationState;
  /** Cap de déplacement GPS, en degrés (0 = nord). */
  headingDeg?: number | null;
  onModeChange?: (mode: MapOrientationMode) => void;
  onRecenter?: () => void;
  className?: string;
}

export function OrientationCompass({
  orientation,
  headingDeg = null,
  onModeChange,
  onRecenter,
  className,
}: OrientationCompassProps) {
  const heading =
    normalizeBearingDeg(headingDeg) ??
    normalizeBearingDeg(orientation.lastValidCourseDeg) ??
    0;
  const cardinal = bearingLabel(heading);
  const roseRotation =
    orientation.mode === 'course-up' ? -orientation.cameraBearingDeg : 0;
  const needleRotation = orientation.mode === 'course-up' ? 0 : heading;
  const compassLabel = `Boussole, cap ${Math.round(heading)} degrés${
    cardinal ? `, ${cardinal}` : ''
  }, ${orientation.mode === 'course-up' ? 'sens du déplacement' : 'nord en haut'}`;

  return (
    <GuidancePanel
      className={cx(styles.compassPanel, className)}
      ariaLabel="Orientation et boussole"
    >
      <GuidancePanelHeader
        eyebrow="Orientation"
        title="Boussole"
        subtitle="Choisissez un nord fixe ou la carte dans le sens de votre déplacement."
      />

      <div className={styles.compassBody}>
        <span className={styles.compassDial} role="img" aria-label={compassLabel}>
          <span
            className={styles.compassRose}
            style={{ transform: `rotate(${roseRotation}deg)` }}
            aria-hidden="true"
          >
            <CompassRose rotationDeg={0} />
          </span>
          <span
            className={styles.compassNeedle}
            style={{ transform: `rotate(${needleRotation}deg)` }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
              <path d="M12 3 17 21 12 17 7 21Z" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.compassCardinal} data-dir="n" aria-hidden="true">
            N
          </span>
          <span className={styles.compassCardinal} data-dir="e" aria-hidden="true">
            E
          </span>
          <span className={styles.compassCardinal} data-dir="s" aria-hidden="true">
            S
          </span>
          <span className={styles.compassCardinal} data-dir="w" aria-hidden="true">
            O
          </span>
        </span>

        <div className={styles.compassMeta}>
          <span className={styles.compassValue}>{Math.round(heading)}°</span>
          <span className={styles.subtitle}>
            {cardinal ? `Cap ${cardinal}` : 'Cap indisponible'} · caméra{' '}
            {Math.round(orientation.cameraBearingDeg)}°
          </span>
          <span className={styles.compassActions}>
            <button
              type="button"
              className={styles.compassAction}
              onClick={onRecenter}
              disabled={!onRecenter}
            >
              <XpIcon name="target" size={14} /> Recentrer
            </button>
          </span>
        </div>
      </div>

      <GuidanceSegmented<MapOrientationMode>
        label="Orientation de la carte"
        value={orientation.mode}
        onChange={(mode) => onModeChange?.(mode)}
        options={[
          { value: 'north-up', label: 'Nord en haut' },
          { value: 'course-up', label: 'Sens du déplacement' },
        ]}
      />

      {orientation.userPanned ? (
        <p className={styles.subtitle} role="status">
          Carte déplacée manuellement : le suivi automatique est suspendu jusqu’au recentrage.
        </p>
      ) : null}
    </GuidancePanel>
  );
}
