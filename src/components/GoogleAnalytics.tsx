'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    // Check stored consent on mount
    const checkConsent = () => {
      try {
        const raw = localStorage.getItem('lkdv_cookie_consent');
        if (raw) {
          const consent = JSON.parse(raw);
          setAnalyticsEnabled(!!consent.analytics);
        }
      } catch {
        // ignore
      }
    };

    checkConsent();

    // Listen for consent updates
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAnalyticsEnabled(!!detail?.analytics);
    };
    window.addEventListener('cookieConsentUpdated', handler);
    return () => window.removeEventListener('cookieConsentUpdated', handler);
  }, []);

  if (!GA_ID || GA_ID === 'enter-your-value-here' || !analyticsEnabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
