/* eslint-disable @next/next/no-img-element -- médias utilisateur servis par un CDN externe, hôtes non déclarables à l'avance. */
'use client';

import React, { useId, useMemo, useState } from 'react';
import type { ActivityReplayManifest, ReplayHighlight } from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  AUDIENCE_LABELS,
  formatDurationSec,
  maskVersionShort,
} from './format';
import { Badge, EmptyState, SectionHeading, Stat } from './StateCards';
import { TrackMiniMap } from './TrackMiniMap';
import { PlaybackControls } from './PlaybackControls';
import { usePlayback } from './usePlayback';
import { ClockIcon, MountainIcon, PhotoIcon, SparkIcon } from './icons';

const HIGHLIGHT_LABELS: Record<ReplayHighlight['kind'], string> = {
  start: 'Départ',
  peak: 'Sommet',
  media: 'Média',
  split: 'Split',
  finish: 'Arrivée',
};

function HighlightIcon({ kind }: { kind: ReplayHighlight['kind'] }) {
  if (kind === 'peak') return <MountainIcon size={16} />;
  if (kind === 'media') return <PhotoIcon size={16} />;
  if (kind === 'finish') return <SparkIcon size={16} />;
  return <ClockIcon size={16} />;
}

export interface ReplayScreenProps {
  manifest: ActivityReplayManifest;
  title: string;
}

/**
 * S3.21 — Activity Replay pour le fil.
 * Un manifeste vide (trace privée) est affiché comme tel : jamais de points
 * ni de miniature d'un rendu précédent.
 */
export function ReplayScreen({ manifest, title }: ReplayScreenProps) {
  const headingId = useId();
  const playback = usePlayback(manifest.durationSec);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  const currentHighlight = useMemo(() => {
    if (manifest.highlights.length === 0) return null;
    let selected = manifest.highlights[0];
    for (const highlight of manifest.highlights) {
      if (highlight.progress <= playback.progress) selected = highlight;
      else break;
    }
    return selected;
  }, [manifest.highlights, playback.progress]);

  if (manifest.points.length === 0) {
    return (
      <section className={styles.screen} aria-labelledby={headingId}>
        <SectionHeading
          eyebrow="Replay"
          title={title}
          description="Le replay n'est pas publiable pour cette audience."
        />
        <EmptyState
          title="Replay indisponible"
          message="La trace est privée ou ne contient aucun point publiable. Aucun aperçu n'est exposé."
        />
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Replay"
        title={title}
        description="Rejoue la sortie en quelques secondes, avec ses temps forts."
        action={
          <div className={styles.badgeRow}>
            <Badge tone="neutral">{formatDurationSec(manifest.durationSec)}</Badge>
            <Badge tone="accent">masque {maskVersionShort(manifest.maskVersion)}</Badge>
          </div>
        }
      />

      <div className={styles.replayLayout}>
        <div className={styles.replayStage}>
          {manifest.fallbackPreviewUrl ? (
            <img
              className={styles.replayBackdrop}
              src={manifest.fallbackPreviewUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <TrackMiniMap
            points={manifest.points}
            pins={manifest.highlights.map((highlight) => ({
              id: highlight.id,
              label: `${HIGHLIGHT_LABELS[highlight.kind]} : ${highlight.label}`,
              lat: highlight.lat,
              lng: highlight.lng,
              tone:
                highlight.kind === 'media'
                  ? 'media'
                  : highlight.kind === 'peak'
                    ? 'meeting'
                    : highlight.kind === 'start'
                      ? 'start'
                      : 'finish',
            }))}
            selectedPinId={selectedHighlightId ?? currentHighlight?.id ?? null}
            onSelectPin={(pinId) => {
              const highlight = manifest.highlights.find((entry) => entry.id === pinId);
              if (highlight) {
                setSelectedHighlightId(highlight.id);
                playback.seek(highlight.tSec);
              }
            }}
            ariaLabel={`Replay de ${title}`}
            height={260}
            className={styles.replayMap}
          />
          <div className={styles.replayTimecode} aria-hidden="true">
            <span>{playback.progress < 1 ? 'LIVE' : 'FIN'}</span>
          </div>
        </div>

        <div className={styles.replaySide}>
          <div className={styles.statsRow}>
            <Stat label="Points" value={manifest.points.length} />
            <Stat label="Temps forts" value={manifest.highlights.length} />
            <Stat label="Audience" value={AUDIENCE_LABELS[manifest.audience]} />
          </div>

          <PlaybackControls
            playback={playback}
            label={`le replay de ${title}`}
            durationSec={manifest.durationSec}
          />

          <ol className={styles.highlightList} aria-label="Temps forts du replay">
            {manifest.highlights.map((highlight) => (
              <li key={highlight.id}>
                <button
                  type="button"
                  className={styles.highlightButton}
                  data-active={
                    (selectedHighlightId ?? currentHighlight?.id) === highlight.id
                      ? 'true'
                      : 'false'
                  }
                  onClick={() => {
                    setSelectedHighlightId(highlight.id);
                    playback.seek(highlight.tSec);
                  }}
                >
                  <span className={styles.highlightIcon} data-kind={highlight.kind}>
                    <HighlightIcon kind={highlight.kind} />
                  </span>
                  <span className={styles.highlightText}>
                    <strong>{highlight.label}</strong>
                    <span>
                      {HIGHLIGHT_LABELS[highlight.kind]} · {formatDurationSec(highlight.tSec)}
                    </span>
                  </span>
                  <span className={styles.highlightProgress}>
                    {Math.round(highlight.progress * 100)} %
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className={styles.footnote}>
        Replay non téléchargeable. Les points affichés proviennent de la projection masquée{' '}
        {maskVersionShort(manifest.maskVersion)}.
      </p>
    </section>
  );
}
