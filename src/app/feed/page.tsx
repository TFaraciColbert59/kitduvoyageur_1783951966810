'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

const JOURNALS = [
  { id: 'j1', author: 'Thomas Vernet', authorId: 'fake-author-1', authorAvatar: 'TV', authorTrustScore: 94, authorLevel: 'ambassadeur', title: 'Circuit des Annapurnas — 18 jours en autonomie complète', destination: 'Circuit des Annapurnas', country: 'Népal', countryCode: 'np', duration: '18 jours', date: '2026-07-01', coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fc94b322-1777501827822.png", coverAlt: 'Randonneur avec sac à dos sur sentier himalayan', excerpt: 'Départ de Besisahar le 12 mars, retour à Pokhara le 30.', gpsTrace: true, gpsPoints: 2847, weatherReal: 'Ensoleillé J1–J14, tempête neige J15–J18', gearUsed: [{ name: 'Osprey Atmos 65', category: 'Sac à dos', rating: 5, linked: true }], missingGear: ['Guêtres imperméables'], routeRating: 9.2, reactions: { useful: 203, securityConfirmed: 87, bagHelped: 156 }, comments: 34, readTime: 12, verified: true },
  { id: 'j2', author: 'Camille Rousseau', authorId: 'fake-author-2', authorAvatar: 'CR', authorTrustScore: 87, authorLevel: 'expert', title: 'GR20 Corse — 15 jours de bout en bout', destination: 'GR20', country: 'France (Corse)', countryCode: 'fr', duration: '15 jours', date: '2026-06-20', coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_12782a0e5-1772085588678.png", coverAlt: 'Randonneuse sur sentier rocheux corse', excerpt: 'Le GR20 en juin : chaleur intense en basse altitude.', gpsTrace: true, gpsPoints: 1923, weatherReal: '28°C en vallée, 12°C en altitude', gearUsed: [{ name: 'Sac Deuter Aircontact 55+10', category: 'Sac à dos', rating: 4, linked: true }], missingGear: ['Filtre à eau'], routeRating: 8.8, reactions: { useful: 178, securityConfirmed: 64, bagHelped: 142 }, comments: 28, readTime: 9, verified: true },
];

export default function FeedPage() {
  const [journals, setJournals] = useState(JOURNALS);
  const [filter, setFilter] = useState<'all' | 'verified' | 'ambassadeur' | 'gps'>('all');
  const [showNewJournal, setShowNewJournal] = useState(false);

  const filtered = JOURNALS.filter((j) => { if (filter === 'verified') return j.verified; if (filter === 'gps') return j.gpsTrace; return true; });

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          <div className="pt-16 lg:pt-18">
            <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
              <div className="max-w-7xl mx-auto relative">
                <div className="flex items-center gap-2 mb-4"><span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span><span className="text-white/50 text-xs font-mono-data">CARNETS DE VOYAGE</span></div>
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div><h1 className="text-section-title text-white mb-3">Carnets d&apos;expédition<br /><span className="text-primary">vérifiés par les données</span></h1><p className="text-white/60 text-base max-w-xl">Pas des posts — des récits longs avec tracé GPS, météo réelle, matériel utilisé.</p></div>
                  <button onClick={() => setShowNewJournal(true)} className="btn-primary flex-shrink-0 self-start lg:self-auto"><Icon name="PencilSquareIcon" size={16} />Écrire un carnet</button>
                </div>
              </div>
            </section>
            <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border"><div className="max-w-7xl mx-auto px-4"><div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-hide">
              {[{ id: 'all', label: 'Tous les carnets' }, { id: 'verified', label: '✓ Achat vérifié' }, { id: 'gps', label: '📍 Tracé GPS' }, { id: 'recent', label: 'Récents' }].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id as typeof filter)} className={`category-pill flex-shrink-0 ${filter === f.id ? 'active' : ''}`}>{f.label}</button>
              ))}
            </div></div></section>
            <div className="max-w-7xl mx-auto px-4 py-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">{filtered.map((j) => <div key={j.id} className="topo-card overflow-hidden p-5"><h2 className="font-display font-700 text-lg mb-2">{j.title}</h2><p className="text-sm text-muted-foreground">{j.excerpt}</p></div>)}</div>
              </div>
            </div>
          </div>
          <Footer />
        </main>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Carnets d&apos;expédition</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Récits avec tracé GPS et matériel utilisé.</p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
              {[{ id: 'all', label: 'Tous' }, { id: 'verified', label: 'Vérifiés' }, { id: 'gps', label: 'GPS' }].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id as typeof filter)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', background: filter === f.id ? '#17402C' : '#F4F1EA', color: filter === f.id ? 'white' : 'rgba(28,38,32,0.6)', whiteSpace: 'nowrap' }}>{f.label}</button>
              ))}
            </div>
            {filtered.map((j) => (
              <div key={j.id} style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', padding: '14px', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#1C2620', marginBottom: '4px' }}>{j.title}</h2>
                <p style={{ fontSize: '11px', color: 'rgba(28,38,32,0.5)', marginBottom: '8px' }}>{j.author} · {j.country} · {j.duration}</p>
                <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.6)', lineHeight: '1.5' }}>{j.excerpt}</p>
              </div>
            ))}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
