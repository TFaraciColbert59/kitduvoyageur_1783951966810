'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/AppIcon'
import { IconButton } from '@/components/ui';

export interface StorySlide {
  image: string;
  caption?: string;
}

export interface StoryUser {
  id: string;
  name: string;
  time?: string;
  slides: StorySlide[];
}

const STORY_DURATION_MS = 5000;
const SWIPE_CLOSE_PX = 110;
const SWIPE_NAV_PX = 60;
const TAP_MS = 350;

/**
 * Visionneur de stories plein écran, gestes façon Instagram :
 * - tape à gauche/droite = story précédente/suivante
 * - swipe horizontal = navigation
 * - swipe vers le bas = fermeture (le contenu suit le doigt)
 * - maintien = pause de l'avance automatique
 * - Échap / flèches clavier = fermer / naviguer
 */
export default function StoriesViewer({
  users,
  startUser,
  onClose,
}: {
  users: StoryUser[];
  startUser: number;
  onClose: () => void;
}) {
  const [userIndex, setUserIndex] = useState(startUser);
  const [slideIndex, setSlideIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragOpacity, setDragOpacity] = useState(1);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startT: 0 });

  const user = users[userIndex];
  const slide = user?.slides[slideIndex];

  const next = useCallback(() => {
    if (!users.length) return;
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

  /* Clavier + verrou du scroll du fond + préférence de mouvement */
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

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
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${user.name}`}
      className="story-viewer"
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
      <div className="story-stage" style={{ transform: `translateY(${dragY}px)` }}>
        <img
          key={`${userIndex}-${slideIndex}`}
          src={slide.image}
          alt=""
          draggable={false}
          className="story-media-img"
        />

        {/* Voiles de lisibilité */}
        <div className="story-scrim story-scrim--top" aria-hidden="true" />
        <div className="story-scrim story-scrim--bottom" aria-hidden="true" />

        {/* Progression */}
        <div className="story-progress" aria-hidden="true">
          {user.slides.map((_, i) => (
            <span key={`${userIndex}-${i}`} className={`story-progress-seg ${i < slideIndex ? 'story-progress-seg--done' : ''}`}>
              {i === slideIndex && !reducedMotion && (
                <span
                  key={`fill-${userIndex}-${slideIndex}`}
                  className="story-progress-fill"
                  style={{ animationPlayState: holding ? 'paused' : 'running' }}
                  onAnimationEnd={next}
                />
              )}
            </span>
          ))}
        </div>

        {/* En-tête : auteur + fermeture */}
        <div className="story-header">
          <span className="story-header-user">
            <span className="story-avatar story-avatar--sm">{user.name.charAt(0)}</span>
            <span className="story-header-name">{user.name}</span>
            {user.time && <span className="story-header-time">{user.time}</span>}
          </span>
          <IconButton
            type="button"
            variant="glass"
            className="absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-sticky)] bg-black/40 text-white active:scale-[var(--motion-press-scale)]"
            aria-label="Fermer les stories"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <Icon name="x" size={18} color="var(--lkv-text-inverted)" />
          </IconButton>
        </div>

        {/* Légende */}
        {slide.caption && (
          <p className="story-caption">
            <strong>{user.name}</strong> {slide.caption}
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}
