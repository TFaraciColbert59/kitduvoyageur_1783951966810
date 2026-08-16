'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileProfilePage from '@/components/mobile-nav/MobileProfilePage';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function ProfilPage() {
  const router = useRouter();

  useEffect(() => {
    // If on desktop (>= 768px), redirect to /compte
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace('/compte');
    }
  }, [router]);

  return (
    <>
      {/* DESKTOP (Fallback while redirecting) */}
      <div className="hidden md:flex items-center justify-center min-h-screen bg-[#FBFAF6]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#1C2620]/20 border-t-[#1C2620] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#63736C]">Redirection vers votre espace compte...</p>
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ minHeight: '100dvh', background: 'var(--background)' }}>
            <MobileProfilePage />
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
