import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Manrope, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@/styles/tokens.css';
import '@/styles/tailwind.css';
import '@/styles/liquid-glass.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { KitSheetProvider } from '@/features/kits/KitSheetContext';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import MobileNavWrapper from '@/components/mobile-nav/MobileNavWrapper';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import ConfirmHost from '@/components/ui/ConfirmHost';
import PromptHost from '@/components/ui/PromptHost';
import RocketConsentScripts from '@/components/RocketConsentScripts';
import TravelpayoutsDrive from '@/components/TravelpayoutsDrive';
import MigrationEffect from '@/lib/storage/MigrationEffect';
import { getOrganizationSchema, getWebsiteSchema } from '@/lib/seo-utils';
import ReactQueryProvider from '@/components/ReactQueryProvider';
import PageTransition from '@/components/ui/PageTransition';
import { ConditionalCursor } from '@/components/ui/CustomCursor';
import PrefetchRoutes from '@/components/PrefetchRoutes';
import NativeAppBootstrap from '@/components/NativeAppBootstrap';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { ActiveTripProvider } from '@/features/trips/context/ActiveTripContext';
import { getActiveTrip } from '@/features/trips/context/activeTripServer';
import { ActiveAdventureProvider } from '@/features/hub/context/ActiveAdventureContext';
import { getActiveAdventure } from '@/features/hub/context/activeAdventureServer';
import { LocaleProvider } from '@/lib/i18n/context';
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locale';

// Fonts — Phase 2 : SF Pro (système) pour toute l'UI (--font-sans/--font-display
// définis dans tokens.css), Manrope conservée comme police de marque (--font-brand).
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  preload: false,
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
  preload: false,
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400'],
  style: ['normal', 'italic'],
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
  // Direction P5 §6 : plus de verrouillage clair — les deux schémas sont déclarés.
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0B1510' },
    { media: '(prefers-color-scheme: dark)', color: '#08110C' },
  ],
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Le Kit du Voyageur — Équipement outdoor & Configurateur IA',
    template: '%s | Le Kit du Voyageur',
  },
  description:
    'Configurateur IA, équipement outdoor, fiches pays et outils terrain. La plateforme complète du voyageur et de l\'aventurier.',
  keywords: [
    'équipement outdoor',
    'kit voyage',
    'configurateur IA',
    'randonnée',
    'trekking',
    'matériel aventure',
    'équipement randonnée',
    'sac à dos',
    'tente',
    'sac de couchage',
  ],
  authors: [{ name: 'Le Kit du Voyageur', url: siteUrl }],
  creator: 'Le Kit du Voyageur',
  publisher: 'Le Kit du Voyageur',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/assets/images/app_logo.png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LKDV',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteUrl,
    siteName: 'Le Kit du Voyageur',
    title: 'Le Kit du Voyageur — Équipement & Préparation',
    description: 'Configurez, achetez et préparez chaque voyage en un seul endroit.',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Le Kit du Voyageur — Équipement outdoor intelligent',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Le Kit du Voyageur — Équipement & Préparation',
    description: 'Configurez, achetez et préparez chaque voyage en un seul endroit.',
    images: ['/assets/images/og-image.png'],
    creator: '@lekitduvoyageur',
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      'fr-FR': siteUrl,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const activeTrip = await getActiveTrip();
  const activeAdventure = await getActiveAdventure();
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
  const organizationSchema = getOrganizationSchema(siteUrl);
  const websiteSchema = getWebsiteSchema(siteUrl);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${manrope.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {/* Thème honnête : respect de prefers-color-scheme, surcharge
            localStorage si l'utilisateur a choisi explicitement (ThemeToggle),
            application de la classe .dark AVANT la peinture (anti-flash). */}
        <script
          id="lkdv-theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;r.classList.add('dark');r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}catch(e){}})();`,
          }}
        />
        {/* Preload critical images for LCP optimization */}
        <link
          rel="preload"
          as="image"
          href="/assets/images/og-image.png"
          type="image/png"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/images/app_logo.png"
          type="image/png"
        />

        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* JSON-LD Structured Data */}
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />

        {/* Rocket analytics scripts — chargés uniquement après consentement */}
        <RocketConsentScripts />

        {/* Travelpayouts Drive — chargé uniquement après consentement (Z7) */}
        <TravelpayoutsDrive />

        {process.env.NODE_ENV !== 'production' && (
          // Dev : un service worker résiduel d'un run production peut servir du
          // HTML périmé pendant les redémarrages du serveur (hydratation cassée,
          // ancienne UI). On le désinscrit et on purge ses caches automatiquement.
          <script
            id="service-worker-dev-cleanup"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) { registration.unregister(); });
                  }).catch(function() {});
                  if (window.caches && caches.keys) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(key) { caches.delete(key); });
                    }).catch(function() {});
                  }
                }
              `,
            }}
          />
        )}
      </head>
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable} bg-transparent min-h-[100dvh]`}
      >
        {/* Toile unique LKDV — fond d'écran de toutes les routes */}
        <div className="lkv-app-background" aria-hidden="true" />
        <LocaleProvider initialLocale={locale}>
        <AuthProvider>
          <ActiveTripProvider initialTrip={activeTrip}>
            <ActiveAdventureProvider initialAdventure={activeAdventure}>
            <WishlistProvider>
              <ToastProvider>
                <SearchProvider>
                  <ErrorBoundaryWrapper>
                    <ReactQueryProvider>
                      <NativeAppBootstrap />
                      {/* Service worker web (production) — jamais enregistré dans
                          l'app Capacitor (garde `isNative()` côté client). */}
                      <ServiceWorkerRegistration />
        <WebVitalsReporter />
                      <KitSheetProvider>
                      <PrefetchRoutes />
                      <Suspense fallback={null}>
                        <GoogleAnalytics />
                      </Suspense>
                      {/* Skip navigation for accessibility */}
                      <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[var(--z-emergency)] focus:px-4 focus:py-2 focus:bg-[color:var(--lkv-primary)] focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
                      >
                        Aller au contenu principal
                      </a>

                      {/* Mobile navigation — hidden on desktop (md+) */}
                      <MobileNavWrapper />

                      <main id="main-content">
                        <PageTransition>{children}</PageTransition>
                      </main>
                      <CookieConsentBanner />
                      <ConfirmHost />
                      <PromptHost />
                      <ConditionalCursor />
                      {/* Migration Mon Matériel — exécutée UNE SEULE FOIS au montage */}
                      <MigrationEffect />
                      </KitSheetProvider>
                    </ReactQueryProvider>
                  </ErrorBoundaryWrapper>
                </SearchProvider>
              </ToastProvider>
            </WishlistProvider>
            </ActiveAdventureProvider>
          </ActiveTripProvider>
        </AuthProvider>
        </LocaleProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}