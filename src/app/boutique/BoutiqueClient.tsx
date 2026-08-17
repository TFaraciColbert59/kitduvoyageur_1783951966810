'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProductCard from '@/components/ui/ProductCard';
import { useEquipment, UnifiedProduct } from '@/hooks/useEquipment';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

type TabView = 'catalogue' | 'owned' | 'missing';
type SortOption = 'score_desc' | 'price_asc' | 'price_desc' | 'weight_asc' | 'rating_desc';

const CATEGORIES = [
  { key: 'all', label: 'Toutes les catégories', icon: '🎒' },
  { key: 'Sacs à dos', label: 'Sacs à dos', icon: '🎒' },
  { key: 'Bivouac', label: 'Bivouac & Tentes', icon: '🏕️' },
  { key: 'Couchage', label: 'Couchage', icon: '🛏️' },
  { key: 'Vêtements', label: 'Vêtements', icon: '🧥' },
  { key: 'Chaussures', label: 'Chaussures', icon: '🥾' },
  { key: 'Cuisine', label: 'Cuisine & Réchauds', icon: '🍳' },
  { key: 'Hydratation', label: 'Eau & Filtres', icon: '💧' },
  { key: 'Navigation', label: 'Navigation & GPS', icon: '🧭' },
  { key: 'Sécurité', label: 'Sécurité & Soins', icon: '🩹' },
  { key: 'Éclairage', label: 'Lampes & Éclairage', icon: '🔦' },
];

export default function BoutiqueClient() {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const {
    products,
    equipment,
    cartCount,
    loading,
    totalPackWeight,
    isOwned,
    isInCart,
    getCartQuantity,
    addToCart,
  } = useEquipment();

  // Navigation & Filtres
  const [activeTab, setActiveTab] = useState<TabView>('catalogue');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('score_desc');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [maxWeight, setMaxWeight] = useState<string>('');

  // Filtrage des produits
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filtre onglet (Catalogue / Possédé / À acheter)
    if (activeTab === 'owned') {
      result = result.filter((p) => isOwned(p));
    } else if (activeTab === 'missing') {
      result = result.filter((p) => !isOwned(p));
    }

    // Filtre catégorie
    if (category !== 'all') {
      result = result.filter(
        (p) =>
          p.category?.toLowerCase() === category.toLowerCase() ||
          p.category_main?.toLowerCase() === category.toLowerCase()
      );
    }

    // Filtre recherche
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }

    // Filtre prix max
    if (maxPrice) {
      const limit = Number(maxPrice);
      if (!isNaN(limit) && limit > 0) {
        result = result.filter((p) => p.price_eur <= limit);
      }
    }

    // Filtre poids max (en grammes)
    if (maxWeight) {
      const limitG = Number(maxWeight);
      if (!isNaN(limitG) && limitG > 0) {
        result = result.filter((p) => p.weight_g <= limitG);
      }
    }

    // Tri
    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price_eur - b.price_eur;
      if (sortBy === 'price_desc') return b.price_eur - a.price_eur;
      if (sortBy === 'weight_asc') return a.weight_g - b.weight_g;
      if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
      return (b.score_kdv || 0) - (a.score_kdv || 0);
    });

    return result;
  }, [products, activeTab, category, search, maxPrice, maxWeight, sortBy, isOwned]);

  const ownedCount = useMemo(() => {
    return products.filter((p) => isOwned(p)).length;
  }, [products, isOwned]);

  const missingCount = products.length - ownedCount;

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#0B1F17] font-sans selection:bg-[#17402C]/10">
      {/* Header Desktop */}
      <div className="hidden md:block">
        <Header />
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 md:pt-28 pb-24">
        {/* ── 1. BANDEAU TITRE & SYNTHÈSE ÉQUIPEMENT / PANIER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-black/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#17402C] bg-[#E1EBDD] px-2.5 py-0.5 rounded-full">
                🧳 Boutique & Équipement
              </span>
              <span className="text-xs text-[#5C6B63] font-mono">
                {products.length} articles référencés
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0B1F17]">
              Matériel & <em className="font-serif italic font-normal text-[#17402C]">Boutique Voyage</em>
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6B63] max-w-xl mt-1">
              Complétez votre équipement, ajoutez au panier en 1 clic et préparez vos expéditions en toute autonomie.
            </p>
          </div>

          {/* Raccourcis Sac & Panier */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Link
              href="/mon-materiel"
              onClick={() => triggerHaptic('light')}
              className="px-4 py-2.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex items-center gap-3 hover:border-[#17402C]/30 transition-colors"
            >
              <span className="text-xl">🎒</span>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B63]">Mon Sac</p>
                <p className="text-xs font-bold text-[#0B1F17]">
                  {equipment.length} article{equipment.length > 1 ? 's' : ''} ·{' '}
                  <span className="text-[#17402C]">
                    {totalPackWeight >= 1000 ? `${(totalPackWeight / 1000).toFixed(1)} kg` : `${totalPackWeight} g`}
                  </span>
                </p>
              </div>
            </Link>

            <Link
              href="/panier"
              onClick={() => triggerHaptic('selection')}
              className="px-5 py-3 rounded-2xl bg-[#17402C] text-white font-bold text-xs flex items-center gap-2 shadow-xs active:scale-95 transition-transform"
            >
              <span>🛒 Voir mon Panier</span>
              {cartCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white text-[#17402C] text-[10px] font-mono font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ── 2. ONGLETS UNIFIÉS (Catalogue / Possédé / À Acheter) ── */}
        <div className="flex items-center justify-between gap-2 pt-4 pb-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-black/[0.06] shadow-2xs">
            {([
              { id: 'catalogue', label: 'Tout le Catalogue', count: products.length },
              { id: 'owned', label: 'Dans mon équipement', count: ownedCount },
              { id: 'missing', label: 'À acheter / Manquants', count: missingCount },
            ] as { id: TabView; label: string; count: number }[]).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setActiveTab(tab.id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#17402C] text-white shadow-xs'
                      : 'text-[#5C6B63] hover:text-[#0B1F17] hover:bg-[#F4F1EB]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-[#F4F1EB] text-[#5C6B63]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Toggle Grille / Liste */}
          <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-2xl border border-black/[0.06] shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-colors ${
                viewMode === 'grid' ? 'bg-[#F4F1EB] text-[#0B1F17]' : 'text-[#5C6B63]'
              }`}
              title="Vue Grille"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-colors ${
                viewMode === 'list' ? 'bg-[#F4F1EB] text-[#0B1F17]' : 'text-[#5C6B63]'
              }`}
              title="Vue Liste"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="4" cy="6" r="1" fill="currentColor" />
                <circle cx="4" cy="12" r="1" fill="currentColor" />
                <circle cx="4" cy="18" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── 3. RECHERCHE & FILTRES RAPIDES ── */}
        <div className="py-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Champ de recherche */}
            <div className="md:col-span-6 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, marque (Osprey, Sea to Summit...)"
                className="w-full bg-white border border-black/[0.08] rounded-2xl px-4 py-3 pl-10 text-xs text-[#0B1F17] placeholder:text-[#5C6B63]/60 shadow-2xs outline-none focus:border-[#17402C] focus:ring-1 focus:ring-[#17402C]"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3.5 top-3.5 text-[#5C6B63]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-3 text-xs text-[#5C6B63] hover:text-[#0B1F17]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Tri */}
            <div className="md:col-span-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full bg-white border border-black/[0.08] rounded-2xl px-3.5 py-3 text-xs text-[#0B1F17] shadow-2xs outline-none focus:border-[#17402C] cursor-pointer"
              >
                <option value="score_desc">★ Score KDV (recommandé)</option>
                <option value="weight_asc">⚖️ Poids le plus léger</option>
                <option value="price_asc">💶 Prix croissant</option>
                <option value="price_desc">💶 Prix décroissant</option>
                <option value="rating_desc">⭐ Meilleures notes</option>
              </select>
            </div>

            {/* Filtre Prix max */}
            <div className="md:col-span-3 flex gap-2">
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Prix max (€)"
                className="w-1/2 bg-white border border-black/[0.08] rounded-2xl px-3 py-3 text-xs text-[#0B1F17] placeholder:text-[#5C6B63]/60 shadow-2xs outline-none focus:border-[#17402C]"
              />
              <input
                type="number"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                placeholder="Poids max (g)"
                className="w-1/2 bg-white border border-black/[0.08] rounded-2xl px-3 py-3 text-xs text-[#0B1F17] placeholder:text-[#5C6B63]/60 shadow-2xs outline-none focus:border-[#17402C]"
              />
            </div>
          </div>

          {/* Catégories (scroll horizontal) */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  triggerHaptic('light');
                  setCategory(cat.key);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors border ${
                  category === cat.key
                    ? 'bg-[#17402C] text-white border-[#17402C]'
                    : 'bg-white text-[#5C6B63] border-black/[0.06] hover:bg-[#F4F1EB]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 4. RÉSULTATS & PRODUCTCARDS UNIFIÉES ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 pt-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white border border-black/[0.04] animate-pulse p-4 flex flex-col justify-between">
                <div className="w-full aspect-square bg-[#F4F1EB] rounded-xl" />
                <div className="h-4 bg-[#F4F1EB] rounded w-3/4" />
                <div className="h-4 bg-[#F4F1EB] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 sm:p-16 text-center rounded-3xl bg-white border border-dashed border-black/10 my-6">
            <p className="text-4xl mb-3">🔍</p>
            <h3 className="font-serif text-lg font-bold text-[#0B1F17]">Aucun article trouvé</h3>
            <p className="text-xs text-[#5C6B63] max-w-sm mx-auto mt-1 mb-5">
              Essayez de réinitialiser vos critères de recherche ou de changer de catégorie.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setCategory('all');
                setMaxPrice('');
                setMaxWeight('');
              }}
              className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#17402C] text-white shadow-xs"
            >
              Effacer les filtres
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3 pt-2">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                viewMode="list"
                context={activeTab === 'owned' ? 'inventory' : 'shop'}
                isOwned={isOwned(p)}
                isInCart={isInCart(p.id)}
                cartQuantity={getCartQuantity(p.id)}
                onAddToCart={() => addToCart(p, 1)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 pt-2">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                viewMode="grid"
                context={activeTab === 'owned' ? 'inventory' : 'shop'}
                isOwned={isOwned(p)}
                isInCart={isInCart(p.id)}
                cartQuantity={getCartQuantity(p.id)}
                onAddToCart={() => addToCart(p, 1)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
