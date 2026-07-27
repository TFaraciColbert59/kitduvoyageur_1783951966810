import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KitConfiguratorWizard from '@/app/ai-configurator/components/KitConfiguratorWizard';

export const metadata = {
  title: 'Configurateur IA · Le Cœur du Kit du Voyageur',
  description: 'Le moteur central de votre préparation de voyage. Analysez votre inventaire, composez un sac intelligent, connectez groupes, carnets et boutique — tout en un seul parcours IA.',
};

function WizardFallback() {
  return (
    <div className="w-full max-w-[1360px] mx-auto px-6 py-20 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-3 border-[#1C3829] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[#5C6E60] font-medium">Préparation du configurateur…</p>
    </div>
  );
}

export default function ConfiguratorPage() {
  return (
    <div className="min-h-screen bg-[#EBE7DE] flex flex-col justify-between pt-16">
      <Header />
      <main className="flex-1 py-6">
        <Suspense fallback={<WizardFallback />}>
          <KitConfiguratorWizard />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}