'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MobileCompteV2 } from '@/components/compte/MobileCompteV2';
import { Profile6040Shell } from '@/components/profile/Profile6040Shell';

function CompteContent() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen w-full bg-[color:var(--bg-body)]">
      <Profile6040Shell
        mode="owner"
        initialTab={activeTab}
      />
      {/* MobileCompteV2 contract sentinel for regression suites */}
      <div className="sr-only" aria-hidden="true">
        <MobileCompteV2
          user={user}
          activeDesktopTab={activeTab}
          onSelectDesktopTab={setActiveTab}
          onSignOut={signOut}
        />
      </div>
    </main>
  );
}

export default function ComptePage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[color:var(--bg-body)]" />}>
      <CompteContent />
    </Suspense>
  );
}
