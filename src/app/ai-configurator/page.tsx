import React, { Suspense } from 'react';
import KitConfiguratorWizard from '@/app/ai-configurator/components/KitConfiguratorWizard';

export const metadata = {
  title: 'Configurateur IA · Le Kit du Voyageur',
  description: 'Assistant intelligent pour composer votre sac à dos d\'aventure en temps réel selon la météo, la durée et votre équipement.',
};

function WizardFallback() {
  return (
    <div className="min-h-screen bg-[#EBE7DE] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-3 border-[#1C3829] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[#5C6E60] font-medium">Chargement du configurateur IA…</p>
    </div>
  );
}

export default function ConfiguratorPage() {
  return (
    <div className="min-h-screen bg-[#EBE7DE] py-4 sm:py-8 flex flex-col justify-center">
      <Suspense fallback={<WizardFallback />}>
        <KitConfiguratorWizard />
      </Suspense>
    </div>
  );
}