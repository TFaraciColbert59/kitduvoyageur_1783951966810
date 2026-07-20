'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

export default function EncheresPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <Icon name="TagIcon" size={28} variant="outline" className="text-amber-600" />
          </div>
          <h1 className="text-2xl font-display font-700 text-foreground mb-3">Les enchères ont évolué</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Le système d&apos;enchères a été remplacé par un système d&apos;offres plus simple et plus rapide.
            Achetez au prix affiché ou faites une offre directement aux vendeurs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/occasion" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
              <Icon name="TagIcon" size={16} variant="outline" />
              Voir les annonces occasion
            </Link>
            <Link href="/boutique" className="btn-secondary inline-flex items-center gap-2 px-6 py-3">
              <Icon name="ShoppingBagIcon" size={16} variant="outline" />
              Boutique
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}