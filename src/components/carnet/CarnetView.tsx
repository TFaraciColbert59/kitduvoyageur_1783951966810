'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import CompteBackground from '@/components/compte/CompteBackground';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CarnetHero from '@/components/carnet/CarnetHero';
import StatsBar from '@/components/carnet/StatsBar';
import CarnetMap from '@/components/carnet/CarnetMap';
import TimelineJours from '@/components/carnet/TimelineJours';
import MomentCard from '@/components/carnet/MomentCard';
import KitSouvenirCard from '@/components/carnet/KitSouvenirCard';
import RandonneesSouvenirCard from '@/components/carnet/RandonneesSouvenirCard';
import CarnetDetailVerticalTabs from '@/components/carnet/CarnetDetailVerticalTabs';
import CarnetDetailRightSidebar from '@/components/carnet/CarnetDetailRightSidebar';
import SpeciesIdentifier from '@/components/carnet/SpeciesIdentifier';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileCarnetDetailView from '@/components/carnet/MobileCarnetDetailView';
import { CarnetData, mockCarnetChartreuse } from '@/lib/mock/carnet-chartreuse';

function downloadGPX(name: string, traceGeojson?: any) {
  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Le Kit du Voyageur"><metadata><name>${name}</name></metadata><trk><name>${name}</name><trkseg>`;
  const coords = (traceGeojson?.geometry?.coordinates || traceGeojson?.coordinates || []) as [number, number, number?][];
  if (coords.length > 0) {
    coords.forEach(([lng, lat, ele]) => {
      gpxContent += `<trkpt lat="${lat}" lon="${lng}">${ele ? `<ele>${ele}</ele>` : ''}</trkpt>`;
    });
  }
  gpxContent += `</trkseg></trk></gpx>`;
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

interface CarnetViewProps {
  data: CarnetData;
}

export default function CarnetView({ data }: CarnetViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Fallbacks so sections are never empty
  const moments = (data.moments && data.moments.length > 0) ? data.moments : mockCarnetChartreuse.moments;
  const kitItems = (data.kit?.items && data.kit.items.length > 0) ? data.kit.items : mockCarnetChartreuse.kit.items;
  const kitIntro = data.kit?.intro || mockCarnetChartreuse.kit.intro;
  const jours = (data.jours && data.jours.length > 0) ? data.jours : mockCarnetChartreuse.jours;
  const hebergements = (data.hebergements && data.hebergements.length > 0) ? data.hebergements : mockCarnetChartreuse.hebergements;

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(data.meta?.titleLine1 || 'carnet').replace(/[^a-zA-Z0-9]/g, '_')}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGPX = () => {
    downloadGPX(data.meta?.titleLine1 || 'Carnet', data.traceGeojson);
  };

  const distVal = data.stats?.find((s) => s.label === 'DISTANCE')?.value ? parseFloat(data.stats.find((s) => s.label === 'DISTANCE')!.value) : 27.4;
  const elevVal = data.stats?.find((s) => s.label === 'DÉNIVELÉ +')?.value ? parseInt(data.stats.find((s) => s.label === 'DÉNIVELÉ +')!.value) : 1620;

  return (
    <>
      {/* ── DESKTOP (3-Column Fullscreen 100dvh + CompteBackground) ── */}
      <div className="hidden md:block">
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
          <CompteBackground />
          <Header />

          <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
            {/* COLONNE GAUCHE (Nav & Vertical Cockpit Tabs) - 230px */}
            <aside className="w-[230px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3">
              <CommunityHubNav layoutVariant="vertical" activeTab="carnets" />
              <CarnetDetailVerticalTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                momentsCount={moments.length}
                itemsCount={kitItems.length}
              />
            </aside>

            {/* COLONNE CENTRALE (Scrollable Unique) */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-5">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
                <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
                <Link href="/carnets" className="hover:text-[#17402C] transition-colors">Carnets</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
                <span className="text-[#17402C] font-semibold truncate max-w-[200px]">{data.meta.titleLine1}</span>
              </div>

              {/* OVERVIEW TAB ONLY: Hero */}
              {activeTab === 'overview' && (
                <>
                  <CarnetHero
                    meta={data.meta}
                    onExport={handleExport}
                    carnetId={data.id}
                    onOpenComments={() => setActiveTab('moments')}
                  />
                  {data.stats && data.stats.length > 0 && <StatsBar stats={data.stats} />}
                </>
              )}

              {/* SECTION: Parcours & Carte (Overview / Tab) */}
              {(activeTab === 'overview' || activeTab === 'parcours') && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-lg text-[#17402C]">
                        Le <span className="font-serif italic text-[#17402C]">parcours</span>
                      </h2>
                      <span className="glass-pill text-[10px] font-mono font-bold">Trace GPX &amp; Étapes</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <CarnetMap
                      traceGeojson={data.traceGeojson}
                      distanceKm={distVal}
                      elevationM={elevVal}
                      destination={data.meta?.itineraire || data.meta?.titleLine1}
                      onDownloadGPX={handleDownloadGPX}
                    />
                    <TimelineJours jours={jours} hebergements={hebergements} />
                  </div>
                </section>
              )}

              {/* SECTION: Moments & Récits */}
              {(activeTab === 'overview' || activeTab === 'moments') && moments.length > 0 && (
                <section id="carnet-moments-section" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-lg text-[#17402C]">
                        Les <span className="font-serif italic text-[#17402C]">moments</span>
                      </h2>
                      <span className="glass-pill text-[10px] font-mono font-bold">{moments.length} souvenirs</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {moments.map((m) => (
                      <MomentCard key={m.id} moment={m} />
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION: Dans le sac & Souvenirs */}
              {(activeTab === 'overview' || activeTab === 'materiel') && kitItems.length > 0 && (
                <section className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <KitSouvenirCard intro={kitIntro} items={kitItems} />
                    {data.randonnees && data.randonnees.length > 0 && (
                      <RandonneesSouvenirCard randonnees={data.randonnees} />
                    )}
                  </div>
                </section>
              )}

              {/* SECTION: Faune & Flore IA */}
              {activeTab === 'faune-flore' && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-lg text-[#17402C]">
                        Identification <span className="font-serif italic text-[#17402C]">Faune &amp; Flore IA</span>
                      </h2>
                      <span className="glass-pill text-[10px] font-mono font-bold">Nature Scanner</span>
                    </div>
                  </div>
                  <SpeciesIdentifier />
                </section>
              )}
            </div>

            {/* COLONNE DROITE (Widgets Sidebar) - 300px */}
            <CarnetDetailRightSidebar
              meta={data.meta}
              stats={data.stats}
              onDownloadGPX={handleDownloadGPX}
              onExport={handleExport}
            />
          </main>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileCarnetDetailView
            data={data}
            moments={moments}
            kitItems={kitItems}
            kitIntro={kitIntro}
            jours={jours}
            hebergements={hebergements}
            onDownloadGPX={handleDownloadGPX}
            onExport={handleExport}
            distVal={distVal}
            elevVal={elevVal}
          />
        </MobilePageShell>
      </div>
    </>
  );
}
