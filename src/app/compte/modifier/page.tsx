'use client';

import React from 'react';
import Header from '@/components/Header';
import { HeaderBackButton, PageHeader } from '@/components/ui';
import EditProfileView from '@/components/compte/EditProfileView';
import CompteBackground from '@/components/compte/CompteBackground';
import { MarbleZone } from '@/components/glass/MarbleZone';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function EditProfilePage() {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="min-h-screen relative font-sans text-[var(--lkv-primary)]">
      <CompteBackground />
      <MarbleZone />

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
        <PageHeader
          variant="inline"
          className="px-4 pt-3 pb-2.5"
          title="Modifier mon profil"
          back={
            <HeaderBackButton
              fallbackHref="/compte"
              label="Mon Compte"
              onClick={() => triggerHaptic('light')}
            />
          }
        />

        <div className="pt-2 px-2">
          <EditProfileView />
        </div>
      </div>
    </div>
  );
}