'use client';

/**
 * Lot N02-UI / K4.17 — Données de navigation embarquées dans le paquet.
 *
 * Le tracé, le profil altimétrique, les manœuvres et les fermetures viennent
 * exclusivement de `OfflineRouteNavigationData` (contrat N02). Ce panneau ne
 * calcule aucun itinéraire et n’invente aucune instruction.
 */

import React from 'react';
import {
  evaluateOfflineClosures,
  type OfflineRouteNavigationData,
  type OfflineClosureNotice,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineBadge,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineStat,
  formatDistanceM,
} from './primitives';
import styles from './offlineUi.module.css';

const SPORT_LABEL: Readonly<Record<string, string>> = {
  course: 'Course',
  rando: 'Randonnée',
  velo: 'Vélo',
  kayak: 'Kayak',
  trail: 'Trail',
  ski: 'Ski',
  escalade: 'Escalade',
  famille: 'Famille',
  bivouac: 'Bivouac',
};

export interface OfflineRouteNavigationPanelProps {
  routeData: OfflineRouteNavigationData;
  currentAlongTrackM?: number;
  nowMs?: number;
  maxManeuvers?: number;
  extraClosures?: readonly OfflineClosureNotice[];
}

function profileTotals(points: OfflineRouteNavigationData['elevationProfile']): {
  distanceM: number;
  ascentM: number;
  descentM: number;
} {
  if (points.length < 2) return { distanceM: 0, ascentM: 0, descentM: 0 };
  let ascentM = 0;
  let descentM = 0;
  for (let index = 1; index < points.length; index += 1) {
    const currEle = points[index].ele;
    const prevEle = points[index - 1].ele;
    if (currEle === null || prevEle === null) continue;
    const delta = currEle - prevEle;
    if (delta > 0) ascentM += delta;
    else descentM += Math.abs(delta);
  }
  return {
    distanceM: Math.max(0, points[points.length - 1].d - points[0].d),
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
  };
}

function maneuverLabel(maneuver: OfflineRouteNavigationData['maneuvers'][number]): string {
  return maneuver.instruction?.trim() || 'Instruction de navigation';
}

export function OfflineRouteNavigationPanel({
  routeData,
  currentAlongTrackM = 0,
  nowMs = Date.now(),
  maxManeuvers = 3,
  extraClosures = [],
}: OfflineRouteNavigationPanelProps) {
  const totals = profileTotals(routeData.elevationProfile);
  const closures = evaluateOfflineClosures(
    [...(routeData.closures ?? []), ...extraClosures],
    nowMs
  );
  const photoCount = routeData.pois.reduce((total, poi) => total + poi.mediaAssets.length, 0);

  const upcoming = [...routeData.maneuvers]
    .filter((maneuver) => maneuver.alongTrackM >= currentAlongTrackM - 10)
    .sort((a, b) => a.alongTrackM - b.alongTrackM)
    .slice(0, maxManeuvers);

  return (
    <OfflinePanel ariaLabel="Données de navigation hors ligne">
      <OfflinePanelHeader
        eyebrow="K4.17 · Guidage embarqué"
        title="Données de navigation hors ligne"
        subtitle={`${routeData.name} · ${SPORT_LABEL[routeData.sport] ?? routeData.sport} · révision ${routeData.routeRevision}`}
        action={
          <OfflineBadge tone="success" icon="route">
            Trace vérifiée
          </OfflineBadge>
        }
      />

      <div className={styles.metrics}>
        <OfflineStat label="Distance" value={formatDistanceM(totals.distanceM)} />
        <OfflineStat label="Dénivelé +" value={`${totals.ascentM} m`} />
        <OfflineStat label="Dénivelé −" value={`${totals.descentM} m`} />
        <OfflineStat label="Instructions" value={String(routeData.maneuvers.length)} />
        <OfflineStat label="Repères" value={String(routeData.pois.length)} />
        <OfflineStat label="Photos" value={String(photoCount)} />
      </div>

      {closures.length > 0 ? (
        <div className={styles.stackTight}>
          {closures.map((closure) => (
            <OfflineNotice
              key={closure.closureId}
              tone={closure.freshness === 'uncertain_expired' ? 'warning' : 'danger'}
              icon="alert"
            >
              {closure.warningLabel}
            </OfflineNotice>
          ))}
        </div>
      ) : null}

      {upcoming.length === 0 ? (
        <OfflineEmpty
          title="Aucune instruction à venir"
          hint="Les manœuvres du parcours ont été dépassées ou ne sont pas incluses."
          icon="route"
        />
      ) : (
        <ul className={styles.list}>
          {upcoming.map((maneuver) => {
            const remainingM = Math.max(0, maneuver.alongTrackM - currentAlongTrackM);
            return (
              <li key={maneuver.id} className={styles.listItem}>
                <span className={styles.iconBubble}>
                  <XpIcon name="nav" size={18} />
                </span>
                <div className={styles.grow}>
                  <p className={styles.itemTitle}>{maneuverLabel(maneuver)}</p>
                  <p className={styles.itemMeta}>
                    À {formatDistanceM(remainingM)} · repère {maneuver.index + 1} · {maneuver.kind}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.caption}>
        Le guidage utilise cette révision téléchargée : aucune instruction n’est recalculée hors
        réseau sans graphe local.
      </p>
    </OfflinePanel>
  );
}
