'use client';

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import TrailPanel from '@/components/explorer/TrailPanel';
import type { ExploreTrail } from '@/components/explorer/AdventureScore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  name: string;
  type: string;
  subtype: string;
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
type PanelMode = 'listings' | 'trails';

// ─── Mock Listings ─────────────────────────────────────────────────────────────

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
    name: "Van des sources d'Isère",
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
    alt: "Van aménagé garé au bord d'un lac de montagne avec reflet des sommets",
  },
  {
    id: '3',
    name: "Cabane du lac d'Aiguebelette",
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
    alt: "Cabane sur pilotis au bord d'un lac turquoise entouré de forêts",
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
    subtype: "Saint-Pierre-d'Entremont",
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
    name: "Bivouac du Col de l'Arc",
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

// ─── Mock Trails / Randonnées ──────────────────────────────────────────────────

const MOCK_TRAILS: ExploreTrail[] = [
  {
    id: 't1',
    name: 'Tour de la Chartreuse',
    geometry: {
      type: 'LineString',
      coordinates: [
        [5.87, 45.38], [5.89, 45.40], [5.92, 45.42], [5.95, 45.44],
        [5.97, 45.42], [5.94, 45.39], [5.91, 45.37], [5.87, 45.38],
      ],
    },
    distance_km: 18.5,
    duration_hours: 7,
    difficulty: 'moderate',
    elevation_gain: 1200,
    adventure_score: 82,
    nature_score: 88,
    panorama_score: 85,
    accessibility_score: 70,
    challenge_score: 75,
    services_score: 60,
    start_lat: 45.38,
    start_lng: 5.87,
    bbox_min_lat: 45.37,
    bbox_min_lng: 5.87,
    bbox_max_lat: 45.44,
    bbox_max_lng: 5.97,
  },
  {
    id: 't2',
    name: 'Sentier du Lac Blanc',
    geometry: {
      type: 'LineString',
      coordinates: [
        [5.77, 45.28], [5.79, 45.30], [5.82, 45.32],
        [5.84, 45.30], [5.81, 45.28], [5.77, 45.28],
      ],
    },
    distance_km: 9.2,
    duration_hours: 3.5,
    difficulty: 'easy',
    elevation_gain: 450,
    adventure_score: 74,
    nature_score: 90,
    panorama_score: 78,
    accessibility_score: 85,
    challenge_score: 45,
    services_score: 72,
    start_lat: 45.28,
    start_lng: 5.77,
    bbox_min_lat: 45.28,
    bbox_min_lng: 5.77,
    bbox_max_lat: 45.32,
    bbox_max_lng: 5.84,
  },
  {
    id: 't3',
    name: 'Crête du Grand Som',
    geometry: {
      type: 'LineString',
      coordinates: [
        [5.92, 45.32], [5.94, 45.35], [5.97, 45.37],
        [6.00, 45.38], [6.02, 45.36], [5.99, 45.33], [5.92, 45.32],
      ],
    },
    distance_km: 14.8,
    duration_hours: 6,
    difficulty: 'hard',
    elevation_gain: 1650,
    adventure_score: 91,
    nature_score: 92,
    panorama_score: 95,
    accessibility_score: 50,
    challenge_score: 90,
    services_score: 40,
    start_lat: 45.32,
    start_lng: 5.92,
    bbox_min_lat: 45.32,
    bbox_min_lng: 5.92,
    bbox_max_lat: 45.38,
    bbox_max_lng: 6.02,
  },
  {
    id: 't4',
    name: 'Boucle du Lac Aiguebelette',
    geometry: {
      type: 'LineString',
      coordinates: [
        [5.79, 45.55], [5.81, 45.57], [5.83, 45.56],
        [5.82, 45.54], [5.79, 45.55],
      ],
    },
    distance_km: 6.5,
    duration_hours: 2,
    difficulty: 'easy',
    elevation_gain: 120,
    adventure_score: 65,
    nature_score: 82,
    panorama_score: 70,
    accessibility_score: 95,
    challenge_score: 30,
    services_score: 80,
    start_lat: 45.55,
    start_lng: 5.79,
    bbox_min_lat: 45.54,
    bbox_min_lng: 5.79,
    bbox_max_lat: 45.57,
    bbox_max_lng: 5.83,
  },
  {
    id: 't5',
    name: 'Traversée des Belledonne',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.07, 45.48], [6.10, 45.50], [6.13, 45.52],
        [6.15, 45.50], [6.12, 45.47], [6.09, 45.46], [6.07, 45.48],
      ],
    },
    distance_km: 22.0,
    duration_hours: 9,
    difficulty: 'expert',
    elevation_gain: 2100,
    adventure_score: 96,
    nature_score: 94,
    panorama_score: 98,
    accessibility_score: 35,
    challenge_score: 98,
    services_score: 30,
    start_lat: 45.48,
    start_lng: 6.07,
    bbox_min_lat: 45.46,
    bbox_min_lng: 6.07,
    bbox_max_lat: 45.52,
    bbox_max_lng: 6.15,
  },
  {
    id: 't6',
    name: 'Sentier des Gorges du Fier',
    geometry: {
      type: 'LineString',
      coordinates: [
        [5.97, 45.42], [5.99, 45.44], [6.01, 45.45],
        [6.03, 45.43], [6.01, 45.41], [5.97, 45.42],
      ],
    },
    distance_km: 8.0,
    duration_hours: 3,
    difficulty: 'moderate',
    elevation_gain: 580,
    adventure_score: 78,
    nature_score: 85,
    panorama_score: 80,
    accessibility_score: 72,
    challenge_score: 65,
    services_score: 68,
    start_lat: 45.42,
    start_lng: 5.97,
    bbox_min_lat: 45.41,
    bbox_min_lng: 5.97,
    bbox_max_lat: 45.45,
    bbox_max_lng: 6.03,
  },
];

// ─── Dynamic Map Import ────────────────────────────────────────────────────────

const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1a12]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#2D5A27]/30 border-t-[#8BAF7C] rounded-full animate-spin" />
        <p className="text-[#8BAF7C]/50 text-xs font-mono tracking-widest uppercase">Chargement…</p>
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
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl overflow-hidden transition-all duration-200 group ${
        selected
          ? 'ring-2 ring-[#1C2620] shadow-lg shadow-[#1C2620]/10'
          : 'shadow-sm hover:shadow-md hover:-translate-y-0.5'
      } bg-white`}
    >
      {/* Image */}
      <div className="relative w-full h-[140px] overflow-hidden">
        <Image
          src={listing.image}
          alt={listing.alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="380px"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Type badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[#1C2620] shadow-sm">
            {listing.type}
          </span>
        </div>

        {/* Favorite button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFav(!fav);
          }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={fav ? '#E4501C' : 'none'}
            stroke={fav ? '#E4501C' : '#666'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Rating badge bottom-right */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 shadow-sm">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-[11px] font-bold text-[#1C2620]">{listing.rating}</span>
          <span className="text-[10px] text-[#1C2620]/50">({listing.reviewCount})</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Location */}
        <p className="text-[10px] font-medium text-[#1C2620]/45 uppercase tracking-wide mb-1 flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {listing.subtype}
        </p>

        {/* Name */}
        <h3 className="text-sm font-semibold text-[#1C2620] leading-snug line-clamp-1 mb-2.5">
          {listing.name}
        </h3>

        {/* Stats pills */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#4A6741] bg-[#4A6741]/8 rounded-full px-2 py-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {listing.altitude.toLocaleString()} m
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1C2620]/60 bg-[#1C2620]/5 rounded-full px-2 py-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {listing.capacity} pers.
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1C2620]/60 bg-[#1C2620]/5 rounded-full px-2 py-0.5">
            {listing.heatingType}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#F0EDE6] mb-2.5" />

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold text-[#1C2620]">{listing.price} €</span>
            <span className="text-[11px] text-[#1C2620]/45 ml-1">/ nuit</span>
          </div>
          <span className="text-[11px] font-medium text-[#1C2620]/50 bg-[#F5F2EC] rounded-lg px-2 py-1">
            Voir le détail →
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Trail Mini Card (for left panel) ─────────────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f97316',
  hard: '#ef4444',
  expert: '#7c3aed',
};
const DIFF_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modérée',
  hard: 'Difficile',
  expert: 'Expert',
};

function TrailMiniCard({
  trail,
  selected,
  onClick,
}: {
  trail: ExploreTrail;
  selected: boolean;
  onClick: () => void;
}) {
  const color = DIFF_COLORS[trail.difficulty] || '#94a3b8';
  const label = DIFF_LABELS[trail.difficulty] || trail.difficulty;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all duration-150 border ${
        selected
          ? 'bg-[#1C2620]/8 border-[#1C2620]/20'
          : 'border-transparent hover:bg-[#1C2620]/4 hover:border-[#1C2620]/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-sm font-semibold text-[#1C2620] leading-tight line-clamp-2 flex-1">
          {trail.name}
        </h3>
        <span
          className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border"
          style={{
            backgroundColor: `${color}18`,
            color,
            borderColor: `${color}40`,
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[#1C2620]/50">
        {trail.distance_km > 0 && <span>📏 {trail.distance_km} km</span>}
        {trail.duration_hours > 0 && <span>⏱ {trail.duration_hours}h</span>}
        {trail.elevation_gain > 0 && <span>⬆️ +{trail.elevation_gain}m</span>}
      </div>
      {trail.adventure_score > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-amber-400 text-[10px]">⭐</span>
          <span className="text-[11px] font-mono font-bold text-[#1C2620]">{trail.adventure_score}</span>
          <span className="text-[10px] text-[#1C2620]/40">/100</span>
        </div>
      )}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const [activeCategories, setActiveCategories] = useState<FilterCategory[]>(['Refuges']);
  const [activeDuration, setActiveDuration] = useState<DurationFilter | null>(null);
  const [dogFilter, setDogFilter] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<ExploreTrail | null>(null);
  const [popupListing, setPopupListing] = useState<Listing | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('listings');
  const [searchWhere, setSearchWhere] = useState('Massif de la Chartreuse');
  const [searchWhen, setSearchWhen] = useState('14 – 17 sept.');
  const [searchActivity, setSearchActivity] = useState('Rando · Bivouac');
  const [searchTravelers, setSearchTravelers] = useState('2 adultes');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const categories: FilterCategory[] = ['Refuges', 'Bivouac', 'Cabanes', 'Vans', 'Gîtes'];
  const durations: DurationFilter[] = ['1 nuit', '2–3 nuits', 'Semaine'];

  const toggleCategory = (cat: FilterCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleTrailClick = useCallback((trail: ExploreTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedTrail(trail);
    setSelectedListingId(null);
    setPopupListing(null);
    setPanelMode('trails');
  }, []);

  const handleListingClick = useCallback((listing: Listing) => {
    setSelectedListingId(listing.id);
    setPopupListing(listing);
    setSelectedTrailId(null);
    setSelectedTrail(null);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setBottomSheetOpen(true);
    }
  }, []);

  const handleCloseTrailPanel = useCallback(() => {
    setSelectedTrail(null);
    setSelectedTrailId(null);
  }, []);

  const handleLocationUpdate = useCallback((loc: [number, number]) => {
    setUserLocation(loc);
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-[#F5F2EC] overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Search Header ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-[#E8E4DA] shadow-sm z-30">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 bg-[#1C2620] rounded-md flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 17l4-8 4 4 4-6 4 10" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1C2620] hidden sm:block">Le Kit</span>
          </Link>

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
          <button
            type="button"
            className="flex-shrink-0 w-9 h-9 bg-[#1C2620] rounded-full flex items-center justify-center hover:bg-[#2d3d35] transition-colors"
            aria-label="Rechercher"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {/* Journal + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/carnets"
              className="text-sm text-[#1C2620]/60 hover:text-[#1C2620] transition-colors hidden sm:block"
            >
              Journal
            </Link>
            <Link href="/compte" aria-label="Mon compte">
              <div className="w-8 h-8 rounded-full bg-[#4A6741] flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity">
                MB
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E8E4DA] z-20">
        <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          {/* All filters button */}
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1C2620] text-white text-xs font-medium hover:bg-[#2d3d35] transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Tous les filtres
          </button>

          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />

          {/* Category filters */}
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
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
              type="button"
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
            type="button"
            onClick={() => setDogFilter(!dogFilter)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              dogFilter
                ? 'bg-[#1C2620] text-white border-[#1C2620]'
                : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
            }`}
          >
            Chien accepté
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Prix filter */}
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#E8E4DA] bg-white text-[#1C2620] hover:border-[#1C2620]/30 transition-all duration-150"
          >
            Prix
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Altitude filter */}
          <button
            type="button"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[#E8E4DA] bg-white text-[#1C2620] hover:border-[#1C2620]/30 transition-all duration-150"
          >
            Altitude
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Randonnées toggle */}
          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />
          <button
            type="button"
            onClick={() => setPanelMode(panelMode === 'trails' ? 'listings' : 'trails')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              panelMode === 'trails' ?'bg-[#4A6741] text-white border-[#4A6741]' :'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#4A6741]/40'
            }`}
          >
            🥾 Randonnées
          </button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── Desktop: Left panel ──────────────────────────────────────── */}
        <div className="hidden md:flex flex-col w-[380px] flex-shrink-0 bg-[#F5F2EC] border-r border-[#E8E4DA] overflow-hidden">
          {/* Panel mode tabs */}
          <div className="flex-shrink-0 flex border-b border-[#E8E4DA] bg-white">
            <button
              type="button"
              onClick={() => setPanelMode('listings')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                panelMode === 'listings' ?'text-[#1C2620] border-b-2 border-[#1C2620]' :'text-[#1C2620]/40 hover:text-[#1C2620]/70'
              }`}
            >
              🏠 {MOCK_LISTINGS.length} hébergements
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('trails')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                panelMode === 'trails' ?'text-[#4A6741] border-b-2 border-[#4A6741]' :'text-[#1C2620]/40 hover:text-[#1C2620]/70'
              }`}
            >
              🥾 {MOCK_TRAILS.length} randonnées
            </button>
          </div>

          {/* Trail detail panel (desktop inline) */}
          {panelMode === 'trails' && selectedTrail ? (
            <div className="flex-1 overflow-hidden">
              <TrailPanel
                trail={selectedTrail}
                onClose={handleCloseTrailPanel}
              />
            </div>
          ) : panelMode === 'trails' ? (
            /* Trails list */
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {MOCK_TRAILS.map((trail) => (
                <TrailMiniCard
                  key={trail.id}
                  trail={trail}
                  selected={selectedTrailId === trail.id}
                  onClick={() => handleTrailClick(trail)}
                />
              ))}
            </div>
          ) : (
            /* Listings list */
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {MOCK_LISTINGS.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  selected={selectedListingId === listing.id}
                  onClick={() => handleListingClick(listing)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <ExplorerMap
            trails={MOCK_TRAILS}
            selectedTrailId={selectedTrailId}
            onTrailClick={handleTrailClick}
            userLocation={userLocation}
            onLocationUpdate={handleLocationUpdate}
          />

          {/* Location label overlay */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm border border-[#E8E4DA]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1C2620"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs font-medium text-[#1C2620]">{searchWhere}</span>
          </div>

          {/* Count badge */}
          <div className="absolute bottom-4 left-3 z-[1000] flex items-center gap-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-[#E8E4DA]">
              <span className="text-xs font-medium text-[#1C2620]">
                {MOCK_LISTINGS.length} lieux · {MOCK_TRAILS.length} randonnées
              </span>
            </div>
          </div>

          {/* Popup preview on listing marker click */}
          {popupListing && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1001] w-[320px] bg-white rounded-2xl shadow-xl border border-[#E8E4DA] overflow-hidden">
              <button
                type="button"
                onClick={() => setPopupListing(null)}
                className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[#1C2620]/50 hover:text-[#1C2620] transition-colors"
                aria-label="Fermer"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
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
                  <p className="text-[10px] text-[#1C2620]/50 mb-0.5">
                    ▲ {popupListing.altitude.toLocaleString()} m · {popupListing.subtype}
                  </p>
                  <h3 className="text-sm font-semibold text-[#1C2620] leading-tight line-clamp-2 mb-1">
                    {popupListing.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#1C2620]">
                      {popupListing.price} €{' '}
                      <span className="font-normal text-[#1C2620]/50 text-xs">/ nuit</span>
                    </span>
                    <span className="text-[11px] text-amber-500">★ {popupListing.rating}</span>
                  </div>
                </div>
              </div>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  className="w-full py-2 bg-[#1C2620] text-white text-sm font-medium rounded-xl hover:bg-[#2d3d35] transition-colors"
                >
                  Voir le détail
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
            type="button"
            onClick={() => setMobileView('map')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileView === 'map' ? 'bg-white text-[#1C2620]' : 'text-white/70'
            }`}
          >
            Carte
          </button>
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileView === 'list' ? 'bg-white text-[#1C2620]' : 'text-white/70'
            }`}
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
          <button
            type="button"
            className="w-full flex flex-col items-center pt-3 pb-2"
            onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
            aria-label={bottomSheetOpen ? 'Réduire' : 'Agrandir'}
          >
            <div className="w-10 h-1 bg-[#E8E4DA] rounded-full mb-2" />
            <div className="flex items-center justify-between w-full px-4">
              <span className="text-sm font-semibold text-[#1C2620]">
                {MOCK_LISTINGS.length} hébergements · {MOCK_TRAILS.length} randonnées
              </span>
              <span className="text-xs text-[#1C2620]/50">Coup de cœur ▾</span>
            </div>
          </button>

          {/* Mobile panel tabs */}
          <div className="flex border-b border-[#E8E4DA] px-4">
            <button
              type="button"
              onClick={() => setPanelMode('listings')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                panelMode === 'listings' ?'text-[#1C2620] border-b-2 border-[#1C2620]' :'text-[#1C2620]/40'
              }`}
            >
              🏠 Hébergements
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('trails')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                panelMode === 'trails' ?'text-[#4A6741] border-b-2 border-[#4A6741]' :'text-[#1C2620]/40'
              }`}
            >
              🥾 Randonnées
            </button>
          </div>

          {/* List */}
          <div
            className="overflow-y-auto px-4 pb-20 space-y-3"
            style={{ maxHeight: 'calc(75vh - 100px)' }}
          >
            {panelMode === 'listings'
              ? MOCK_LISTINGS.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedListingId === listing.id}
                    onClick={() => handleListingClick(listing)}
                  />
                ))
              : MOCK_TRAILS.map((trail) => (
                  <TrailMiniCard
                    key={trail.id}
                    trail={trail}
                    selected={selectedTrailId === trail.id}
                    onClick={() => handleTrailClick(trail)}
                  />
                ))}
          </div>
        </div>

        {/* Mobile Trail Panel */}
        {selectedTrail && (
          <TrailPanel
            trail={selectedTrail}
            onClose={handleCloseTrailPanel}
            isMobile
          />
        )}
      </div>
    </div>
  );
}
