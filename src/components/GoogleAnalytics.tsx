'use client';

import Script from 'next/script';
import { useCookieConsent } from '@/lib/cookieConsent';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function GoogleAnalytics() {
  const { consent } = useCookieConsent();
  const analyticsEnabled = consent?.analytics === true;

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
