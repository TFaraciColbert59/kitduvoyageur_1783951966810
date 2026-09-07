'use client';

import { useCookieConsent } from '@/lib/cookieConsent';

/**
 * Travelpayouts Drive (NTYxMTY5 — tag manuel fourni par Travelpayouts).
 *
 * Injecté UNIQUEMENT après consentement marketing/analytique explicite,
 * même modèle que RocketConsentScripts et GoogleAnalytics (Z7) :
 * aucun traceur tiers passif hors consentement. Le snippet (attributs +
 * IIFE) reste fidèle à celui fourni par Travelpayouts.
 */
export default function TravelpayoutsDrive() {
  const { consent } = useCookieConsent();
  const driveEnabled = consent?.marketing === true || consent?.analytics === true;

  if (!driveEnabled) return null;

  return (
    <script
      suppressHydrationWarning
      {...{
        nowprocket: '',
        'data-noptimize': '1',
        'data-cfasync': 'false',
        'data-wpfc-render': 'false',
        'seraph-accel-crit': '1',
        'data-no-defer': '1',
        'data-cmp-ab': '2',
      }}
      dangerouslySetInnerHTML={{
        __html: `(function () {
      var script = document.createElement("script");
      script.async = 1;
      script.setAttribute("data-cmp-ab","2");
      script.src = 'https://tpembars.com/NTYxMTY5.js?t=561169';
      document.head.appendChild(script);
  })();`,
      }}
    />
  );
}