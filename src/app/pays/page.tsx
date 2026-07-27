'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopoSeparator from '@/components/TopoSeparator';
import BackButton from '@/components/ui/BackButton';
import Link from 'next/link';
import { getAllCountries } from '@/lib/countries';

const ALL_COUNTRIES = getAllCountries();

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const continents = ['Tous', 'Europe', 'Asie', 'Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];
const continentEmojis: Record<string, string> = {
  'Tous': '🌍',
  'Europe': '🏔️',
  'Asie': '🗺️',
  'Afrique': '🦁',
  'Amérique du Nord': '🦅',
  'Amérique du Sud': '🌿',
  'Océanie': '🌊',
};

const dangerLabels: Record<string, string> = { low: 'Sûr', medium: 'Vigilance', high: 'Risqué' };
const dangerColors: Record<string, string> = {
  low: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  high: 'text-red-600 bg-red-50 border-red-200',
};

const ALL_TAGS = Array.from(new Set(ALL_COUNTRIES.flatMap((c) => c.tags))).sort();
const FEATURED = ALL_COUNTRIES.filter((c) => c.published);
const PAGE_SIZE = 60;

export default function PaysPage() {
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Tous');
  const [dangerFilter, setDangerFilter] = useState<string>('Tous');
  const [tagFilter, setTagFilter] = useState<string>('');
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
      return matchSearch && matchContinent && matchDanger && matchTag;
    });
  }, [search, continent, dangerFilter, tagFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, continent, dangerFilter, tagFilter]);

  const _totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayItems = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < filtered.length;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div id="main-content" className="container mx-auto px-4 pt-24 pb-12">
          <BackButton variant="ghost" className="text-xs mb-8" />
          
          {/* Hero */}
          <section className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#1C2620] mb-4">Fiches Pays</h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Explorez {ALL_COUNTRIES.length} destinations avec informations pratiques, météo, visa et équipement recommandé.
            </p>
          </section>

          {/* Featured */}
          {FEATURED.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-[#1C2620] mb-6">Destinations Phares</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {FEATURED.map((country) => (
                  <Link
                    key={country.code}
                    href={`/pays/${country.code.toLowerCase()}`}
                    className="group p-4 border border-gray-200 rounded-lg hover:border-[#E4501C] hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getFlagEmoji(country.code)}</span>
                      <span className="font-semibold text-[#1C2620]">{country.nom}</span>
                    </div>
                    <p className="text-sm text-gray-600">{country.capital}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <TopoSeparator />

          {/* Filters */}
          <section className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#1C2620] mb-2">Rechercher</label>
                <input
                  type="text"
                  placeholder="Pays, capitale, tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E4501C]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1C2620] mb-2">Continent</label>
                <select
                  value={continent}
                  onChange={(e) => setContinent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E4501C]"
                >
                  {continents.map((c) => (
                    <option key={c} value={c}>{continentEmojis[c]} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1C2620] mb-2">Sécurité</label>
                <select
                  value={dangerFilter}
                  onChange={(e) => setDangerFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E4501C]"
                >
                  <option value="Tous">Tous</option>
                  <option value="low">Sûr</option>
                  <option value="medium">Vigilance</option>
                  <option value="high">Risqué</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1C2620] mb-2">Activité</label>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#E4501C]"
                >
                  <option value="">Tous</option>
                  {ALL_TAGS.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* View Mode Toggle */}
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-600">{filtered.length} résultats</p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-[#E4501C] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Grille
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-[#E4501C] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Liste
              </button>
            </div>
          </div>

          {/* Results */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayItems.map((country) => (
                <Link
                  key={country.code}
                  href={`/pays/${country.code.toLowerCase()}`}
                  className="group block p-6 border border-gray-200 rounded-lg hover:border-[#E4501C] hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">{getFlagEmoji(country.code)}</span>
                        <h3 className="text-xl font-bold text-[#1C2620]">{country.nom}</h3>
                      </div>
                      <p className="text-sm text-gray-600">{country.capital}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${dangerColors[country.danger_level]}`}>
                      {dangerLabels[country.danger_level]}
                    </span>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Meilleure saison: {country.meilleure_saison}</p>
                    <p className="text-xs text-gray-500">Devise: {country.monnaie}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {country.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{tag}</span>
                    ))}
                  </div>
                  {!country.published && (
                    <div className="mt-4 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                      ⚠️ Contenu en cours de vérification
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayItems.map((country) => (
                <Link
                  key={country.code}
                  href={`/pays/${country.code.toLowerCase()}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-[#E4501C] hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl">{getFlagEmoji(country.code)}</span>
                    <div>
                      <h3 className="font-semibold text-[#1C2620]">{country.nom}</h3>
                      <p className="text-sm text-gray-600">{country.capital}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">{country.meilleure_saison}</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${dangerColors[country.danger_level]}`}>
                      {dangerLabels[country.danger_level]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-8 py-3 bg-[#1C2620] text-white rounded-xl font-semibold hover:bg-[#1C2620]/80 transition-colors"
              >
                Charger plus ({filtered.length - displayItems.length} restants)
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-2xl mb-2">🌍</p>
              <p className="text-gray-600">Aucun pays ne correspond à vos filtres.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}