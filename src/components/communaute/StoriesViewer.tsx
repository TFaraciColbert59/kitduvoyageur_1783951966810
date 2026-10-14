'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/AppIcon'
import { IconButton } from '@/components/ui';

export interface StorySlide {
  image: string;
  caption?: string;
  storyId?: string;
  /** Stories V2 : type de média (défaut image). */
  mediaType?: 'image' | 'video';
  /** Durée annoncée (vidéo) — la progression réelle utilise le média. */
  durationMs?: number;
}

export interface StoryUser {
  id: string;
  name: string;
  avatarUrl?: string;
  time?: string;
  slides: StorySlide[];
}

const STORY_DURATION_MS = 5000;
const SWIPE_CLOSE_PX = 110;
const SWIPE_NAV_PX = 60;
const TAP_MS = 350;
const VIEW_RECORD_MS = 1000;

/**
 * Visionneur de stories plein écran, gestes façon Instagram :
 * - tape à gauche/droite = story précédente/suivante
 * - swipe horizontal = navigation ; swipe vers le bas = fermeture
 * - maintien = pause ; Espace = pause/lecture ; Échap = fermer
 *
 * Fiabilité (Stories V2, phase 02) :
 * - un seul arbitre d'avancement (`advancingRef`) : fin de vidéo et timer ne
 *   peuvent pas déclencher deux passages ;
 * - progression requestAnimationFrame (photos) / timeupdate (vidéos) : pause au
 *   point exact (maintien, Espace, onglet masqué, buffering, erreur média,
 *   overlay de reprise) et reprise au même endroit ;
 * - média cassé → « Média indisponible » + Ignorer (jamais d'écran blanc) ;
 * - vidéo : playsinline, muet au démarrage (préférence session), bouton son
 *   textuel (« Son » / « Muet » — aucun nom d'icône hors registre).
 *
 * Social (phases 04/05) : vue enregistrée après 1 s d'affichage réel (jamais
 * ma propre story), like idempotent (état fourni par la barre).
 */
export default function StoriesViewer({
  users,
  startUser,
  onClose,
  onReport,
  onBlock,
  onDelete,
  onView,
  onToggleLike,
  likedStoryIds,
  myUserId,
}: {
  users: StoryUser[];
  startUser: number;
  onClose: () => void;
  onReport?: (user: StoryUser, slide: StorySlide) => void;
  onBlock?: (user: StoryUser) => void;
  onDelete?: (slide: StorySlide) => void;
  onView?: (slide: StorySlide) => void;
  onToggleLike?: (slide: StorySlide, liked: boolean) => void;
  likedStoryIds?: ReadonlySet<string>;
  myUserId?: string;
}) {
  const [userIndex, setUserIndex] = useState(startUser);
  const [slideIndex, setSlideIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hiddenTab, setHiddenTab] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [muted, setMuted] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragOpacity, setDragOpacity] = useState(1);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startT: 0 });
  const viewerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const advancingRef = useRef(false);

  const user = users[userIndex];
  const slide = user?.slides[slideIndex];
  const isVideo = slide?.mediaType === 'video';
  const liked = Boolean(slide?.storyId && likedStoryIds?.has(slide.storyId));
  const paused = holding || pinned || hiddenTab || mediaError || needsTap;

  const next = useCallback(() => {
    if (!users.length || advancingRef.current) return;
    advancingRef.current = true;
    if (slideIndex < user.slides.length - 1) {
      setSlideIndex((i) => i + 1);
    } else if (userIndex < users.length - 1) {
      setUserIndex((u) => u + 1);
      setSlideIndex(0);
    } else {
      onClose();
    }
  }, [slideIndex, userIndex, user, users, onClose]);

  const prev = useCallback(() => {
    if (!users.length) return;
    if (slideIndex > 0) {
      setSlideIndex((i) => i - 1);
    } else if (userIndex > 0) {
      setUserIndex((u) => u - 1);
      setSlideIndex(users[userIndex - 1].slides.length - 1);
    }
  }, [slideIndex, userIndex, users]);

  /* Clavier + onglet masqué + verrou du scroll du fond */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        setPinned((p) => !p);
      }
    };
    const onVis = () => setHiddenTab(document.hidden);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  /* Focus : entrée dans le dialogue, restitution au déclencheur */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    viewerRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  /* Réinitialisation progression + verrou à chaque slide */
  useEffect(() => {
    advancingRef.current = false;
    progressRef.current = 0;
    setProgress(0);
    setMediaError(false);
    setBuffering(false);
    setNeedsTap(false);
  }, [userIndex, slideIndex]);

  /* Photo : progression requestAnimationFrame (pausable au point exact) */
  useEffect(() => {
    if (!slide || isVideo || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const value = Math.min(1, progressRef.current + dt / STORY_DURATION_MS);
      progressRef.current = value;
      setProgress(value);
      if (value >= 1) {
        next();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slide, isVideo, paused, next, userIndex, slideIndex]);

  /* Vidéo : lecture/pause selon l'état (autoplay refusé → bouton de reprise) */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => setNeedsTap(true));
    }
  }, [paused, isVideo, userIndex, slideIndex]);

  /* Vue enregistrée après 1 s d'affichage réel (jamais ma propre story). */
  useEffect(() => {
    if (!onView || !slide?.storyId) return;
    if (myUserId && user?.id === myUserId) return;
    const timer = window.setTimeout(() => onView(slide), VIEW_RECORD_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement par slide
  }, [onView, slide?.storyId, user?.id, myUserId, userIndex, slideIndex]);

  /* Préférence de son (session uniquement, jamais de surprise sonore) */
  useEffect(() => {
    try {
      setMuted(sessionStorage.getItem('lkv.stories.muted') !== '0');
    } catch {
      /* sessionStorage indisponible */
    }
  }, []);
  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    try {
      sessionStorage.setItem('lkv.stories.muted', nextMuted ? '1' : '0');
    } catch {
      /* ignoré */
    }
  };

  /* Préchargement de la prochaine image (jamais les vidéos) */
  useEffect(() => {
    if (!user) return;
    const nextSlide =
      slideIndex < user.slides.length - 1
        ? user.slides[slideIndex + 1]
        : users[userIndex + 1]?.slides[0];
    if (nextSlide && nextSlide.mediaType !== 'video') {
      const img = new Image();
      img.src = nextSlide.image;
    }
  }, [user, slideIndex, userIndex, users]);

  const handleTabTrap = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusables = viewerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!user || !slide) return null;

  /* ---------- Gestes pointeur ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, startT: Date.now() };
    setHolding(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dy = e.clientY - dragRef.current.startY;
    if (dy > 0) {
      setDragY(dy);
      setDragOpacity(Math.max(0.25, 1 - dy / 420));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const { startX, startY, startT } = dragRef.current;
    dragRef.current.active = false;
    setHolding(false);

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dt = Date.now() - startT;

    if (Math.abs(dy) > SWIPE_CLOSE_PX) {
      setDragY(dy > 0 ? 900 : 0);
      setDragOpacity(0);
      window.setTimeout(onClose, 190);
      return;
    }
    setDragY(0);
    setDragOpacity(1);

    if (Math.abs(dx) > SWIPE_NAV_PX) {
      if (dx < 0) next();
      else prev();
      return;
    }
    if (dt < TAP_MS && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const w = window.innerWidth;
      if (e.clientX < w * 0.3) prev();
      else if (e.clientX > w * 0.7) next();
    }
  };

  const viewer = (
    <div
      ref={viewerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${user.name}`}
      tabIndex={-1}
      onKeyDown={handleTabTrap}
      className="fixed inset-0 z-[var(--z-modal)] touch-none select-none bg-black"
      style={{ opacity: dragOpacity }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current.active = false;
        setHolding(false);
        setDragY(0);
        setDragOpacity(1);
      }}
    >
      <div className="absolute inset-0" style={{ transform: `translateY(${dragY}px)` }}>
        {isVideo ? (
          <video
            key={`${userIndex}-${slideIndex}`}
            ref={videoRef}
            src={slide.image}
            playsInline
            muted={muted}
            autoPlay
            preload="auto"
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) {
                const value = Math.min(1, v.currentTime / v.duration);
                progressRef.current = value;
                setProgress(value);
              }
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => {
              setBuffering(false);
              setNeedsTap(false);
            }}
            onEnded={next}
            onError={() => setMediaError(true)}
          />
        ) : (
          <img
            key={`${userIndex}-${slideIndex}`}
            src={slide.image}
            alt={`Story de ${user.name}`}
            draggable={false}
            className="h-full w-full object-cover"
            onError={() => setMediaError(true)}
          />
        )}

        {/* Voiles de lisibilité */}
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent"
          aria-hidden="true"
        />

        {/* Progression */}
        <div
          className="absolute inset-x-0 top-0 z-[var(--z-sticky)] flex gap-1 px-[var(--space-3)] pt-[max(var(--space-3),var(--safe-top))]"
          aria-hidden="true"
        >
          {user.slides.map((_, i) => (
            <span
              key={`${userIndex}-${i}`}
              className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              {i < slideIndex && <span className="absolute inset-y-0 left-0 w-full bg-white" />}
              {i === slideIndex && (
                <span
                  className="absolute inset-y-0 left-0 bg-white"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              )}
            </span>
          ))}
        </div>

        {/* En-tête : auteur + actions */}
        <div className="absolute inset-x-0 top-0 z-[var(--z-sticky)] flex items-center justify-between gap-[var(--space-3)] px-[var(--space-4)] pt-[max(var(--space-6),calc(var(--safe-top)+var(--space-4)))]">
          <span className="flex min-w-0 items-center gap-[var(--space-2)]">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar distant (même URL que le reste de l'app)
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-[length:var(--lkv-text-subheadline)] font-semibold text-white backdrop-blur-md">
                {user.name.charAt(0)}
              </span>
            )}
            <span className="truncate text-[length:var(--lkv-text-subheadline)] font-semibold text-white">
              {user.name}
            </span>
            {user.time && (
              // P2 — blanc 90 % sur voile haut (≥4.5, plus de white/70)
              <span className="shrink-0 text-[length:var(--lkv-text-caption-2)] text-white/90">
                {user.time}
              </span>
            )}
          </span>
          <span className="flex items-center gap-[var(--space-1)]">
            {/* Phases 04/05 : like sans quitter le visionneur. */}
            {onToggleLike && user.id !== myUserId && slide.storyId && (
              <IconButton
                type="button"
                variant="glass"
                className="bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
                aria-label={liked ? "Retirer mon j'aime" : 'Aimer cette story'}
                aria-pressed={liked}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(slide, liked);
                }}
              >
                <Icon name="heart" size={16} color={liked ? '#f43f5e' : 'var(--lkv-text-inverted)'} />
              </IconButton>
            )}
            {/* A-144 : signaler et bloquer sans quitter le visionneur. */}
            {onDelete && myUserId && user.id === myUserId && slide.storyId && (
              <IconButton
                type="button"
                variant="glass"
                className="bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
                aria-label="Retirer ma story"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(slide);
                }}
              >
                <Icon name="trash2" size={16} color="var(--lkv-text-inverted)" />
              </IconButton>
            )}
            {onReport && user.id !== myUserId && (
              <IconButton
                type="button"
                variant="glass"
                className="bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
                aria-label={`Signaler la story de ${user.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onReport(user, slide);
                }}
              >
                <Icon name="flag" size={16} color="var(--lkv-text-inverted)" />
              </IconButton>
            )}
            {onBlock && user.id !== myUserId && (
              <IconButton
                type="button"
                variant="glass"
                className="bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
                aria-label={`Bloquer ${user.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onBlock(user);
                }}
              >
                <Icon name="user-minus" size={16} color="var(--lkv-text-inverted)" />
              </IconButton>
            )}
            <IconButton
              type="button"
              variant="glass"
              className="bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
              aria-label="Fermer les stories"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <Icon name="x" size={18} color="var(--lkv-text-inverted)" />
            </IconButton>
          </span>
        </div>

        {/* Buffering vidéo : pastille discrète, la progression est gelée par
            l'absence de timeupdate. */}
        {isVideo && buffering && !mediaError && (
          <span
            className="absolute left-1/2 top-1/2 z-[var(--z-sticky)] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full bg-black/50 text-[length:var(--lkv-text-caption-2)] text-white backdrop-blur-md"
            aria-live="polite"
          >
            …
          </span>
        )}

        {/* Autoplay refusé : reprise explicite au tap */}
        {needsTap && !mediaError && (
          <button
            type="button"
            aria-label="Lancer la lecture"
            className="absolute inset-0 z-[var(--z-sticky)] flex items-center justify-center bg-black/40"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setNeedsTap(false);
            }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
              <Icon name="play" size={28} color="var(--lkv-text-inverted)" />
            </span>
          </button>
        )}

        {/* Média cassé : jamais d'écran blanc */}
        {mediaError && (
          <div className="absolute inset-0 z-[var(--z-sticky)] flex flex-col items-center justify-center gap-[var(--space-3)] bg-black/75 p-[var(--space-6)] text-center">
            <Icon name="image-off" size={28} color="var(--lkv-text-inverted)" />
            <p className="text-[length:var(--lkv-text-body-sm)] text-white">Média indisponible</p>
            <button
              type="button"
              className="rounded-full bg-white/15 px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] font-semibold text-white backdrop-blur-md"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              Ignorer
            </button>
          </div>
        )}

        {/* Son (vidéo uniquement) — jamais de surprise sonore. Bouton textuel :
            aucun nom d'icône hors registre LKDV (Gate 0). */}
        {isVideo && !mediaError && (
          <button
            type="button"
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute bottom-[max(var(--space-8),calc(var(--safe-bottom)+var(--space-6)))] right-[var(--space-4)] z-[var(--z-sticky)] flex h-10 items-center justify-center rounded-full bg-black/40 px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-semibold text-white backdrop-blur-md"
          >
            {muted ? 'Son' : 'Muet'}
          </button>
        )}

        {/* Légende */}
        {slide.caption && (
          <p className="absolute inset-x-0 bottom-0 z-[var(--z-sticky)] px-[var(--space-4)] pb-[max(var(--space-8),calc(var(--safe-bottom)+var(--space-6)))] pr-[64px] text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-snug)] text-white">
            <strong>{user.name}</strong> {slide.caption}
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}
