'use client';

import React from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import {
  videoPlaybackReasonLabel,
  type VideoPreferences,
} from '@/features/community/g01/videoPlayback';
import { useVideoPlayback } from '@/features/community/g01/useVideoPlayback';
import styles from './g01.module.css';

export interface G01VideoPlayerProps {
  src: string;
  poster?: string | null;
  preferences: VideoPreferences | unknown;
  /** La carte est-elle autorisée ? `false` ne monte aucun média. */
  audienceAllowed: boolean;
  ariaLabel?: string;
}

/**
 * Lecteur vidéo G01 : aucune lecture automatique par défaut, son coupé,
 * pause hors écran/onglet masqué, et respect de `prefers-reduced-motion` et de
 * l'économie de données. Les contrôles restent visibles et atteignables.
 */
export function G01VideoPlayer({
  src,
  poster,
  preferences,
  audienceAllowed,
  ariaLabel = 'Vidéo de la sortie',
}: G01VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [visibleFraction, setVisibleFraction] = React.useState(0);
  const [soundOn, setSoundOn] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [pausedByUser, setPausedByUser] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const { decision, requestPlay, requestPause } = useVideoPlayback({
    preferences,
    audienceAllowed,
    visibleFraction,
  });

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisibleFraction(1);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisibleFraction(entry ? Math.max(0, Math.min(1, entry.intersectionRatio)) : 0);
      },
      { threshold: [0, 0.25, 0.65, 1] }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const shouldPlay = decision.shouldPlay && !pausedByUser;
    if (shouldPlay) {
      void video.play().catch(() => {
        setPlaying(false);
        requestPause();
      });
    } else {
      video.pause();
      setPlaying(false);
    }
  }, [decision.shouldPlay, pausedByUser, requestPause, src]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onOtherVideo = (event: Event) => {
      if ((event as CustomEvent).detail !== video) {
        video.pause();
        setPlaying(false);
        requestPause();
      }
    };
    document.addEventListener('lkdv-community-video-play', onOtherVideo);
    return () => {
      document.removeEventListener('lkdv-community-video-play', onOtherVideo);
      video.pause();
    };
  }, [requestPause]);

  if (!decision.allowed) return null;

  const showDataSaverNotice =
    decision.reason === 'data_saver' || decision.reason === 'slow_network';

  return (
    <div>
      <div ref={frameRef} className={styles.videoFrame}>
        <video
          ref={videoRef}
          className={styles.video}
          src={src}
          poster={poster ?? undefined}
          preload={decision.preload}
          playsInline
          muted={!soundOn}
          loop={decision.loop}
          controls={false}
          aria-label={ariaLabel}
          onPlay={() => {
            setPlaying(true);
            document.dispatchEvent(
              new CustomEvent('lkdv-community-video-play', { detail: videoRef.current })
            );
          }}
          onPause={() => setPlaying(false)}
          onError={() => {
            setFailed(true);
            setPlaying(false);
          }}
        />
        {failed ? (
          <p role="alert" className={styles.videoNotice}>
            Vidéo indisponible. Réessayez plus tard.
          </p>
        ) : (
          <div className={styles.videoControls}>
            <button
              type="button"
              className={styles.videoButton}
              onClick={() => {
                if (playing) {
                  setPausedByUser(true);
                  requestPause();
                } else {
                  setPausedByUser(false);
                  requestPlay();
                }
              }}
              aria-label={playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
            >
              {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={styles.videoButton}
              onClick={() => setSoundOn((value) => !value)}
              aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
            >
              {soundOn ? (
                <Volume2 size={20} aria-hidden="true" />
              ) : (
                <VolumeX size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
      {showDataSaverNotice ? (
        <p className={styles.videoNotice}>{videoPlaybackReasonLabel(decision.reason)}</p>
      ) : null}
    </div>
  );
}

export default G01VideoPlayer;
