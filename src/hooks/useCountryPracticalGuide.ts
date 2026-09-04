import { useQuery } from '@tanstack/react-query';
import type { PracticalSection, GuideSource } from '@/lib/ai/jobs/generateCountryGuide';

export interface SectionGuideData {
  content_md: string;
  sources: GuideSource[];
  model_used: string;
  generated_at: string;
  stale_after: string;
}

export interface CountryPracticalGuideResponse {
  country_code: string;
  sections: Partial<Record<PracticalSection, SectionGuideData>>;
  updated_at: string | null;
  has_content: boolean;
}

export function useCountryPracticalGuide(countryCode?: string) {
  const normalizedCode = countryCode?.trim().toUpperCase();

  return useQuery<CountryPracticalGuideResponse>({
    queryKey: ['country-practical-guide', normalizedCode],
    queryFn: async () => {
      if (!normalizedCode) {
        return { country_code: '', sections: {}, updated_at: null, has_content: false };
      }
      const res = await fetch(`/api/ai/country-guide/${normalizedCode}`);
      if (!res.ok) {
        throw new Error('Échec du chargement du guide pratique');
      }
      return res.json();
    },
    enabled: !!normalizedCode && normalizedCode.length >= 2,
    staleTime: 1000 * 60 * 60, // 1 heure en cache React Query
  });
}
