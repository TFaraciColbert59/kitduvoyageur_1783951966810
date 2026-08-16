'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileProfilePage from '@/components/mobile-nav/MobileProfilePage';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function ProfilPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/compte');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F3ED]">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#1C2620]/20 border-t-[#1C2620] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#5C6B5E] font-medium">Redirection vers votre espace compte...</p>
      </div>
    </div>
  );
}
