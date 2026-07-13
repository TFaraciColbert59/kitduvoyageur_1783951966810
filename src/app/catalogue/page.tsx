import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CatalogueClient from '@/app/catalogue/components/CatalogueClient';

export const metadata = {
  title: 'Catalogue — Kit du Voyageur',
  description: 'Découvrez plus de 500 produits outdoor filtrables par activité, poids, prix et marque.',
};

export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        <Suspense fallback={<div className="min-h-screen" />}>
          <CatalogueClient />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}