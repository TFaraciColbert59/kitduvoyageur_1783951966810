'use client';

import PublierPage from '@/app/communaute/publier/page';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function Page() {
  return (
    <>
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
    </>
  );
}
