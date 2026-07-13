'use client';

import dynamic from 'next/dynamic';

const HomePageClient = dynamic(() => import('@/app/components/HomePageClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#1C2620]" aria-label="Chargement..." />
  ),
});

export default function HomePageDynamic() {
  return <HomePageClient />;
}
