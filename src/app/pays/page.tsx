'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';



import Link from 'next/link';
import { getAllCountries, type Country } from '@/lib/countries';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import AppImage from '@/components/ui/AppImage';
import BackButton from '@/components/ui/BackButton';
import TopoSeparator from '@/components/TopoSeparator';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Footer from '@/components/Footer';






const ALL_COUNTRIES = getAllCountries();

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const CONTINENTS = ['Tous', 'Europe', 'Asie', 'Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];

const CONTINENT_EMOJIS: Record<string, string> = {
  'Tous': '🌍',
  'Europe': '🏔️',
  'Asie': '🗺️',
  'Afrique': '🦁',
  'Amérique du Nord': '🦅',
  'Amérique du Sud': '🌿',
  'Océanie': '🌊',
};

const DANGER_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  low: {
    label: 'Sûr',
    bg: 'bg-[#EDF7F0]',
    text: 'text-[#2D6A4F]',
    border: 'border-[#B7E4C7]',
    dot: 'bg-[#2D6A4F]',
  },
  medium: {
    label: 'Vigilance',
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#D97706]',
    border: 'border-[#FCD34D]',
    dot: 'bg-[#D97706]',
  },
  high: {
    label: 'Risqué',
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#DC2626]',
    border: 'border-[#FCA5A5]',
    dot: 'bg-[#DC2626]',
  },
};

const COUNTRY_IMAGES: Record<string, string> = {
  IS: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=600&q=80',
  NO: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80',
  FR: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  JP: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
  NP: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=80',
  MA: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80',
  TZ: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80',
  CA: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=600&q=80',
  PE: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=600&q=80',
  NZ: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80',
};

const DEFAULT_LANDSCAPES = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&q=80',
];

function getCountryImage(code: string): string {
  if (COUNTRY_IMAGES[code]) return COUNTRY_IMAGES[code];
  const charCode = code.charCodeAt(0) + (code.charCodeAt(1) || 0);
  return DEFAULT_LANDSCAPES[charCode % DEFAULT_LANDSCAPES.length];
}

const ALL_TAGS = Array.from(new Set(ALL_COUNTRIES.flatMap((c) => c.tags))).sort();
const FEATURED = ALL_COUNTRIES.filter((c) => c.published);
const PAGE_SIZE = 36;

// ─── Country Card ─────────────────────────────────────────────────────────────

function CountryCard({ country }: { country: ReturnType<typeof getAllCountries>[0] }) {
  const danger = dangerConfig[country.danger_level] || dangerConfig.medium;

  return (
    <Link
      href={`/pays/${country.code.toLowerCase()}`}
      className="group block"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DA',
        borderRadius: '16px',
        padding: '20px',
        transition: 'all 0.25s ease',
        boxShadow: '0 1px 3px rgba(28,38,32,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(28,38,32,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(28,38,32,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E8E4DA'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(28,38,32,0.04)'; }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={`Drapeau ${country.nom}`}>
            {getFlagEmoji(country.code)}
          </span>
          <div>
            <h3
              style={{
                fontFamily: 'Georgia, serif',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#1C2620',
                lineHeight: '1.2',
                marginBottom: '2px',
              }}
            >
              {country.nom}
            </h3>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#8A8578', letterSpacing: '0.08em' }}>
              {country.capital}
            </p>
          </div>
        </div>
        <span
          className="px-2 py-1 text-xs font-medium flex-shrink-0"
          style={{
            background: danger.bg,
            color: danger.color,
            border: `1px solid ${danger.border}`,
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.08em',
          }}
        >
          {danger.label}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: '11px', color: '#8A8578', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          Meilleure saison
        </p>
        <p style={{ fontSize: '11px', color: '#5C6B5E', fontFamily: 'var(--font-sans)' }}>
          {country.meilleure_saison}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {country.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5"
            style={{
              background: '#F5F2EC',
              border: '1px solid #E8E4DA',
              borderRadius: '5px',
              fontSize: '10px',
              color: '#8A8578',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {!country.published && (
        <div
          className="mt-3 px-2.5 py-1.5"
          style={{
            background: 'rgba(217,119,6,0.06)',
            border: '1px solid rgba(217,119,6,0.15)',
            borderRadius: '6px',
          }}
        >
          <p style={{ fontSize: '10px', color: '#D97706', fontFamily: 'var(--font-mono)' }}>⚠ En cours de vérification</p>
        </div>
      )}
    </Link>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────

const COUNTRY_IMAGES: Record<string, { src: string; alt: string }> = {
  JP: { src: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80', alt: 'Mont Fuji enneigé reflété dans un lac japonais au lever du soleil' },
  NP: { src: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Panorama de l\'Himalaya avec les sommets enneigés du Népal' },
  IS: { src: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80', alt: 'Paysage volcanique islandais avec vapeurs géothermiques et montagnes colorées' },
  NO: { src: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80', alt: 'Fjord norvégien avec montagnes enneigées et reflets dans l\'eau calme' },
  NZ: { src: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=80', alt: 'Paysage verdoyant de Nouvelle-Zélande avec collines et ciel dramatique' },
  MA: { src: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800&q=80', alt: 'Médina de Marrakech avec ses ruelles colorées et architecture traditionnelle' },
  IN: { src: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80', alt: 'Taj Mahal au lever du soleil avec ses reflets dans le bassin d\'eau' },
  PT: { src: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80', alt: 'Lisbonne avec ses toits de tuiles oranges et le Tage en arrière-plan' },
  SE: { src: 'https://images.unsplash.com/photo-1509356843151-3e7d96241e11?w=800&q=80', alt: 'Forêt suédoise automnale avec lac et reflets dorés' },
  MH: { src: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80', alt: 'Atoll des Îles Marshall avec lagon turquoise et plage de sable blanc' },
};

function FeaturedCountryCard({ country }: { country: ReturnType<typeof getAllCountries>[0] }) {
  const img = COUNTRY_IMAGES[country.code.toUpperCase()];
  const danger = dangerConfig[country.danger_level] || dangerConfig.medium;

  return (
    <Link
      href={`/pays/${country.code.toLowerCase()}`}
      className="group relative overflow-hidden block"
      style={{ borderRadius: '16px', height: '260px' }}
    >
      {img ? (
        <>
          <AppImage
            src={img.src}
            alt={img.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(14,21,18,0.88) 0%, rgba(14,21,18,0.25) 60%, transparent 100%)' }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#1C2620' }}
        >
          <span className="text-6xl">{getFlagEmoji(country.code)}</span>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex justify-between items-start">
          <span className="text-3xl">{getFlagEmoji(country.code)}</span>
          <span
            className="px-2 py-1"
            style={{
              background: 'rgba(14,21,18,0.7)',
              border: '1px solid rgba(231,227,214,0.15)',
              borderRadius: '6px',
              fontSize: '10px',
              color: danger.color,
              fontFamily: 'var(--font-mono)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {danger.label}
          </span>
        </div>

        <div>
          <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {country.continent}
          </p>
          <h3
            style={{
              fontFamily: 'Georgia, serif',
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: '1.3rem',
              color: '#FFFFFF',
              lineHeight: '1.1',
              marginBottom: '6px',
            }}
          >
            {country.nom}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {country.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5"
                style={{
                  background: 'rgba(14,21,18,0.6)',
                  border: '1px solid rgba(231,227,214,0.12)',
                  borderRadius: '5px',
                  fontSize: '10px',
                  color: 'rgba(231,227,214,0.7)',
                  fontFamily: 'var(--font-mono)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaysPage() {
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Tous');
  const [dangerFilter, setDangerFilter] = useState<string>('Tous');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [publishedOnly, setPublishedOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return ALL_COUNTRIES.filter((c) => {
      const matchSearch =
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.capital.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchContinent = continent === 'Tous' || c.continent === continent;
      const matchDanger = dangerFilter === 'Tous' || c.danger_level === dangerFilter;
      const matchTag = tagFilter === '' || c.tags.includes(tagFilter);
      const matchPublished = !publishedOnly || c.published;
      return matchSearch && matchContinent && matchDanger && matchTag && matchPublished;
    });
  }, [search, continent, dangerFilter, tagFilter, publishedOnly]);

  useEffect(() => {
    setPage(1);
  }, [search, continent, dangerFilter, tagFilter, publishedOnly]);

  const displayItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < filtered.length;

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
      <Header />
      <main className="min-h-screen bg-[#FAF8F5] text-[#1C2620]">
        {/* Top Hero Section */}
        <section className="relative pt-28 pb-16 bg-[#1C2620] text-white overflow-hidden">
          {/* Subtle topo grid pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#E8E4D8_1px,transparent_1px)] [background-size:24px_24px]" />
          
          <div className="container mx-auto px-4 relative z-10">
            <BackButton variant="ghost" className="text-white/70 hover:text-white mb-6" />

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-white/90 mb-4 border border-white/15">
                <span className="animate-pulse text-emerald-400">●</span>
                <span>Exploration Mondiale · Earth Guide</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 leading-tight">
                Destinations & Fiches Pays 🌍
              </h1>
              
              <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-2xl font-light">
                Explorez <span className="font-semibold text-white">{ALL_COUNTRIES.length} destinations</span> répertoriées. 
                Retrouvez les conseils de sécurité, météo idéale, équipements recommandés et formalités de visa.
              </p>

              {/* Search Bar Input */}
              <div className="relative max-w-xl">
                <div className="relative flex items-center bg-white rounded-2xl shadow-xl overflow-hidden p-1.5 border border-[#E4E0D4]">
                  <svg className="w-5 h-5 ml-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher un pays, une capitale, une activité (ex: Islande, Tokyo, Safari)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-[#1C2620] bg-transparent focus:outline-none placeholder-gray-400 font-medium"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full mr-1 transition-colors"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl border-t border-white/10 pt-6">
              <div>
                <span className="block text-2xl md:text-3xl font-bold text-white">{ALL_COUNTRIES.length}</span>
                <span className="text-xs text-white/60">Pays répertoriés</span>
              </div>
              <div>
                <span className="block text-2xl md:text-3xl font-bold text-emerald-400">{FEATURED.length}</span>
                <span className="text-xs text-white/60">Destinations Phares</span>
              </div>
              <div>
                <span className="block text-2xl md:text-3xl font-bold text-white">7</span>
                <span className="text-xs text-white/60">Continents couverts</span>
              </div>
              <div>
                <span className="block text-2xl md:text-3xl font-bold text-amber-400">{ALL_TAGS.length}</span>
                <span className="text-xs text-white/60">Thématiques Outdoor</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Area */}
        <div id="main-content" className="container mx-auto px-4 py-10">

          {/* Featured Destinations Carousel / Grid */}
          {FEATURED.length > 0 && !search && continent === 'Tous' && dangerFilter === 'Tous' && !tagFilter && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1C2620]">Destinations Phares 🔥</h2>
                  <p className="text-sm text-[#5C6B5E]">Nos fiches complètes vérifiées avec guides d&apos;équipement sur-mesure</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {FEATURED.map((country) => {
                  const img = getCountryImage(country.code);
                  const danger = DANGER_CONFIG[country.danger_level];
                  return (
                    <Link
                      key={country.code}
                      href={`/pays/${country.code.toLowerCase()}`}
                      className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E8E4D8] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                      {/* Image Header */}
                      <div className="relative h-44 w-full bg-[#E7E3D6] overflow-hidden">
                        <img
                          src={img}
                          alt={country.nom}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        
                        {/* Flag Badge */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-sm font-bold shadow-md flex items-center gap-1.5">
                          <span>{getFlagEmoji(country.code)}</span>
                          <span className="text-[#1C2620] text-xs uppercase tracking-wider">{country.code}</span>
                        </div>

                        {/* Safety Badge */}
                        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm flex items-center gap-1 ${danger.bg} ${danger.text} ${danger.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${danger.dot}`} />
                          <span>{danger.label}</span>
                        </div>

                        {/* Title over gradient */}
                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <h3 className="font-bold text-xl leading-tight drop-shadow-md">{country.nom}</h3>
                          <p className="text-xs text-white/80 font-light">{country.capital} · {country.continent}</p>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 flex flex-col flex-1 justify-between bg-white">
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-xs text-[#5C6B5E]">
                            <span>📅 {country.meilleure_saison}</span>
                            <span className="font-mono bg-[#F5F2EA] px-2 py-0.5 rounded text-[#1C2620] font-semibold">{country.monnaie}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0ECE1]">
                          {country.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-[#F5F2EA] text-[#3A4A3D] text-[11px] font-medium rounded-md border border-[#E4E0D4]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <TopoSeparator className="my-8" />

          {/* Filter Bar & Controls */}
          <section className="mb-8 space-y-5">
            {/* Continent Pills Bar */}
            <div>
              <label className="block text-xs font-bold text-[#7A8A7D] uppercase tracking-wider mb-2">Continent</label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {CONTINENTS.map((c) => {
                  const isSelected = continent === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setContinent(c)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                        isSelected
                          ? 'bg-[#1C2620] text-white border-[#1C2620] shadow-md scale-105'
                          : 'bg-white text-[#3A4A3D] border-[#E4E0D4] hover:border-[#1C2620] hover:bg-[#F5F2EA]'
                      }`}
                    >
                      <span>{CONTINENT_EMOJIS[c]}</span>
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropdown Filters Row */}
            <div className="bg-white p-4 rounded-2xl border border-[#E8E4D8] shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
              {/* Security Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#7A8A7D] uppercase tracking-wider mb-1">Sécurité</label>
                <select
                  value={dangerFilter}
                  onChange={(e) => setDangerFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold text-[#1C2620] bg-[#F5F2EA] border border-[#E4E0D4] rounded-xl focus:outline-none focus:border-[#1C2620]"
                >
                  <option value="Tous">Tous les niveaux</option>
                  <option value="low">🟢 Sûr</option>
                  <option value="medium">🟡 Vigilance</option>
                  <option value="high">🔴 Risqué</option>
                </select>
              </div>

              {/* Tag / Activity Filter */}
              <div>
                <label className="block text-[11px] font-bold text-[#7A8A7D] uppercase tracking-wider mb-1">Thématique / Activité</label>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold text-[#1C2620] bg-[#F5F2EA] border border-[#E4E0D4] rounded-xl focus:outline-none focus:border-[#1C2620]"
                >
                  <option value="">Toutes les activités</option>
                  {ALL_TAGS.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* Published Toggle */}
              <div className="flex items-center gap-2 pt-4 sm:pt-0">
                <input
                  type="checkbox"
                  id="publishedToggle"
                  checked={publishedOnly}
                  onChange={(e) => setPublishedOnly(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#1C2620] cursor-pointer"
                />
                <label htmlFor="publishedToggle" className="text-xs font-semibold text-[#1C2620] cursor-pointer">
                  Destinations vérifiées uniquement
                </label>
              </div>

              {/* Reset Filters Button */}
              {(search || continent !== 'Tous' || dangerFilter !== 'Tous' || tagFilter || publishedOnly) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSearch('');
                      setContinent('Tous');
                      setDangerFilter('Tous');
                      setTagFilter('');
                      setPublishedOnly(false);
                    }}
                    className="text-xs font-semibold text-[#17402C] hover:underline flex items-center gap-1"
                  >
                    <span>Réinitialiser les filtres</span>
                    <span>✕</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Results Summary & View Switcher */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-xs font-bold text-[#7A8A7D] uppercase tracking-wider">
              {filtered.length} destination{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}
            </p>
            <div className="flex gap-1.5 p-1 bg-white border border-[#E4E0D4] rounded-xl shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid' ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'
                }`}
              >
                Grille
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'list' ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'
                }`}
              >
                Liste
              </button>
            </div>
          </div>

          {/* Results Display */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E8E4D8] p-8 shadow-sm">
              <div className="text-5xl mb-4">🌏</div>
              <h3 className="text-xl font-bold text-[#1C2620] mb-2">Aucune destination trouvée</h3>
              <p className="text-sm text-[#5C6B5E] max-w-md mx-auto mb-6">
                Aucun pays ne correspond aux filtres sélectionnés. Essayez de réinitialiser votre recherche.
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setContinent('Tous');
                  setDangerFilter('Tous');
                  setTagFilter('');
                  setPublishedOnly(false);
                }}
                className="px-5 py-2.5 bg-[#1C2620] text-white text-xs font-bold rounded-xl hover:bg-[#2D3F35] transition-all"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayItems.map((country) => {
                const danger = DANGER_CONFIG[country.danger_level];
                const img = getCountryImage(country.code);
                return (
                  <Link
                    key={country.code}
                    href={`/pays/${country.code.toLowerCase()}`}
                    className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E8E4D8] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* Top image bar */}
                    <div className="relative h-36 w-full bg-[#E7E3D6] overflow-hidden">
                      <img
                        src={img}
                        alt={country.nom}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Flag Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-sm font-bold shadow-md flex items-center gap-1.5">
                        <span>{getFlagEmoji(country.code)}</span>
                        <span className="text-[#1C2620] text-xs font-mono">{country.code}</span>
                      </div>

                      {/* Security Level Pill */}
                      <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm flex items-center gap-1.5 ${danger.bg} ${danger.text} ${danger.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${danger.dot}`} />
                        <span>{danger.label}</span>
                      </div>

                      {/* Name over image */}
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="font-bold text-lg leading-tight drop-shadow">{country.nom}</h3>
                        <p className="text-xs text-white/80 font-light">{country.capital} · {country.continent}</p>
                      </div>
                    </div>

                    {/* Card details */}
                    <div className="p-4 flex flex-col flex-1 justify-between bg-white space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#5C6B5E] pt-1">
                        <span>📅 <strong>Saison:</strong> {country.meilleure_saison}</span>
                        <span className="font-mono bg-[#F5F2EA] px-2 py-0.5 rounded text-[#1C2620] font-semibold">{country.monnaie}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0ECE1]">
                        {country.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-[#F5F2EA] text-[#3A4A3D] text-[11px] font-medium rounded-md border border-[#E4E0D4]">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {country.published && (
                        <div className="pt-2 flex items-center text-[11px] text-[#2D6A4F] font-bold gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Fiche Guide Vérifiée</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-3">
              {displayItems.map((country) => {
                const danger = DANGER_CONFIG[country.danger_level];
                return (
                  <Link
                    key={country.code}
                    href={`/pays/${country.code.toLowerCase()}`}
                    className="group flex items-center justify-between p-4 bg-white border border-[#E8E4D8] rounded-xl hover:border-[#1C2620] hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-3xl p-2 bg-[#F5F2EA] rounded-xl">{getFlagEmoji(country.code)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-[#1C2620] group-hover:text-[#17402C] transition-colors">{country.nom}</h3>
                          <span className="text-xs text-[#7A8A7D] font-mono">({country.code})</span>
                        </div>
                        <p className="text-xs text-[#5C6B5E]">{country.capital} · {country.continent}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden md:block text-right">
                        <span className="block text-xs font-semibold text-[#1C2620]">Saison: {country.meilleure_saison}</span>
                        <span className="text-xs text-[#7A8A7D]">Devise: {country.monnaie}</span>
                      </div>

                      <div className="flex gap-1.5 hidden lg:flex">
                        {country.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-[#F5F2EA] text-[#3A4A3D] text-[11px] font-medium rounded-md border border-[#E4E0D4]">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border flex items-center gap-1 ${danger.bg} ${danger.text} ${danger.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${danger.dot}`} />
                        <span>{danger.label}</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Load More Pagination */}
          {hasMore && (
            <div className="flex flex-col items-center justify-center mt-12 space-y-3">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-8 py-3.5 bg-[#1C2620] text-white rounded-2xl text-xs font-bold tracking-wide uppercase shadow-lg hover:bg-[#2D3F35] active:scale-[0.98] transition-all"
              >
                Charger plus de pays ({filtered.length - displayItems.length} restants)
              </button>
              <p className="text-xs text-[#7A8A7D]">
                Affichage de {displayItems.length} sur {filtered.length} destinations
              </p>
            </div>
          )}

        <NewFooterSection />
      </main>
      <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px', minHeight: '100%' }}>
            {/* Mobile Header */}
            <div style={{ marginBottom: '20px' }}>
              <BackButton variant="ghost" className="text-[#1C2620]/60 mb-3" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1C2620', margin: 0 }}>
                  Destinations
                </h1>
                <span style={{ fontSize: '20px' }}>🌍</span>
              </div>
              <p style={{ fontSize: '13px', color: '#5C6B5E', marginBottom: '16px', margin: '4px 0 16px' }}>
                {ALL_COUNTRIES.length} pays répertoriés
              </p>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un pays..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '12px',
                    border: '1px solid #E4E0D4',
                    fontSize: '13px',
                    background: '#fff',
                    color: '#1C2620',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Continent Filter */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {CONTINENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setContinent(c)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    border: '1px solid',
                    background: continent === c ? '#1C2620' : '#fff',
                    color: continent === c ? '#fff' : '#3A4A3D',
                    borderColor: continent === c ? '#1C2620' : '#E4E0D4',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {CONTINENT_EMOJIS[c]} {c}
                </button>
              ))}
            </div>

            {/* Danger + Tag filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <select
                value={dangerFilter}
                onChange={(e) => setDangerFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '12px',
                  borderRadius: '10px',
                  border: '1px solid #E4E0D4',
                  background: '#F5F2EA',
                  color: '#1C2620',
                  fontWeight: '600',
                  outline: 'none',
                }}
              >
                <option value="Tous">🟢 Sécurité: Tous</option>
                <option value="low">🟢 Sûr</option>
                <option value="medium">🟡 Vigilance</option>
                <option value="high">🔴 Risqué</option>
              </select>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: '12px',
                  borderRadius: '10px',
                  border: '1px solid #E4E0D4',
                  background: '#F5F2EA',
                  color: '#1C2620',
                  fontWeight: '600',
                  outline: 'none',
                }}
              >
                <option value="">🏷️ Activité: Toutes</option>
                {ALL_TAGS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Active filters reset */}
            {(search || continent !== 'Tous' || dangerFilter !== 'Tous' || tagFilter) && (
              <div style={{ marginBottom: '12px', textAlign: 'right' }}>
                <button
                  onClick={() => { setSearch(''); setContinent('Tous'); setDangerFilter('Tous'); setTagFilter(''); }}
                  style={{ fontSize: '11px', fontWeight: '600', color: '#17402C', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Réinitialiser les filtres ✕
                </button>
              </div>
            )}

            {/* Results count */}
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#7A8A7D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {filtered.length} destination{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Results grid */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #E8E4D8' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌏</div>
                <p style={{ fontSize: '16px', fontWeight: '700', color: '#1C2620', marginBottom: '8px' }}>Aucune destination</p>
                <p style={{ fontSize: '13px', color: '#5C6B5E', marginBottom: '16px' }}>Essayez de modifier vos filtres</p>
                <button
                  onClick={() => { setSearch(''); setContinent('Tous'); setDangerFilter('Tous'); setTagFilter(''); }}
                  style={{ padding: '10px 20px', background: '#1C2620', color: '#fff', fontSize: '12px', fontWeight: '700', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
                >
                  Réinitialiser
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {displayItems.map((country) => {
                  const danger = DANGER_CONFIG[country.danger_level];
                  const img = getCountryImage(country.code);
                  return (
                    <Link
                      key={country.code}
                      href={`/pays/${country.code.toLowerCase()}`}
                      style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E8E4D8' }}
                    >
                      <div style={{ position: 'relative', height: '100px', background: '#E7E3D6', overflow: 'hidden' }}>
                        <img src={img} alt={country.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                        <div style={{ position: 'absolute', top: '6px', left: '6px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.95)', fontSize: '16px', lineHeight: '22px' }}>
                          {getFlagEmoji(country.code)}
                        </div>
                        <div style={{ position: 'absolute', top: '6px', right: '6px', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', border: '1px solid', display: 'flex', alignItems: 'center', gap: '3px', background: danger.bg, color: danger.text, borderColor: danger.border }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: danger.dot, display: 'inline-block' }} />
                          <span>{danger.label}</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: '6px', left: '8px', right: '8px', color: '#fff' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', display: 'block', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{country.nom}</span>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>{country.capital}</span>
                        </div>
                      </div>
                      <div style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {country.tags.slice(0, 2).map((tag) => (
                            <span key={tag} style={{ padding: '2px 6px', background: '#F5F2EA', fontSize: '9px', fontWeight: '500', borderRadius: '4px', border: '1px solid #E4E0D4', color: '#3A4A3D' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: '10px', color: '#5C6B5E', marginTop: '4px' }}>
                          📅 {country.meilleure_saison}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '20px' }}>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: '12px 28px',
                    background: '#1C2620',
                    color: '#fff',
                    borderRadius: '14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '280px',
                  }}
                >
                  Charger plus ({filtered.length - displayItems.length} restants)
                </button>
                <p style={{ fontSize: '11px', color: '#7A8A7D', marginTop: '8px' }}>
                  {displayItems.length} / {filtered.length}
                </p>
              </div>
            )}

            {/* Bottom spacer */}
            <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}