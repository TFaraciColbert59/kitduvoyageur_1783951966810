'use client';

import { useCallback } from 'react';

type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  }, []);

  const haptic = useCallback((style: HapticStyle) => {
    switch (style) {
      case 'light':
        vibrate(10);
        break;
      case 'medium':
        vibrate(20);
        break;
      case 'heavy':
        vibrate(40);
        break;
      case 'selection':
        vibrate(8);
        break;
      case 'success':
        vibrate([10, 50, 20]);
        break;
      case 'warning':
        vibrate([20, 80, 20, 80, 20]);
        break;
      case 'error':
        vibrate([30, 60, 30, 60, 30]);
        break;
    }
  }, [vibrate]);

  return { haptic, vibrate };
}
