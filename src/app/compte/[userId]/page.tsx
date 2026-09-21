'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui';

export default function CompteUserRedirectPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const router = useRouter();

  useEffect(() => {
    if (userId) {
      router.replace(`/profil/${userId}`);
    } else {
      router.replace('/compte');
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <LoadingState label="Redirection vers le profil voyageur…" />
    </div>
  );
}
