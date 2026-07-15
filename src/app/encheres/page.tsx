'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
  const [listings, setListings] = useState<BidListing[]>([]);
  const [loading, setLoading] = useState(true);
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

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from('auction_items')
      .select('*')
      .eq('status', 'active')
      .order('ends_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Enchères fetch error:', error);
          setLoading(false);
          return;
        }
        const mapped: BidListing[] = (data ?? []).map((row: Record<string, unknown>) => {
          const condRaw = (row.condition as string) ?? 'bon';
          const validConditions = ['comme_neuf', 'tres_bon', 'bon', 'acceptable'] as const;
          const condition = validConditions.includes(condRaw as typeof validConditions[number])
            ? (condRaw as BidListing['condition'])
            : 'bon';
          return {
            id: row.id as string,
            slug: `enchere-${row.id as string}`,
            title: row.title as string,
            seller: 'Vendeur',
            sellerAvatar: 'V',
            sellerTrustScore: 70,
            category: 'Matériel',
            startingPrice: Number(row.start_price ?? 0),
            currentBid: Number(row.current_bid ?? 0),
            buyNowPrice: row.buy_now_price ? Number(row.buy_now_price) : undefined,
            condition,
            location: '',
            endsAt: (row.ends_at as string) ?? new Date(Date.now() + 86400000).toISOString(),
            image: (row.image as string) ?? '',
            alt: (row.alt as string) ?? (row.title as string),
            tags: [],
            description: (row.description as string) ?? '',
            bidsCount: Number(row.bids_count ?? 0),
            watchers: Number(row.watchers_count ?? 0),
            negotiable: false,
            shippingAvailable: false,
          };
        });
        setListings(mapped);
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const categories = ['all', ...Array.from(new Set(listings.map((l) => l.category)))];

  const filteredListings = listings.filter((l) => filterCategory === 'all' || l.category === filterCategory).sort((a, b) => {
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

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-64 bg-card border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
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
                          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isWatched ? 'bg-primary text-white' : 'bg-dark-bg/60 text-white hover:bg-dark-bg/80'}`}
                        >
                          <Icon name="HeartIcon" size={16} variant={isWatched ? 'solid' : 'outline'} />
                        </button>
                        {myBid && (
                          <div className="absolute bottom-2 left-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-lg font-medium">
                            Votre offre: {myBid} €
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold leading-tight flex-1">{listing.title}</h3>
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${cond.color}`}>{cond.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center font-bold">
                            {listing.sellerAvatar}
                          </div>
                          <span className="text-xs text-muted-foreground">{listing.seller}</span>
                          <span className="text-xs text-emerald-600 font-mono">{listing.sellerTrustScore}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Enchère actuelle</p>
                            <p className="text-lg font-display font-700 text-primary">{listing.currentBid} €</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{listing.bidsCount} offres</p>
                            <p className="text-xs text-muted-foreground">{listing.watchers} 👁</p>
                          </div>
                        </div>
                        {listing.buyNowPrice && (
                          <p className="text-xs text-muted-foreground mt-1">Achat immédiat: <span className="font-mono font-semibold">{listing.buyNowPrice} €</span></p>
                        )}
                        <Link
                          href={`/produit/${listing.slug}?type=enchere`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 block w-full text-center py-1.5 rounded-lg text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                        >
                          Voir la fiche enchère →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail Panel */}
              <div className="space-y-4">
                {selectedListing ? (
                  <div className="bg-card rounded-xl border border-border overflow-hidden sticky top-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedListing.image} alt={selectedListing.alt} className="w-full h-44 object-cover" />
                    <div className="p-4">
                      <h3 className="font-display font-700 text-base mb-1">{selectedListing.title}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center font-bold">
                          {selectedListing.sellerAvatar}
                        </div>
                        <span className="text-sm text-muted-foreground">{selectedListing.seller}</span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          Trust {selectedListing.sellerTrustScore}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{selectedListing.description}</p>
                      <div className="space-y-2 text-xs border-t border-border pt-3 mb-3">
                        <div className="flex justify-between"><span className="text-muted-foreground">Enchère actuelle</span><span className="font-mono font-bold text-primary text-base">{selectedListing.currentBid} €</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Enchère de départ</span><span className="font-mono">{selectedListing.startingPrice} €</span></div>
                        {selectedListing.buyNowPrice && <div className="flex justify-between"><span className="text-muted-foreground">Achat immédiat</span><span className="font-mono font-semibold">{selectedListing.buyNowPrice} €</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Offres</span><span>{selectedListing.bidsCount} enchères</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Fin</span><span className={isEndingSoon(selectedListing.endsAt) ? 'text-red-500 font-semibold' : ''}>{getTimeLeft(selectedListing.endsAt)}</span></div>
                      </div>
                      <div className="space-y-2">
                        <button onClick={() => setShowBidModal(true)} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                          🔨 Enchérir
                        </button>
                        {selectedListing.buyNowPrice && (
                          <button className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                            ⚡ Acheter maintenant — {selectedListing.buyNowPrice} €
                          </button>
                        )}
                        <Link
                          href={`/produit/${selectedListing.slug}?type=enchere`}
                          className="w-full py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
                          Fiche produit enchère
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border p-8 text-center">
                    <Icon name="BoltIcon" size={32} variant="outline" className="mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">Sélectionnez une enchère pour voir les détails et placer une offre</p>
                  </div>
                )}

                {/* Watchlist */}
                {watchlist.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Icon name="HeartIcon" size={16} variant="solid" className="text-primary" />
                      Mes favoris ({watchlist.length})
                    </h3>
                    <div className="space-y-2">
                      {listings.filter((l) => watchlist.includes(l.id)).map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => setSelectedListing(l)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.image} alt={l.alt} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{l.title}</p>
                            <p className="text-muted-foreground">{l.currentBid} € · {getTimeLeft(l.endsAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bid Modal */}
      {showBidModal && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            {bidSuccess ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-lg font-display font-700 text-emerald-600">Enchère placée !</h3>
                <p className="text-sm text-muted-foreground mt-1">Vous êtes maintenant le meilleur enchérisseur.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-700">Placer une enchère</h2>
                  <button onClick={() => setShowBidModal(false)} className="p-2 hover:bg-muted rounded-lg">
                    <Icon name="XMarkIcon" size={20} variant="outline" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{selectedListing.title}</p>
                <p className="text-sm mb-4">Enchère actuelle: <span className="font-mono font-bold text-primary">{selectedListing.currentBid} €</span></p>
                <div className="mb-4">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Votre enchère (min. {selectedListing.currentBid + 5} €)</label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={selectedListing.currentBid + 5}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={`Min. ${selectedListing.currentBid + 5} €`}
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowBidModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button
                    onClick={handlePlaceBid}
                    disabled={!bidAmount || Number(bidAmount) <= selectedListing.currentBid}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            {offerSuccess ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">📨</div>
                <h3 className="text-lg font-display font-700 text-blue-600">Offre envoyée !</h3>
                <p className="text-sm text-muted-foreground mt-1">Le vendeur recevra votre proposition et vous répondra sous 24h.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-700">Faire une offre</h2>
                  <button onClick={() => setShowOfferModal(false)} className="p-2 hover:bg-muted rounded-lg">
                    <Icon name="XMarkIcon" size={20} variant="outline" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Proposez un prix directement au vendeur.</p>
                <div className="mb-4">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Votre offre (€)</label>
                  <input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={`Ex: ${Math.round(selectedListing.currentBid * 0.9)} €`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Prix actuel: {selectedListing.currentBid} €</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowOfferModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Annuler</button>
                  <button
                    onClick={handleMakeOffer}
                    disabled={!offerAmount}
                    className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Envoyer l&apos;offre
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}