'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [ringPosition, setRingPosition] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const isVisibleRef = useRef(false);

  useEffect(() => {
    // Detect if device supports touch/coarse pointer
    if (typeof window !== 'undefined') {
      const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
      if (touchQuery.matches || 'ontouchstart' in window) {
        setIsTouchDevice(true);
        return;
      }
    }

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
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden select-none">
      {/* Outer Smooth Lag Ring */}
      <div
        className={`fixed top-0 left-0 rounded-full border transition-all duration-200 ease-out ${
          isHovered
            ? 'w-11 h-11 bg-[#2D6A4F]/15 border-[#2D6A4F]/60 backdrop-blur-[1px] scale-110'
            : isClicked
            ? 'w-7 h-7 bg-[#2D6A4F]/30 border-[#2D6A4F]/80 scale-90'
            : 'w-8 h-8 bg-[#2D6A4F]/08 border-[#2D6A4F]/35'
        }`}
        style={{
          transform: `translate3d(${ringPosition.x}px, ${ringPosition.y}px, 0) translate(-50%, -50%)`,
        }}
      />

      {/* Inner Precision Center Dot */}
      <div
        className={`fixed top-0 left-0 rounded-full bg-[#1C2620] transition-transform duration-100 ease-out shadow-sm ${
          isHovered
            ? 'w-2.5 h-2.5 bg-[#2D6A4F] scale-125'
            : isClicked
            ? 'w-1.5 h-1.5 bg-[#1C2620] scale-75'
            : 'w-2 h-2'
        }`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
        }}
      />
    </div>
  );
}
