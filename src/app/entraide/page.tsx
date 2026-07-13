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
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span>
              <span className="text-white/50 text-xs font-mono-data">ENTRAIDE SOS</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h1 className="text-section-title text-white mb-3">
                  Réseau d&apos;entraide<br />
                  <span className="text-primary">géolocalisé</span>
                </h1>
                <p className="text-white/60 text-base max-w-xl">
                  Panne van, pharmacie oubliée, guide de dernière minute — lancez un appel visible aux membres à proximité. Chaque aide confirmée ajoute au Trust Score de l&apos;aidant.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {/* Opt-in toggle */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Icon name="MapPinIcon" size={16} className="text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-sm font-600 text-white">Recevoir les appels à proximité</p>
                    <p className="text-xs text-white/50">Opt-in géolocalisation</p>
                  </div>
                  <button
                    onClick={() => setOptedIn((v) => !v)}
                    className={`w-11 h-6 rounded-full transition-all relative ${optedIn ? 'bg-emerald-500' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${optedIn ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
                <button
                  onClick={() => setShowNewRequest(true)}
                  className="btn-primary"
                >
                  <Icon name="MegaphoneIcon" size={16} />
                  Lancer un appel d&apos;entraide
                </button>
              </div>
            </div>

            {/* Distinction from SOS */}
            <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
              <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">
                <strong>Ce module est pour l&apos;entraide logistique entre voyageurs.</strong> En cas d&apos;urgence vitale (blessure grave, détresse médicale), utilisez le{' '}
                <a href="/alertes" className="underline text-amber-300">module SOS urgence</a> qui contacte les secours officiels.
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 py-3">
              {[
                { id: 'all', label: 'Tous les appels' },
                { id: 'open', label: '🔴 En attente' },
                { id: 'nearby', label: '📍 < 10 km' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as typeof filter)}
                  className={`category-pill flex-shrink-0 ${filter === f.id ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Request list */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-700 text-foreground text-lg">Appels actifs</h2>
                <span className="font-mono-data text-xs text-muted-foreground">{filtered.length} appels</span>
              </div>
              {filtered.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  isSelected={selectedRequest === r.id}
                  onSelect={() => setSelectedRequest(r.id)}
                />
              ))}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-3">
              {selected ? (
                <div className="topo-card p-6">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-5">
                    <span className="text-4xl">{selected.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${typeConfig[selected.type].color}`}>
                          {typeConfig[selected.type].label}
                        </span>
                        <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${statusConfig[selected.status].color}`}>
                          {statusConfig[selected.status].label}
                        </span>
                      </div>
                      <h2 className="font-display font-700 text-foreground text-xl">{selected.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Icon name="MapPinIcon" size={12} />
                        {selected.location} · {selected.distanceKm} km de vous
                      </p>
                    </div>
                  </div>

                  {/* Author */}
                  <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border mb-5">
                    <div className="w-9 h-9 rounded-xl bg-secondary text-white flex items-center justify-center text-sm font-700">
                      {selected.authorAvatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-700 text-foreground">{selected.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selected.postedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {new Date(selected.postedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <TrustRing score={selected.authorTrustScore} size={44} />
                  </div>

                  <p className="text-sm text-foreground leading-relaxed mb-6">{selected.description}</p>

                  {/* Help offers */}
                  <div className="mb-5">
                    <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2">
                      <Icon name="HandRaisedIcon" size={16} className="text-primary" />
                      Aides proposées ({HELP_OFFERS.length})
                    </h3>
                    <div className="space-y-3">
                      {HELP_OFFERS.map((offer) => (
                        <div key={offer.id} className={`p-4 rounded-xl border ${offer.confirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-background border-border'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center text-xs font-700 flex-shrink-0">
                              {offer.helperAvatar}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-700 text-foreground">{offer.helper}</span>
                                {offer.confirmed && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-700">✓ Confirmé</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">{offer.distance} · ETA {offer.eta}</p>
                            </div>
                            <TrustRing score={offer.helperTrustScore} size={36} />
                          </div>
                          <p className="text-xs text-foreground">{offer.message}</p>
                          {!offer.confirmed && (
                            <div className="flex gap-2 mt-3">
                              <button className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-700 hover:bg-emerald-600 transition-colors">
                                Confirmer l&apos;aide (+Trust Score)
                              </button>
                              <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                                Contacter
                              </button>
                            </div>
                          )}
                          {offer.confirmed && (
                            <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1">
                              <Icon name="CheckBadgeIcon" size={11} />
                              Aide confirmée — Trust Score de {offer.helper} augmenté
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Propose help */}
                  {selected.status === 'open' && (
                    <div className="border-t border-border pt-5">
                      <h3 className="font-display font-700 text-foreground text-sm mb-3">Proposer votre aide</h3>
                      <textarea
                        rows={3}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3"
                        placeholder="Décrivez comment vous pouvez aider..."
                      />
                      <button className="btn-primary w-full justify-center py-2.5 text-sm">
                        <Icon name="HandRaisedIcon" size={15} />
                        Proposer mon aide
                      </button>
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
                        Si votre aide est confirmée par le bénéficiaire, votre Trust Score sera augmenté.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="topo-card p-12 text-center">
                  <Icon name="HandRaisedIcon" size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">Sélectionnez un appel pour voir les détails</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New request modal */}
      {showNewRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-foreground text-lg">Lancer un appel d&apos;entraide</h2>
              <button onClick={() => setShowNewRequest(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Type de besoin</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'panne', label: '🔧 Panne' },
                    { id: 'pharmacie', label: '💊 Santé' },
                    { id: 'guide', label: '🗺️ Guide' },
                    { id: 'logistique', label: '📦 Logistique' },
                    { id: 'info', label: 'ℹ️ Info' },
                  ].map((t) => (
                    <button key={t.id} className="py-2 px-2 rounded-xl border border-border text-xs font-600 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Titre</label>
                <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Décrivez brièvement votre besoin" />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Description détaillée</label>
                <textarea rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Donnez tous les détails utiles..." />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <Icon name="ExclamationTriangleIcon" size={13} className="flex-shrink-0 mt-0.5" />
                Urgence vitale ? Utilisez le module SOS urgence, pas ce formulaire.
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewRequest(false)} className="flex-1 btn-secondary py-2.5 text-sm justify-center">Annuler</button>
                <button className="flex-1 btn-primary py-2.5 text-sm justify-center">Lancer l&apos;appel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
