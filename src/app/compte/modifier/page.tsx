'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import EditProfileView from '@/components/compte/EditProfileView';
import CompteBackground from '@/components/compte/CompteBackground';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function EditProfilePage() {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className="min-h-screen relative font-sans text-[#17402C]">
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
        {/* Mobile top bar Liquid Glass */}
        <div className="sticky top-0 z-40 px-4 pt-3 pb-2.5 flex items-center justify-between gap-2 backdrop-blur-md bg-white/70 border-b border-white/60">
          <Link
            href="/compte"
            onClick={() => triggerHaptic('light')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-xs font-bold text-[#17402C] border border-white shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <span className="text-sm font-bold">‹</span>
            <span>Mon Compte</span>
          </Link>

          <span className="font-display font-extrabold text-sm text-[#17402C]">
            Modifier mon profil
          </span>

          <div className="w-16" />
        </div>

        <div className="pt-2 px-2">
          <EditProfileView />
        </div>
      </div>
    </div>
  );
}