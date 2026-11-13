'use client';

/**
 * @fileoverview Hooks React pour les préférences d'accessibilité, annonces lecteur d'écran
 * et restauration du focus des drawers (Lot O02).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { announceToScreenReader, getSharedAnnouncer } from './announcer';
import { createFocusTrap } from './keyboard';
import {
  applyAccessibilityToDocument,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  loadAccessibilityPreferences,
  readSystemAccessibilityEnvironment,
  resetAccessibilityPreferences,
  resolveAccessibilityPreferences,
  saveAccessibilityPreferences,
  subscribeAccessibilityPreferences,
} from './preferences';
import type {
  AccessibilityPreferences,
  AnnouncementOptions,
  FocusTrapOptions,
  ResolvedAccessibilityPreferences,
  SystemAccessibilityEnvironment,
} from './types';

export function useSystemAccessibilityEnvironment(): SystemAccessibilityEnvironment {
  const [env, setEnv] = useState<SystemAccessibilityEnvironment>(() =>
    readSystemAccessibilityEnvironment(),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: more)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(forced-colors: active)'),
    ];

    const update = () => {
      setEnv(readSystemAccessibilityEnvironment());
    };

    update();
    for (const mq of queries) {
      mq.addEventListener?.('change', update);
    }

    return () => {
      for (const mq of queries) {
        mq.removeEventListener?.('change', update);
      }
    };
  }, []);

  return env;
}

export interface UseAccessibilityPreferencesResult {
  preferences: AccessibilityPreferences;
  resolved: ResolvedAccessibilityPreferences;
  updatePreferences: (partial: Partial<AccessibilityPreferences>) => void;
  resetPreferences: () => void;
}

export function useAccessibilityPreferences(options?: {
  applyToDocument?: boolean;
}): UseAccessibilityPreferencesResult {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() =>
    typeof window !== 'undefined'
      ? loadAccessibilityPreferences()
      : { ...DEFAULT_ACCESSIBILITY_PREFERENCES },
  );
  const systemEnv = useSystemAccessibilityEnvironment();

  useEffect(() => {
    setPreferences(loadAccessibilityPreferences());
    return subscribeAccessibilityPreferences((next) => {
      setPreferences(next);
    });
  }, []);

  const resolved = useMemo(
    () => resolveAccessibilityPreferences(preferences, systemEnv),
    [preferences, systemEnv],
  );

  useEffect(() => {
    if (options?.applyToDocument !== false) {
      applyAccessibilityToDocument(resolved);
    }
  }, [resolved, options?.applyToDocument]);

  const updatePreferences = useCallback((partial: Partial<AccessibilityPreferences>) => {
    const next = saveAccessibilityPreferences(partial);
    setPreferences(next);
  }, []);

  const resetPreferences = useCallback(() => {
    const next = resetAccessibilityPreferences();
    setPreferences(next);
  }, []);

  return {
    preferences,
    resolved,
    updatePreferences,
    resetPreferences,
  };
}

export function useReducedMotion(): boolean {
  const { resolved } = useAccessibilityPreferences({ applyToDocument: false });
  return resolved.reducedMotion;
}

export function useHighContrast(): boolean {
  const { resolved } = useAccessibilityPreferences({ applyToDocument: false });
  return resolved.highContrast;
}

export function useScreenReaderAnnouncer() {
  const announce = useCallback((message: string, options?: AnnouncementOptions) => {
    return announceToScreenReader(message, options);
  }, []);

  const clear = useCallback(() => {
    getSharedAnnouncer().clear();
  }, []);

  return { announce, clear };
}

export function useDrawerFocusRestoration(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {},
): void {
  const { onEscape, allowTabExit, initialFocus, restoreFocusTo } = options;

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const trap = createFocusTrap(containerRef.current, {
      onEscape,
      allowTabExit,
      initialFocus,
      restoreFocusTo,
    });
    trap.activate();
    return () => {
      trap.deactivate();
    };
  }, [isOpen, containerRef, onEscape, allowTabExit, initialFocus, restoreFocusTo]);
}
