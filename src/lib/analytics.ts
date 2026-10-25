'use client';

import { hasConsent } from '@/lib/cookieConsent';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, eventParams: Record<string, unknown> = {}) {
  // Ne jamais tracker sans consentement analytics explicite.
  if (typeof window === 'undefined' || !hasConsent('analytics')) return;
  if (!window.gtag) return;
  window.gtag('event', eventName, eventParams);
}
