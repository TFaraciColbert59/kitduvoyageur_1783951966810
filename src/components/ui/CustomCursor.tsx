'use client';

import React, { useEffect, useRef, useState } from 'react';

/** En dessous de cette largeur, l’app se lit comme sur un téléphone. */
export const MOBILE_VIEWPORT_MAX = 768;

export interface CursorSignals {
  hasTouch: boolean;
  isCoarsePointer: boolean;
  viewportWidth: number;
}

/**
 * Le curseur personnalise n’a de sens ni au doigt, ni dans une fenetre etroite.
 * Sans cette regle, une fenetre de bureau redimensionnee en largeur de
 * telephone garde un anneau flottant par-dessus le bouton principal.
 *
 * Regle pure, testee sans DOM : la decision ne depend que de ces trois signaux.
 */
export function shouldHideCustomCursor({
  hasTouch,
  isCoarsePointer,
  viewportWidth,
}: CursorSignals): boolean {
  return hasTouch || isCoarsePointer || viewportWidth <= MOBILE_VIEWPORT_MAX;
}

function readCursorSignals(): CursorSignals {
  if (typeof window === 'undefined') {
    return { hasTouch: true, isCoarsePointer: true, viewportWidth: 0 };
  }
  return {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isCoarsePointer: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    viewportWidth: window.innerWidth,
  };
}

export function useIsTouchDevice() {
  // true par defaut : rien ne s affiche tant que la mesure n’est pas faite.
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const measure = () => setHidden(shouldHideCustomCursor(readCursorSignals()));
    measure();
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, []);
  return hidden;
}

export function ConditionalCursor() {
  const isTouch = useIsTouchDevice();
  if (isTouch) return null;
  return <CustomCursor />;
}

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [ringPosition, setRingPosition] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(true);

  const isVisibleRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Ne démarre JAMAIS le rAF sur device tactile
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (isTouch) {
      setIsTouchDevice(true);
      return;
    }
    setIsTouchDevice(false);

    let animationFrameId: number;
    let targetX = -100;
    let targetY = -100;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      setPosition({ x: targetX, y: targetY });

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }

      // Check if mouse is hovering over any interactive element
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest('a, button, input, select, textarea, [role="button"], .cursor-pointer')
        );
        setIsHovered(isInteractive);
      }
    };

    const handleMouseDown = () => setIsClicked(true);
    const handleMouseUp = () => setIsClicked(false);
    const handleMouseLeave = () => {
      isVisibleRef.current = false;
      setIsVisible(false);
    };
    const handleMouseEnter = () => {
      isVisibleRef.current = true;
      setIsVisible(true);
    };

    // Smoothler ring lag loop
    let ringX = -100;
    let ringY = -100;

    const render = () => {
      // Lerp ring towards dot target position
      ringX += (targetX - ringX) * 0.2;
      ringY += (targetY - ringY) * 0.2;
      setRingPosition({ x: ringX, y: ringY });

      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.body.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.body.addEventListener('mouseenter', handleMouseEnter, { passive: true });

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (isTouchDevice || !isVisible || position.x < 0 || position.y < 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[var(--z-emergency)] overflow-hidden select-none">
      {/* Outer Smooth Lag Ring */}
      <div
        className={`fixed top-0 left-0 rounded-full border transition-all duration-200 ease-out ${
          isHovered
            ? 'w-11 h-11 bg-white/20 border-white/60 backdrop-blur-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.15)] scale-110'
            : isClicked
            ? 'w-7 h-7 bg-white/30 border-white/80 scale-90'
            : 'w-8 h-8 bg-white/10 border-white/40'
        }`}
        style={{
          transform: `translate3d(${ringPosition.x}px, ${ringPosition.y}px, 0) translate(-50%, -50%)`,
        }}
      />

      {/* Inner Precision Center Dot */}
      <div
        className={`fixed top-0 left-0 rounded-full bg-[color:var(--glass-label)] transition-transform duration-100 ease-out  ${
          isHovered
            ? 'w-2.5 h-2.5 bg-[color:var(--glass-label)] scale-125'
            : isClicked
            ? 'w-1.5 h-1.5 bg-[color:var(--glass-label)] scale-75'
            : 'w-2 h-2'
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
        }}
      />
    </div>
  );
}
