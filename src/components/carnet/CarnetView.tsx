'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import CarnetHero from '@/components/carnet/CarnetHero';
import StatsBar from '@/components/carnet/StatsBar';
import CarnetMap from '@/components/carnet/CarnetMap';
import TimelineJours from '@/components/carnet/TimelineJours';
import MomentCard from '@/components/carnet/MomentCard';
import KitSouvenirCard from '@/components/carnet/KitSouvenirCard';
import RandonneesSouvenirCard from '@/components/carnet/RandonneesSouvenirCard';
import GroupeToCarnetCTA from '@/components/carnet/GroupeToCarnetCTA';
import CarnetFooter from '@/components/carnet/CarnetFooter';
import { mockCarnetChartreuse, CarnetData } from '@/lib/mock/carnet-chartreuse';
import { getCarnetComplet } from '@/lib/queries/carnet';

function downloadMockGPX(name: string) {
  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg></trkseg></trk></gpx>`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

interface CarnetViewProps {
  carnetId?: string;
}

export default function CarnetView({ carnetId }: CarnetViewProps) {
  const [data, setData] = useState<CarnetData>(mockCarnetChartreuse);

  useEffect(() => {
    async function loadCarnet() {
      try {
        const result = await getCarnetComplet(carnetId || 'demo');
        setData(result);
      } catch (e) {
        console.error('Error fetching carnet:', e);
      }
    }

    loadCarnet();
  }, [carnetId]);

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'carnet-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#E7E3D6] font-sans">
      <Header />

      <CarnetHero meta={data.meta} onExport={handleExport} />
      <StatsBar stats={data.stats} />

      {/* Section: Le parcours */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[#1C2620]">
            Le <em className="font-serif italic">parcours</em>
          </h2>
          <p className="text-sm text-[#1C2620]/60 max-w-md mt-2 md:mt-0 md:text-right font-sans">
            Trois jours de marche lente. Trace GPX et hébergements enregistrés à chaque étape.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <CarnetMap onDownloadGPX={() => downloadMockGPX('Traversee-Complete')} />
          <TimelineJours jours={data.jours} hebergements={data.hebergements} />
        </div>
      </section>

      {/* Section: Les moments */}
      <section className="bg-[#E7E3D6] border-t border-[#1C2620]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-[#1C2620]">
              Les <em className="font-serif italic">moments</em>
            </h2>
            <p className="text-sm text-[#1C2620]/60 max-w-md mt-2 md:mt-0 md:text-right font-sans">
              Quatorze micro-souvenirs écrits pendant le voyage — quelques mots suffisent souvent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.moments.map(m => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        </div>
      </section>

      {/* Section: Les souvenirs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[#1C2620]">
            Les <em className="font-serif italic">souvenirs</em>
          </h2>
          <p className="text-sm text-[#1C2620]/60 max-w-md mt-2 md:mt-0 md:text-right font-sans">
            Ce qu&apos;on avait dans le sac, ce qu&apos;on a marché — tout est archivé avec le voyage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <KitSouvenirCard intro={data.kit.intro} items={data.kit.items} />
          <RandonneesSouvenirCard randonnees={data.randonnees} />
        </div>
      </section>

      <GroupeToCarnetCTA />
      <CarnetFooter />
    </div>
  );
}
