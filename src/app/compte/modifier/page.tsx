'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { PageHeader } from '@/components/ui';
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
          sticky
          variant="inline"
          className="px-4 pt-3 pb-2.5"
          title="Modifier mon profil"
          back={
            <Link
              href="/compte"
              onClick={() => triggerHaptic('light')}
              className="glass-capsule-btn text-xs font-bold !py-1.5 !px-3 cursor-pointer"
            >
              <span className="text-sm font-bold">‹</span>
              <span>Mon Compte</span>
            </Link>
          }
        />

        <div className="pt-2 px-2">
          <EditProfileView />
        </div>
      </div>
    </div>
  );
}