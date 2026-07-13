import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConfiguratorWizard from '@/app/ai-configurator/components/ConfiguratorWizard';

export const metadata = {
  title: 'Configurateur IA — Kit du Voyageur',
  description: 'Générez votre liste d\'équipement optimisée en 2 minutes. Entrez votre destination, vos dates et votre profil.',
};

export default function ConfiguratorPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        <ConfiguratorWizard />
      </div>
      <Footer />
    </main>
  );
}