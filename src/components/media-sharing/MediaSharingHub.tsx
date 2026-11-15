'use client';

import React, { useId, useState } from 'react';
import type {
  ActivityReplayManifest,
  FlybyDetectionResult,
  FlyoverTimeline,
  GeolocatedGalleryResult,
  PublishableTrackProjection,
  ShareCardSpec,
  TransparentStickerSpec,
  WebEmbedPayload,
} from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  AUDIENCE_LABELS,
  formatDistanceM,
  formatDurationSec,
  maskVersionShort,
  SPORT_LABELS,
} from './format';
import { Badge } from './StateCards';
import { GalleryScreen } from './GalleryScreen';
import { FlyoverScreen } from './FlyoverScreen';
import { ReplayScreen } from './ReplayScreen';
import { FlybyScreen } from './FlybyScreen';
import { ExternalShareScreen } from './ExternalShareScreen';
import { ProtectedPreviewScreen } from './ProtectedPreviewScreen';
import {
  CompassIcon,
  PhotoIcon,
  ShareIcon,
  ShieldIcon,
  SparkIcon,
  UsersIcon,
} from './icons';

export type MediaSharingTab =
  | 'gallery'
  | 'flyover'
  | 'replay'
  | 'flyby'
  | 'share'
  | 'preview';

const TABS: Array<{
  id: MediaSharingTab;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}> = [
  { id: 'gallery', label: 'Galerie', shortLabel: 'Galerie', icon: <PhotoIcon size={17} /> },
  { id: 'flyover', label: 'Flyover 3D', shortLabel: 'Flyover', icon: <CompassIcon size={17} /> },
  { id: 'replay', label: 'Replay', shortLabel: 'Replay', icon: <SparkIcon size={17} /> },
  { id: 'flyby', label: 'Flyby', shortLabel: 'Flyby', icon: <UsersIcon size={17} /> },
  { id: 'share', label: 'Partage externe', shortLabel: 'Partage', icon: <ShareIcon size={17} /> },
  { id: 'preview', label: 'Aperçu révocable', shortLabel: 'Aperçu', icon: <ShieldIcon size={17} /> },
];

export interface MediaSharingHubProps {
  track: PublishableTrackProjection;
  gallery: GeolocatedGalleryResult;
  timeline: FlyoverTimeline;
  replay: ActivityReplayManifest;
  flyby: FlybyDetectionResult;
  externalShare: {
    embed: WebEmbedPayload;
    card: ShareCardSpec;
    sticker: TransparentStickerSpec;
  };
  primaryName?: string;
  initialTab?: MediaSharingTab;
}

/**
 * Écran C04 — hub média d'une sortie.
 * Il compose les vues Galerie / Flyover / Replay / Flyby / Partage / Aperçu.
 * Chaque vue reçoit une charge utile déjà filtrée par le contrat ; aucune
 * coordonnée masquée ne transite par l'interface.
 */
export function MediaSharingHub({
  track,
  gallery,
  timeline,
  replay,
  flyby,
  externalShare,
  primaryName,
  initialTab = 'gallery',
}: MediaSharingHubProps) {
  const headingId = useId();
  const [tab, setTab] = useState<MediaSharingTab>(initialTab);
  const activeIndex = TABS.findIndex((entry) => entry.id === tab);
  const activeTab = TABS[activeIndex] ?? TABS[0];

  function moveTab(direction: 1 | -1) {
    const nextIndex = (activeIndex + direction + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    setTab(next.id);
    const element = document.getElementById(`media-tab-${next.id}`);
    element?.focus();
  }

  return (
    <div className={styles.hub}>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.eyebrow}>Médias de la sortie</p>
            <h1 className={styles.heroTitle} id={headingId}>
              {track.title}
            </h1>
            <p className={styles.heroSubtitle}>
              {SPORT_LABELS[track.sport] ?? 'Sortie'} ·{' '}
              {formatDistanceM(track.totalDistanceM)} · +
              {Math.round(track.elevationGainM)} m ·{' '}
              {formatDurationSec(track.durationSec)}
            </p>
          </div>
          <div className={styles.heroBadges}>
            <Badge tone="accent">
              <UsersIcon size={13} /> {AUDIENCE_LABELS[track.audience]}
            </Badge>
            <Badge tone="neutral">masque {maskVersionShort(track.maskVersion)}</Badge>
          </div>
        </div>

        <div className={styles.heroStats} aria-label="Résumé des médias">
          <div>
            <span className={styles.heroStatValue}>{gallery.items.length}</span>
            <span className={styles.heroStatLabel}>médias visibles</span>
          </div>
          <div>
            <span className={styles.heroStatValue}>{gallery.markers.length}</span>
            <span className={styles.heroStatLabel}>repères sur la trace</span>
          </div>
          <div>
            <span className={styles.heroStatValue}>{gallery.filteredOutCount}</span>
            <span className={styles.heroStatLabel}>masqués</span>
          </div>
          <div>
            <span className={styles.heroStatValue}>{flyby.crossings.length}</span>
            <span className={styles.heroStatLabel}>flybys consentis</span>
          </div>
        </div>

        <p className={styles.privacyNote}>
          <ShieldIcon size={15} />
          Les points dans les zones protégées et les EXIF privés sont retirés avant
          l’affichage. Un changement de masque invalide les rendus et les liens.
        </p>
      </header>

      <div
        className={styles.tabBar}
        role="tablist"
        aria-label="Sections média"
        aria-describedby={headingId}
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`media-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`media-panel-${entry.id}`}
            aria-label={entry.label}
            tabIndex={tab === entry.id ? 0 : -1}
            className={styles.tab}
            data-active={tab === entry.id ? 'true' : 'false'}
            onClick={() => setTab(entry.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveTab(1);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveTab(-1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                setTab(TABS[0].id);
                document.getElementById(`media-tab-${TABS[0].id}`)?.focus();
              } else if (event.key === 'End') {
                event.preventDefault();
                const last = TABS[TABS.length - 1];
                setTab(last.id);
                document.getElementById(`media-tab-${last.id}`)?.focus();
              }
            }}
          >
            <span className={styles.tabIcon} aria-hidden="true">
              {entry.icon}
            </span>
            <span className={styles.tabLabelFull}>{entry.label}</span>
            <span className={styles.tabLabelShort}>{entry.shortLabel}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`media-panel-${activeTab.id}`}
        aria-labelledby={`media-tab-${activeTab.id}`}
        className={styles.panel}
        key={activeTab.id}
      >
        {activeTab.id === 'gallery' ? (
          <GalleryScreen
            result={gallery}
            trackTitle={track.title}
            sport={track.sport}
            trackPoints={track.points}
            distanceM={track.totalDistanceM}
            elevationGainM={track.elevationGainM}
          />
        ) : null}

        {activeTab.id === 'flyover' ? (
          <FlyoverScreen timeline={timeline} title={track.title} />
        ) : null}

        {activeTab.id === 'replay' ? (
          <ReplayScreen manifest={replay} title={track.title} />
        ) : null}

        {activeTab.id === 'flyby' ? (
          <FlybyScreen
            result={flyby}
            primaryName={primaryName ?? track.title}
            primaryPoints={track.points}
          />
        ) : null}

        {activeTab.id === 'share' ? (
          <ExternalShareScreen
            embed={externalShare.embed}
            card={externalShare.card}
            sticker={externalShare.sticker}
            title={track.title}
          />
        ) : null}

        {activeTab.id === 'preview' ? (
          <ProtectedPreviewScreen track={track} ownerId={track.ownerId} />
        ) : null}
      </div>
    </div>
  );
}
