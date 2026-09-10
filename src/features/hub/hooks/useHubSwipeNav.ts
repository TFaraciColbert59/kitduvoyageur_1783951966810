'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { hubSectionHref, type HubAdventureRef } from '../registry/hubSectionRegistry';
import type { HubSectionId } from '../engine/hubProfileEngine';
import { nextSwipeSection } from '../mobile/hubSwipeEngine';

/**
 * Navigation par swipe du hub (mobile) : swipe vers la droite → section
 * suivante dans l'ordre du registre ; vers la gauche → retour simple.
 * Les zones interactives (carte Leaflet, rails horizontaux, dialogues,
 * contrôles de formulaire, barre d'onglets) sont ignorées.
 */

const IGNORE_SELECTOR = [
  '[data-swipe-ignore]',
  '.leaflet-container',
  '.hub-hscroll',
  '[role="dialog"]',
  'nav',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
].join(', ');

const MIN_DX = 70;
const MAX_DY = 60;
const DIRECTION_RATIO = 1.6;

export interface UseHubSwipeNavOptions {
  enabled: boolean;
  sections: HubSectionId[];
  activeSection: HubSectionId | null;
  ref: HubAdventureRef;
}

export function useHubSwipeNav({ enabled, sections, activeSection, ref }: UseHubSwipeNavOptions) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const gesture = useRef({ x: 0, y: 0, tracking: false });
  const data = useRef({ sections, activeSection, ref });

  useEffect(() => {
    data.current = { sections, activeSection, ref };
  }, [sections, activeSection, ref]);

  useEffect(() => {
    if (!enabled) return;

    const isIgnored = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(IGNORE_SELECTOR);

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isIgnored(event.target)) {
        gesture.current.tracking = false;
        return;
      }
      const touch = event.touches[0];
      gesture.current = { x: touch.clientX, y: touch.clientY, tracking: true };
    };

    const onEnd = (event: TouchEvent) => {
      if (!gesture.current.tracking) return;
      const startX = gesture.current.x;
      const startY = gesture.current.y;
      gesture.current.tracking = false;

      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (
        Math.abs(dx) < MIN_DX ||
        Math.abs(dy) > MAX_DY ||
        Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO
      ) {
        return;
      }

      triggerHaptic('light');

      if (dx < 0) {
        router.back();
        return;
      }

      const target = nextSwipeSection(data.current.sections, data.current.activeSection);
      if (target) {
        router.push(hubSectionHref(data.current.ref, target as HubSectionId));
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true, capture: true });
    window.addEventListener('touchend', onEnd, { passive: true, capture: true });
    return () => {
      window.removeEventListener('touchstart', onStart, { capture: true });
      window.removeEventListener('touchend', onEnd, { capture: true });
    };
  }, [enabled, router, triggerHaptic]);
}
