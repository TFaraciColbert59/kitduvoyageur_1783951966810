'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import TrailPanel from '@/components/explorer/TrailPanel';
import ExplorerFilterSheet from '@/components/explorer/ExplorerFilterSheet';
import type { ExploreTrail } from '@/components/explorer/AdventureScore';
import type { FilterState } from '@/components/explorer/types';
import { DEFAULT_FILTERS } from '@/components/explorer/types';
import { createClient } from '@/lib/supabase/client';

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

// ─── Mock Trails ──────────────────────────────────────────────────────────────

const MOCK_TRAILS: ExploreTrail[] = [];

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
  onFavoriteToggle,
}: {
  listing: Listing;
  selected: boolean;
  onClick: () => void;
  onFavoriteToggle?: (id: string, fav: boolean) => void;
}) {
  const [fav, setFav] = useState(listing.isFavorite || false);

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    onFavoriteToggle?.(listing.id, next);
  };

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
          onClick={handleFav}
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
        <p className="text-[10px] font-medium text-[#1C2620]/45 uppercase tracking-wide mb-1 flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {listing.subtype}
        </p>

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

        <div className="h-px bg-[#F0EDE6] mb-2.5" />

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
const DIFF_BG: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-orange-50 text-orange-700 border-orange-200',
  hard: 'bg-red-50 text-red-700 border-red-200',
  expert: 'bg-violet-50 text-violet-700 border-violet-200',
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
  const diffBg = DIFF_BG[trail.difficulty] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl transition-all duration-200 overflow-hidden group border ${
        selected
          ? 'border-[#1C2620]/25 bg-white shadow-md shadow-[#1C2620]/8'
          : 'border-[#E8E4DA] bg-white hover:border-[#1C2620]/20 hover:shadow-sm'
      }`}
    >
      {/* Difficulty accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-semibold text-[#1C2620] leading-tight line-clamp-2 flex-1">
            {trail.name}
          </h3>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${diffBg}`}>
            {label}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          {trail.distance_km > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4A6741] bg-[#4A6741]/8 rounded-full px-2 py-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
              {trail.distance_km} km
            </span>
          )}
          {trail.duration_hours > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1C2620]/60 bg-[#1C2620]/5 rounded-full px-2 py-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {trail.duration_hours}h
            </span>
          )}
          {trail.elevation_gain > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1C2620]/60 bg-[#1C2620]/5 rounded-full px-2 py-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              +{trail.elevation_gain}m
            </span>
          )}
        </div>

        {/* Adventure score */}
        {trail.adventure_score > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-[#E8E4DA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${trail.adventure_score}%`,
                    backgroundColor: trail.adventure_score >= 75 ? '#22c55e' : trail.adventure_score >= 50 ? '#f97316' : '#94a3b8',
                  }}
                />
              </div>
              <span className="text-[11px] font-bold text-[#1C2620]">{trail.adventure_score}</span>
              <span className="text-[10px] text-[#1C2620]/40">/100</span>
            </div>
            <span className="text-[10px] text-[#1C2620]/40 font-medium">Score aventure →</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Fixed Dropdown Portal ─────────────────────────────────────────────────────

function FixedDropdown({
  open,
  anchorRef,
  children,
  minWidth = 150,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  minWidth?: number;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
  }, [open, anchorRef]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth,
        zIndex: 99999,
      }}
      className="bg-white border border-[#E8E4DA] rounded-xl shadow-xl overflow-hidden"
    >
      {children}
    </div>
  );
}

// ─── Price Range Dropdown ──────────────────────────────────────────────────────

function PriceDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    { label: 'Tous les prix', value: '' },
    { label: '< 100 €', value: '0-100' },
    { label: '100 – 200 €', value: '100-200' },
    { label: '200 – 300 €', value: '200-300' },
    { label: '> 300 €', value: '300+' },
  ];

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
          value
            ? 'bg-[#1C2620] text-white border-[#1C2620]'
            : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
        }`}
      >
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <FixedDropdown open={open} anchorRef={btnRef} minWidth={150}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F5F2EC] transition-colors ${
              opt.value === value ? 'font-semibold text-[#1C2620]' : 'text-[#1C2620]/70'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </FixedDropdown>
    </div>
  );
}

// ─── Altitude Range Dropdown ───────────────────────────────────────────────────

function AltitudeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    { label: 'Toute altitude', value: '' },
    { label: '< 500 m', value: '0-500' },
    { label: '500 – 1000 m', value: '500-1000' },
    { label: '1000 – 2000 m', value: '1000-2000' },
    { label: '> 2000 m', value: '2000+' },
  ];

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
          value
            ? 'bg-[#1C2620] text-white border-[#1C2620]'
            : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]/30'
        }`}
      >
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <FixedDropdown open={open} anchorRef={btnRef} minWidth={160}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#F5F2EC] transition-colors ${
              opt.value === value ? 'font-semibold text-[#1C2620]' : 'text-[#1C2620]/70'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </FixedDropdown>
    </div>
  );
}

// ─── Travelers Dropdown ────────────────────────────────────────────────────────

function TravelersDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    '1 adulte',
    '2 adultes',
    '3 adultes',
    '4 adultes',
    '2 adultes · 1 enfant',
    '2 adultes · 2 enfants',
    'Groupe (6+)',
  ];

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left bg-transparent outline-none"
      >
        <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Voyageurs</p>
        <p className="text-sm font-medium text-[#1C2620] truncate">{value || 'Voyageurs…'}</p>
      </button>
      <FixedDropdown open={open} anchorRef={btnRef} minWidth={190}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { onChange(opt); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors ${
              opt === value ? 'font-semibold text-[#1C2620]' : 'text-[#1C2620]/70'
            }`}
          >
            {opt}
          </button>
        ))}
      </FixedDropdown>
    </div>
  );
}

// ─── Activity Dropdown ─────────────────────────────────────────────────────────

function ActivityDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const options = [
    'Toutes activités',
    'Rando · Bivouac',
    'Randonnée',
    'Trek',
    'Bivouac',
    'Vélo / VTT',
    'Escalade',
    'Ski de randonnée',
    'Kayak / Canoë',
    'Famille',
  ];

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left bg-transparent outline-none"
      >
        <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Activité</p>
        <p className="text-sm font-medium text-[#1C2620] truncate">{value || 'Activité…'}</p>
      </button>
      <FixedDropdown open={open} anchorRef={btnRef} minWidth={190}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { onChange(opt); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors ${
              opt === value ? 'font-semibold text-[#1C2620]' : 'text-[#1C2620]/70'
            }`}
          >
            {opt}
          </button>
        ))}
      </FixedDropdown>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.toLowerCase().trim());
}

function parsePriceRange(range: string): [number, number] {
  if (!range) return [0, Infinity];
  if (range === '300+') return [300, Infinity];
  const [min, max] = range.split('-').map(Number);
  return [min, max];
}

function parseAltitudeRange(range: string): [number, number] {
  if (!range) return [0, Infinity];
  if (range === '2000+') return [2000, Infinity];
  const [min, max] = range.split('-').map(Number);
  return [min, max];
}

function parseTravelersCount(travelers: string): number {
  const match = travelers.match(/(\d+)\s*adulte/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const [activeCategories, setActiveCategories] = useState<FilterCategory[]>([]);
  const [activeDuration, setActiveDuration] = useState<DurationFilter | null>(null);
  const [dogFilter, setDogFilter] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<ExploreTrail | null>(null);
  const [popupListing, setPopupListing] = useState<Listing | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('listings');
  const [searchWhere, setSearchWhere] = useState('');
  const [searchWhen, setSearchWhen] = useState('');
  const [searchActivity, setSearchActivity] = useState('');
  const [searchTravelers, setSearchTravelers] = useState('2 adultes');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [trails, setTrails] = useState<ExploreTrail[]>(MOCK_TRAILS);
  const [trailsLoading, setTrailsLoading] = useState(true);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [priceRange, setPriceRange] = useState('');
  const [altitudeRange, setAltitudeRange] = useState('');
  const [locating, setLocating] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Fetch real trails from Supabase explore_trails view
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('explore_trails')
      .select('id, name, geometry, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, accessibility_score, challenge_score, services_score, start_lat, start_lng, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng')
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setTrails(data as ExploreTrail[]);
        }
        setTrailsLoading(false);
      });
  }, []);

  // ── Filtered listings ──────────────────────────────────────────────────────
  const filteredListings = useMemo(() => {
    let result = MOCK_LISTINGS;

    // Where filter
    if (searchWhere.trim()) {
      result = result.filter(
        (l) =>
          matchesSearch(l.name, searchWhere) ||
          matchesSearch(l.subtype, searchWhere) ||
          matchesSearch(l.type, searchWhere)
      );
    }

    // Category filter
    if (activeCategories.length > 0) {
      result = result.filter((l) => {
        const typeNorm = l.type.toLowerCase();
        return activeCategories.some((cat) => {
          if (cat === 'Refuges') return typeNorm.includes('refuge');
          if (cat === 'Bivouac') return typeNorm.includes('bivouac');
          if (cat === 'Cabanes') return typeNorm.includes('cabane');
          if (cat === 'Vans') return typeNorm.includes('van');
          if (cat === 'Gîtes') return typeNorm.includes('gîte') || typeNorm.includes('gite');
          return false;
        });
      });
    }

    // Price filter
    if (priceRange) {
      const [minP, maxP] = parsePriceRange(priceRange);
      result = result.filter((l) => l.price >= minP && l.price <= maxP);
    }

    // Altitude filter
    if (altitudeRange) {
      const [minA, maxA] = parseAltitudeRange(altitudeRange);
      result = result.filter((l) => l.altitude >= minA && l.altitude <= maxA);
    }

    // Travelers filter (capacity)
    if (searchTravelers) {
      const count = parseTravelersCount(searchTravelers);
      if (count > 0) {
        result = result.filter((l) => l.capacity >= count);
      }
    }

    // Duration filter (price proxy for nuit)
    if (activeDuration === '1 nuit') {
      result = result.filter((l) => l.price < 150);
    } else if (activeDuration === '2–3 nuits') {
      result = result.filter((l) => l.price >= 100 && l.price < 300);
    } else if (activeDuration === 'Semaine') {
      result = result.filter((l) => l.price >= 200);
    }

    return result;
  }, [searchWhere, activeCategories, priceRange, altitudeRange, searchTravelers, activeDuration]);

  // ── Filtered trails ────────────────────────────────────────────────────────
  const filteredTrails = useMemo(() => {
    let result = trails;

    // Where filter
    if (searchWhere.trim()) {
      result = result.filter((t) => matchesSearch(t.name, searchWhere));
    }

    // Activity filter → maps to difficulty/type
    if (searchActivity && searchActivity !== 'Toutes activités') {
      const act = searchActivity.toLowerCase();
      if (act.includes('facile') || act.includes('famille')) {
        result = result.filter((t) => t.difficulty === 'easy');
      } else if (act.includes('trek')) {
        result = result.filter((t) => t.difficulty === 'hard' || t.difficulty === 'expert');
      } else if (act.includes('bivouac')) {
        result = result.filter((t) => t.duration_hours >= 6);
      }
    }

    // Advanced filters (from filter sheet)
    if (advancedFilters.difficulty.length > 0) {
      result = result.filter((t) => advancedFilters.difficulty.includes(t.difficulty));
    }

    if (advancedFilters.duration.length > 0) {
      result = result.filter((t) => {
        return advancedFilters.duration.some((d) => {
          if (d === '2h') return t.duration_hours <= 2;
          if (d === 'half') return t.duration_hours > 2 && t.duration_hours <= 4;
          if (d === 'day') return t.duration_hours > 4 && t.duration_hours <= 10;
          if (d === 'multi') return t.duration_hours > 10;
          return false;
        });
      });
    }

    return result;
  }, [trails, searchWhere, searchActivity, advancedFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(advancedFilters).flat().length +
      (priceRange ? 1 : 0) +
      (altitudeRange ? 1 : 0) +
      activeCategories.length +
      (activeDuration ? 1 : 0);
  }, [advancedFilters, priceRange, altitudeRange, activeCategories, activeDuration]);

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

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }, []);

  const handleFavoriteToggle = useCallback((id: string, fav: boolean) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (fav) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSearch = useCallback(() => {
    // Filters are reactive via useMemo — just close any open dropdowns
    // and switch to list view on mobile to show results
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('list');
      setBottomSheetOpen(true);
    }
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setActiveCategories([]);
    setActiveDuration(null);
    setDogFilter(false);
    setPriceRange('');
    setAltitudeRange('');
    setAdvancedFilters(DEFAULT_FILTERS);
    setSearchWhere('');
    setSearchWhen('');
    setSearchActivity('');
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-[#F5F2EC] overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Search Header ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-[#E8E4DA] shadow-sm z-30">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Back arrow */}
          <Link
            href="/"
            className="flex-shrink-0 w-9 h-9 rounded-full border border-[#E8E4DA] flex items-center justify-center hover:bg-[#F5F2EC] transition-colors"
            aria-label="Retour"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Destination, massif…"
              />
            </div>
            {/* Quand */}
            <div className="flex-1 px-3 min-w-0 hidden md:block">
              <p className="text-[9px] font-semibold text-[#1C2620]/40 uppercase tracking-widest">Quand</p>
              <input
                value={searchWhen}
                onChange={(e) => setSearchWhen(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="text-sm font-medium text-[#1C2620] bg-transparent outline-none w-full truncate"
                placeholder="Dates…"
              />
            </div>
            {/* Activité */}
            <div className="flex-1 px-3 min-w-0 hidden lg:block">
              <ActivityDropdown value={searchActivity} onChange={setSearchActivity} />
            </div>
            {/* Voyageurs */}
            <div className="flex-1 px-3 min-w-0 hidden lg:block">
              <TravelersDropdown value={searchTravelers} onChange={setSearchTravelers} />
            </div>
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            className="flex-shrink-0 w-9 h-9 bg-[#1C2620] rounded-full flex items-center justify-center hover:bg-[#2d3d35] transition-colors active:scale-95"
            aria-label="Rechercher"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {/* Géolocalisation */}
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className={`flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
              locating
                ? 'border-[#4A6741] bg-[#4A6741]/10 animate-pulse'
                : userLocation
                ? 'border-[#4A6741] bg-[#4A6741]/10'
                : 'border-[#E8E4DA] hover:bg-[#F5F2EC]'
            }`}
            aria-label="Ma position"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={userLocation ? '#4A6741' : '#1C2620'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            </svg>
          </button>

          {/* Journal + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/carnets" className="text-sm text-[#1C2620]/60 hover:text-[#1C2620] transition-colors hidden sm:block">
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
            onClick={() => setFilterSheetOpen(true)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
              activeFilterCount > 0
                ? 'bg-[#1C2620] text-white'
                : 'bg-[#1C2620] text-white hover:bg-[#2d3d35]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Tous les filtres
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-white text-[#1C2620] rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
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
            🐕 Chien accepté
          </button>

          {/* Prix filter */}
          <PriceDropdown value={priceRange} onChange={setPriceRange} />

          {/* Altitude filter */}
          <AltitudeDropdown value={altitudeRange} onChange={setAltitudeRange} />

          <div className="w-px h-5 bg-[#E8E4DA] flex-shrink-0" />

          {/* Randonnées toggle */}
          <button
            type="button"
            onClick={() => setPanelMode(panelMode === 'trails' ? 'listings' : 'trails')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              panelMode === 'trails' ?'bg-[#4A6741] text-white border-[#4A6741]' :'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#4A6741]/40'
            }`}
          >
            🥾 Randonnées
          </button>

          {/* Clear all filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Effacer
            </button>
          )}
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
                panelMode === 'listings' ? 'text-[#1C2620] border-b-2 border-[#1C2620]' : 'text-[#1C2620]/40 hover:text-[#1C2620]/70'
              }`}
            >
              🏠 {filteredListings.length} hébergements
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('trails')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                panelMode === 'trails' ? 'text-[#4A6741] border-b-2 border-[#4A6741]' : 'text-[#1C2620]/40 hover:text-[#1C2620]/70'
              }`}
            >
              🥾 {filteredTrails.length} randonnées
            </button>
          </div>

          {/* Trail detail panel (desktop inline) */}
          {panelMode === 'trails' && selectedTrail ? (
            <div className="flex-1 overflow-hidden">
              <TrailPanel trail={selectedTrail} onClose={handleCloseTrailPanel} />
            </div>
          ) : panelMode === 'trails' ? (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {trailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#4A6741]/30 border-t-[#4A6741] rounded-full animate-spin" />
                </div>
              ) : filteredTrails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm font-medium text-[#1C2620]/60">Aucune randonnée trouvée</p>
                  <button type="button" onClick={handleClearAllFilters} className="text-xs text-[#4A6741] underline">
                    Effacer les filtres
                  </button>
                </div>
              ) : (
                filteredTrails.map((trail) => (
                  <TrailMiniCard
                    key={trail.id}
                    trail={trail}
                    selected={selectedTrailId === trail.id}
                    onClick={() => handleTrailClick(trail)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {filteredListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm font-medium text-[#1C2620]/60">Aucun hébergement trouvé</p>
                  <button type="button" onClick={handleClearAllFilters} className="text-xs text-[#4A6741] underline">
                    Effacer les filtres
                  </button>
                </div>
              ) : (
                filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedListingId === listing.id}
                    onClick={() => handleListingClick(listing)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Map ──────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <ExplorerMap
            trails={filteredTrails}
            selectedTrailId={selectedTrailId}
            onTrailClick={handleTrailClick}
            userLocation={userLocation}
            onLocationUpdate={handleLocationUpdate}
          />

          {/* Location label overlay */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm border border-[#E8E4DA]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1C2620" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-xs font-medium text-[#1C2620]">
              {searchWhere || 'France'}
            </span>
            {searchWhere && (
              <button
                type="button"
                onClick={() => setSearchWhere('')}
                className="text-[#1C2620]/40 hover:text-[#1C2620] transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Count badge */}
          <div className="absolute bottom-4 left-3 z-[1000] flex items-center gap-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-[#E8E4DA]">
              <span className="text-xs font-medium text-[#1C2620]">
                {filteredListings.length} lieux · {filteredTrails.length} randonnées
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="flex gap-3 p-3">
                <div className="relative w-[80px] h-[70px] rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={popupListing.image} alt={popupListing.alt} fill className="object-cover" sizes="80px" />
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
            onClick={() => { setMobileView('map'); setBottomSheetOpen(false); }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mobileView === 'map' ? 'bg-white text-[#1C2620]' : 'text-white/70'
            }`}
          >
            Carte
          </button>
          <button
            type="button"
            onClick={() => { setMobileView('list'); setBottomSheetOpen(true); }}
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
                {filteredListings.length} hébergements · {filteredTrails.length} randonnées
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
                panelMode === 'listings' ? 'text-[#1C2620] border-b-2 border-[#1C2620]' : 'text-[#1C2620]/40'
              }`}
            >
              🏠 Hébergements
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('trails')}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                panelMode === 'trails' ? 'text-[#4A6741] border-b-2 border-[#4A6741]' : 'text-[#1C2620]/40'
              }`}
            >
              🥾 Randonnées
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto px-4 pb-20 space-y-3" style={{ maxHeight: 'calc(75vh - 100px)' }}>
            {panelMode === 'listings'
              ? filteredListings.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <span className="text-3xl">🔍</span>
                    <p className="text-sm font-medium text-[#1C2620]/60">Aucun hébergement trouvé</p>
                    <button type="button" onClick={handleClearAllFilters} className="text-xs text-[#4A6741] underline">
                      Effacer les filtres
                    </button>
                  </div>
                )
                : filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    selected={selectedListingId === listing.id}
                    onClick={() => handleListingClick(listing)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))
              : filteredTrails.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm font-medium text-[#1C2620]/60">Aucune randonnée trouvée</p>
                  <button type="button" onClick={handleClearAllFilters} className="text-xs text-[#4A6741] underline">
                    Effacer les filtres
                  </button>
                </div>
              )
              : filteredTrails.map((trail) => (
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
          <TrailPanel trail={selectedTrail} onClose={handleCloseTrailPanel} isMobile />
        )}
      </div>

      {/* ── Filter Sheet ──────────────────────────────────────────────────── */}
      <ExplorerFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={advancedFilters}
        onChange={setAdvancedFilters}
      />
    </div>
  );
}
