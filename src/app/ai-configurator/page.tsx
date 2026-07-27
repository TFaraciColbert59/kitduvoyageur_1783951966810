import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConfiguratorWizard from '@/app/ai-configurator/components/ConfiguratorWizard';
import BackButton from '@/components/ui/BackButton';

export const metadata = {
  title: 'Configurateur IA — Kit du Voyageur',
  description: 'Générez votre liste d\'équipement optimisée en 2 minutes. Entrez votre destination, vos dates et votre profil.',
};

export default function ConfiguratorPage() {
  return (
    <main className="min-h-screen bg-[#F7FAF8]">
      <Header />
      <div className="pt-24 px-4 max-w-[800px] mx-auto">
        <BackButton variant="ghost" className="text-xs mb-4" />
      </div>
      <div className="pb-16">
        <ConfiguratorWizard />
      </div>
      <Footer />
    </main>
  );
}