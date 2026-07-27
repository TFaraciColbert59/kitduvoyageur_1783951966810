import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KitConfiguratorWizard from '@/app/ai-configurator/components/KitConfiguratorWizard';

export const metadata = {
  title: 'Configurateur · Composer un sac — Le Kit du Voyageur',
  description: 'Assistant multi-étapes pour composer votre sac à dos d\'aventure en temps réel selon la météo, la durée et votre pratique.',
};

export default function ConfiguratorPage() {
  return (
    <div className="min-h-screen bg-[#EBE7DE] flex flex-col justify-between pt-16">
      <Header />
      <main className="flex-1 py-6">
        <KitConfiguratorWizard />
      </main>
      <Footer />
    </div>
  );
}