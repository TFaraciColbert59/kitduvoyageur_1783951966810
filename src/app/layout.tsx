import React, { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Manrope, IBM_Plex_Mono } from 'next/font/google';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import Script from 'next/script';
import { ToastProvider } from '@/contexts/ToastContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { SearchProvider } from '@/contexts/SearchContext';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import MobileNavWrapper from '@/components/mobile-nav/MobileNavWrapper';

import CookieConsentBanner from '@/components/CookieConsentBanner';
import { getOrganizationSchema, getWebsiteSchema } from '@/lib/seo-utils';
import ReactQueryProvider from '@/components/ReactQueryProvider';
import PageTransition from '@/components/ui/PageTransition';



// Only load weights actually used in the app
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

// Mono font: defer preload — only used for labels/stats, not critical path
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
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
    google: 'google-site-verification-code', // Replace with actual code
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organizationSchema = getOrganizationSchema(siteUrl);
  const websiteSchema = getWebsiteSchema(siteUrl);

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${dmSans.variable} ${manrope.variable} ${ibmPlexMono.variable}`}
    >
      <head>
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

        {/* Rocket analytics scripts */}

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
</head>
      <body className={dmSans.className}>
        <AuthProvider>
          <WishlistProvider>
            <ToastProvider>
              <SearchProvider>
                <ErrorBoundaryWrapper>
                  <ReactQueryProvider>
                    <Suspense fallback={null}>
                      <GoogleAnalytics />
                    </Suspense>
                    {/* Skip navigation for accessibility */}
                    <a
                      href="#main-content"
                      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#17402C] focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
                    >
                      Aller au contenu principal
                    </a>
                    {/* Mobile navigation — hidden on desktop (md+) */}
                    <MobileNavWrapper />
                    <main id="main-content">
                      <PageTransition>{children}</PageTransition>
                    </main>
                    <CookieConsentBanner />
                  </ReactQueryProvider>
                </ErrorBoundaryWrapper>
              </SearchProvider>
            </ToastProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}