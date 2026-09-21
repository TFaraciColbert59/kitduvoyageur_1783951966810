'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';

export default function ProfilPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/compte');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--sand-100)]">
      <LoadingState label="Redirection vers votre espace compte…" />
    </div>
  );
}
