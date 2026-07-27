'use client';

import type { TrustStats, FeaturedCarnet } from '@/lib/home-queries';
import HomepageHeroSection from '@/app/components/home/HomepageHeroSection';
import HomepageSocialProofSection from '@/app/components/home/HomepageSocialProofSection';
import HomepageAIDemoSection from '@/app/components/home/HomepageAIDemoSection';
import HomepageHowItWorksSection from '@/app/components/home/HomepageHowItWorksSection';
import HomepageDestinationsSection from '@/app/components/home/HomepageDestinationsSection';
import HomepageFeaturedProductsSection from '@/app/components/home/HomepageFeaturedProductsSection';
import HomepageFAQSection from '@/app/components/home/HomepageFAQSection';
import HomepagePressTestimonialsSection from '@/app/components/home/HomepagePressTestimonialsSection';
import HomepageFinalCTASection from '@/app/components/home/HomepageFinalCTASection';

export default function HomepageV1({
  stats,
  carnets,
}: {
  stats: TrustStats;
  carnets: FeaturedCarnet[];
}) {
  return (
    <>
      {/* 1. Hero */}
      <HomepageHeroSection />

      {/* 2. Preuve sociale */}
      <HomepageSocialProofSection stats={stats} />

      {/* 3. Démonstration IA */}
      <HomepageAIDemoSection stats={stats} />

      {/* 4. Comment ça marche */}
      <HomepageHowItWorksSection />

      {/* 5. Destinations */}
      <HomepageDestinationsSection />

      {/* 6. Produits phares */}
      <HomepageFeaturedProductsSection />

      {/* 7. FAQ */}
      <HomepageFAQSection />

      {/* 7.5 Presse & Témoignages */}
      <HomepagePressTestimonialsSection />

      {/* 8. CTA final */}
      <HomepageFinalCTASection />
    </>
  );
}
