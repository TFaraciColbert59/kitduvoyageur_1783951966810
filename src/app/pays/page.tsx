'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopoSeparator from '@/components/TopoSeparator';
import BackButton from '@/components/ui/BackButton';
import Link from 'next/link';
import { getAllCountries, type Country } from '@/lib/countries';

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
                    className="text-xs font-semibold text-[#E4501C] hover:underline flex items-center gap-1"
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
                          <h3 className="font-bold text-base text-[#1C2620] group-hover:text-[#E4501C] transition-colors">{country.nom}</h3>
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
        </div>
      </main>
      <Footer />
    </>
  );
}