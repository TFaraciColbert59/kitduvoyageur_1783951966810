'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MobileCompteV2 } from '@/components/compte/MobileCompteV2';

function CompteContent() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('aventures');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen w-full bg-[color:var(--bg-body)]">
      <MobileCompteV2
        user={user}
        activeDesktopTab={activeTab}
        onSelectDesktopTab={setActiveTab}
        onSignOut={signOut}
      />
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
