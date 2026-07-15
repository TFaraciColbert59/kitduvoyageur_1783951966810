'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface RentalListing {
  id: string;
  slug: string;
  title: string;
  owner: string;
  ownerAvatar: string;
  ownerTrustScore: number;
  category: string;
  pricePerDay: number;
  pricePerWeek: number;
  deposit: number;
  weightG: number;
  condition: 'neuf' | 'excellent' | 'bon' | 'correct';
  location: string;
  distance: number;
  available: boolean;
  nextAvailable?: string;
  image: string;
  alt: string;
  tags: string[];
  reviewCount: number;
  rating: number;
}

const CATEGORIES = ['Tout', 'Tentes', 'Sacs à dos', 'Couchage', 'Cuisine', 'Escalade', 'Eau', 'Vêtements', 'Chaussures', 'Bâtons', 'Éclairage', 'Sécurité'];

const conditionConfig = {
  neuf: { label: 'Neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  excellent: { label: 'Excellent', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  bon: { label: 'Bon état', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  correct: { label: 'Correct', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function MiniCalendar({ available }: { available: boolean }) {
  const today = new Date(2026, 6, 10);
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const bookedDays = available ? [14, 15, 16, 22, 23, 24, 25] : [10, 11, 12, 13, 14, 15, 16, 17];
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-background rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-700 text-sm text-foreground">Juillet 2026</span>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />Dispo</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 inline-block" />Réservé</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-mono text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`text-center text-xs py-1 rounded-md transition-colors ${
              day === null ? '' : bookedDays.includes(day)
                ? 'bg-red-50 text-red-400 border border-red-100'
                : day < 10 ? 'text-muted-foreground/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-pointer hover:bg-emerald-100'
            }`}
          >
            {day || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function RentalDetailModal({ listing, onClose }: { listing: RentalListing; onClose: () => void }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reserved, setReserved] = useState(false);
  const cond = conditionConfig[listing.condition];

  const days = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const totalPrice = days > 0 ? (days >= 7 ? listing.pricePerWeek * Math.ceil(days / 7) : listing.pricePerDay * days) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-display font-700 text-foreground text-base line-clamp-1">{listing.title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {!reserved ? (
          <div className="p-5 space-y-5">
            <div className="relative rounded-xl overflow-hidden aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.image} alt={listing.alt} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className={`text-xs font-600 px-2 py-1 rounded-full border ${cond.color}`}>{cond.label}</span>
                {!listing.available && (
                  <span className="text-xs font-600 px-2 py-1 rounded-full border text-red-600 bg-red-50 border-red-200">Indisponible</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background rounded-xl p-3 border border-border text-center">
                <p className="font-display font-700 text-foreground text-xl">{listing.pricePerDay}€</p>
                <p className="text-xs text-muted-foreground">par jour</p>
              </div>
              <div className="bg-background rounded-xl p-3 border border-border text-center">
                <p className="font-display font-700 text-foreground text-xl">{listing.pricePerWeek}€</p>
                <p className="text-xs text-muted-foreground">par semaine</p>
              </div>
              <div className="bg-background rounded-xl p-3 border border-border text-center">
                <p className="font-display font-700 text-amber-500 text-xl">{listing.deposit}€</p>
                <p className="text-xs text-muted-foreground">caution</p>
              </div>
            </div>

            {listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {listing.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground border border-border">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="StarIcon" size={14} variant={i < Math.floor(listing.rating) ? 'solid' : 'outline'} className={i < Math.floor(listing.rating) ? 'text-amber-400' : 'text-muted-foreground'} />
                ))}
              </div>
              <span className="font-semibold text-foreground text-sm">{listing.rating}</span>
              <span className="text-muted-foreground text-sm">({listing.reviewCount} avis)</span>
            </div>

            {listing.available && (
              <div>
                <h3 className="font-semibold text-foreground mb-3 text-sm">Choisir les dates</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Date de début</label>
                    <input type="date" className="input-field w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Date de fin</label>
                    <input type="date" className="input-field w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                {days > 0 && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{days} jour{days > 1 ? 's' : ''} de location</p>
                      <p className="text-xs text-muted-foreground">+ {listing.deposit}€ de caution (remboursée)</p>
                    </div>
                    <p className="font-display font-700 text-primary text-xl">{totalPrice}€</p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-2 border border-border rounded-xl hover:border-foreground/30 transition-all"
            >
              <Icon name="CalendarIcon" size={12} />
              {showCalendar ? 'Masquer le calendrier' : 'Voir les disponibilités'}
            </button>
            {showCalendar && <MiniCalendar available={listing.available} />}

            <div className="bg-background rounded-xl p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Propriétaire</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-700 text-sm flex-shrink-0">
                  {listing.ownerAvatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{listing.owner}</p>
                  <p className="text-xs text-muted-foreground">{listing.location}</p>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 rounded-lg px-2 py-1">
                  <Icon name="ShieldCheckIcon" size={12} className="text-primary" />
                  <span className="text-xs font-700 text-primary">{listing.ownerTrustScore}%</span>
                </div>
              </div>
            </div>

            <button
              disabled={!listing.available}
              onClick={() => listing.available && setReserved(true)}
              className={`w-full py-3 rounded-xl text-sm font-600 transition-all ${
                listing.available ? 'btn-primary justify-center' : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {listing.available
                ? days > 0 ? `Réserver — ${totalPrice}€ + ${listing.deposit}€ caution` : 'Réserver'
                : `Indisponible${listing.nextAvailable ? ` — Dispo le ${new Date(listing.nextAvailable).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}`
              }
            </button>

            <Link
              href={`/produit/${listing.slug}?type=location`}
              className="w-full py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
              Voir la fiche location complète
            </Link>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckIcon" size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-display font-700 text-foreground text-xl mb-2">Réservation confirmée !</h3>
            <p className="text-sm text-muted-foreground mb-2">{listing.title}</p>
            <p className="text-sm text-muted-foreground mb-6">{listing.owner} vous contactera pour organiser la remise du matériel.</p>
            <button onClick={onClose} className="btn-primary justify-center px-8 py-3">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RentalCard({ listing }: { listing: RentalListing }) {
  const [showDetail, setShowDetail] = useState(false);
  const cond = conditionConfig[listing.condition];

  return (
    <>
      <div className="topo-card group flex flex-col cursor-pointer hover:border-primary/20 transition-all" onClick={() => setShowDetail(true)}>
        <div className="relative overflow-hidden aspect-[4/3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.image} alt={listing.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
            {!listing.available && (
              <span className="text-[10px] font-600 px-2 py-0.5 rounded-full border text-red-600 bg-red-50 border-red-200">Indisponible</span>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1 gap-3">
          <div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{listing.category}</p>
            <h3 className="font-display font-700 text-foreground text-base leading-tight">{listing.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-700 flex-shrink-0">
              {listing.ownerAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground font-500 truncate">{listing.owner}</p>
              <p className="text-[10px] text-muted-foreground">{listing.location}</p>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 rounded-lg px-2 py-1">
              <Icon name="ShieldCheckIcon" size={12} className="text-primary" />
              <span className="text-[11px] font-700 text-primary">{listing.ownerTrustScore}</span>
            </div>
          </div>

          {listing.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {listing.tags.map((tag) => (
                <span key={tag} className="tag-badge tag-activity">{tag}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon name="StarIcon" size={12} className="text-amber-500 fill-amber-500" />
            <span className="font-600 text-foreground">{listing.rating}</span>
            <span>({listing.reviewCount} avis)</span>
          </div>

          <div className="border-t border-border pt-3 mt-auto">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xl font-display font-800 text-foreground">{listing.pricePerDay}€<span className="text-sm font-400 text-muted-foreground">/jour</span></p>
                <p className="text-xs text-muted-foreground">{listing.pricePerWeek}€/semaine · Caution {listing.deposit}€</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                disabled={!listing.available}
                className={`flex-1 py-2.5 rounded-xl text-sm font-600 transition-all ${
                  listing.available ? 'btn-primary justify-center' : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {listing.available ? 'Voir & Réserver' : 'Indisponible'}
              </button>
              <Link
                href={`/produit/${listing.slug}?type=location`}
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-2.5 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors flex items-center"
              >
                <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
              </Link>
            </div>
          </div>
        </div>
      </div>
      {showDetail && <RentalDetailModal listing={listing} onClose={() => setShowDetail(false)} />}
    </>
  );
}

export default function LocationPage() {
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [showListModal, setShowListModal] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'rating'>('distance');

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from('rental_items')
      .select('*, owner:user_profiles!rental_items_owner_id_fkey(full_name, trust_score)')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const mapped: RentalListing[] = (data ?? []).map((row: Record<string, unknown>) => {
          const owner = row.owner as { full_name?: string; trust_score?: number } | null;
          const ownerName = owner?.full_name ?? 'Propriétaire';
          const condRaw = (row.condition as string) ?? 'bon';
          const validConditions = ['neuf', 'excellent', 'bon', 'correct'] as const;
          const condition = validConditions.includes(condRaw as typeof validConditions[number])
            ? (condRaw as RentalListing['condition'])
            : 'bon';
          return {
            id: row.id as string,
            slug: `location-${row.id as string}`,
            title: row.title as string,
            owner: ownerName,
            ownerAvatar: ownerName[0]?.toUpperCase() ?? 'P',
            ownerTrustScore: owner?.trust_score ?? 70,
            category: 'Matériel',
            pricePerDay: Number(row.price_per_day ?? 0),
            pricePerWeek: Number(row.price_per_week ?? 0),
            deposit: Number(row.deposit ?? 0),
            weightG: 0,
            condition,
            location: (row.location as string) ?? '',
            distance: 0,
            available: Boolean(row.available),
            image: (row.image as string) ?? '',
            alt: (row.alt as string) ?? (row.title as string),
            tags: [],
            reviewCount: Number(row.reviews_count ?? 0),
            rating: Number(row.rating ?? 0),
          };
        });
        setListings(mapped);
        setLoading(false);
      });
  }, [supabase]);

  const filtered = listings
    .filter((l) => activeCategory === 'Tout' || l.category === activeCategory)
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'price') return a.pricePerDay - b.pricePerDay;
      return b.rating - a.rating;
    });

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="tag-badge bg-primary/20 text-primary border border-primary/30 text-[10px]">PHASE 2</span>
                  <span className="text-white/50 text-xs font-mono">LOCATION P2P</span>
                </div>
                <h1 className="text-section-title text-white mb-3">
                  Louez l&apos;équipement<br />de vos voisins aventuriers
                </h1>
                <p className="text-white/60 text-base max-w-xl">
                  Accédez à du matériel premium sans l&apos;acheter. Louez entre particuliers, vérifiez les disponibilités en temps réel et partez léger.
                </p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <button onClick={() => setShowListModal(true)} className="btn-primary py-3 px-6">
                  <Icon name="PlusIcon" size={16} />
                  Proposer mon matériel
                </button>
                <Link href="/compte" className="btn-ghost-white py-3 px-6">
                  Mes locations
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-10 max-w-lg">
              {[
                { value: String(listings.length), label: 'Annonces actives', icon: 'TagIcon' },
                { value: '4.8★', label: 'Note moyenne', icon: 'StarIcon' },
                { value: '48h', label: 'Délai moyen', icon: 'ClockIcon' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="font-display font-800 text-white text-xl">{stat.value}</p>
                  <p className="text-white/50 text-[10px] mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 flex-1 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`category-pill flex-shrink-0 ${activeCategory === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2 border-l border-border pl-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Trier par</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground outline-none cursor-pointer"
              >
                <option value="distance">Distance</option>
                <option value="price">Prix</option>
                <option value="rating">Note</option>
              </select>
            </div>
          </div>
        </section>

        {/* Listings Grid */}
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-600 text-foreground">{filtered.length}</span> annonces trouvées
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-80 bg-card border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="KeyIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
              <p>Aucune annonce de location disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((listing) => (
                <RentalCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-card border-t border-border py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-section-title text-foreground mb-10 text-center">Comment ça marche ?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: '01', icon: 'MagnifyingGlassIcon', title: 'Cherchez', desc: 'Filtrez par catégorie, lieu et disponibilité' },
                { step: '02', icon: 'CalendarIcon', title: 'Réservez', desc: 'Choisissez vos dates et payez la caution en ligne' },
                { step: '03', icon: 'HandRaisedIcon', title: 'Récupérez', desc: 'Rencontrez le propriétaire ou recevez par colis' },
                { step: '04', icon: 'StarIcon', title: 'Évaluez', desc: 'Laissez un avis et construisez votre Trust Score' },
              ].map((item) => (
                <div key={item.step} className="topo-card p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon name={item.icon} size={22} className="text-primary" />
                  </div>
                  <p className="font-mono text-primary text-xs mb-1">{item.step}</p>
                  <h3 className="font-display font-700 text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowListModal(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-foreground text-lg">Proposer mon matériel</h3>
              <button onClick={() => setShowListModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Titre de l&apos;annonce</label>
                <input className="input-field" placeholder="Ex: Tente Snow Peak Land Lock 4P" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Prix/jour (€)</label>
                  <input type="number" className="input-field" placeholder="12" />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Caution (€)</label>
                  <input type="number" className="input-field" placeholder="150" />
                </div>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">État</label>
                <select className="input-field">
                  <option>Neuf</option>
                  <option>Excellent</option>
                  <option>Bon état</option>
                  <option>Correct</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Description</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Décrivez votre matériel, son utilisation, ses accessoires inclus..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowListModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
              <button className="btn-primary flex-1 justify-center py-3">
                <Icon name="PlusIcon" size={16} />
                Publier
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}