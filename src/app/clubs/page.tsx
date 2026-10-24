'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClubLiquidGlassV8 from '@/components/clubs/ClubLiquidGlassV8';

function ClubsPageContent() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get('id') || searchParams.get('club') || 'cl1';
  const initialTab = searchParams.get('tab') || undefined;

  return (
    <main className="min-h-screen w-full bg-[color:var(--bg-body)]">
      <ClubLiquidGlassV8 clubId={clubId} initialTab={initialTab} />
    </main>
  );
}

export default function ClubsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[color:var(--bg-body)]" />}>
      <ClubsPageContent />
    </Suspense>
  );
}
