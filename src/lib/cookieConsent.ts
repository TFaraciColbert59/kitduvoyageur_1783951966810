'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Unique source of truth for cookie consent on Le Kit du Voyageur.
 * Persisted in localStorage under `lkdv_cookie_consent` (version '1').
 * A custom `cookieConsentUpdated` event is broadcast so every consumer
 * (banner, /cookies page, Google Analytics, Rocket tracker) stays in sync.
 */

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type StoredConsent = ConsentState & { version: string };

export const CONSENT_KEY = 'lkdv_cookie_consent';
export const CONSENT_VERSION = '1';

export function getStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (
      parsed &&
      typeof parsed.analytics === 'boolean' &&
      typeof parsed.marketing === 'boolean'
    ) {
      return { necessary: true, analytics: parsed.analytics, marketing: parsed.marketing, version: parsed.version || CONSENT_VERSION };
    }
    return null;
  } catch {
    return null;
  }
}

export function storeConsent(consent: ConsentState) {
  if (typeof window === 'undefined') return;
  const normalized: ConsentState = { necessary: true, analytics: consent.analytics, marketing: consent.marketing };
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ ...normalized, version: CONSENT_VERSION })
  );
  window.dispatchEvent(
    new CustomEvent<ConsentState>('cookieConsentUpdated', { detail: normalized })
  );
}

export function hasConsent(flag: 'analytics' | 'marketing'): boolean {
  if (typeof window === 'undefined') return false;
  const stored = getStoredConsent();
  if (!stored) return false;
  return stored[flag] === true;
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      setConsent({ necessary: true, analytics: stored.analytics, marketing: stored.marketing });
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      if (detail) setConsent(detail);
    };
    window.addEventListener('cookieConsentUpdated', handler);
    return () => window.removeEventListener('cookieConsentUpdated', handler);
  }, []);

  const acceptAll = useCallback(() => {
    storeConsent({ necessary: true, analytics: true, marketing: true });
  }, []);

  const refuseAll = useCallback(() => {
    storeConsent({ necessary: true, analytics: false, marketing: false });
  }, []);

  const save = useCallback((analytics: boolean, marketing: boolean) => {
    storeConsent({ necessary: true, analytics, marketing });
  }, []);

  return { consent, acceptAll, refuseAll, save };
}