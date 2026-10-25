'use client';

import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions {
  threshold?: number;
  preventDefault?: boolean;
}

export function useSwipe(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const { threshold = 50, preventDefault = false } = options;
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startX.current || !startY.current) return;
    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      isSwiping.current = true;
    }

    if (preventDefault && isSwiping.current) {
      e.preventDefault();
    }
  }, [preventDefault]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!startX.current || !startY.current) return;

    const deltaX = e.changedTouches[0].clientX - startX.current;
    const deltaY = e.changedTouches[0].clientY - startY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Only trigger if primary axis exceeds threshold
    if (absX > threshold && absX > absY) {
      if (deltaX > 0) handlers.onSwipeRight?.();
      else handlers.onSwipeLeft?.();
    } else if (absY > threshold && absY > absX) {
      if (deltaY > 0) handlers.onSwipeDown?.();
      else handlers.onSwipeUp?.();
    }

    startX.current = 0;
    startY.current = 0;
    isSwiping.current = false;
  }, [handlers, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
