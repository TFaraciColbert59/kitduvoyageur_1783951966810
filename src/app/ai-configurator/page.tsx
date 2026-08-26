import React, { Suspense } from 'react';
import KitConfiguratorWizard from '@/app/ai-configurator/components/KitConfiguratorWizard';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import CompteBackground from '@/components/compte/CompteBackground';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Configurateur IA · Le Kit du Voyageur',
  description: 'Assistant intelligent pour composer votre sac à dos d\'aventure en temps réel.',
};

function WizardFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-5 min-h-[60vh]">
      <div className="w-10 h-10 rounded-full border-2 border-[#17402C] border-t-transparent animate-spin" />
      <p className="text-xs font-mono font-bold text-[#5A7064]">Initialisation de l&apos;intelligence terrain…</p>
    </div>
  );
}

export default function ConfiguratorPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Configurateur IA · Le Kit du Voyageur',
    description: 'Assistant intelligent pour composer votre sac à dos d\'aventure en temps réel.',
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
    <div className="min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] selection:bg-[#17402C]/10 font-sans relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} suppressHydrationWarning />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} suppressHydrationWarning />

      {/* Fond canopée dorée immersif */}
      <CompteBackground />

      {/* ── DESKTOP COCKPIT (hidden md:flex) ── */}
      <div className="hidden md:flex flex-col h-full overflow-hidden p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
        <Suspense fallback={<WizardFallback />}>
          <KitConfiguratorWizard />
        </Suspense>
      </div>

      {/* ── MOBILE NATIVE VIEW (block md:hidden) ── */}
      <div className="block md:hidden min-h-screen">
        <MobilePageShell videoBackground={false} background="transparent">
          <div className="px-3 pt-3 pb-32">
            <Suspense fallback={<WizardFallback />}>
              <KitConfiguratorWizard isMobile={true} />
            </Suspense>
          </div>
        </MobilePageShell>
      </div>
    </div>
  );
}
