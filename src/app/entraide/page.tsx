'use client';

import React from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import AppShell from '@/components/shell/AppShell';
import { Button } from '@/components/ui';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * F-031 — page honnête : plus de CTA « Lancer un appel » sans formulaire ni
 * mutation, plus de filtres qui ne pilotent aucune liste, plus de promesse de
 * secours garanti. L'entraide réelle passe par une question publiée dans la
 * communauté (objet durable, réponses et modération existantes).
 */
export default function EntraidePage() {
  const cta = (
    <Link href="/communaute/publier?type=question">
      <Button icon={<LKDVIcon name="plus" size={15} />} size="lg">
        Poser une question à la communauté
      </Button>
    </Link>
  );

  return (
    <>
      {/* DESKTOP — fullscreen sans scroll */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
          <Header />
          <main className="flex h-full items-center justify-center overflow-hidden px-[var(--space-6)] pb-[var(--space-10)] pt-20">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-[var(--space-5)] text-center">
              <div className="flex items-center gap-[var(--space-3)]">
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)]">Communauté</span>
                <span className="font-mono text-[length:var(--lkv-text-caption-1)] uppercase tracking-widest text-[color:var(--sage-100)]">Entraide</span>
              </div>
              <h1 className="font-display text-[length:var(--lkv-text-title-xl)] font-bold leading-[var(--leading-tight)] tracking-tight text-white">
                Entraide entre <span className="text-white/80">voyageurs</span>
              </h1>
              <p className="max-w-md text-[length:var(--lkv-text-footnote)] leading-[var(--leading-relaxed)] text-white/70">
                Posez une question claire à la communauté — préparation, matériel, conditions de terrain — et
                obtenez des réponses de voyageurs qui connaissent la zone. Ce réseau n&apos;est pas un service de
                secours : en urgence, contactez les secours locaux.
              </p>
              {cta}
            </div>
          </main>
        </div>
        {/* Footer : masqué en desktop fullscreen (pas de scroll), visible sous md */}
        <div className="md:hidden">
          <Footer />
        </div>
      </div>

      {/* MOBILE — scroll natif */}
      <div className="block md:hidden">
        <AppShell>
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--glass-label)]">Entraide</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-secondary)]">
              Posez votre question à la communauté — et en urgence, contactez les secours locaux.
            </p>
            <Link href="/communaute/publier?type=question" className="block">
              <Button fullWidth icon={<LKDVIcon name="plus" size={15} />}>
                Poser une question à la communauté
              </Button>
            </Link>
          </div>
        </AppShell>
      </div>
    </>
  );
}
