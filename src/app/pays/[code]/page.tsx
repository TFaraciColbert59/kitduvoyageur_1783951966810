// page.tsx - Page détail d'un pays
// Redesign premium avec EarthLayout

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getCountryByCode, type Country } from '@/lib/countries';

// Composants Earth
import EarthLayout from '@/components/earth/EarthLayout';
import CountryDetailsHeader from '@/components/earth/CountryDetailsHeader';
import CountryClimatePanel from '@/components/earth/CountryClimatePanel';
import CountrySafetyPanel from '@/components/earth/CountrySafetyPanel';
import CountryActivitiesPanel from '@/components/earth/CountryActivitiesPanel';

// Globe 3D
const CountryGlobe = dynamic(
  () => import('@/components/pays/CountryGlobe'),
  { ssr: false }
);

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function CountryPage({ params }: PageProps) {
  const router = useRouter();
  const { code } = React.use(params);
  const country = getCountryByCode(code.toLowerCase());

  if (!country) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h1 className="text-3xl font-bold text-white mb-4">Pays non trouvé</h1>
          <p className="text-white/70 mb-6">
            Le pays que vous recherchez n existe pas ou son code est invalide.
          </p>
          <button
            onClick={() => router.push("/pays")}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Retour a Earth
          </button>
        </div>
      </div>
    );
  }

  return (
    <EarthLayout
      className="bg-slate-950"
      isCountryPage={true}
      topContent={
        <CountryDetailsHeader
          country={country}
          onBack={() => router.push("/pays")}
        />
      }
      leftContent={
        <div className="max-h-[80vh] overflow-y-auto custom-scrollbar pb-4">
          <CountryClimatePanel country={country} />
        </div>
      }
      centerContent={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-4xl">
            <CountryGlobe
              countries={[country]}
              onCountryClick={() => {}}
              focusCode={country.code.toLowerCase()}
              fullscreen={false}
            />
          </div>
        </div>
      }
      rightContent={
        <div className="max-h-[80vh] overflow-y-auto custom-scrollbar pb-4">
          <CountrySafetyPanel country={country} />
        </div>
      }
      bottomContent={
        <div className="mt-4">
          <CountryActivitiesPanel country={country} />
        </div>
      }
    />
  );
}
