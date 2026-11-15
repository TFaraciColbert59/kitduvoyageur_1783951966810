'use client';

/**
 * Lot N01 / K4.09 — Carte de montée et de descente pendant le suivi.
 *
 * Le tronçon, la pente, le D+ restant et le profil proviennent exclusivement de
 * `ClimbDescentCardState`. Un profil troué (altitude `null`) n’est jamais comblé
 * ici : les points invalides sont simplement ignorés pour le dessin.
 */

import React from 'react';
import {
  formatNavigationDistance,
  formatNavigationElevation,
  type ClimbDescentCardState,
  type ElevationPoint,
  type NavigationUnits,
} from '@/features/navigation';
import {
  GuidanceBadge,
  GuidancePanel,
  GuidancePanelHeader,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

const TITLE: Readonly<Record<ClimbDescentCardState['status'], string>> = {
  active_climb: 'Montée en cours',
  active_descent: 'Descente en cours',
  upcoming_climb: 'Montée à venir',
  upcoming_descent: 'Descente à venir',
  flat_or_none: 'Profil plat',
  unavailable: 'Profil indisponible',
};

function frenchDecimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

function validPoints(points: readonly ElevationPoint[]): Array<{ d: number; ele: number }> {
  return points.filter(
    (point): point is { d: number; ele: number } =>
      Number.isFinite(point.d) && typeof point.ele === 'number' && Number.isFinite(point.ele),
  );
}

export function buildSlopeSparkline(points: readonly ElevationPoint[]): {
  line: string;
  area: string;
} | null {
  const clean = validPoints(points);
  if (clean.length < 2) return null;

  const minD = clean[0].d;
  const maxD = clean[clean.length - 1].d;
  const spanD = Math.max(1, maxD - minD);
  const elevations = clean.map((point) => point.ele);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const spanEle = Math.max(1, maxEle - minEle);

  const coords = clean.map((point) => {
    const x = ((point.d - minD) / spanD) * 100;
    const y = 40 - ((point.ele - minEle) / spanEle) * 34;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return {
    line: `M${coords.join(' L')}`,
    area: `M0,44 L${coords.join(' L')} L100,44 Z`,
  };
}

export interface ClimbDescentCardProps {
  card: ClimbDescentCardState;
  units?: NavigationUnits;
  className?: string;
  /** Conserve la carte à l’écran quand le profil est plat (utile en aperçu). */
  showWhenInactive?: boolean;
}

export function ClimbDescentCard({
  card,
  units = 'metric',
  className,
  showWhenInactive = false,
}: ClimbDescentCardProps) {
  if (
    !card.segment ||
    card.status === 'flat_or_none' ||
    card.status === 'unavailable'
  ) {
    if (!showWhenInactive) return null;
    return (
      <GuidancePanel className={className} ariaLabel="Profil de montée et descente">
        <GuidancePanelHeader eyebrow="Profil" title={TITLE[card.status]} />
        <p className={styles.subtitle}>
          {card.status === 'unavailable'
            ? 'Aucun profil altimétrique disponible pour ce parcours.'
            : 'Aucune montée ou descente significative devant vous.'}
        </p>
      </GuidancePanel>
    );
  }

  const segment = card.segment;
  const climb = segment.kind === 'climb';
  const sparkline = buildSlopeSparkline(card.remainingProfilePoints);
  const gradientValue = `${frenchDecimal(segment.averageGradePct)} %`;
  const elevationLabel = formatNavigationElevation(
    card.remainingElevationDeltaM ?? 0,
    units,
    false,
  );
  const distanceLabel =
    card.distanceToStartM !== null && card.distanceToStartM > 0
      ? `dans ${formatNavigationDistance(card.distanceToStartM, units)}`
      : `reste ${formatNavigationDistance(card.remainingDistanceM, units)}`;
  const progressPercent = Math.round(Math.max(0, Math.min(1, card.progressRatio)) * 100);

  return (
    <GuidancePanel
      className={cx(styles.slopeCard, className)}
      ariaLabel={`${TITLE[card.status]}, pente moyenne ${gradientValue}`}
    >
      <div className={styles.slopeHeader}>
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>Profil · {climb ? 'montée' : 'descente'}</p>
          <h2 className={styles.title}>{TITLE[card.status]}</h2>
        </div>
        <span className={styles.slopeGrade}>
          {frenchDecimal(segment.averageGradePct)}
          <span className={styles.slopeGradeUnit}>%</span>
        </span>
      </div>

      <div className={styles.row} style={{ gap: 8 }}>
        <GuidanceBadge tone={climb ? 'warning' : 'info'} icon={climb ? 'up' : 'down'}>
          {climb ? 'D+' : 'D−'} {elevationLabel}
        </GuidanceBadge>
        <GuidanceBadge tone="neutral" icon="route">
          {distanceLabel}
        </GuidanceBadge>
        {card.currentGradePct !== null && card.progressRatio > 0 ? (
          <GuidanceBadge tone="neutral">
            pente {frenchDecimal(card.currentGradePct)} %
          </GuidanceBadge>
        ) : null}
      </div>

      {sparkline ? (
        <svg
          className={styles.sparkline}
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={sparkline.area} fill="currentColor" opacity="0.12" />
          <path
            d={sparkline.line}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      {card.progressRatio > 0 ? (
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={`Progression sur la ${climb ? 'montée' : 'descente'}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      ) : null}

      <div className={styles.slopeFoot}>
        <span>{`Longueur ${formatNavigationDistance(segment.lengthM, units)}`}</span>
        <span>{`Pente max ${frenchDecimal(segment.maxGradePct)} %`}</span>
      </div>

      {card.summaryLabel ? <span className={styles.srOnly}>{card.summaryLabel}</span> : null}
    </GuidancePanel>
  );
}
