'use client';

import React, { useId, useMemo } from 'react';
import type { FlyoverTimeline } from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  formatDistanceM,
  formatDurationSec,
  maskVersionShort,
} from './format';
import { Badge, EmptyState, SectionHeading, Stat } from './StateCards';
import { TrackMiniMap } from './TrackMiniMap';
import { PlaybackControls } from './PlaybackControls';
import { usePlayback } from './usePlayback';
import { CompassIcon, SparkIcon } from './icons';

export interface FlyoverScreenProps {
  timeline: FlyoverTimeline;
  title: string;
}

/**
 * K5.12 / S3.20 — Flyover 3D.
 * Le lecteur ne fait que rejouer la timeline déterministe : la caméra, les
 * stats et les médias attachés sont ceux du contrat, jamais recalculés ici.
 */
export function FlyoverScreen({ timeline, title }: FlyoverScreenProps) {
  const headingId = useId();
  const playback = usePlayback(timeline.durationSec);
  const current = useMemo(() => {
    if (timeline.keyframes.length === 0) return null;
    const target = playback.progress;
    let selected = timeline.keyframes[0];
    for (const keyframe of timeline.keyframes) {
      if (keyframe.progress <= target) selected = keyframe;
      else break;
    }
    return selected;
  }, [timeline.keyframes, playback.progress]);

  if (timeline.keyframes.length === 0) {
    return (
      <section className={styles.screen} aria-labelledby={headingId}>
        <SectionHeading
          eyebrow="Flyover 3D"
          title={title}
          description="Aucun point publiable : le survol ne peut pas être généré."
        />
        <EmptyState
          title="Trace indisponible"
          message="Tous les points sont masqués ou la trace ne contient aucune coordonnée exploitable."
        />
      </section>
    );
  }

  const lastFrame = timeline.keyframes[timeline.keyframes.length - 1];
  const progressDistance = Math.round(current?.statCallout?.distanceM ?? 0);
  const progressGain = current?.statCallout?.elevationGainM ?? 0;

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Flyover 3D"
        title={title}
        description="Survol caméra continu, média attachés et lecture sans coupure."
        action={
          <div className={styles.badgeRow}>
            <Badge tone="accent">{timeline.fps} fps</Badge>
            <Badge tone="neutral">masque {maskVersionShort(timeline.maskVersion)}</Badge>
          </div>
        }
      />

      <div className={styles.flyoverLayout}>
        <div className={styles.flyoverStage}>
          <TrackMiniMap
            points={timeline.keyframes.map((frame) => ({
              lat: frame.lat,
              lng: frame.lng,
            }))}
            pins={
              current
                ? [
                    {
                      id: 'camera',
                      label: `Caméra à ${Math.round(current.progress * 100)} %`,
                      lat: current.lat,
                      lng: current.lng,
                      tone: 'camera',
                    },
                  ]
                : []
            }
            selectedPinId="camera"
            ariaLabel={`Survol caméra de ${title}`}
            height={250}
            className={styles.flyoverMap}
          />
          <div className={styles.cameraHud} aria-hidden="true">
            <span className={styles.cameraHudLabel}>CAMÉRA</span>
            <span className={styles.cameraHudValue}>
              {current ? Math.round(current.bearingDeg) : 0}°
            </span>
            <span className={styles.cameraHudSub}>
              {current ? `${Math.round(current.elevationM)} m` : '—'}
            </span>
          </div>
          <div className={styles.progressRail} aria-hidden="true">
            <span
              className={styles.progressFill}
              style={{ transform: `scaleX(${playback.progress})` }}
            />
          </div>
        </div>

        <div className={styles.flyoverSide}>
          <div className={styles.statsRow}>
            <Stat label="Durée" value={formatDurationSec(timeline.durationSec)} />
            <Stat label="Images" value={timeline.keyframes.length} />
            <Stat
              label="Médias"
              value={timeline.attachedMediaCount}
              hint="attachés à la caméra"
            />
          </div>

          <PlaybackControls
            playback={playback}
            label={`le flyover de ${title}`}
            durationSec={timeline.durationSec}
          />

          <div className={styles.liveReadout} aria-live="polite">
            <div>
              <span className={styles.readoutLabel}>Distance</span>
              <strong className={styles.readoutValue}>{formatDistanceM(progressDistance)}</strong>
            </div>
            <div>
              <span className={styles.readoutLabel}>D+</span>
              <strong className={styles.readoutValue}>+{progressGain} m</strong>
            </div>
            <div>
              <span className={styles.readoutLabel}>Cap</span>
              <strong className={styles.readoutValue}>
                {current ? `${Math.round(current.bearingDeg)}°` : '—'}
              </strong>
            </div>
          </div>

          {current?.attachedMediaId ? (
            <div className={styles.attachedMedia}>
              <SparkIcon size={18} />
              <div>
                <strong>Média attaché</strong>
                <p>
                  Le cadrage s’ouvre sur le média au repère {current.attachedMediaId}.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.attachedMedia} data-muted="true">
              <CompassIcon size={18} />
              <div>
                <strong>Caméra libre</strong>
                <p>Le survol suit la trace ; aucun média n’est attaché à ce point.</p>
              </div>
            </div>
          )}

          <p className={styles.footnote}>
            Dernier keyframe à {formatDurationSec(lastFrame.tSec)} · projection masquée{' '}
            {maskVersionShort(timeline.maskVersion)}.
          </p>
        </div>
      </div>
    </section>
  );
}
