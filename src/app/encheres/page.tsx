'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


interface BidListing {
  id: string;
  slug: string;
  title: string;
  seller: string;
  sellerAvatar: string;
  sellerTrustScore: number;
  category: string;
  startingPrice: number;
  currentBid: number;
  buyNowPrice?: number;
  condition: 'comme_neuf' | 'tres_bon' | 'bon' | 'acceptable';
  location: string;
  endsAt: string;
  image: string;
  alt: string;
  tags: string[];
  description: string;
  bidsCount: number;
  watchers: number;
  negotiable: boolean;
  shippingAvailable: boolean;
  topBidder?: string;
}

const CONDITION_CONFIG = {
  comme_neuf: { label: 'Comme neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  tres_bon: { label: 'Très bon', color: 'text-green-600 bg-green-50 border-green-200' },
  bon: { label: 'Bon état', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  acceptable: { label: 'Acceptable', color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

const STATIC_LISTINGS: BidListing[] = [
  {
    id: '1',
    slug: 'enchere-tente-msr-hubba',
    title: 'Tente MSR Hubba Hubba NX 2P',
    seller: 'AlpinistePro',
    sellerAvatar: 'A',
    sellerTrustScore: 96,
    category: 'Tentes',
    startingPrice: 150,
    currentBid: 220,
    buyNowPrice: 380,
    condition: 'tres_bon',
    location: 'Grenoble',
    endsAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente MSR Hubba Hubba NX 2 places orange montée en montagne',
    tags: ['Légère', '3 saisons', 'Double paroi'],
    description: 'Tente MSR Hubba Hubba NX 2 places en excellent état. Utilisée 5 nuits. Toutes les sardines et tendeurs présents.',
    bidsCount: 8,
    watchers: 23,
    negotiable: false,
    shippingAvailable: true,
    topBidder: 'Rando_Julien',
  },
  {
    id: '2',
    slug: 'enchere-sac-osprey-atmos',
    title: 'Sac à dos Osprey Atmos AG 65L',
    seller: 'TrekkeurSavoyard',
    sellerAvatar: 'T',
    sellerTrustScore: 88,
    category: 'Sacs à dos',
    startingPrice: 80,
    currentBid: 145,
    buyNowPrice: 250,
    condition: 'bon',
    location: 'Annecy',
    endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    alt: 'Sac à dos Osprey Atmos AG 65L bleu posé sur un rocher',
    tags: ['Anti-gravité', '65L', 'Taille M'],
    description: 'Osprey Atmos AG 65L taille M. Système anti-gravité en parfait état. Quelques marques d\'usure normales.',
    bidsCount: 5,
    watchers: 17,
    negotiable: true,
    shippingAvailable: true,
  },
  {
    id: '3',
    slug: 'enchere-chaussures-scarpa',
    title: 'Chaussures Scarpa Zodiac Plus GTX',
    seller: 'GrimpeursAlpins',
    sellerAvatar: 'G',
    sellerTrustScore: 92,
    category: 'Chaussures',
    startingPrice: 60,
    currentBid: 110,
    buyNowPrice: 180,
    condition: 'comme_neuf',
    location: 'Chamonix',
    endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    alt: 'Chaussures de randonnée Scarpa Zodiac Plus GTX grises sur fond blanc',
    tags: ['Gore-Tex', 'Taille 42', 'Vibram'],
    description: 'Scarpa Zodiac Plus GTX taille 42. Portées 2 fois seulement. Semelle Vibram intacte.',
    bidsCount: 12,
    watchers: 31,
    negotiable: false,
    shippingAvailable: true,
    topBidder: 'Montagnard_Pro',
  },
  {
    id: '4',
    slug: 'enchere-doudoune-arcteryx',
    title: "Doudoune Arc'teryx Cerium LT Hoody",
    seller: 'OutdoorLyon',
    sellerAvatar: 'O',
    sellerTrustScore: 85,
    category: 'Vêtements',
    startingPrice: 100,
    currentBid: 175,
    buyNowPrice: 300,
    condition: 'tres_bon',
    location: 'Lyon',
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80',
    alt: "Doudoune Arc'teryx Cerium LT Hoody bleue portée en montagne enneigée",
    tags: ['Duvet 850+', 'Taille M', 'Imperméable'],
    description: "Arc'teryx Cerium LT Hoody taille M. Duvet 850+ cuin. Légère et compressible. Très bon état général.",
    bidsCount: 7,
    watchers: 19,
    negotiable: false,
    shippingAvailable: true,
  },
  {
    id: '5',
    slug: 'enchere-crampons-petzl',
    title: 'Crampons Petzl Vasak 10 pointes',
    seller: 'AlpinistePro',
    sellerAvatar: 'A',
    sellerTrustScore: 96,
    category: 'Escalade',
    startingPrice: 40,
    currentBid: 75,
    buyNowPrice: 130,
    condition: 'bon',
    location: 'Grenoble',
    endsAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
    alt: 'Crampons Petzl Vasak 10 pointes en acier sur fond blanc',
    tags: ['10 pointes', 'Acier', 'Universel'],
    description: 'Crampons Petzl Vasak 10 pointes. Compatibles chaussures semi-rigides et rigides. Bon état, pointes peu usées.',
    bidsCount: 4,
    watchers: 11,
    negotiable: true,
    shippingAvailable: true,
  },
];

function getTimeLeft(endsAt: string): string {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Terminée';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}j ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
}

function isEndingSoon(endsAt: string): boolean {
  const diff = new Date(endsAt).getTime() - new Date().getTime();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

export default function EncheresPage() {
  const [listings] = useState<BidListing[]>(STATIC_LISTINGS);
  const [selectedListing, setSelectedListing] = useState<BidListing | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [placedBids, setPlacedBids] = useState<Record<string, number>>({});
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'ending' | 'bids' | 'price'>('ending');
  const [showBidModal, setShowBidModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const categories = ['all', ...Array.from(new Set(listings.map((l) => l.category)))];

  const filteredListings = listings
    .filter((l) => filterCategory === 'all' || l.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'ending') return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
      if (sortBy === 'bids') return b.bidsCount - a.bidsCount;
      if (sortBy === 'price') return a.currentBid - b.currentBid;
      return 0;
    });

  const handlePlaceBid = () => {
    if (!selectedListing || !bidAmount) return;
    const amount = Number(bidAmount);
    if (amount <= selectedListing.currentBid) return;
    setPlacedBids((prev) => ({ ...prev, [selectedListing.id]: amount }));
    setBidSuccess(true);
    setTimeout(() => { setBidSuccess(false); setShowBidModal(false); setBidAmount(''); }, 2000);
  };

  const handleMakeOffer = () => {
    if (!selectedListing || !offerAmount) return;
    setOfferSuccess(true);
    setTimeout(() => { setOfferSuccess(false); setShowOfferModal(false); setOfferAmount(''); }, 2000);
  };

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon name="BoltIcon" size={22} variant="outline" className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Phase 3 · Marketplace Avancée</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Enchères &amp; Négociation</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl">Enchérissez sur du matériel outdoor rare ou haut de gamme. Les meilleures affaires en temps réel.</p>
            <div className="grid grid-cols-3 gap-3 max-w-sm mt-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-primary">{listings.length}</p>
                <p className="text-xs text-white/50">Enchères actives</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-amber-400">{listings.reduce((s, l) => s + l.bidsCount, 0)}</p>
                <p className="text-xs text-white/50">Offres placées</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-emerald-400">{listings.filter((l) => isEndingSoon(l.endsAt)).length}</p>
                <p className="text-xs text-white/50">Se terminent bientôt</p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterCategory === cat ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {cat === 'all' ? 'Toutes' : cat}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="ending">Fin imminente</option>
                <option value="bids">Plus d&apos;offres</option>
                <option value="price">Prix croissant</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Listings Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredListings.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-muted-foreground">
                  <Icon name="BoltIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
                  <p>Aucune enchère active</p>
                </div>
              ) : filteredListings.map((listing) => {
                const timeLeft = getTimeLeft(listing.endsAt);
                const endingSoon = isEndingSoon(listing.endsAt);
                const myBid = placedBids[listing.id];
                const isWatched = watchlist.includes(listing.id);
                const cond = CONDITION_CONFIG[listing.condition];

                return (
                  <div
                    key={listing.id}
                    className={`bg-card rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${selectedListing?.id === listing.id ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'}`}
                    onClick={() => setSelectedListing(listing)}
                  >
                    <div className="relative h-40 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={listing.image} alt={listing.alt} className="w-full h-full object-cover" />
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-mono font-bold ${endingSoon ? 'bg-red-500 text-white animate-pulse' : 'bg-dark-bg/80 text-white'}`}>
                        ⏱ {timeLeft}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleWatchlist(listing.id); }}
                        className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${isWatched ? 'bg-primary text-white' : 'bg-dark-bg/60 text-white hover:bg-dark-bg/80'}`}
                      >
                        <Icon name="EyeIcon" size={14} variant="outline" />
                      </button>
                      {listing.buyNowPrice && (
                        <div className="absolute bottom-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                          Achat immédiat {listing.buyNowPrice}€
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display font-700 text-foreground text-sm line-clamp-2 flex-1">{listing.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${cond.color}`}>{cond.label}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Enchère actuelle</p>
                          <p className="font-display font-800 text-primary text-xl">{myBid ?? listing.currentBid}€</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{listing.bidsCount} offres</p>
                          <p className="text-xs text-muted-foreground">{listing.watchers} observateurs</p>
                        </div>
                      </div>

                      {listing.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {listing.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedListing(listing); setShowBidModal(true); }}
                          className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-600 hover:bg-primary/90 transition-colors"
                        >
                          Enchérir
                        </button>
                        {listing.negotiable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedListing(listing); setShowOfferModal(true); }}
                            className="flex-1 py-2 rounded-lg border border-border text-xs font-600 hover:bg-muted transition-colors"
                          >
                            Offre directe
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-1">
              {selectedListing ? (
                <div className="bg-card border border-border rounded-xl p-5 sticky top-24">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-700 text-foreground text-base line-clamp-1">{selectedListing.title}</h2>
                    <button onClick={() => setSelectedListing(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Icon name="XMarkIcon" size={16} />
                    </button>
                  </div>

                  <div className="relative rounded-xl overflow-hidden aspect-video mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedListing.image} alt={selectedListing.alt} className="w-full h-full object-cover" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Enchère actuelle</p>
                        <p className="font-display font-800 text-primary text-2xl">{placedBids[selectedListing.id] ?? selectedListing.currentBid}€</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Temps restant</p>
                        <p className={`font-mono font-700 text-sm ${isEndingSoon(selectedListing.endsAt) ? 'text-red-500' : 'text-foreground'}`}>
                          {getTimeLeft(selectedListing.endsAt)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedListing.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Vendeur</p>
                        <p className="font-600 text-foreground">{selectedListing.seller}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Localisation</p>
                        <p className="font-600 text-foreground">{selectedListing.location}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Fiabilité</p>
                        <p className="font-600 text-primary">{selectedListing.sellerTrustScore}%</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Offres</p>
                        <p className="font-600 text-foreground">{selectedListing.bidsCount}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowBidModal(true)}
                      className="w-full py-3 rounded-xl bg-primary text-white font-600 text-sm hover:bg-primary/90 transition-colors"
                    >
                      Placer une enchère
                    </button>
                    {selectedListing.buyNowPrice && (
                      <button className="w-full py-2.5 rounded-xl border border-emerald-400 text-emerald-600 font-600 text-sm hover:bg-emerald-50 transition-colors">
                        Acheter maintenant — {selectedListing.buyNowPrice}€
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Icon name="BoltIcon" size={32} variant="outline" className="mx-auto mb-3 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">Sélectionnez une enchère pour voir les détails</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bid Modal */}
      {showBidModal && selectedListing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBidModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {!bidSuccess ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Placer une enchère</h3>
                  <button onClick={() => setShowBidModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <div className="bg-background rounded-xl border border-border p-3 mb-4">
                  <p className="text-xs font-600 text-muted-foreground mb-1">Enchère actuelle</p>
                  <p className="font-display font-800 text-primary text-2xl">{selectedListing.currentBid}€</p>
                  <p className="text-xs text-muted-foreground mt-1">Enchère minimum : {selectedListing.currentBid + 5}€</p>
                </div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Votre enchère (€)</label>
                <input
                  type="number"
                  className="input-field w-full mb-4"
                  placeholder={`Min. ${selectedListing.currentBid + 5}`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowBidModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button onClick={handlePlaceBid} className="btn-primary flex-1 justify-center py-3">Enchérir</button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Enchère placée !</h3>
                <p className="text-sm text-muted-foreground">Vous êtes le meilleur enchérisseur.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowOfferModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {!offerSuccess ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Faire une offre directe</h3>
                  <button onClick={() => setShowOfferModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Votre offre (€)</label>
                <input
                  type="number"
                  className="input-field w-full mb-4"
                  placeholder="Montant de votre offre"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowOfferModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button onClick={handleMakeOffer} className="btn-primary flex-1 justify-center py-3">Envoyer</button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Offre envoyée !</h3>
                <p className="text-sm text-muted-foreground">Le vendeur vous répondra bientôt.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}