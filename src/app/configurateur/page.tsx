'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

function ConfigurateurRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams?.toString();
    router?.replace(params ? `/ai-configurator?${params}` : '/ai-configurator');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Chargement du configurateur…</p>
      </div>
    </div>
  );
}

export default function ConfigurateurPage() {
  const spinner = (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <Suspense fallback={spinner}><ConfigurateurRedirect /></Suspense>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <Suspense fallback={spinner}>
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ConfigurateurRedirect />
            </div>
          </Suspense>
        </MobilePageShell>
        
      </div>
    </>
  );
}
