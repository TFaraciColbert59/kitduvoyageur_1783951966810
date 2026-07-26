'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  name: string;
  type: string;
  subtype: string;
  location: string;
  altitude: number;
  capacity: number;
  heatingType: string;
  price: number;
  rating: number;
  reviewCount: number;
  lat: number;
  lng: number;
  image: string;
  alt: string;
  isFavorite?: boolean;
}

type FilterCategory = 'Refuges' | 'Bivouac' | 'Cabanes' | 'Vans' | 'Gîtes';
type DurationFilter = '1 nuit' | '2–3 nuits' | 'Semaine';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_LISTINGS: Listing[] = [
  {
    id: '1',
    name: 'Chalet de la Dent de Crolles',
    type: 'Gîte',
    subtype: 'Saint-Pancrasse',
    altitude: 2062,
    capacity: 6,
    heatingType: 'Pierre',
    price: 312,
    rating: 4.9,
    reviewCount: 158,
    lat: 45.38,
    lng: 5.87,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
    alt: 'Chalet en bois dans les Alpes avec vue sur les montagnes enneigées',
  },
  {
    id: '2',
    name: 'Van des sources d\'Isère',
    type: 'Van aménagé',
    subtype: 'Le Sappey-en-Chartreuse',
    altitude: 1000,
    capacity: 3,
    heatingType: 'Van T4',
    price: 128,
    rating: 4.7,
    reviewCount: 42,
    lat: 45.28,
    lng: 5.77,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80',
    alt: 'Van aménagé garé au bord d\'un lac de montagne avec reflet des sommets',
  },
  {
    id: '3',
    name: 'Cabane du lac d\'Aiguebelette',
    type: 'Cabane sur pilotis',
    subtype: 'Aiguebelette-le-Lac',
    altitude: 375,
    capacity: 2,
    heatingType: 'Bois',
    price: 195,
    rating: 4.8,
    reviewCount: 178,
    lat: 45.55,
    lng: 5.79,
    image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80',
    alt: 'Cabane sur pilotis au bord d\'un lac turquoise entouré de forêts',
  },
  {
    id: '4',
    name: 'Refuge de Bellefont',
    type: 'Refuge gardé',
    subtype: 'Chapareillan',
    altitude: 1892,
    capacity: 12,
    heatingType: 'Alpin',
    price: 62,
    rating: 4.6,
    reviewCount: 320,
    lat: 45.42,
    lng: 5.97,
    image: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=400&q=80',
    alt: 'Refuge de montagne avec vue panoramique sur les sommets alpins',
  },
  {
    id: '5',
    name: 'Cabane du Grand Vaneau',
    type: 'Cabane',
    subtype: 'Saint-Pierre-d\'Entremont',
    altitude: 1620,
    capacity: 4,
    heatingType: 'Bois',
    price: 248,
    rating: 4.9,
    reviewCount: 94,
    lat: 45.32,
    lng: 5.92,
    image: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=400&q=80',
    alt: 'Cabane en bois dans une forêt de sapins avec brume matinale',
  },
  {
    id: '6',
    name: 'Bivouac du Col de l\'Arc',
    type: 'Bivouac',
    subtype: 'Allevard',
    altitude: 2100,
    capacity: 2,
    heatingType: 'Tente',
    price: 89,
    rating: 4.8,
    reviewCount: 96,
    lat: 45.48,
    lng: 6.07,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80',
    alt: 'Tente de bivouac au coucher du soleil avec vue sur les Alpes',
  },
];

// ─── Leaflet Map Component ─────────────────────────────────────────────────────

const ExplorerSplitMap = dynamic(() => import('@/components/explorer/ExplorerSplitMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#e8e4da]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#1C2620]/20 border-t-[#1C2620] rounded-full animate-spin" />
        <p className="text-[#1C2620]/50 text-xs font-mono tracking-widest uppercase">Chargement…</p>
      </div>
    </div>
  ),
});

// ─── Listing Card ──────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  selected,
  onClick,
}: {
  listing: Listing;
  selected: boolean;
  onClick: () => void;
}) {
  const [fav, setFav] = useState(listing.isFavorite || false);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex gap-3 p-3 rounded-xl transition-all duration-150 group ${
        selected ? 'bg-[#1C2620]/8 ring-1 ring-[#1C2620]/20' : 'hover:bg-[#1C2620]/4'
      }`}
    >
      {/* Image */}
      <div className="relative flex-shrink-0 w-[88px] h-[72px] rounded-lg overflow-hidden">
        <Image
          src={listing.image}
          alt={listing.alt}
          fill
          className="object-cover"
          sizes="88px"
        />
        <button
          onClick={(e) => { e.stopPropagation(); setFav(!fav); }}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={fav ? '#E4501C' : 'none'} stroke={fav ? '#E4501C' : '#666'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#1C2620]/50 mb-0.5">{listing.type} · {listing.subtype}</p>
        <h3 className="text-sm font-semibold text-[#1C2620] leading-tight line-clamp-1 mb-1">{listing.name}</h3>
        <div className="flex items-center gap-2 text-[11px] text-[#1C2620]/50">
          <span>▲ {listing.altitude.toLocaleString()} m</span>
          <span>· {listing.capacity} pers.</span>
          <span>· {listing.heatingType}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-bold text-[#1C2620]">{listing.price} € <span className="font-normal text-[#1C2620]/50 text-xs">/ nuit</span></span>
          <span className="text-[11px] text-amber-500">★ {listing.rating} · {listing.reviewCount}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const [activeCategories, setActiveCategories] = useState<FilterCategory[]>(['Refuges']);
  const [activeDuration, setActiveDuration] = useState<DurationFilter | null>(null);
  const [dogFilter, setDogFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popupListing, setPopupListing] = useState<Listing | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [searchWhere, setSearchWhere] = useState('Massif de la Chartreuse');
  const [searchWhen, setSearchWhen] = useState('14 – 17 sept.');
  const [searchActivity, setSearchActivity] = useState('Rando · Bivouac');
  const [searchTravelers, setSearchTravelers] = useState('2 adultes');
  const listRef = useRef<HTMLDivElement>(null);

  const categories: FilterCategory[] = ['Refuges', 'Bivouac', 'Cabanes', 'Vans', 'Gîtes'];
  const durations: DurationFilter[] = ['1 nuit', '2–3 nuits', 'Semaine'];

  const toggleCategory = (cat: FilterCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleMarkerClick = useCallback((listing: Listing) => {
    setSelectedId(listing.id);
    setPopupListing(listing);
    if (window.innerWidth < 768) {
      setBottomSheetOpen(true);
    }
  }, []);

  const handleCardClick = useCallback((listing: Listing) => {
    setSelectedId(listing.id);
    setPopupListing(listing);
  }, []);

  // Close popup on outside click
  useEffect(() => {
    const handler = () => setPopupListing(null);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') handler(); });
    return () => document.removeEventListener('keydown', handler as EventListener);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F5F2EC] overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Search Header ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-[#E8E4DA] shadow-sm z-30">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-[#1C2620] rounded-md flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l4-8 4 4 4-6 4 10" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1C2620] hidden sm:block">Le Kit</span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-[#E8E4DA] flex-shrink-0" />

          {/* Search fields */}
          <div className="flex-1 flex items-center divide-x divide-[#E8E4DA] min-w-0">
            {/* Où */}
            <div className="flex-1 px-3 min-w-0 hidden sm:block">
              <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Où</p>
              <input
                value={searchWhere}
                onChange={(e) => setSearchWhere(e.target.value)}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Destination…"
              />
            </div>
            {/* Quand */}
            <div className="flex-1 px-3 min-w-0 hidden md:block">
              <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Quand</p>
              <input
                value={searchWhen}
                onChange={(e) => setSearchWhen(e.target.value)}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Dates…"
              />
            </div>
            {/* Activité */}
            <div className="flex-1 px-3 min-w-0 hidden lg:block">
              <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Activité</p>
              <input
                value={searchActivity}
                onChange={(e) => setSearchActivity(e.target.value)}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Activité…"
              />
            </div>
            {/* Voyageurs */}
            <div className="flex-1 px-3 min-w-0 hidden lg:block">
              <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Voyageurs</p>
              <input
                value={searchTravelers}
                onChange={(e) => setSearchTravelers(e.target.value)}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Voyageurs…"
              />
            </div>
          </div>

          {/* Search button */}
          <button className="flex-shrink-0 w-9 h-9 bg-[#1C2620] rounded-full flex items-center justify-center hover:bg-[#2d3d35] transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {/* Journal + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="text-sm text-[#1C2620]/60 hover:text-[#1C2620] transition-colors hidden sm:block">Journal</button>
            <div className="w-8 h-8 rounded-full bg-[#4A6741] flex items-center justify-center text-white text-xs font-bold">MB</div>
          </div>
        </div>
      </header>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E8E4DA] z-20">
        <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          {/* All filters button */}
          <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C2620] text-white text-xs font-medium hover:bg-[#2d3d35] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Tous les filtres
          </button>

          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />

          {/* Category filters */}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                activeCategories.includes(cat)
                  ? 'bg-[#1C2620] text-white border-[#1C2620]'
                  : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />

          {/* Duration filters */}
          {durations.map((dur) => (
            <button
              key={dur}
              onClick={() => setActiveDuration(activeDuration === dur ? null : dur)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                activeDuration === dur
                  ? 'bg-[#1C2620] text-white border-[#1C2620]'
                  : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
              }`}
            >
              {dur}
            </button>
          ))}

          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />

          {/* Dog filter */}
          <button
            onClick={() => setDogFilter(!dogFilter)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              dogFilter
                ? 'bg-[#1C2620] text-white border-[#1C2620]'
                : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
            }`}
          >
            Chien accepté
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Prix filter */}
          <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#E8E4DA] bg-white text-[#1C2620] hover:border-[#1C2620]/30 transition-all duration-150">
            Prix
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Altitude filter */}
          <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#E8E4DA] bg-white text-[#1C2620] hover:border-[#1C2620]/30 transition-all duration-150">
            Altitude
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── Desktop: Left list panel ─────────────────────────────────── */}
        <div
          ref={listRef}
          className="hidden md:flex flex-col w-[420px] flex-shrink-0 bg-[#F5F2EC] border-r border-[#E8E4DA] overflow-y-auto"
        >
          {/* Scroll indicator */}
          <div className="absolute left-[418px] top-1/2 -translate-y-1/2 z-10 w-4 flex flex-col items-center gap-1 pointer-events-none">
            <div className="w-1 h-8 bg-[#E8E4DA] rounded-full" />
          </div>

          <div className="px-3 py-3 space-y-1">
            {MOCK_LISTINGS.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selectedId === listing.id}
                onClick={() => handleCardClick(listing)}
              />
            ))}
          </div>
        </div>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <ExplorerSplitMap
            listings={MOCK_LISTINGS}
            selectedId={selectedId}
            onMarkerClick={handleMarkerClick}
            center={[45.38, 5.87]}
            zoom={10}
          />

          {/* Location label */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm border border-[#E8E4DA]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs font-medium text-[#1C2620]">{searchWhere}</span>
          </div>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
            <button className="w-8 h-8 bg-white rounded-lg shadow-sm border border-[#E8E4DA] flex items-center justify-center text-[#1C2620] hover:bg-[#F5F2EC] transition-colors text-lg font-light">+</button>
            <button className="w-8 h-8 bg-white rounded-lg shadow-sm border border-[#E8E4DA] flex items-center justify-center text-[#1C2620] hover:bg-[#F5F2EC] transition-colors text-lg font-light">−</button>
            <button className="w-8 h-8 bg-white rounded-lg shadow-sm border border-[#E8E4DA] flex items-center justify-center text-[#1C2620] hover:bg-[#F5F2EC] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
            </button>
          </div>

          {/* Bottom bar: count + relief */}
          <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-[#E8E4DA]">
              <span className="text-xs font-medium text-[#1C2620]">{MOCK_LISTINGS.length} lieux</span>
            </div>
            <button className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-[#E8E4DA] flex items-center gap-1.5 hover:bg-white transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l4-8 4 4 4-6 4 10" />
              </svg>
              <span className="text-xs font-medium text-[#1C2620]">Relief</span>
            </button>
          </div>

          {/* Popup preview on marker click */}
          {popupListing && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[1001] w-[320px] bg-white rounded-2xl shadow-xl border border-[#E8E4DA] overflow-hidden">
              <button
                onClick={() => setPopupListing(null)}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[#1C2620]/50 hover:text-[#1C2620] transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="flex gap-3 p-3">
                <div className="relative w-[80px] h-[70px] rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={popupListing.image}
                    alt={popupListing.alt}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#1C2620]/50 mb-0.5">▲ {popupListing.altitude.toLocaleString()} m · {popupListing.subtype}</p>
                  <h3 className="text-sm font-semibold text-[#1C2620] leading-tight line-clamp-2 mb-1">{popupListing.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1C2620]">{popupListing.price} € <span className="font-normal text-[#1C2620]/50 text-xs">/ nuit</span></span>
                    <span className="text-[11px] text-amber-500">★ {popupListing.rating}</span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-3">
                <button className="w-full py-2 bg-[#1C2620] text-white text-sm font-medium rounded-xl hover:bg-[#2d3d35] transition-colors">
                  Voir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: Bottom sheet ──────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Toggle map/list */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex bg-[#1C2620] rounded-full p-1 shadow-lg">
          <button
            onClick={() => setMobileView('map')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mobileView === 'map' ? 'bg-white text-[#1C2620]' : 'text-white/70'}`}
          >
            Carte
          </button>
          <button
            onClick={() => setMobileView('list')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mobileView === 'list' ? 'bg-white text-[#1C2620]' : 'text-white/70'}`}
          >
            Liste
          </button>
        </div>

        {/* Bottom sheet */}
        <div
          className={`fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ${
            bottomSheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-120px)]'
          }`}
          style={{ maxHeight: '75vh' }}
        >
          {/* Handle */}
          <div
            className="flex flex-col items-center pt-3 pb-2 cursor-pointer"
            onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
          >
            <div className="w-10 h-1 bg-[#E8E4DA] rounded-full mb-2" />
            <div className="flex items-center justify-between w-full px-4">
              <span className="text-sm font-semibold text-[#1C2620]">{MOCK_LISTINGS.length} lieux</span>
              <span className="text-xs text-[#1C2620]/50">Coup de cœur ▾</span>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto px-3 pb-20 space-y-1" style={{ maxHeight: 'calc(75vh - 60px)' }}>
            {MOCK_LISTINGS.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selectedId === listing.id}
                onClick={() => handleCardClick(listing)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
