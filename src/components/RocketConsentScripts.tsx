'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/lib/cookieConsent';

/**
 * Rocket web analytics — chargé uniquement après consentement
 * (analytique ou marketing) explicite de l'utilisateur.
 */
export default function RocketConsentScripts() {
  const { consent } = useCookieConsent();
  const enabled = consent?.analytics === true || consent?.marketing === true;

  if (!enabled) return null;

  return (
    <>
      <Script
        src="https://static.rocket.new/rocket-web.js?_cfg=https://kitduvoyag4153back.builtwithrocket.new&_be=https://appanalytics.rocket.new&_v=0.1.19"
        strategy="lazyOnload"
        async
      />
      <Script
        src="https://static.rocket.new/rocket-shot.js?v=0.0.2"
        strategy="lazyOnload"
        defer
      />
    </>
  );
}