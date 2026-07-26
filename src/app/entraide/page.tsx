'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

interface HelpRequest {
  id: string;
  author: string;
  authorAvatar: string;
  authorTrustScore: number;
  type: 'panne' | 'pharmacie' | 'guide' | 'logistique' | 'info';
  emoji: string;
  title: string;
  description: string;
  location: string;
  distanceKm: number;
  postedAt: string;
  status: 'open' | 'helped' | 'resolved';
  helpers: number;
  confirmedHelp?: boolean;
}

interface HelpOffer {
  id: string;
  helper: string;
  helperAvatar: string;
  helperTrustScore: number;
  message: string;
  distance: string;
  eta: string;
  confirmed: boolean;
}

const HELP_REQUESTS: HelpRequest[] = [
  {
    id: 'h1',
    author: 'Erik Lindström',
    authorAvatar: 'EL',
    authorTrustScore: 79,
    type: 'panne',
    emoji: '🔧',
    title: 'Panne van — courroie de distribution',
    description: 'Van immobilisé sur D918 entre Cauterets et Luz-Saint-Sauveur. Courroie de distribution lâchée. Cherche quelqu\'un avec remorque ou contact mécanicien local qui accepte les vans aménagés.',
    location: 'D918, Hautes-Pyrénées (65)',
    distanceKm: 4.2,
    postedAt: '2026-07-10T14:30:00',
    status: 'open',
    helpers: 2,
    confirmedHelp: false,
  },
  {
    id: 'h2',
    author: 'Marie Corse',
    authorAvatar: 'MC',
    authorTrustScore: 74,
    type: 'pharmacie',
    emoji: '💊',
    title: 'Pharmacie ouverte dimanche — Corte',
    description: 'Besoin d\'ibuprofène et de pansements hydrocolloïdes (ampoules). Pharmacie de garde à Corte ce dimanche ? Google Maps donne des infos contradictoires.',
    location: 'Corte, Haute-Corse (2B)',
    distanceKm: 1.8,
    postedAt: '2026-07-10T11:15:00',
    status: 'helped',
    helpers: 3,
    confirmedHelp: true,
  },
  {
    id: 'h3',
    author: 'Lucas Pérou',
    authorAvatar: 'LP',
    authorTrustScore: 68,
    type: 'guide',
    emoji: '🗺️',
    title: 'Guide local dernière minute — Cusco',
    description: 'Mon guide prévu s\'est désisté ce matin pour le trek Salkantay. Départ demain 5h. Cherche guide certifié ou contact fiable à Cusco. Budget 80–120$/jour.',
    location: 'Cusco, Pérou',
    distanceKm: 12.4,
    postedAt: '2026-07-10T08:45:00',
    status: 'open',
    helpers: 1,
    confirmedHelp: false,
  },
  {
    id: 'h4',
    author: 'Sophie Van',
    authorAvatar: 'SV',
    authorTrustScore: 88,
    type: 'logistique',
    emoji: '📦',
    title: 'Colis bloqué en douane — Marrakech',
    description: 'Pièce de rechange pour van bloquée en douane marocaine depuis 5 jours. Quelqu\'un a déjà géré ça ? Besoin d\'un contact ou d\'un transitaire local.',
    location: 'Marrakech, Maroc',
    distanceKm: 28.7,
    postedAt: '2026-07-09T16:20:00',
    status: 'resolved',
    helpers: 4,
    confirmedHelp: true,
  },
];

const HELP_OFFERS: HelpOffer[] = [
  {
    id: 'o1',
    helper: 'Thomas Vernet',
    helperAvatar: 'TV',
    helperTrustScore: 94,
    message: 'J\'ai une remorque et je suis à 20 min. Je peux te remorquer jusqu\'à Lourdes où il y a un mécanicien spécialisé van.',
    distance: '18 km',
    eta: '25 min',
    confirmed: false,
  },
  {
    id: 'o2',
    helper: 'Camille Rousseau',
    helperAvatar: 'CR',
    helperTrustScore: 87,
    message: 'Contact mécanicien à Luz-Saint-Sauveur : Garage Pyrénées, il accepte les vans. Tel : demande-moi en MP.',
    distance: '6 km',
    eta: 'Info immédiate',
    confirmed: true,
  },
];

const typeConfig = {
  panne: { color: 'bg-red-100 text-red-700', label: 'Panne véhicule' },
  pharmacie: { color: 'bg-blue-100 text-blue-700', label: 'Pharmacie / Santé' },
  guide: { color: 'bg-purple-100 text-purple-700', label: 'Guide local' },
  logistique: { color: 'bg-amber-100 text-amber-700', label: 'Logistique' },
  info: { color: 'bg-gray-100 text-gray-700', label: 'Information' },
};

const statusConfig = {
  open: { color: 'bg-orange-100 text-orange-700', label: 'En attente d\'aide' },
  helped: { color: 'bg-blue-100 text-blue-700', label: 'Aide en cours' },
  resolved: { color: 'bg-emerald-100 text-emerald-700', label: 'Résolu ✓' },
};

function TrustRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-mono-data text-foreground" style={{ fontSize: size * 0.26, fontWeight: 700 }}>{score}</span>
    </div>
  );
}

function RequestCard({ request, isSelected, onSelect }: { request: HelpRequest; isSelected: boolean; onSelect: () => void }) {
  const typeCfg = typeConfig[request.type];
  const statusCfg = statusConfig[request.status];

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left topo-card p-4 transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{request.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-display font-700 text-foreground text-sm leading-tight">{request.title}</h3>
            <span className={`text-[9px] font-700 px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${typeCfg.color}`}>{typeCfg.label}</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Icon name="MapPinIcon" size={9} />
              {request.distanceKm} km
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{request.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-secondary text-white flex items-center justify-center text-[9px] font-700">
                {request.authorAvatar}
              </div>
              <span className="text-[10px] text-muted-foreground">{request.author}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{request.helpers} aide{request.helpers > 1 ? 's' : ''} proposée{request.helpers > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function EntraidePage() {
  const [selectedRequest, setSelectedRequest] = useState<string | null>('h1');
  const [optedIn, setOptedIn] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'nearby'>('all');

  const selected = HELP_REQUESTS.find((r) => r.id === selectedRequest);
  const filtered = HELP_REQUESTS.filter((r) => {
    if (filter === 'open') return r.status === 'open';
    if (filter === 'nearby') return r.distanceKm <= 10;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: '#E7E3D6' }}>
      <Header />

      {/* ── Hero ── */}
      <section style={{ background: '#1C2620' }} className="pt-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none" style={{ background: 'radial-gradient(circle, #4A6741 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: '#E4501C' }}>Communauté</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
            <span className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Entraide SOS</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h1 className="font-display mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
                Réseau d&apos;entraide<br />
                <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.65)' }}>géolocalisé.</em>
              </h1>
              <p className="text-sm max-w-xl" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                Panne van, pharmacie oubliée, guide de dernière minute — lancez un appel visible aux membres à proximité. Chaque aide confirmée ajoute au Trust Score de l&apos;aidant.
              </p>
            </div>

            <div className="flex flex-col gap-4 flex-shrink-0">
              {/* Opt-in toggle */}
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Icon name="MapPinIcon" size={16} style={{ color: '#10b981' }} />
                <div className="flex-1">
                  <p className="text-sm font-600 text-white">Recevoir les appels à proximité</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Opt-in géolocalisation</p>
                </div>
                <button
                  onClick={() => setOptedIn((v) => !v)}
                  className="w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                  style={{ background: optedIn ? '#10b981' : 'rgba(255,255,255,0.15)' }}
                >
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: optedIn ? '22px' : '2px' }} />
                </button>
              </div>

              <button
                onClick={() => setShowNewRequest(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-700 transition-all"
                style={{ background: '#E4501C', color: '#fff' }}
              >
                <Icon name="ExclamationTriangleIcon" size={15} />
                Lancer un appel SOS
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-8 flex-wrap">
            {[
              { value: HELP_REQUESTS.filter(r => r.status === 'open').length.toString(), label: 'appels ouverts' },
              { value: HELP_REQUESTS.filter(r => r.status === 'resolved').length.toString(), label: 'résolus' },
              { value: HELP_REQUESTS.reduce((s, r) => s + r.helpers, 0).toString(), label: 'aides proposées' },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className="font-mono font-700 text-base" style={{ color: '#E4501C' }}>{s.value}</span>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {[
            { id: 'all', label: 'Tous les appels' },
            { id: 'open', label: '🆘 En attente' },
            { id: 'nearby', label: '📍 À proximité (< 10 km)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className="px-4 py-2 rounded-xl text-sm font-600 transition-all"
              style={{
                background: filter === f.id ? '#1C2620' : '#fff',
                color: filter === f.id ? '#fff' : '#5C6B5E',
                border: `1px solid ${filter === f.id ? '#1C2620' : '#E8E4DA'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: requests list */}
          <div className="lg:col-span-2 space-y-3">
            {filtered.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isSelected={selectedRequest === request.id}
                onSelect={() => setSelectedRequest(request.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-[#5C6B5E]">
                <p className="text-3xl mb-2">🆘</p>
                <p className="text-sm">Aucun appel pour ce filtre</p>
              </div>
            )}
          </div>

          {/* Right: detail panel */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="rounded-2xl overflow-hidden sticky top-24" style={{ background: '#fff', border: '1px solid #E8E4DA' }}>
                {/* Header */}
                <div className="p-5" style={{ background: '#1C2620' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">{selected.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${typeConfig[selected.type].color}`}>{typeConfig[selected.type].label}</span>
                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${statusConfig[selected.status].color}`}>{statusConfig[selected.status].label}</span>
                      </div>
                      <h2 className="font-display font-700 text-white text-lg leading-tight">{selected.title}</h2>
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        <Icon name="MapPinIcon" size={11} /> {selected.location} · {selected.distanceKm} km
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Author */}
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F5F2E8', border: '1px solid #E8E4DA' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-700 text-white flex-shrink-0" style={{ background: '#4A6741' }}>
                      {selected.authorAvatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-600 text-sm text-[#1C2620]">{selected.author}</p>
                      <p className="text-xs text-[#5C6B5E]">Trust Score {selected.authorTrustScore}</p>
                    </div>
                    <TrustRing score={selected.authorTrustScore} size={40} />
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E] mb-2">Description</p>
                    <p className="text-sm text-[#1C2620] leading-relaxed">{selected.description}</p>
                  </div>

                  {/* Offers */}
                  {selected.id === 'h1' && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B5E] mb-3">Aides proposées ({HELP_OFFERS.length})</p>
                      <div className="space-y-3">
                        {HELP_OFFERS.map((offer) => (
                          <div key={offer.id} className="p-4 rounded-xl" style={{ background: '#F5F2E8', border: `1px solid ${offer.confirmed ? 'rgba(16,185,129,0.3)' : '#E8E4DA'}` }}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-700 text-white flex-shrink-0" style={{ background: '#1C2620' }}>
                                {offer.helperAvatar}
                              </div>
                              <div className="flex-1">
                                <p className="font-600 text-sm text-[#1C2620]">{offer.helper}</p>
                                <p className="text-[10px] text-[#5C6B5E]">{offer.distance} · {offer.eta}</p>
                              </div>
                              {offer.confirmed && <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Confirmé</span>}
                            </div>
                            <p className="text-xs text-[#5C6B5E] leading-relaxed">{offer.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {selected.status === 'open' && (
                    <button
                      className="w-full py-3 rounded-xl text-sm font-700 transition-all"
                      style={{ background: '#E4501C', color: '#fff' }}
                    >
                      <Icon name="HandRaisedIcon" size={15} className="inline mr-2" />
                      Proposer mon aide
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-[#5C6B5E]">
                <p className="text-4xl mb-3">👆</p>
                <p className="text-sm">Sélectionnez un appel pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New request modal */}
      {showNewRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md p-6" style={{ background: '#EDEAE0', border: '1px solid #C8C3B0' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-[#1C2620] text-xl">Lancer un appel SOS</h2>
              <button onClick={() => setShowNewRequest(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <p className="text-sm text-[#5C6B5E] mb-4">Décrivez votre situation et les membres à proximité seront notifiés.</p>
            <div className="space-y-3">
              <input placeholder="Titre de votre appel" className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none" style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' }} />
              <textarea rows={3} placeholder="Décrivez votre situation..." className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none" style={{ background: '#fff', border: '1px solid #C8C3B0', color: '#1C2620' }} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewRequest(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-600 text-[#5C6B5E]" style={{ borderColor: '#C8C3B0' }}>Annuler</button>
              <button onClick={() => setShowNewRequest(false)} className="flex-1 py-2.5 rounded-xl text-sm font-700 transition-all" style={{ background: '#E4501C', color: '#fff' }}>Envoyer l&apos;appel</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
