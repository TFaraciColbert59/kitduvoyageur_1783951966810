'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSwipe } from '@/hooks/useSwipe';
import { useDragDismiss } from '@/hooks/gestures';
import Icon from '@/components/ui/AppIcon';

interface ExplorerStory {
  id: string;
  name: string;
  avatar: string;
  location: string;
  altitude?: number;
  timeAgo: string;
  status: string;
  storyImage: string;
  hasUnseenStory?: boolean;
}

const DEFAULT_STORIES: ExplorerStory[] = [
  {
    id: 's-1',
    name: 'Marceline',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200',
    location: 'Charmant Som',
    altitude: 1867,
    timeAgo: 'Il y a 35 min',
    status: '⛺ Bivouac sous les étoiles',
    storyImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-2',
    name: 'Antoine',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200',
    location: 'Col Vert · Vercors',
    altitude: 1766,
    timeAgo: 'Il y a 1h',
    status: '☕ Pause réchaud au col',
    storyImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-3',
    name: 'Léna',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200',
    location: 'Lac Blanc · Belledonne',
    altitude: 2150,
    timeAgo: 'Il y a 2h',
    status: '🏔️ Arrivée au refuge',
    storyImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    hasUnseenStory: true,
  },
  {
    id: 's-4',
    name: 'Julien',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200',
    location: 'Aiguilles Rouges',
    altitude: 2352,
    timeAgo: 'Il y a 3h',
    status: '🦅 Observation gypaète',
    storyImage: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?q=80&w=1200',
    hasUnseenStory: false,
  },
  {
    id: 's-5',
    name: 'Camille',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df0?q=80&w=200',
    location: 'Pointe Percée',
    altitude: 2750,
    timeAgo: 'Il y a 4h',
    status: '🥾 Crêtes aériennes',
    storyImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200',
    hasUnseenStory: false,
  },
];

const STORY_DURATION_MS = 5000;
const TAP_MAX_MS = 400;
const TAP_MAX_DIST_PX = 15;

/* ───────────────────────────────────────────────────────────────────────────
 * StoryViewer plein écran (mission gestes, Phase 5) — remplace l'ancien
 * modal fermé au clic. Gestes niveau Instagram :
 *   • tap zone droite / gauche → story suivante / précédente
 *   • appui maintenu → pause de l'auto-advance
 *   • swipe vertical vers le bas → fermeture élastique (useDragDismiss)
 *   • swipe horizontal → utilisateur suivant / précédent (useSwipe)
 *   • barre de progression réelle + auto-advance 5s
 * Palette LKDV : noir + blanc sur l'image, accents Sage/Stone pour les pills.
 * ──────────────────────────────────────────────────────────────────────── */
function StoryViewer({
  stories,
  index,
  onClose,
  onIndexChange,
}: {
  stories: ExplorerStory[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const { haptic } = useHapticFeedback();
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [direction, setDirection] = useState(0);

  const downRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const progressRef = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current = holding;
  const rafRef = useRef<number | null>(null);

  const story = stories[index];

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) {
        onClose();
        return;
      }
      if (next >= stories.length) {
        onClose();
        return;
      }
      setDirection(next > index ? 1 : -1);
      progressRef.current = 0;
      setProgress(0);
      onIndexChange(next);
    },
    [index, stories.length, onClose, onIndexChange]
  );

  // Auto-advance : boucle rAF, pause pendant l'appui maintenu.
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        progressRef.current += dt / STORY_DURATION_MS;
        if (progressRef.current >= 1) {
          haptic('light');
          goTo(index + 1);
          return; // l'effet se relance sur le changement d'index
        }
        setProgress(progressRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [index, goTo, haptic]);

  // Lock scroll + clavier (desktop : ← → Échap).
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') { haptic('light'); goTo(index + 1); }
      if (e.key === 'ArrowLeft') { haptic('light'); goTo(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, goTo, index, haptic]);

  // Swipe horizontal → utilisateur suivant / précédent.
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { haptic('light'); goTo(index + 1); },
    onSwipeRight: () => { haptic('light'); goTo(index - 1); },
  }, { threshold: 60 });

  // Swipe vertical bas → fermeture élastique (physique framer-motion).
  const { dragProps, y } = useDragDismiss({
    onDismiss: onClose,
    mode: 'element',
    threshold: 90,
  });

  // Appui maintenu = pause ; relâchement bref = navigation par zone.
  const handlePointerDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    setHolding(true);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setHolding(false);
    const down = downRef.current;
    downRef.current = null;
    if (!down) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const held = Date.now() - down.at;
    // Hold ou swipe → pas de navigation (le hold a déjà mis en pause,
    // le swipe horizontal/vertical a déjà été traité).
    if (held >= TAP_MAX_MS || dist > TAP_MAX_DIST_PX) return;
    // Zone IG : 40 % gauche = précédent, 60 % droite = suivant.
    haptic('light');
    goTo(e.clientX < window.innerWidth * 0.4 ? index - 1 : index + 1);
  };

  if (!story) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md select-none"
      style={{ y }}
      {...dragProps}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setHolding(false)}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label={`Story de ${story.name}`}
    >
      {/* Image plein écran — transition horizontale entre utilisateurs */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={story.id}
          className="absolute inset-0"
          initial={reduceMotion ? { opacity: 0 } : { x: direction * 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { x: direction * -60, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- sources Unsplash distantes */}
          <img
            src={story.storyImage}
            alt={`Story de ${story.name}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />
        </motion.div>
      </AnimatePresence>

      {/* Conteneur gestes touch (swipe horizontal) — au-dessus de l'image,
          sous l'UI cliquable */}
      <div className="absolute inset-0" {...swipeHandlers} />

      {/* Top : barre de progression + header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 space-y-2.5" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        {/* Barre de progression réelle (une story par utilisateur) */}
        <div className="flex gap-1" aria-hidden="true">
          <div className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: `${Math.min(progress * 100, 100)}%`, transition: holding ? 'none' : 'width 100ms linear' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- sources Unsplash distantes */}
            <img
              src={story.avatar}
              alt=""
              className="w-9 h-9 rounded-full object-cover border-2 border-white"
            />
            <div>
              <span className="text-xs font-bold text-white block">{story.name}</span>
              <span className="text-[10px] text-white/80 font-mono">{story.timeAgo}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {holding && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-mono font-bold text-white">
                ⏸ PAUSE
              </span>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center font-bold text-sm hover:bg-black/60 transition-colors"
              aria-label="Fermer les stories"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Zones tap invisibles (repères a11y ; la navigation réelle passe par
          handlePointerUp pour coexister avec hold/swipe) */}
      <button type="button" className="absolute left-0 top-0 bottom-0 w-2/5 opacity-0 pointer-events-none" aria-label="Story précédente" tabIndex={-1} />
      <button type="button" className="absolute right-0 top-0 bottom-0 w-3/5 opacity-0 pointer-events-none" aria-label="Story suivante" tabIndex={-1} />

      {/* Bottom : caption */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 space-y-2 text-white" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-mono font-bold text-white">
            📍 {story.location}
          </span>
          {story.altitude && (
            <span className="px-2 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-mono font-bold text-[#D7E8D5]">
              ⛰️ {story.altitude}m
            </span>
          )}
        </div>
        <p className="font-display font-bold text-sm leading-snug">
          {story.status}
        </p>
      </div>
    </motion.div>
  );
}

export default function CommunityStoriesBar({ currentUser }: { currentUser?: any }) {
  const [stories, setStories] = useState<ExplorerStory[]>(DEFAULT_STORIES);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleOpenStory = (story: ExplorerStory) => {
    const idx = stories.findIndex((s) => s.id === story.id);
    if (idx === -1) return;
    setActiveIndex(idx);
    setStories((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, hasUnseenStory: false } : s))
    );
  };

  return (
    <>
      <div className="glass p-3 rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xs">
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1">
          {/* Add story button for current user */}
          <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#17402C]/30 group-hover:border-[#17402C] bg-white/70 flex items-center justify-center transition-all">
              <span className="w-8 h-8 rounded-full bg-[#17402C] text-white flex items-center justify-center text-sm font-bold shadow-xs">
                +
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#17402C] truncate max-w-[64px]">
              En direct
            </span>
          </div>

          {/* Explorer stories */}
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => handleOpenStory(story)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group text-center"
            >
              <div
                className={`p-0.5 rounded-full transition-transform duration-300 group-hover:scale-105 ${
                  story.hasUnseenStory
                    ? 'bg-gradient-to-tr from-emerald-600 via-teal-400 to-amber-300'
                    : 'bg-black/10'
                }`}
              >
                <div className="p-0.5 bg-white rounded-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- sources Unsplash distantes */}
                  <img
                    src={story.avatar}
                    alt={story.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#17402C] truncate max-w-[64px]">
                {story.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Story Viewer plein écran */}
      {activeIndex !== null && (
        <StoryViewer
          stories={stories}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      )}
    </>
  );
}
