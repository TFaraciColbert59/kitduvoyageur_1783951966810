import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { CompteBackground } from '@/components/compte/CompteBackground';
import { MarbleZone } from '@/components/glass/MarbleZone';
import MaProgressionView from '@/components/progression/MaProgressionView';
import { LoadingState } from '@/components/ui';

export const metadata = {
  title: 'Ma Progression & Classements — Le Kit du Voyageur',
  description: 'Suivez votre niveau permanent, vos compétences de cordée et vos classements territoriaux sur LKDV.',
};

export default function ProgressionPage() {
  return (
    <>
      {/* DESKTOP LAYOUT (>= 768px) */}
      <div className="hidden md:block min-h-screen bg-background relative font-sans">
        <CompteBackground />
        <Header />
        {/* M04 — le landmark `main#main-content` unique est porté par src/app/layout.tsx.
            Ici un simple conteneur de section pour ne jamais dupliquer le repère principal. */}
        <section aria-label="Ma progression" className="relative z-[var(--z-dropdown)] max-w-4xl mx-auto px-4 pt-24 pb-16">
          <MarbleZone />
          <div className="p-2 sm:p-4">
            <Suspense fallback={<LoadingState label="Chargement de la progression…" />}>
              <MaProgressionView />
            </Suspense>
          </div>
        </section>
        <Footer />
      </div>

      {/* MOBILE LAYOUT (< 768px, iPhone 16 Pro priority) */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="relative font-sans px-3.5 pt-4 pb-24">
            <Suspense fallback={<LoadingState label="Chargement de la progression…" />}>
              <MaProgressionView />
            </Suspense>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
