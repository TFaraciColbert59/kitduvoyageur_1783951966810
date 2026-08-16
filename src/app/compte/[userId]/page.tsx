'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-[#F5F3ED] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#5C6B5E] font-medium">Redirection vers le profil voyageur...</p>
      </div>
    </div>
  );
}
