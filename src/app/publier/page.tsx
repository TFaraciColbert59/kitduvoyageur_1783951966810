'use client';

import React, { Suspense } from 'react';
import PublierPage from '@/app/communaute/publier/page';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

function PublierPageContent() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" /></div>}>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <PublierPage />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <PublierPage />
        </MobilePageShell>
      </div>
    </Suspense>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PublierPageContent />
    </Suspense>
  );
}
