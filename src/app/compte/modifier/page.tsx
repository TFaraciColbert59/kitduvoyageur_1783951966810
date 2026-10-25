'use client';

import React from 'react';
import Header from '@/components/Header';
import { HeaderBackButton, PageHeader } from '@/components/ui';
import EditProfileView from '@/components/compte/EditProfileView';
import CompteBackground from '@/components/compte/CompteBackground';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function EditProfilePage() {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="min-h-screen relative font-sans text-[color:var(--lkv-text-primary)]">
      <CompteBackground />

      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="h-dvh overflow-hidden bg-transparent">
          <Header />
          <main className="h-full overflow-y-auto pt-20 sm:pt-24 pb-8">
            <EditProfileView />
          </main>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden pb-32">
        {/* Sticky Apple iOS Frosted Glass Top Navigation Bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur-xl bg-white/75 dark:bg-black/60 border-b border-black/5 dark:border-white/10">
          <HeaderBackButton
            fallbackHref="/compte"
            label="Mon Compte"
            onClick={() => triggerHaptic('light')}
          />
          <h1 className="font-semibold text-base text-[color:var(--lkv-text-primary)] tracking-tight">
            Modifier mon profil
          </h1>
        </div>

        <div className="pt-2 px-2">
          <EditProfileView />
        </div>
      </div>
    </div>
  );
}