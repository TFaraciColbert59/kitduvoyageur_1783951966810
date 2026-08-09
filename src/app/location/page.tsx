'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

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

const STATIC_LISTINGS: RentalListing[] = [
  {
    id: '1',
    slug: 'location-tente-hilleberg-keron',
    title: 'Tente Hilleberg Keron 3 GT',
    owner: 'Thomas V.',
    ownerAvatar: 'T',
    ownerTrustScore: 97,
    category: 'Tentes',
    pricePerDay: 18,
    pricePerWeek: 95,
    deposit: 300,
    weightG: 3200,
    condition: 'excellent',
    location: 'Paris 11e',
    distance: 2,
    available: true,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente Hilleberg Keron 3 GT rouge montée dans un paysage arctique enneigé',
    tags: ['4 saisons', '3 places', 'Arctique'],
    reviewCount: 24,
    rating: 4.9,
  },
  {
    id: '2',
    slug: 'location-sac-osprey-aether',
    title: 'Sac à dos Osprey Aether Plus 85L',
    owner: 'Léa F.',
    ownerAvatar: 'L',
    ownerTrustScore: 91,
    category: 'Sacs à dos',
    pricePerDay: 8,
    pricePerWeek: 42,
    deposit: 120,
    weightG: 2100,
    condition: 'bon',
    location: 'Lyon 6e',
    distance: 5,
    available: true,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    alt: 'Sac à dos Osprey Aether Plus 85L vert posé sur un sentier de montagne',
    tags: ['85L', 'Taille L', 'Randonnée'],
    reviewCount: 11,
    rating: 4.7,
  },
  {
    id: '3',
    slug: 'location-sac-couchage-western-mountaineering',
    title: 'Sac de couchage Western Mountaineering UltraLite',
    owner: 'Marc B.',
    ownerAvatar: 'M',
    ownerTrustScore: 88,
    category: 'Couchage',
    pricePerDay: 12,
    pricePerWeek: 65,
    deposit: 200,
    weightG: 510,
    condition: 'excellent',
    location: 'Grenoble',
    distance: 8,
    available: false,
    nextAvailable: '2026-07-20T00:00:00Z',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80',
    alt: 'Sac de couchage Western Mountaineering UltraLite bleu déplié sur un matelas',
    tags: ['-7°C', 'Duvet 850+', 'Ultra-léger'],
    reviewCount: 7,
    rating: 4.8,
  },
  {
    id: '4',
    slug: 'location-kit-cuisine-msr',
    title: 'Kit cuisine MSR WindBurner + casseroles',
    owner: 'Sarah K.',
    ownerAvatar: 'S',
    ownerTrustScore: 93,
    category: 'Cuisine',
    pricePerDay: 6,
    pricePerWeek: 30,
    deposit: 80,
    weightG: 850,
    condition: 'neuf',
    location: 'Bordeaux',
    distance: 3,
    available: true,
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    alt: 'Kit cuisine MSR WindBurner avec casseroles empilées sur une table de camping',
    tags: ['Coupe-vent', 'Complet', '2 personnes'],
    reviewCount: 18,
    rating: 4.6,
  },
  {
    id: '5',
    slug: 'location-kit-escalade-petzl',
    title: 'Kit escalade Petzl — baudrier + casque + dégaines',
    owner: 'Antoine R.',
    ownerAvatar: 'A',
    ownerTrustScore: 95,
    category: 'Escalade',
    pricePerDay: 15,
    pricePerWeek: 80,
    deposit: 250,
    weightG: 1800,
    condition: 'excellent',
    location: 'Chamonix',
    distance: 12,
    available: true,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
    alt: 'Kit escalade Petzl complet avec baudrier, casque et dégaines sur fond blanc',
    tags: ['Baudrier', 'Casque', 'Dégaines'],
    reviewCount: 32,
    rating: 4.9,
  },
  {
    id: '6',
    slug: 'location-filtre-eau-sawyer',
    title: 'Filtre à eau Sawyer Squeeze + réservoirs',
    owner: 'Julie M.',
    ownerAvatar: 'J',
    ownerTrustScore: 86,
    category: 'Eau',
    pricePerDay: 4,
    pricePerWeek: 20,
    deposit: 40,
    weightG: 120,
    condition: 'bon',
    location: 'Toulouse',
    distance: 6,
    available: true,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    alt: 'Filtre à eau Sawyer Squeeze bleu avec réservoirs souples sur fond blanc',
    tags: ['Ultra-léger', 'Longue durée', 'Bivouac'],
    reviewCount: 9,
    rating: 4.5,
  },
];

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
              <img src={listing.image || '/assets/images/no_image.png'} alt={listing.alt} className="w-full h-full object-cover" />
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

function RentalCard({ listing, onClick }: { listing: RentalListing; onClick: () => void }) {
  const cond = conditionConfig[listing.condition];

  return (
    <div className="topo-card group flex flex-col cursor-pointer hover:border-primary/20 transition-all" onClick={onClick}>
      <div className="relative overflow-hidden aspect-[4/3] rounded-t-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={listing.image || '/assets/images/no_image.png'} alt={listing.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
          {!listing.available && (
            <span className="text-xs font-600 px-2 py-0.5 rounded-full border text-red-600 bg-red-50 border-red-200">Indisponible</span>
          )}
        </div>
        <div className="absolute top-2 right-2 bg-dark-bg/70 text-white text-xs font-mono px-2 py-1 rounded-lg">
          {listing.distance} km
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display font-700 text-foreground text-sm mb-1 line-clamp-2">{listing.title}</h3>

        <div className="flex flex-wrap gap-1 mb-3">
          {listing.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">{tag}</span>
          ))}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display font-800 text-foreground text-xl">{listing.pricePerDay}€</span>
              <span className="text-xs text-muted-foreground ml-1">/jour</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon name="StarIcon" size={12} variant="solid" className="text-amber-400" />
              <span className="text-xs font-600 text-foreground">{listing.rating}</span>
              <span className="text-xs text-muted-foreground">({listing.reviewCount})</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon name="MapPinIcon" size={10} />
              {listing.location}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-[9px] font-700">
                {listing.ownerAvatar}
              </div>
              {listing.owner}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LocationPage() {
  const [listings, setListings] = useState<RentalListing[]>(STATIC_LISTINGS);
  const [selectedListing, setSelectedListing] = useState<RentalListing | null>(null);
  const [category, setCategory] = useState('Tout');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'rating'>('distance');
  const [search, setSearch] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [listSent, setListSent] = useState(false);
  const [listForm, setListForm] = useState({ title: '', pricePerDay: '', location: '', description: '' });
  const [listSaving, setListSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Load from rental_items table (real data)
    supabase
      .from('rental_items')
      .select('*, owner:owner_id(full_name, trust_score)')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const dbListings: RentalListing[] = data.map((l) => {
          const owner = (l.owner as unknown) as { full_name: string; trust_score: number } | null;
          const condMap: Record<string, RentalListing['condition']> = {
            neuf: 'neuf', excellent: 'excellent', bon: 'bon', correct: 'correct',
          };
          return {
            id: l.id,
            slug: l.id,
            title: l.title,
            owner: owner?.full_name ?? 'Propriétaire vérifié',
            ownerAvatar: (owner?.full_name?.[0] ?? 'V').toUpperCase(),
            ownerTrustScore: owner?.trust_score ?? 90,
            category: 'Autre',
            pricePerDay: Number(l.price_per_day ?? 0),
            pricePerWeek: Number(l.price_per_week ?? 0),
            deposit: Number(l.deposit ?? 0),
            weightG: 0,
            condition: condMap[l.condition ?? 'excellent'] ?? 'excellent',
            location: l.location ?? 'France',
            distance: 0,
            available: l.available ?? true,
            image: l.image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
            alt: l.alt || l.title || 'Matériel outdoor en location',
            tags: [],
            reviewCount: l.reviews_count ?? 0,
            rating: Number(l.rating ?? 4.5),
          };
        });
        setListings((prev) => {
          const ids = new Set(dbListings.map(d => d.id));
          return [...dbListings, ...prev.filter(p => !ids.has(p.id))];
        });
      });
  }, []);

  const filtered = listings
    .filter((item) => {
      const matchCat = category === 'Tout' || item.category === category;
      const matchSearch = search === '' || item.title.toLowerCase().includes(search.toLowerCase()) || item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'price') return a.pricePerDay - b.pricePerDay;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Icon name="CalendarDaysIcon" size={22} variant="outline" className="text-secondary" />
              </div>
              <div>
                <p className="text-xs font-mono text-secondary/80 tracking-widest uppercase">Phase 3 · Marketplace</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Location de Matériel</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl">Louez du matériel outdoor de qualité près de chez vous. Testez avant d&apos;acheter, économisez sur vos aventures.</p>
            <div className="grid grid-cols-3 gap-3 max-w-sm mt-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-secondary">{listings.length}</p>
                <p className="text-xs text-white/50">Articles disponibles</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-amber-400">{listings.filter((l) => l.available).length}</p>
                <p className="text-xs text-white/50">Disponibles maintenant</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-emerald-400">
                  {listings.length > 0 ? Math.round(listings.reduce((s, l) => s + l.pricePerDay, 0) / listings.length) : 0}€
                </p>
                <p className="text-xs text-white/50">Prix moyen/jour</p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher du matériel..."
                className="input-field pl-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="distance">Plus proche</option>
              <option value="price">Prix croissant</option>
              <option value="rating">Mieux notés</option>
            </select>
            <button
              onClick={() => setShowListModal(true)}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Icon name="PlusIcon" size={16} />
              Proposer du matériel
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === cat ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="CalendarDaysIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
              <p>Aucun article trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((listing) => (
                <RentalCard key={listing.id} listing={listing} onClick={() => setSelectedListing(listing)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedListing && <RentalDetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} />}

      {/* List Modal */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowListModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {!listSent ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Proposer du matériel</h3>
                  <button onClick={() => setShowListModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Partagez votre matériel avec la communauté et générez des revenus supplémentaires.</p>
                <div className="space-y-3">
                  <input type="text" placeholder="Nom du matériel" className="input-field w-full" value={listForm.title} onChange={e => setListForm(p => ({ ...p, title: e.target.value }))} />
                  <input type="number" placeholder="Prix par jour (€)" className="input-field w-full" value={listForm.pricePerDay} onChange={e => setListForm(p => ({ ...p, pricePerDay: e.target.value }))} />
                  <input type="text" placeholder="Votre ville" className="input-field w-full" value={listForm.location} onChange={e => setListForm(p => ({ ...p, location: e.target.value }))} />
                  <textarea placeholder="Description et état du matériel..." className="input-field resize-none w-full" rows={3} value={listForm.description} onChange={e => setListForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowListModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button
                    disabled={listSaving || !listForm.title.trim()}
                    onClick={async () => {
                      setListSaving(true);
                      try {
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        await supabase.from('rental_items').insert({
                          owner_id: user?.id ?? null,
                          title: listForm.title.trim(),
                          description: listForm.description.trim(),
                          price_per_day: Number(listForm.pricePerDay) || 0,
                          price_per_week: (Number(listForm.pricePerDay) || 0) * 6,
                          location: listForm.location.trim(),
                          status: 'available',
                          available: true,
                        });
                        setListSent(true);
                      } catch (_e) {
                        setListSent(true);
                      } finally {
                        setListSaving(false);
                      }
                    }}
                    className="btn-primary flex-1 justify-center py-3 disabled:opacity-50"
                  >
                    {listSaving ? 'Envoi...' : 'Soumettre'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Demande envoyée !</h3>
                <p className="text-sm text-muted-foreground mb-6">Notre équipe validera votre annonce sous 24h.</p>
                <button onClick={() => { setListSent(false); setShowListModal(false); }} className="btn-primary justify-center px-8 py-3">Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px 16px calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}>📅</div>
              <div>
                <p style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7A8A7D', margin: '0 0 2px' }}>Location</p>
                <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1C2620', margin: 0 }}>Location de Matériel</h1>
              </div>
            </div>

            {/* Search + Sort row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1px solid #E4E0D4',
                    fontSize: '13px',
                    background: '#fff',
                    color: '#1C2620',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  border: '1px solid #E4E0D4',
                  fontSize: '12px',
                  background: '#fff',
                  color: '#1C2620',
                  fontWeight: '600',
                  outline: 'none',
                }}
              >
                <option value="distance">📍 Distance</option>
                <option value="price">💰 Prix</option>
                <option value="rating">⭐ Note</option>
              </select>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ background: '#17402C', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', color: '#fff' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', display: 'block' }}>{listings.length}</span>
                <span style={{ fontSize: '9px', opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>Articles</span>
              </div>
              <div style={{ background: '#1C2620', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', color: '#fff' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', display: 'block', color: '#FCD34D' }}>{listings.filter(l => l.available).length}</span>
                <span style={{ fontSize: '9px', opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>Disponibles</span>
              </div>
              <div style={{ background: '#1C2620', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', color: '#fff' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', display: 'block', color: '#6EE7B7' }}>
                  {listings.length > 0 ? Math.round(listings.reduce((s, l) => s + l.pricePerDay, 0) / listings.length) : 0}€
                </span>
                <span style={{ fontSize: '9px', opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>Prix moy./j</span>
              </div>
            </div>

            {/* Category scrollable */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    border: '1px solid',
                    background: category === cat ? '#17402C' : '#fff',
                    color: category === cat ? '#fff' : '#3A4A3D',
                    borderColor: category === cat ? '#17402C' : '#E4E0D4',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #E8E4D8' }}>
                <p style={{ fontSize: '14px', color: '#7A8A7D' }}>Aucun article trouvé</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.slice(0, 20).map((listing) => {
                  const cond = conditionConfig[listing.condition];
                  return (
                    <div
                      key={listing.id}
                      onClick={() => setSelectedListing(listing)}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        background: '#fff',
                        borderRadius: '14px',
                        border: '1px solid #E8E4D8',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: '100px', height: '100px', flexShrink: 0, background: '#E7E3D6', overflow: 'hidden' }}>
                        <img src={listing.image || '/assets/images/no_image.png'} alt={listing.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, padding: '10px 10px 10px 0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1C2620', margin: '0 0 4px', lineHeight: 1.3 }}>{listing.title}</h3>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span className={cond.color} style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600', border: '1px solid' }}>
                              {cond.label}
                            </span>
                            {listing.tags.slice(0, 2).map((tag) => (
                              <span key={tag} style={{ padding: '1px 6px', background: '#F5F2EA', fontSize: '9px', borderRadius: '4px', border: '1px solid #E4E0D4', color: '#3A4A3D' }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#1C2620' }}>{listing.pricePerDay}€<span style={{ fontSize: '10px', fontWeight: '400', color: '#7A8A7D' }}>/j</span></span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <svg width="10" height="10" fill="#F59E0B" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#1C2620' }}>{listing.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Propose CTA */}
            <button
              onClick={() => setShowListModal(true)}
              style={{
                width: '100%',
                marginTop: '16px',
                padding: '14px',
                background: '#17402C',
                color: '#fff',
                borderRadius: '14px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              + Proposer du matériel
            </button>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}