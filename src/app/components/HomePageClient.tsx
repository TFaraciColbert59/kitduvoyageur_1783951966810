'use client';

import Header from '@/components/Header';
import HeroSection from '@/app/components/HeroSection';
import VerifiedReviewsSection from '@/app/components/VerifiedReviewsSection';
import BelowFoldSections from '@/app/components/BelowFoldSections';
import Footer from '@/components/Footer';

export default function HomePageClient() {
  return (
    <main className="min-h-screen">
      <Header />
      <div id="main-content">
        <HeroSection />
        <VerifiedReviewsSection />
        <BelowFoldSections />
      </div>
      <Footer />
    </main>
  );
}
