import React, { Suspense } from 'react';
import KitConfiguratorWizard from '@/app/ai-configurator/components/KitConfiguratorWizard';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Configurateur IA · Le Kit du Voyageur',
  description: 'Assistant intelligent pour composer votre sac à dos d\'aventure en temps réel.',
};

function WizardFallback() {
  return (
    <div style={{ minHeight: '100vh', background: '#EBE7DE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #1C3829', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: '14px', color: '#5C6E60', fontWeight: 500 }}>Chargement du configurateur IA…</p>
    </div>
  );
}

export default function ConfiguratorPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Configurateur IA · Le Kit du Voyageur',
    description: 'Assistant intelligent pour composer votre sac \u00e0 dos d\'aventure en temps r\u00e9el.',
    url: `${siteUrl}/ai-configurator`,
    isPartOf: { '@id': `${siteUrl}/#website` },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Configurateur IA', item: `${siteUrl}/ai-configurator` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div style={{ minHeight: '100vh', background: '#EBE7DE', padding: '32px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Suspense fallback={<WizardFallback />}><KitConfiguratorWizard /></Suspense>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: '#EBE7DE' }}>
            <Suspense fallback={<WizardFallback />}><KitConfiguratorWizard /></Suspense>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
