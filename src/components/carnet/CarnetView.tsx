'use client';

import React from 'react';
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
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { CarnetData } from '@/lib/mock/carnet-chartreuse';

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
  data: CarnetData;
}

export default function CarnetView({ data }: CarnetViewProps) {
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
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
    <div className="min-h-screen bg-[#E7E3D6] font-sans">
      <Header />

      <CarnetHero meta={data.meta} onExport={handleExport} />
      <StatsBar stats={data.stats} />

      {/* Section: Le parcours */}
      {(data.jours.length > 0 || data.hebergements.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-[#1C2620]">
              Le <em className="font-serif italic">parcours</em>
            </h2>
            <p className="text-sm text-[#1C2620]/60 max-w-md mt-2 md:mt-0 md:text-right font-sans">
              Trace GPX et hébergements enregistrés à chaque étape.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <CarnetMap onDownloadGPX={() => downloadMockGPX(data.meta.titleLine1 || 'Carnet')} />
            <TimelineJours jours={data.jours} hebergements={data.hebergements} />
          </div>
        </section>
      )}

      {/* Section: Les moments */}
      {data.moments.length > 0 && (
        <section className="bg-[#E7E3D6] border-t border-[#1C2620]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-[#1C2620]">
                Les <em className="font-serif italic">moments</em>
              </h2>
              <p className="text-sm text-[#1C2620]/60 max-w-md mt-2 md:mt-0 md:text-right font-sans">
                Souvenirs écrits pendant le voyage — quelques mots suffisent souvent.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.moments.map(m => (
                <MomentCard key={m.id} moment={m} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section: Les souvenirs */}
      {(data.kit.items.length > 0 || data.randonnees.length > 0) && (
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
      )}

      <GroupeToCarnetCTA />
      <CarnetFooter />
    </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '0 0 calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }}>
            {/* Hero */}
            <div style={{ background: '#1C2620', padding: '24px 16px 20px', color: '#fff' }}>
              <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                Carnet de voyage
              </p>
              <h1 style={{ fontSize: '26px', fontWeight: '700', lineHeight: 1.15, marginBottom: '8px' }}>
                {data.meta.titleLine1}<br />
                <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#8BAF7C', fontWeight: 400 }}>{data.meta.titleLine2}</em>
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
                {data.meta.subtitleLine1}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.stats && (
                  <>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
                      📏 {data.stats.distance_km} km
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
                      ⛰️ {data.stats.denivele_m} m
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>
                      📅 {data.stats.duree_jours} jours
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Moments */}
            {data.moments.length > 0 && (
              <div style={{ padding: '20px 16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2620', marginBottom: '12px' }}>
                  Les <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>moments</em>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.moments.map(m => (
                    <div key={m.id} style={{ background: '#fff', borderRadius: '14px', padding: '14px', border: '1px solid #E8E4D8' }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#1C2620', margin: '0 0 4px' }}>{m.title}</p>
                      <p style={{ fontSize: '12px', color: '#5C6B5E', margin: 0, lineHeight: 1.4 }}>{m.description || m.content}</p>
                      {m.coordinates && (
                        <p style={{ fontSize: '10px', color: '#7A8A7D', fontFamily: 'ui-monospace, monospace', marginTop: '6px' }}>
                          📍 {m.coordinates.lat.toFixed(4)}, {m.coordinates.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kit souvenir */}
            {data.kit.items.length > 0 && (
              <div style={{ padding: '0 16px 20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2620', marginBottom: '12px' }}>
                  Le <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>kit</em>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.kit.items.slice(0, 5).map(item => (
                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', borderRadius: '12px', border: '1px solid #E8E4D8', fontSize: '13px' }}>
                      <span style={{ fontWeight: '600', color: '#1C2620' }}>{item.name}</span>
                      <span style={{ color: '#5C6B5E' }}>{item.weightG}g</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ background: '#132219', padding: '24px 16px 12px' }}>
              <p style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                {data.meta.titleLine1} — {data.meta.subtitleLine1}
              </p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                © Le Kit du Voyageur
              </p>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
