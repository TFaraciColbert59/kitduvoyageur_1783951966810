'use client';

/**
 * Lot N01 / K4.12 & S1.06 — Aperçu de l’écran verrouillé et de la Live Activity.
 *
 * Rendu strictement visuel du payload construit par `buildLockScreenNavigationPayload` :
 * aucune Live Activity n’est créée, aucun pont natif n’est appelé. Les actions
 * remontent par `onAction` pour être branchées sur `LockScreenBridgeController`.
 */

import React from 'react';
import {
  MANEUVER_ICON_BY_KIND,
  type LockScreenCapability,
  type LockScreenNavigationPayload,
  type Sport,
} from '@/features/navigation';
import { XpIcon, type XpIconName } from '../../ui/XpIcon';
import { ManeuverGlyph } from './glyphs';
import {
  GuidanceBadge,
  GuidancePanel,
  GuidancePanelHeader,
  GuidanceSegmented,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

export type LockScreenPreviewPlatform = 'ios' | 'android';
export type LockScreenPreviewAction = 'pause' | 'resume' | 'lap' | 'mute';

const SPORT_ICON: Readonly<Record<Sport, XpIconName>> = {
  course: 'run',
  trail: 'hike',
  rando: 'hike',
  velo: 'bike',
  kayak: 'kayak',
  ski: 'ski',
  escalade: 'mtn',
  famille: 'users',
  bivouac: 'tent',
};

const CONTRACT_ICON_MAP: Readonly<Record<string, XpIconName>> = {
  'flag-start': 'flag',
  'flag-checkered': 'flag',
  'arrow-up': 'up',
  'arrow-up-left': 'up',
  'arrow-up-right': 'up',
  'corner-up-left': 'chevl',
  'corner-up-right': 'chevr',
  'turn-sharp-left': 'chevl',
  'turn-sharp-right': 'chevr',
  'rotate-ccw': 'repeat',
  'map-pin': 'pin',
  'alert-triangle': 'alert',
  'sport-course': 'run',
  'sport-trail': 'hike',
  'sport-rando': 'hike',
  'sport-velo': 'bike',
  'sport-kayak': 'kayak',
  'sport-ski': 'ski',
  'sport-escalade': 'mtn',
  'sport-famille': 'users',
  'sport-bivouac': 'tent',
};

function iconFor(name: string | null | undefined, sport: Sport): XpIconName {
  if (name && CONTRACT_ICON_MAP[name]) return CONTRACT_ICON_MAP[name];
  const maneuverMatch = name
    ? (Object.values(MANEUVER_ICON_BY_KIND) as string[]).find((icon) => icon === name)
    : null;
  if (maneuverMatch && CONTRACT_ICON_MAP[maneuverMatch]) return CONTRACT_ICON_MAP[maneuverMatch];
  return SPORT_ICON[sport] ?? 'nav';
}

export interface LiveActivityPreviewProps {
  payload: LockScreenNavigationPayload;
  capability?: LockScreenCapability | null;
  defaultPlatform?: LockScreenPreviewPlatform;
  onAction?: (action: LockScreenPreviewAction) => void;
  className?: string;
}

export function LiveActivityPreview({
  payload,
  capability = null,
  defaultPlatform = 'ios',
  onAction,
  className,
}: LiveActivityPreviewProps) {
  const [platform, setPlatform] = React.useState<LockScreenPreviewPlatform>(defaultPlatform);
  const island = payload.dynamicIsland;
  const maneuver = payload.nextManeuver;
  const android = payload.androidNotification;
  const platformSupported =
    capability === null
      ? null
      : platform === 'ios'
        ? capability.liveActivityAvailable
        : capability.ongoingNotificationAvailable;

  return (
    <GuidancePanel
      className={cx(styles.livePanel, className)}
      ariaLabel="Aperçu Live Activity et écran verrouillé"
    >
      <GuidancePanelHeader
        eyebrow="Écran verrouillé"
        title="Live Activity"
        subtitle="Statistiques et prochaine instruction, sans déverrouiller le téléphone."
        action={
          <GuidanceBadge
            tone={payload.offRoute ? 'warning' : payload.paused ? 'neutral' : 'success'}
            icon="shield"
          >
            {payload.paused ? 'Pause' : payload.offRoute ? 'Hors trace' : 'En direct'}
          </GuidanceBadge>
        }
      />

      <GuidanceSegmented<LockScreenPreviewPlatform>
        label="Aperçu de l’écran verrouillé"
        value={platform}
        onChange={setPlatform}
        options={[
          { value: 'ios', label: 'iPhone' },
          { value: 'android', label: 'Android' },
        ]}
      />

      {platform === 'ios' ? (
        <div className={styles.liveStage}>
          <div className={styles.phone} role="group" aria-label={`Aperçu iPhone, ${island.compactTrailing}`}>
            <div className={styles.phoneStatusBar}>
              <span>9:41</span>
              <span>LKDV</span>
            </div>

            <div className={styles.island} aria-hidden="true">
              {maneuver ? (
                <ManeuverGlyph kind={maneuver.kind} size={13} />
              ) : (
                <XpIcon name={iconFor(island.compactLeading, payload.sport)} size={13} />
              )}
              <span className={styles.islandValue}>{island.compactTrailing}</span>
            </div>

            <div className={styles.islandExpanded}>
              <p className={styles.islandHeadline}>{island.expanded.headline}</p>
              <p className={styles.islandSub}>{island.expanded.subheadline}</p>
              <div className={styles.islandStats}>
                <div className={styles.islandStat}>
                  <span className={styles.islandStatLabel}>
                    {island.expanded.leadingStatLabel}
                  </span>
                  <span className={styles.islandStatValue}>
                    {island.expanded.leadingStatValue}
                  </span>
                </div>
                <div className={styles.islandStat}>
                  <span className={styles.islandStatLabel}>
                    {island.expanded.trailingStatLabel}
                  </span>
                  <span className={styles.islandStatValue}>
                    {island.expanded.trailingStatValue}
                  </span>
                </div>
              </div>
              {island.expanded.bottomBanner ? (
                <p className={styles.islandSub}>{island.expanded.bottomBanner}</p>
              ) : null}
            </div>

            <div className={styles.lockCard}>
              <div className={styles.lockApp}>
                <span>LKDV · Navigation</span>
                <span>{payload.sport}</span>
              </div>
              <p className={styles.lockHeadline}>{island.expanded.headline}</p>
              <p className={styles.lockSub}>
                {payload.formattedDistance} · {payload.formattedDuration} ·{' '}
                {payload.formattedElevationGain}
                {payload.formattedRhythm !== '—' ? ` · ${payload.formattedRhythm}` : ''}
              </p>

              {maneuver ? (
                <div className={styles.maneuverRow}>
                  <span className={styles.maneuverRowGlyph}>
                    <ManeuverGlyph kind={maneuver.kind} size={24} />
                  </span>
                  <span className={styles.maneuverRowText}>
                    <span className={styles.maneuverRowTitle}>{maneuver.instruction}</span>
                    <span className={styles.maneuverRowDistance}>
                      {maneuver.formattedDistance}
                    </span>
                  </span>
                </div>
              ) : null}

              {payload.offRouteBanner ? (
                <p className={cx(styles.badge, styles.pillOnDark)}>{payload.offRouteBanner}</p>
              ) : null}

              <div className={styles.lockActions}>
                <button
                  type="button"
                  className={styles.lockAction}
                  onClick={() => onAction?.(payload.paused ? 'resume' : 'pause')}
                >
                  <XpIcon name={payload.paused ? 'play' : 'pause'} size={14} />
                  {payload.paused ? 'Reprendre' : 'Pause'}
                </button>
                <button
                  type="button"
                  className={styles.lockAction}
                  onClick={() => onAction?.('lap')}
                >
                  <XpIcon name="lap" size={14} />
                  Tour
                </button>
                <button
                  type="button"
                  className={styles.lockAction}
                  onClick={() => onAction?.('mute')}
                >
                  <XpIcon name="vol" size={14} />
                  Muet
                </button>
              </div>
            </div>
          </div>

          {capability?.dynamicIslandAvailable === false ? (
            <p className={styles.disclaimer}>
              <XpIcon name="info" size={14} />
              Dynamic Island indisponible sur cet appareil : l’aperçu reste indicatif.
            </p>
          ) : null}
        </div>
      ) : (
        <div className={styles.liveStage}>
          <div className={styles.androidFrame}>
            <div className={styles.androidCard}>
              <div className={styles.androidHeader}>
                <span className={styles.androidMark}>L</span>
                <span>LKDV · notification continue</span>
              </div>
              <p className={styles.androidTitle}>{android.title}</p>
              <p className={styles.androidSub}>{android.subtitle}</p>
              <p className={styles.androidSub}>{android.body}</p>
              <div className={styles.androidActions}>
                {android.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={styles.androidAction}
                    onClick={() => onAction?.(action.id)}
                  >
                    {action.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {platformSupported === false ? (
        <p className={styles.warning} role="status">
          <XpIcon name="info" size={14} />
          {capability?.reason ??
            'Cette surface native n’est pas disponible sur cet appareil. L’aperçu ne crée aucune notification.'}
        </p>
      ) : null}

      <p className={styles.disclaimer}>
        <XpIcon name="info" size={14} />
        Aperçu visuel uniquement : aucune Live Activity ni notification n’est créée depuis cet
        écran.
      </p>
    </GuidancePanel>
  );
}
