'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import CompteBackground from '@/components/compte/CompteBackground';
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
import type { CarnetData } from '@/lib/mock/carnet-chartreuse';
import { Badge } from '@/components/ui';

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

  // Aucun fallback fictif : les sections vides restent vides.
  const moments = data.moments ?? [];
  const kitItems = data.kit?.items ?? [];
  const kitIntro = data.kit?.intro ?? '';
  const jours = data.jours ?? [];
  const hebergements = data.hebergements ?? [];

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

  const distVal = data.stats?.find((s) => s.label === 'DISTANCE')?.value
    ? parseFloat(data.stats.find((s) => s.label === 'DISTANCE')!.value)
    : undefined;
  const elevVal = data.stats?.find((s) => s.label === 'DÉNIVELÉ +')?.value
    ? parseInt(data.stats.find((s) => s.label === 'DÉNIVELÉ +')!.value)
    : undefined;

  return (
    <>
      <div className="hidden md:block">
        <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
          <CompteBackground />
          <Header />

          <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-[var(--space-5)] overflow-hidden px-[var(--space-4)] pb-[var(--space-4)] pt-24 sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
            <div className="h-full w-[230px] shrink-0 overflow-hidden">
              <CarnetDetailVerticalTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>

            <div className="h-full min-w-0 flex-1 space-y-[var(--space-5)] overflow-y-auto pr-[var(--space-2)]">
              <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <Link href="/carnets" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Carnets</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <span className="max-w-[200px] truncate font-semibold text-[color:var(--lkv-text-primary)]">{data.meta.titleLine1}</span>
              </div>

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

              {(activeTab === 'overview' || activeTab === 'parcours') && (
                <section className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                        Le <span className="font-serif italic text-[color:var(--lkv-text-primary)]">parcours</span>
                      </h2>
                      <Badge className="font-mono font-bold">Trace GPX &amp; Étapes</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-2">
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

              {(activeTab === 'overview' || activeTab === 'moments') && moments.length > 0 && (
                <section id="carnet-moments-section" className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                        Les <span className="font-serif italic text-[color:var(--lkv-text-primary)]">moments</span>
                      </h2>
                      <Badge className="font-mono font-bold">{moments.length} souvenirs</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 xl:grid-cols-3">
                    {moments.map((m) => (
                      <MomentCard key={m.id} moment={m} />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'overview' || activeTab === 'materiel') && kitItems.length > 0 && (
                <section className="space-y-[var(--space-4)]">
                  <div className="grid grid-cols-1 gap-[var(--space-4)]">
                    <KitSouvenirCard intro={kitIntro} items={kitItems} />
                    {data.randonnees && data.randonnees.length > 0 && (
                      <RandonneesSouvenirCard randonnees={data.randonnees} />
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'faune-flore' && (
                <section className="space-y-[var(--space-4)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                        Identification <span className="font-serif italic text-[color:var(--lkv-text-primary)]">Faune &amp; Flore IA</span>
                      </h2>
                      <Badge className="font-mono font-bold">Nature Scanner</Badge>
                    </div>
                  </div>
                  <SpeciesIdentifier />
                </section>
              )}
            </div>

            <CarnetDetailRightSidebar
              meta={data.meta}
              stats={data.stats}
              onDownloadGPX={handleDownloadGPX}
              onExport={handleExport}
            />
          </main>
        </div>
      </div>

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
