'use client';

import dynamic from 'next/dynamic';

// Lazy load below-fold sections — client component wrapper
const LazyFeatures = dynamic(() => import('@/app/components/FeaturesSection'), { ssr: false });
const LazyKits = dynamic(() => import('@/app/components/PopularKitsSection'), { ssr: false });
const LazyProof = dynamic(() => import('@/app/components/SocialProofSection'), { ssr: false });
const LazyCategories = dynamic(() => import('@/app/components/CategoriesSection'), { ssr: false });
const LazyCountries = dynamic(() => import('@/app/components/CountryTeaserSection'), { ssr: false });

export default function BelowFoldSections() {
  return (
    <>
      <LazyFeatures />
      <LazyKits />
      <LazyCategories />
      <LazyCountries />
      <LazyProof />
    </>
  );
}
