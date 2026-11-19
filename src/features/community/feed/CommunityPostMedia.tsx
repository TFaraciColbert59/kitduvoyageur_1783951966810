'use client';

import { EngagementBar, LikeIcon } from '@/components/social-kit';
import { G01VideoPlayer } from '@/components/communaute/g01/G01VideoPlayer';
import { DEFAULT_VIDEO_PREFERENCES, type VideoPreferences } from '@/features/community/g01/videoPlayback';
import { DEFAULT_DOUBLE_TAP_WINDOW_MS } from '@/hooks/gestures';
import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImageOff, Pause, Play, Volume2, VolumeX } from 'lucide-react';

export interface CommunityPostMediaProps {
  media: string;
  isVideo: boolean;
  /**
   * Visionneuse (fiche carnet) : la vidéo reçoit lecture/pause et son au
   * toucher. Le fil Communauté garde sa vignette muette sans contrôle.
   */
  interactiveVideo?: boolean;
  /** Image de poster affichée avant la lecture (réseaux lents). */
  poster?: string;
  alt?: string | null;
  priority?: boolean;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  burst?: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  /** Désactive les gestes quand un panneau est ouvert. */
  inert?: boolean;
  /** Un swipe vient de se terminer : ne pas transformer le relâchement en like. */
  shouldIgnoreClick?: () => boolean;
  /** Proportions réelles du média (largeur / hauteur), pour adapter la hauteur de la carte. */
  onRatio?: (ratio: number) => void;
  /** Plusieurs médias (moments d'un carnet) : flèches et compteur. */
  nav?: { count: number; index: number; onChange: (index: number) => void };
  /** Préférences de lecture vidéo G01 (S6.28). */
  videoPreferences?: VideoPreferences | unknown;
}

/**
 * Média de la carte Communauté : dimensions réservées, décodage asynchrone,
 * repli image cassée et double-tap accessible. Aucun texte de structure.
 */
/** Bouton de contrôle vidéo 44 px, lisible sur l'image. */
const VIDEO_BUTTON_STYLE: React.CSSProperties = {
  width: 44,
  height: 44,
  padding: 0,
  border: 0,
  borderRadius: 9999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--lkdv-video-control-bg, rgba(11, 31, 23, 0.62))',
  color: 'var(--lkdv-video-control-ink, #ffffff)',
  backdropFilter: 'blur(10px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
  cursor: 'pointer',
};

/**
 * Vidéo interactive d'une visionneuse : lecture/pause et son au toucher,
 * muette par défaut, 44 px de cible, jamais de lecture auto non demandée.
 */
function InteractivePostVideo({
  src,
  poster,
  label,
  onRatio,
}: {
  src: string;
  poster?: string;
  label: string;
  onRatio?: (ratio: number) => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    try {
      if (media.paused) {
        const attempt = media.play();
        if (attempt && typeof attempt.catch === 'function') attempt.catch(() => undefined);
      } else {
        media.pause();
      }
    } catch {
      /* lecture refusée : on ne lève jamais */
    }
  }, []);

  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = !media.muted;
    setMuted(media.muted);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={mediaRef}
        src={src}
        poster={poster}
        width={1080}
        height={1440}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          togglePlay();
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          const el = event.currentTarget;
          if (el.videoWidth && el.videoHeight) onRatio?.(el.videoWidth / el.videoHeight);
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div
        style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 8 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
          aria-pressed={playing}
          onClick={togglePlay}
          style={VIDEO_BUTTON_STYLE}
        >
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
        <button
          type="button"
          aria-label={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'}
          aria-pressed={!muted}
          onClick={toggleMute}
          style={VIDEO_BUTTON_STYLE}
        >
          {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function CommunityPostMedia({
  media,
  isVideo,
  interactiveVideo = false,
  poster,
  alt,
  priority = false,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  burst = 0,
  onLike,
  onComment,
  onShare,
  inert = false,
  shouldIgnoreClick,
  onRatio,
  nav,
  videoPreferences = DEFAULT_VIDEO_PREFERENCES,
}: CommunityPostMediaProps) {
  const [failed, setFailed] = useState(false);
  const [localBurst, setLocalBurst] = useState(0);
  const clickTimer = useRef<number | null>(null);
  const prevLikedRef = useRef(liked);
  const effectiveBurst = Math.max(burst, localBurst);

  useEffect(() => {
    if (liked && !prevLikedRef.current) {
      setLocalBurst((k) => k + 1);
    }
    prevLikedRef.current = liked;
  }, [liked]);

  const triggerLikeWithAnim = useCallback(() => {
    if (!liked) {
      setLocalBurst((k) => k + 1);
    }
    onLike();
  }, [liked, onLike]);
  const mediaLabel = alt?.trim() || 'Média de la publication';
  // Le poster d'une vidéo est une image distante comme les autres : sans
  // passage par l'optimiseur, il partait en 1600 px / 500 Ko pour une carte
  // de 393 px. Une seule largeur suffit ici (pas de srcset sur `poster`).
  const optimizedPoster =
    poster && !poster.startsWith('/_next/image')
      ? `/_next/image?url=${encodeURIComponent(poster)}&w=828&q=75`
      : poster;

  useEffect(() => {
    setFailed(false);
  }, [media]);

  useEffect(
    () => () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
    },
    [],
  );

  const activateLike = useCallback(() => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      triggerLikeWithAnim();
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      triggerLikeWithAnim();
    }, DEFAULT_DOUBLE_TAP_WINDOW_MS);
  }, [triggerLikeWithAnim]);

  return (
    <div className="lkdv-post-main">
      <div className="lkdv-post-media-wrap">
        <div
          className="lkdv-post-media"
          role="button"
          tabIndex={inert ? -1 : 0}
          aria-label={liked ? "Retirer mon j'aime" : "J'aime cette publication"}
          aria-pressed={liked}
          aria-disabled={inert || undefined}
          inert={inert}
          onClick={(event) => {
            event.stopPropagation();
            if (shouldIgnoreClick?.()) return;
            activateLike();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onLike();
          }}
          data-media-error={failed ? 'true' : undefined}
        >
          {failed ? (
            <span className="lkdv-post-media-fallback" role="img" aria-label="Média indisponible">
              <ImageOff size={30} aria-hidden="true" />
            </span>
          ) : isVideo && interactiveVideo ? (
            <InteractivePostVideo src={media} poster={optimizedPoster} label={mediaLabel} onRatio={onRatio} />
          ) : isVideo ? (
            <G01VideoPlayer
              src={media}
              poster={optimizedPoster ?? null}
              preferences={videoPreferences}
              audienceAllowed
              ariaLabel={mediaLabel}
            />
          ) : (
            // Même rendu, mais l'optimiseur sert une largeur adaptée (AVIF/WebP)
            // au lieu du JPEG 1600 px d'origine. Les dimensions 1080×1440
            // réservent la place avant chargement (CLS 0).
            <Image
              src={media}
              alt={mediaLabel}
              width={1080}
              height={1440}
              sizes="(max-width: 544px) calc(100vw - 24px), 496px"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              draggable={false}
              ref={(el) => {
                // Image déjà en cache avant l'hydratation : `onLoad` ne partirait pas.
                if (el && el.complete && el.naturalWidth && el.naturalHeight) onRatio?.(el.naturalWidth / el.naturalHeight);
              }}
              onLoad={(event) => {
                const el = event.currentTarget;
                if (el.naturalWidth && el.naturalHeight) onRatio?.(el.naturalWidth / el.naturalHeight);
              }}
              onError={() => setFailed(true)}
            />
          )}
          <AnimatePresence>
            {effectiveBurst > 0 ? (
              <motion.span
                key={effectiveBurst}
                className="lkdv-post-heart-burst"
                aria-hidden="true"
                initial={{ scale: 0.25, opacity: 0, rotate: -14 }}
                animate={{
                  scale: [0.25, 1.38, 0.94, 1.1, 1.18],
                  opacity: [0, 1, 1, 0.9, 0],
                  rotate: [-14, 10, -5, 0, 0],
                }}
                exit={{ opacity: 0, scale: 1.25 }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.span
                  initial={{ scale: 0.5, opacity: 0.9 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: 'absolute',
                    inset: -8,
                    borderRadius: '999px',
                    border: '3px solid rgba(255, 255, 255, 0.85)',
                    pointerEvents: 'none',
                  }}
                />
                <LikeIcon plain size={84} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {nav ? (
          <>
            <button type="button" className="lkdv-post-media-nav is-left" aria-label="Moment précédent" onClick={(event) => { event.stopPropagation(); nav.onChange((nav.index - 1 + nav.count) % nav.count); }}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="lkdv-post-media-nav is-right" aria-label="Moment suivant" onClick={(event) => { event.stopPropagation(); nav.onChange((nav.index + 1) % nav.count); }}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <span className="lkdv-post-media-count">{nav.index + 1}/{nav.count}</span>
          </>
        ) : null}
        <EngagementBar
          likesCount={likesCount}
          commentsCount={commentsCount}
          sharesCount={sharesCount}
          liked={liked}
          onLike={triggerLikeWithAnim}
          onComment={onComment}
          onShare={onShare}
        />
      </div>
    </div>
  );
}

export default CommunityPostMedia;
