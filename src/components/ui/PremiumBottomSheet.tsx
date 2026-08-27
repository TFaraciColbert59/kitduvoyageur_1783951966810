'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface PremiumBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: ('peek' | 'half' | 'full')[];
  defaultSnap?: 'peek' | 'half' | 'full';
  showHandle?: boolean;
  className?: string;
}

const SNAP_HEIGHTS = {
  peek: '30dvh',
  half: '55dvh',
  full: '92dvh',
};

export default function PremiumBottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = ['half', 'full'],
  defaultSnap = 'half',
  showHandle = true,
  className = '',
}: PremiumBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentSnap(defaultSnap);
      setDragOffset(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, defaultSnap]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startOffset.current = dragOffset;
    setIsDragging(true);
  }, [dragOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    setDragOffset(Math.max(0, delta));
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const threshold = 80;

    if (dragOffset > threshold) {
      const currentIndex = snapPoints.indexOf(currentSnap);
      if (currentIndex === 0) {
        onClose();
      } else {
        setCurrentSnap(snapPoints[currentIndex - 1]);
      }
    } else if (dragOffset < -threshold) {
      const currentIndex = snapPoints.indexOf(currentSnap);
      if (currentIndex < snapPoints.length - 1) {
        setCurrentSnap(snapPoints[currentIndex + 1]);
      }
    }
    setDragOffset(0);
  }, [dragOffset, currentSnap, snapPoints, onClose]);

  if (!isOpen) return null;

  const height = SNAP_HEIGHTS[currentSnap];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(14,21,18,0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 200ms ease both',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panneau'}
        className={`fixed left-0 right-0 bottom-0 z-50 flex flex-col ${className}`}
        style={{
          height,
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'height 400ms cubic-bezier(0.16,1,0.3,1), transform 400ms cubic-bezier(0.16,1,0.3,1)',
          background: 'rgba(237,234,224,0.96)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -4px 40px rgba(14,21,18,0.18), 0 -1px 0 rgba(255,255,255,0.5)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          animation: 'slideUp 400ms cubic-bezier(0.16,1,0.3,1) both',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        {showHandle && (
          <div
            className="flex items-center justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing"
            aria-hidden="true"
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(23,64,44,0.18)',
              }}
            />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
            <h2
              className="font-display font-bold text-[#17402C]"
              style={{ fontSize: '18px', letterSpacing: '-0.02em' }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="flex items-center justify-center w-11 h-11 rounded-full haptic-press cursor-pointer"
              style={{ background: 'rgba(23,64,44,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#17402C" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
          {children}
        </div>
      </div>
    </>
  );
}
