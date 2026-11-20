import React from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import '@/styles/tokens.generated.css';
import '@/styles/tokens.css';
import '@/styles/tailwind.css';
import '@/styles/liquid-glass.css';
import '@/styles/liquid-ios27.css';
import '@/styles/liquid-selectors.css';
import '@/styles/floating-liquid-tabbar.css';
import '@/styles/liquid-capsules.css';
import '@/styles/drawer-selectors-tabbar.css';
import '@/styles/community-post-polish.css';
import '@/styles/app-tint.css';
import '@/styles/native-account-tabbar.css';
import '@/styles/community-social.css';
import '@/styles/account-glass.css';
import '@/styles/community-feed.css';
import '@/styles/carnet-profile.css';
import '@/styles/hub-tokens.css';
import '@/features/posts/ui/post-system.css';
import '@/components/social-kit/social-kit.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { KitSheetProvider } from '@/features/kits/KitSheetContext';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';
import MobileNavWrapper from '@/components/mobile-nav/MobileNavWrapper';
import { getOrganizationSchema, getWebsiteSchema } from '@/lib/seo-utils';
import ReactQueryProvider from '@/components/ReactQueryProvider';
import PageTransition from '@/components/ui/PageTransition';
import PrefetchRoutes from '@/components/PrefetchRoutes';
import NativeAppBootstrap from '@/components/NativeAppBootstrap';
import { SkipToContentLink } from '@/components/accessibility/SkipToContentLink';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import DeferredGlobalHosts from '@/components/DeferredGlobalHosts';
import { ActiveTripProvider } from '@/features/trips/context/ActiveTripContext';
import { ActiveAdventureProvider } from '@/features/hub/context/ActiveAdventureContext';
import { LocaleProvider } from '@/lib/i18n/context';
import { DEFAULT_LOCALE } from '@/lib/i18n/locale';

// Fonts — Phase 2 : SF Pro (système) pour toute l'UI (--font-sans/--font-display
// définis dans tokens.css), Manrope conservée comme police de marque (--font-brand).
// Auto-hébergées (src/app/fonts, licence OFL) : la construction ne dépend plus
// du réseau vers Google Fonts.
const manrope = localFont({
  src: [{ path: './fonts/manrope.woff2', weight: '400 800', style: 'normal' }],
  variable: '--font-brand',
  display: 'swap',
  preload: false,
});

const ibmPlexMono = localFont({
  src: [
    { path: './fonts/plexmono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/plexmono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plexmono-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

const instrumentSerif = localFont({
  src: [
    { path: './fonts/instrumentserif.woff2', weight: '400', style: 'normal' },
    { path: './fonts/instrumentserif-italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
  preload: false,
});

// Inter est le substitut le plus proche de SF Pro en dehors des plates-formes
// Apple. Sur iOS/macOS, `-apple-system` resout SF Pro en amont et l empilement
// ci-dessous ne sert donc jamais. Sur Windows/Linux, c est Inter qui paint,
// ce qui evite la chute sur Segoe UI.
const inter = localFont({
  src: [{ path: './fonts/inter.woff2', weight: '400 900', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
  // 100% Mode Clair Liquid Glass
  colorScheme: 'light',
  themeColor: '#FBFAF6',
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Ne pas lire `cookies()` ni `headers()` dans le layout racine : sinon
  // Next.js force le rendu dynamique sur 100 % des routes (y compris `/`,
  // `/manifeste`, `/cgu`, `/cgv`, `/connexion`), empêchant tout pré-rendu
  // statique et le cache CDN Vercel. `LocaleProvider` réconcilie le cookie de
  // langue côté client si un drapeau multi-langue est activé, et les routes
  // dynamiques (`/hub`, `/compas`, `/carnets`) lisent leurs cookies dans leur
  // propre layout/page.
  const locale = DEFAULT_LOCALE;
  const organizationSchema = getOrganizationSchema(siteUrl);
  const websiteSchema = getWebsiteSchema(siteUrl);

  // Materiau Liquid Glass iOS 27 : l'attribut data-liquid-ios27 est pose UNE seule
  // fois sur <html>, ici, pour TOUTES les routes. Le retirer = opting-out du
  // materiau. Aucun autre portillon n'existe dans les feuilles de style.

  return (
    <html
      lang={locale}
      data-theme="light"
      data-liquid-ios27=""
      suppressHydrationWarning
      className={`${manrope.variable} ${ibmPlexMono.variable} ${inter.variable}`}
    >
      <head>
        {/* 100% Mode Clair Liquid Glass — Enforce light mode strictly */}
        <script
          id="lkdv-theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;r.classList.remove('dark');r.setAttribute('data-theme', 'light');r.style.colorScheme='light';try{var g=localStorage.getItem('lkdv_glass_intensity');if(g)r.style.setProperty('--glass-intensity',g);}catch(e){}})();`,
          }}
        />
        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* Supabase (API + stockage) : ouvert dès le premier octet pour que la
            première requête de données ne paie pas le handshake TLS. */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} />
        {/* Pas de préconnexion vers des hôtes absents du premier affichage (Rocket est bloqué par la CSP,
            ArcGIS ne sert qu'aux vues satellite / anciennes cartes) : sur mobile, chaque préconnexion
            inutile coûte DNS + TCP + TLS et concurrence les ressources de la page. */}

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

        {process.env.NODE_ENV !== 'production' && (
          // Dev : script externe same-origin (autorisé par CSP) pour purger tout
          // ancien Service Worker `/sw.js` et `lkdv-static-*` avant les chunks.
          <Script
            id="service-worker-dev-cleanup"
            src="/dev-sw-cleanup.js"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable} ${inter.variable} bg-transparent min-h-[100dvh]`}
      >
        {/* Toile unique LKDV — fond d'écran de toutes les routes */}
        <div className="lkv-app-background" aria-hidden="true" />
        <LocaleProvider initialLocale={locale}>
        <AuthProvider>
          <ActiveTripProvider>
            <ActiveAdventureProvider>
            <WishlistProvider>
              <ToastProvider>
                <SearchProvider>
                  <ErrorBoundaryWrapper>
                    <ReactQueryProvider>
                      <NativeAppBootstrap />
                      <KitSheetProvider>
                      <PrefetchRoutes />
                      {/* Skip navigation for accessibility — place le focus sur <main>. */}
                      <SkipToContentLink targetId="main-content" />

                      {/* Mobile navigation — hidden on desktop (md+) */}
                      <MobileNavWrapper />

                      <main id="main-content">
                        <PageTransition>{children}</PageTransition>
                      </main>
                      <CookieConsentBanner />
                      <DeferredGlobalHosts />
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
      </body>
    </html>
  );
}
