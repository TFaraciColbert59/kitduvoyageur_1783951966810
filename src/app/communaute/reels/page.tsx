'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FreedomReelsViewer } from '@/features/community/reels/FreedomReelsViewer';

function FreedomReelsContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams?.get('id') ?? null;

  return <FreedomReelsViewer initialReelId={initialId} />;
}

export default function FreedomReelsPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-black text-white">
          <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      }
    >
      <FreedomReelsContent />
    </Suspense>
  );
}
