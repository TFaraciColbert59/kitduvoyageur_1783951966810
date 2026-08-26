"use client";

import { useCallback } from "react";
import { triggerNativeHaptic, HapticStyle } from "@/lib/native/haptics";

export function useHapticFeedback() {
  const haptic = useCallback((style: HapticStyle) => {
    triggerNativeHaptic(style);
  }, []);

  return {
    haptic,
    triggerHaptic: haptic,
    vibrate: (pattern: number | number[]) => {
      triggerNativeHaptic("light");
    },
  };
}
