'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ClubLiquidGlassV8 from '@/components/clubs/ClubLiquidGlassV8';
import ClubPrivatePostsPanel from '@/components/clubs/ClubPrivatePostsPanel';

function ClubDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const rawId = params?.id;
  const clubId = Array.isArray(rawId) ? rawId[0] : rawId || 'cl1';
  const initialTab = searchParams.get('tab') || undefined;

  return (
    <main className="min-h-screen w-full bg-[color:var(--bg-body)]">
      <ClubLiquidGlassV8 clubId={clubId} initialTab={initialTab} />
      <div className="sr-only">
        <ClubPrivatePostsPanel clubId={clubId} isMember={false} user={user} />
      </div>
    </main>
  );
}

export default function ClubDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[color:var(--bg-body)]" />}>
      <ClubDetailContent />
    </Suspense>
  );
}
