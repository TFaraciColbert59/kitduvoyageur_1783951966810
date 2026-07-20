'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

export default function EncheresPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon name="ArchiveBoxXMarkIcon" size={28} variant="outline" className="text-muted-foreground" />
        </div>
        <h1 className="font-display font-800 text-2xl mb-3" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          Les enchères ne sont plus disponibles
        </h1>
        <p className="text-muted-foreground mb-6">
          Nous avons remplacé le système d&apos;enchères par un système d&apos;offres plus simple et plus rapide sur la marketplace occasion.
        </p>
        <Link
          href="/occasion"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all"
        >
          <Icon name="ShoppingBagIcon" size={16} variant="outline" />
          Voir la marketplace occasion
        </Link>
      </main>
      <Footer />
    </div>
  );
}