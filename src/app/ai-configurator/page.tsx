import React from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import ConfiguratorWizard from '@/app/ai-configurator/components/ConfiguratorWizard';

export const metadata = {
  title: 'Configurateur IA — Kit du Voyageur',
  description: 'Composez votre kit de voyage en 5 étapes. Météo, usage, confort : votre sac sur mesure en 2 minutes.',
};

export default function ConfiguratorPage() {
  return (
    <main className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      <div className="pt-16">
        <ConfiguratorWizard />
      </div>
      <NewFooterSection />
    </main>
  );
}