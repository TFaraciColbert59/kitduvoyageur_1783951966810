'use client';

/**
 * Lecteurs vidéo de la fiche carnet v2 (proposition n° 31 de la maquette
 * `docs/carnets/maquette-carnets-de-bord.html`).
 *
 * Avant : un moment vidéo était rendu comme une image (`<img src=…>`) — la
 * vidéo n'était donc jamais lue, ni dans le fil ni dans la mosaïque Médias.
 * Ici, deux rendus sobres, sans dépendance :
 *
 * - `CarnetVideoFeed` : dans le fil, lecture muette en boucle (le son se touche
 *   explicitement), contrôles 44 px lecture/pause + son + ouverture, mouvement
 *   réduit respecté (pas de lecture automatique) ;
 * - `CarnetVideoThumb` : dans les tuiles et la mosaïque, une vignette vidéo
 *   inerte (preload metadata), sans contrôles ni lecture — la tuile ouvre le
 *   moment comme une photo.
 *
 * Les erreurs de lecture (format, 403, navigateur) ne cassent pas la carte :
 * l'élément retombe sur son fond et le bouton lecture reste inactif.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX, ExternalLink } from 'lucide-react';

/** Vrai si la personne a demandé un mouvement réduit (pas de lecture auto). */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface CarnetVideoThumbProps {
  src: string;
  /** Libellé lu par le lecteur d'écran (souvent vide : la tuile porte déjà son aria-label). */
  label?: string;
}

/** Vignette vidéo inerte : premier plan figé, aucun contrôle, aucune lecture. */
export function CarnetVideoThumb({ src, label }: CarnetVideoThumbProps) {
  return (
    <video
      className="lkdv-video-thumb"
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      tabIndex={-1}
    />
  );
}

export interface CarnetVideoFeedProps {
  src: string;
  /** Ouvre le moment (fiche plein écran) : fourni, un bouton 44 px l'expose. */
  onOpen?: () => void;
  /** Lieu/légende pour les libellés des contrôles. */
  place?: string;
}

/**
 * Vidéo du fil : muette en boucle, son au toucher, contrôles accessibles.
 * `play()` peut être refusé (politique navigateur, format) : on ne lève jamais.
 */
export function CarnetVideoFeed({ src, onOpen, place }: CarnetVideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = videoRef.current;
    if (!media || prefersReducedMotion()) return;
    try {
      const attempt = media.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => undefined);
    } catch {
      /* lecture refusée : l'utilisateur lance lui-même */
    }
  }, []);

  const togglePlay = useCallback(() => {
    const media = videoRef.current;
    if (!media || failed) return;
    try {
      if (media.paused) {
        const attempt = media.play();
        if (attempt && typeof attempt.catch === 'function') attempt.catch(() => undefined);
      } else {
        media.pause();
      }
    } catch {
      setFailed(true);
    }
  }, [failed]);

  const toggleMute = useCallback(() => {
    const media = videoRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }, []);

  return (
    <div className="lkdv-video-feed">
      <video
        ref={videoRef}
        className="lkdv-video-feed-media"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      <div className="lkdv-video-controls">
        <button
          type="button"
          className="lkdv-video-btn"
          aria-label={playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
          aria-pressed={playing}
          onClick={togglePlay}
          disabled={failed}
        >
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="lkdv-video-btn"
          aria-label={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'}
          aria-pressed={!muted}
          onClick={toggleMute}
          disabled={failed}
        >
          {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
        </button>
        {onOpen ? (
          <button
            type="button"
            className="lkdv-video-btn"
            aria-label={`Ouvrir : ${place?.trim() || 'la vidéo'}`}
            onClick={onOpen}
          >
            <ExternalLink size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {failed ? <span className="lkdv-video-error">Vidéo indisponible</span> : null}
    </div>
  );
}

export default CarnetVideoFeed;
