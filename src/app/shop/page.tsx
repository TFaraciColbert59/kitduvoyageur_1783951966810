import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShopClient from '@/app/shop/components/ShopClient';

export const metadata = {
  title: 'Shop — Kit du Voyageur',
  description: 'Découvrez plus de 500 produits outdoor : neuf, kits assemblés, occasion vérifiée, enchères et location.',
};

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        <Suspense fallback={<div className="min-h-screen" />}>
          <ShopClient />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
