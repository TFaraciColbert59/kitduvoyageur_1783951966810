/* eslint-disable @next/next/no-img-element -- médias utilisateur servis par un CDN externe, hôtes non déclarables à l'avance. */
'use client';

import React, { useId, useMemo, useState } from 'react';
import type {
  GeolocatedGalleryResult,
  SanitizedMediaItem,
  SportKind,
} from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  formatDateTimeMs,
  formatDistanceM,
  mediaCountLabel,
  SPORT_LABELS,
} from './format';
import { EmptyState, LockedState, SectionHeading, Stat } from './StateCards';
import { TrackMiniMap } from './TrackMiniMap';
import { PhotoIcon, VideoIcon } from './icons';

type Filter = 'all' | 'photo' | 'video';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'photo', label: 'Photos' },
  { id: 'video', label: 'Vidéos' },
];

function MediaThumb({
  item,
  selected,
  onSelect,
}: {
  item: SanitizedMediaItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const mediaLabel = item.caption?.trim() || (item.kind === 'video' ? 'Vidéo' : 'Photo');
  return (
    <button
      type="button"
      className={styles.mediaCard}
      data-selected={selected ? 'true' : 'false'}
      aria-pressed={selected}
      aria-label={`${mediaLabel}, ${item.kind === 'video' ? 'vidéo' : 'photo'}${
        item.capturedAtMs ? `, ${formatDateTimeMs(item.capturedAtMs)}` : ''
      }`}
      onClick={onSelect}
    >
      <span className={styles.mediaImageWrap}>
        {!broken ? (
          <img
            className={styles.mediaImage}
            src={item.thumbnailUrl || item.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className={styles.mediaFallback} aria-hidden="true">
            {item.kind === 'video' ? <VideoIcon size={30} /> : <PhotoIcon size={30} />}
          </span>
        )}
        <span className={styles.mediaKind} data-kind={item.kind}>
          {item.kind === 'video' ? <VideoIcon size={13} /> : <PhotoIcon size={13} />}
          {item.kind === 'video' ? 'Vidéo' : 'Photo'}
        </span>
        {item.kind === 'video' && item.durationSec ? (
          <span className={styles.mediaDuration}>{Math.round(item.durationSec)} s</span>
        ) : null}
      </span>
      <span className={styles.mediaBody}>
        <span className={styles.mediaCaption}>{item.caption || 'Sans légende'}</span>
        <span className={styles.mediaSubline}>
          {item.location ? 'Géolocalisé' : 'Sans position'}
          {item.capturedAtMs ? ` · ${formatDateTimeMs(item.capturedAtMs)}` : ''}
        </span>
      </span>
    </button>
  );
}

export interface GalleryScreenProps {
  result: GeolocatedGalleryResult;
  trackTitle: string;
  sport: SportKind;
  trackPoints: readonly { lat: number; lng: number }[];
  distanceM: number;
  elevationGainM: number;
  fallbackMediaCount?: number;
}

/**
 * K5.06 / S1.21 — Galerie géolocalisée.
 * Aucune coordonnée brute n'est affichée : seuls les repères sur la trace et
 * les métadonnées utiles le sont. Un lecteur non autorisé ne reçoit rien.
 */
export function GalleryScreen({
  result,
  trackTitle,
  sport,
  trackPoints,
  distanceM,
  elevationGainM,
  fallbackMediaCount = 0,
}: GalleryScreenProps) {
  const headingId = useId();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      result.items.filter((item) => (filter === 'all' ? true : item.kind === filter)),
    [result.items, filter],
  );

  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const photoCount = result.items.filter((item) => item.kind === 'photo').length;
  const videoCount = result.items.length - photoCount;
  const selectedMarker = selected
    ? result.markers.find((marker) => marker.mediaId === selected.id) ?? null
    : null;
  const sportLabel = SPORT_LABELS[sport] ?? 'Sortie';

  if (!result.authorized) {
    return (
      <section className={styles.screen} aria-labelledby={headingId}>
        <SectionHeading
          eyebrow="Galerie géolocalisée"
          title={trackTitle}
          description="Les médias de cette sortie ne sont pas visibles avec ton niveau d'accès."
        />
        <LockedState
          title={result.reason === 'blocked' ? 'Accès bloqué' : 'Galerie privée'}
          message={
            result.reason === 'blocked'
              ? "Le propriétaire t'a bloqué. Aucun média ni repère n'est exposé."
              : "Cette galerie est réservée à l'audience choisie par le propriétaire. Aucun média ni repère n'est exposé."
          }
        />
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Galerie géolocalisée"
        title={trackTitle}
        description={`${sportLabel} · ${formatDistanceM(distanceM)} · +${Math.round(
          elevationGainM,
        )} m`}
        action={
          <div className={styles.filterGroup} role="group" aria-label="Filtrer les médias">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={styles.filterButton}
                data-active={filter === entry.id ? 'true' : 'false'}
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      />

      <div className={styles.statsRow}>
        <Stat label="Photos" value={photoCount} />
        <Stat label="Vidéos" value={videoCount} />
        <Stat
          label="Masqués"
          value={result.filteredOutCount}
          hint={`${result.filteredOutCount === 1 ? 'média dans une zone protégée' : 'médias dans des zones protégées'}`}
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Aucun média géolocalisé"
          message={
            fallbackMediaCount > 0
              ? `${mediaCountLabel(fallbackMediaCount, 'item')} existent, mais aucun n'est rattaché à la trace publiable.`
              : "Prends une photo pendant le suivi : elle apparaîtra ici et sur la trace."
          }
        />
      ) : (
        <div className={styles.galleryLayout}>
          <div className={styles.mediaGrid} role="list" aria-label="Médias de la sortie">
            {filtered.map((item) => (
              <div role="listitem" key={item.id}>
                <MediaThumb
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              </div>
            ))}
            {filtered.length === 0 ? (
              <div className={styles.gridEmpty}>
                <EmptyState
                  title="Aucun média pour ce filtre"
                  message="Change de filtre pour retrouver les photos ou les vidéos de la sortie."
                />
              </div>
            ) : null}
          </div>

          <aside className={styles.detailPanel} aria-label="Détail du média sélectionné">
            {selected ? (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.eyebrow}>
                      {selected.kind === 'video' ? 'Vidéo' : 'Photo'}
                    </p>
                    <h3 className={styles.detailTitle}>
                      {selected.caption || 'Sans légende'}
                    </h3>
                  </div>
                  <span className={styles.exifStamp} title="Métadonnées EXIF supprimées">
                    EXIF retirés
                  </span>
                </div>
                <div className={styles.detailImageWrap}>
                  <img
                    className={styles.detailImage}
                    src={selected.thumbnailUrl || selected.url}
                    alt={selected.caption || 'Média de la sortie'}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <dl className={styles.detailList}>
                  <div>
                    <dt>Prise</dt>
                    <dd>{formatDateTimeMs(selected.capturedAtMs)}</dd>
                  </div>
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {selected.location
                        ? `Sur la trace${selected.location.elevationM !== null ? ` · ${Math.round(selected.location.elevationM)} m` : ''}`
                        : 'Non géolocalisée'}
                    </dd>
                  </div>
                  {selectedMarker ? (
                    <div>
                      <dt>Repère</dt>
                      <dd>{formatDistanceM(selectedMarker.distanceAlongTrackM)} depuis le départ</dd>
                    </div>
                  ) : null}
                </dl>
                <TrackMiniMap
                  points={trackPoints}
                  pins={
                    selectedMarker
                      ? [
                          {
                            id: selectedMarker.mediaId,
                            label: selectedMarker.caption || 'Média sélectionné',
                            lat: selectedMarker.location.lat,
                            lng: selectedMarker.location.lng,
                            tone: 'media',
                          },
                        ]
                      : []
                  }
                  selectedPinId={selectedMarker?.mediaId ?? null}
                  ariaLabel="Repère du média sélectionné sur la trace"
                  height={160}
                />
              </>
            ) : null}
          </aside>
        </div>
      )}

      {result.items.length > 0 ? (
        <p className={styles.footnote}>
          {result.filteredOutCount > 0
            ? `${result.filteredOutCount} média(s) masqué(s) par les zones de confidentialité. `
            : ''}
          Les coordonnées GPS et les numéros de série ne sont jamais exposés.
        </p>
      ) : null}
    </section>
  );
}
