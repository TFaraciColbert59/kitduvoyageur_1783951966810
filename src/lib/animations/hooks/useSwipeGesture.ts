import { useState } from 'react';

export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 100
) {
  const [startX, setStartX] = useState(0);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => setStartX(e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diff = endX - startX;

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && onSwipeRight) onSwipeRight();
        if (diff < 0 && onSwipeLeft) onSwipeLeft();
      }
    }
  };

  return handlers;
}
