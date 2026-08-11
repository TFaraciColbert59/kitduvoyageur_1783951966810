'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import BackButton from '@/components/ui/BackButton';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/client';
import { getCart, addToCart, removeFromCart, updateQuantity, getCartTotals, CartItem } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';

// --- Types ---
interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  category_main?: string;
  weight_g: number;
  weight_grams?: number;
  price_eur: number;
  image: string;
  image_alt: string;
  essentiality?: string;
  score_kdv?: number;
}

interface GearItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  weight_g: number;
  purchase_price: number;
  image: string;
  product_id?: string;
  quantity?: number; // Virtual for grouping
}

// --- Constants ---
const CATEGORY_MAP: Record<string, string> = {
  'Bivouac': '🏕️', 'Tente': '🏕️', 'Abri': '⛺',
  'Sac à dos': '🎒', 'Sac': '🎒',
  'Vêtements': '👕', 'Vêtement': '🧥',
  'Chaussures': '🥾', 'Chaussure': '👟',
  'Cuisine': '🍳',
  'Eau': '💧', 'Filtre à eau': '💧', 'Hydratation': '💧',
  'Navigation': '🧭',
  'Éclairage': '🔦',
  'Sécurité': '🩹', 'Premiers secours': '🩹',
  'Hygiène': '🧼',
  'Électronique': '🔋',
  'Nourriture': '🍫', 'Consommables': '🍫',
  'Accessoires': '🧰',
  'Couchage': '🛏️', 'Matelas': '🛏️',
};

const getCategoryIcon = (cat: string) => CATEGORY_MAP[cat] || '🎒';
const isConsumable = (cat: string) => ['eau', 'nourriture', 'consommables', 'gaz'].includes((cat || '').toLowerCase());

// --- Sidebar Component ---

function InventorySidebar({
  user, gearItems, shopProducts, isOpen, toggleOpen, onRefreshCart
}: {
  user: any, gearItems: GearItem[], shopProducts: ShopProduct[], isOpen: boolean, toggleOpen: () => void, onRefreshCart: () => void
}) {
  const totalItems = gearItems.length;
  const totalWeightG = gearItems.reduce((acc, item) => acc + (item.weight_g || 0), 0);
  const totalPriceEur = gearItems.reduce((acc, item) => acc + (item.purchase_price || 0), 0);

  const equipment = gearItems.filter(i => !isConsumable(i.category));
  const consumables = gearItems.filter(i => isConsumable(i.category));

  // Compute Missing Essentials
  const missingSuggestions: { title: string, category: string, reason: string }[] = [];
  const hasCat = (cats: string[]) => gearItems.some(i => cats.includes((i.category || '').toLowerCase()));
  
  if (!hasCat(['sécurité', 'premiers secours'])) {
    missingSuggestions.push({ title: 'Trousse de premiers secours', category: 'Sécurité', reason: 'Recommandée pour toute sortie' });
  }
  if (!hasCat(['éclairage', 'lampe'])) {
    missingSuggestions.push({ title: 'Lampe frontale', category: 'Éclairage', reason: 'Essentielle pour la nuit' });
  }
  if (!hasCat(['eau', 'filtre', 'hydratation'])) {
    missingSuggestions.push({ title: 'Filtre à eau', category: 'Eau', reason: 'Vital en autonomie' });
  }

  const handleAddToCart = (title: string, category: string) => {
    // Find best match in shop
    const product = shopProducts.find(p => p.name.toLowerCase().includes(title.toLowerCase()) || p.category?.toLowerCase() === category.toLowerCase()) || shopProducts[0];
    if (product) {
      addToCart({
        id: product.id, slug: product.slug, name: product.name, brand: product.brand,
        category: product.category, priceEur: product.price_eur, weightG: product.weight_g || 0,
        image: product.image, imageAlt: product.image_alt || product.name
      });
      onRefreshCart();
    }
  };

  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 bg-[#F5F2EA] border-l border-[#1C2620]/10 shadow-2xl transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:static lg:block lg:w-80 lg:shadow-none lg:h-[calc(100vh-80px)] lg:sticky lg:top-20'}`}>
      
      {/* Header */}
      <div className="p-6 border-b border-[#1C2620]/10 bg-[#1C2620] text-white flex justify-between items-center lg:rounded-t-2xl">
        <h2 className="font-serif italic text-2xl">Mon Inventaire</h2>
        <button onClick={toggleOpen} className="lg:hidden p-2 bg-white/10 rounded-full hover:bg-white/20">✕</button>
      </div>

      {!user ? (
        <div className="flex-1 p-8 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-[#1C2620]/5 rounded-full flex items-center justify-center mb-6 text-4xl">🎒</div>
          <h3 className="text-xl font-bold text-[#1C2620] mb-3">Votre inventaire vous suit partout</h3>
          <p className="text-[#5A6A5D] text-sm mb-8">Créez votre inventaire personnalisé, retrouvez votre équipement et préparez vos prochains voyages en quelques clics.</p>
          <Link href="/auth" className="w-full py-3.5 bg-[#1C2620] text-white rounded-full font-bold shadow-md hover:bg-[#2D5A3D] transition-colors mb-4">
            Créer mon inventaire
          </Link>
          <Link href="/auth" className="text-xs font-bold text-[#1C2620]/60 hover:text-[#1C2620] underline underline-offset-4">
            J'ai déjà un compte · Se connecter
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="p-6 bg-[#2D3F35] text-white flex gap-4 text-center justify-between border-b border-[#1C2620]/10">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-white/50 mb-1">ARTICLES</p>
              <p className="text-xl font-bold">{totalItems}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-white/50 mb-1">POIDS</p>
              <p className="text-xl font-bold">{totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(2)} kg` : `${totalWeightG} g`}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-white/50 mb-1">PRIX</p>
              <p className="text-xl font-bold">{totalPriceEur.toFixed(0)} €</p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Equipment */}
            <div>
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-[#1C2620]/50 mb-4 border-b border-[#1C2620]/10 pb-2">Équipement</h3>
              {equipment.length === 0 ? (
                <p className="text-xs text-[#1C2620]/50 italic">Aucun équipement.</p>
              ) : (
                <ul className="space-y-3 mb-4">
                  {equipment.slice(0, 5).map(item => (
                    <li key={item.id} className="flex gap-3 items-center">
                      <span className="text-lg">{getCategoryIcon(item.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1C2620] truncate">{item.name}</p>
                      </div>
                    </li>
                  ))}
                  {equipment.length > 5 && (
                    <li className="text-xs text-[#1C2620]/50 italic pl-8">+ {equipment.length - 5} autres articles</li>
                  )}
                </ul>
              )}
              <Link href="/mon-materiel" className="text-xs font-bold text-[#2D5A3D] hover:underline flex items-center gap-1">
                Gérer mon inventaire <span>→</span>
              </Link>
            </div>

            {/* Consumables */}
            <div>
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-[#1C2620]/50 mb-4 border-b border-[#1C2620]/10 pb-2">Consommables</h3>
              {consumables.length === 0 ? (
                <p className="text-xs text-[#1C2620]/50 italic">Aucun consommable.</p>
              ) : (
                <ul className="space-y-3">
                  {consumables.map(item => (
                    <li key={item.id} className="flex gap-3 items-center group">
                      <span className="text-lg">{getCategoryIcon(item.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#1C2620] truncate">{item.name}</p>
                      </div>
                      <button 
                        onClick={() => handleAddToCart(item.name, item.category)}
                        title="Ajouter au panier pour racheter"
                        className="w-6 h-6 flex items-center justify-center bg-white border border-[#1C2620]/20 rounded-md text-[#1C2620] hover:bg-[#1C2620] hover:text-white transition-colors"
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Suggestions */}
            {missingSuggestions.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-amber-600 mb-3">À ne pas oublier</h3>
                <ul className="space-y-4">
                  {missingSuggestions.map(sug => (
                    <li key={sug.title}>
                      <p className="text-xs font-bold text-[#1C2620] flex items-center gap-1">⚠️ {sug.title}</p>
                      <p className="text-[10px] text-[#1C2620]/60 mt-0.5 mb-2">{sug.reason}</p>
                      <button 
                        onClick={() => handleAddToCart(sug.title, sug.category)}
                        className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors"
                      >
                        Ajouter au panier
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
          </div>
        </>
      )}
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string, onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1C2620]/10 text-[#1C2620] rounded-full text-xs font-medium">
      {label}
      <button onClick={onRemove} className="w-4 h-4 rounded-full bg-[#1C2620]/20 hover:bg-[#1C2620]/40 flex items-center justify-center text-white">✕</button>
    </span>
  );
}

export default function BoutiqueClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [maxWeight, setMaxWeight] = useState<number | ''>('');
  const [inventoryStatus, setInventoryStatus] = useState<'all' | 'owned' | 'missing'>('all');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'weight_asc' | 'score_desc'>('score_desc');

  const supabase = useMemo(() => createClient(), []);

  const loadGear = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('gear_items').select('*').eq('user_id', user.id);
    if (data) setGearItems(data);
  }, [user, supabase]);

  useEffect(() => {
    async function initData() {
      // Products
      let { data } = await supabase.from('products').select('*');
      if (!data || data.length === 0) {
        const fallback = await supabase.from('products').select('*').eq('is_active', true);
        data = fallback.data;
      }
      if (data) setProducts(data as ShopProduct[]);
      
      // Gear
      await loadGear();
      setCartCount(getCart().reduce((acc, i) => acc + i.quantity, 0));
      setLoading(false);
    }
    initData();
  }, [user, supabase, loadGear]);

  const refreshCart = () => {
    setCartCount(getCart().reduce((acc, i) => acc + i.quantity, 0));
    // Optional: trigger a small UI notification here
  };

  const handleAddToInventory = async (p: ShopProduct) => {
    if (!user) {
      router.push('/connexion');
      return;
    }
    const { error } = await supabase.from('gear_items').insert({
      user_id: user.id,
      name: p.name,
      brand: p.brand,
      category: p.category_main || p.category || 'Autre',
      purchase_price: p.price_eur,
      weight_g: p.weight_g || p.weight_grams || 0,
      image: p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
      condition: 'neuf',
      source: 'catalogue',
      product_id: p.id
    });
    if (!error) {
      await loadGear();
    }
  };

  const activeFiltersCount = [category, maxPrice, maxWeight, search, inventoryStatus !== 'all'].filter(Boolean).length;

  const resetFilters = () => {
    setSearch(''); setCategory(''); setMaxPrice(''); setMaxWeight(''); setInventoryStatus('all'); setSortBy('score_desc');
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category_main || p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const ownedProductIds = useMemo(() => new Set(gearItems.map(g => g.product_id).filter(Boolean)), [gearItems]);
  const ownedNames = useMemo(() => new Set(gearItems.map(g => g.name.toLowerCase())), [gearItems]);

  const isProductOwned = (p: ShopProduct) => ownedProductIds.has(p.id) || ownedNames.has(p.name.toLowerCase());

  const filteredProducts = useMemo(() => {
    let res = products;
    
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(p => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
    }
    if (category) {
      res = res.filter(p => (p.category_main || p.category) === category);
    }
    if (maxPrice !== '') res = res.filter(p => p.price_eur <= maxPrice);
    if (maxWeight !== '') res = res.filter(p => (p.weight_g || p.weight_grams || 0) <= maxWeight);
    if (inventoryStatus !== 'all') {
      if (inventoryStatus === 'owned') res = res.filter(p => isProductOwned(p));
      else if (inventoryStatus === 'missing') res = res.filter(p => !isProductOwned(p));
    }

    res = [...res].sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return a.price_eur - b.price_eur;
        case 'price_desc': return b.price_eur - a.price_eur;
        case 'weight_asc': return (a.weight_g || 0) - (b.weight_g || 0);
        case 'score_desc': return (b.score_kdv || 0) - (a.score_kdv || 0);
        default: return 0;
      }
    });

    return res;
  }, [products, search, category, maxPrice, maxWeight, inventoryStatus, sortBy, isProductOwned]);

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2EA] font-sans text-[#1C2620] flex flex-col">
          <Header />

          <main className="flex-1 pt-24 pb-24 px-4 w-full max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-8 relative">

            {/* Left side: Main Content */}
            <div className="flex-1 flex flex-col min-w-0">

              <div className="flex items-center justify-between mb-8">
                <BackButton href="/" label="Retour" />
                <div className="flex items-center gap-3">
                  <Link href="/panier" className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white text-[#1C2620] rounded-full text-sm font-bold shadow-sm hover:shadow-md border border-[#1C2620]/10 transition-all">
                    🛒 Panier <span className="bg-[#1C2620] text-white px-2 py-0.5 rounded-full text-xs">{cartCount}</span>
                  </Link>
                  <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[#1C2620] text-white rounded-full text-sm font-bold shadow-lg">
                    Inventaire
                  </button>
                </div>
              </div>

              <div className="mb-10">
                <h1 className="text-4xl md:text-6xl font-semibold mb-4">
                  Catalogue & <span className="font-serif italic text-[#2D5A3D] font-normal">Inventaire</span>
                </h1>
                <p className="text-[#5A6A5D] text-sm md:text-base max-w-2xl font-mono tracking-wide leading-relaxed">
                  Cockpit de préparation. Filtrez, explorez et complétez votre équipement.
                </p>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-[#1C2620]/5 mb-8">
                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <div className="flex-1 relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C2620]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full bg-[#F5F2EA]/50 border border-[#1C2620]/10 rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2D5A3D] transition-colors" />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select value={category} onChange={e => setCategory(e.target.value)} className="bg-[#F5F2EA]/50 border border-[#1C2620]/10 rounded-full px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer pr-10">
                      <option value="">Toutes catégories</option>
                      {categories.map(c => <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>)}
                    </select>

                    <select value={inventoryStatus} onChange={e => setInventoryStatus(e.target.value as any)} className="bg-[#F5F2EA]/50 border border-[#1C2620]/10 rounded-full px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer pr-10">
                      <option value="all">Tout le catalogue</option>
                      <option value="owned">Déjà possédé ✓</option>
                      <option value="missing">Manquant ❌</option>
                    </select>

                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-[#1C2620] text-white rounded-full px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer pr-10 font-bold">
                      <option value="score_desc">Tri: Pertinence</option>
                      <option value="price_asc">Prix croissant</option>
                      <option value="price_desc">Prix décroissant</option>
                      <option value="weight_asc">Poids (Léger)</option>
                    </select>
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#1C2620]/5 flex items-center flex-wrap gap-2">
                    <span className="text-xs text-[#1C2620]/50 uppercase tracking-widest font-bold mr-2">Filtres actifs :</span>
                    {category && <FilterTag label={`Catégorie: ${category}`} onRemove={() => setCategory('')} />}
                    {inventoryStatus === 'owned' && <FilterTag label="Possédé" onRemove={() => setInventoryStatus('all')} />}
                    {inventoryStatus === 'missing' && <FilterTag label="Manquant" onRemove={() => setInventoryStatus('all')} />}
                    {search && <FilterTag label={`Recherche: ${search}`} onRemove={() => setSearch('')} />}
                    <button onClick={resetFilters} className="text-xs text-[#2D5A3D] font-bold hover:underline ml-2">Réinitialiser tout</button>
                  </div>
                )}
              </div>

              {/* Grid */}
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <span className="inline-block w-8 h-8 border-4 border-[#1C2620]/20 border-t-[#1C2620] rounded-full animate-spin" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-[#1C2620]/5">
                  <h3 className="text-2xl font-serif italic text-[#1C2620]/50 mb-2">Aucun produit trouvé</h3>
                  <p className="text-sm text-[#1C2620]/40">Modifiez vos filtres pour voir plus de résultats.</p>
                  <button onClick={resetFilters} className="mt-6 px-6 py-2 bg-[#1C2620] text-white rounded-full text-sm font-bold">Effacer les filtres</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {filteredProducts.map((p) => {
                    const isOwned = isProductOwned(p);
                    const weight = p.weight_g || p.weight_grams || 0;

                    return (
                      <div key={p.id} className={`group bg-white rounded-3xl overflow-hidden shadow-sm border transition-all duration-300 ${isOwned ? 'border-[#8BAF7C] ring-2 ring-[#8BAF7C]/20' : 'border-[#1C2620]/5 hover:shadow-xl hover:border-[#1C2620]/20'}`}>
                        <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => router.push(`/produit/${p.slug}`)}>
                          <AppImage src={p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80'} alt={p.image_alt || p.name} fill sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                          {isOwned && (
                            <div className="absolute top-3 right-3 bg-[#8BAF7C] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md flex items-center gap-1">
                              ✓ Dans l'inventaire
                            </div>
                          )}
                          {!isOwned && p.category && (
                            <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-md text-[#1C2620] text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                              {getCategoryIcon(p.category_main || p.category)} {(p.category_main || p.category)}
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex flex-col h-[180px]">
                          <p className="text-[10px] text-[#1C2620]/50 font-mono tracking-widest uppercase truncate">{p.brand}</p>
                          <h3 className="font-bold text-[#1C2620] text-sm leading-tight mt-1 mb-2 line-clamp-2" title={p.name}>{p.name}</h3>

                          <div className="mt-auto flex flex-col gap-3">
                            <div className="flex items-end justify-between">
                              <span className="font-bold text-lg text-[#2D5A3D]">{p.price_eur} €</span>
                              <span className="text-xs text-[#1C2620]/50 font-mono">{weight >= 1000 ? `${(weight/1000).toFixed(1)}kg` : `${weight}g`}</span>
                            </div>

                            {isOwned ? (
                              <div className="w-full py-2.5 bg-[#8BAF7C]/10 text-[#2D5A3D] border border-[#8BAF7C]/30 text-xs font-bold rounded-full text-center flex items-center justify-center gap-2">
                                <span>✓</span> Possédé
                              </div>
                            ) : (
                              <button onClick={() => handleAddToInventory(p)} className="w-full py-2.5 bg-[#1C2620] text-white text-xs font-bold rounded-full hover:bg-[#2D5A3D] transition-colors">
                                {user ? "Ajouter à l'inventaire" : "Se connecter pour ajouter"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right side: Sidebar Overlay for Mobile / Sticky for Desktop */}
            {sidebarOpen && (
              <div className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            <InventorySidebar
              user={user}
              gearItems={gearItems}
              shopProducts={products}
              isOpen={sidebarOpen}
              toggleOpen={() => setSidebarOpen(false)}
              onRefreshCart={refreshCart}
            />

          </main>
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Link href="/" style={{ fontSize: '13px', color: '#6B7A72', textDecoration: 'none', fontWeight: 500 }}>← Retour</Link>
              <Link href="/panier" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#F4F1EA', borderRadius: '999px', fontSize: '13px', fontWeight: 700, color: '#1C2620', textDecoration: 'none', border: '1px solid rgba(11,31,23,0.06)' }}>
                🛒 <span style={{ background: '#1C2620', color: 'white', padding: '2px 8px', borderRadius: '999px', fontSize: '11px' }}>{cartCount}</span>
              </Link>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1C2620', marginBottom: '4px' }}>
              Catalogue & <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>Inventaire</em>
            </h1>
            <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '16px', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em', lineHeight: '1.5' }}>
              Cockpit de préparation. Filtrez, explorez et complétez votre équipement.
            </p>

            {/* Compact Search & Filters */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: '#FBFAF6',
                  border: '1px solid rgba(11,31,23,0.06)',
                  borderRadius: '999px',
                  fontSize: '14px',
                  color: '#1C2620',
                  outline: 'none',
                  marginBottom: '8px',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#FBFAF6',
                    border: '1px solid rgba(11,31,23,0.06)',
                    borderRadius: '999px',
                    fontSize: '12px',
                    color: '#1C2620',
                    outline: 'none',
                  }}
                >
                  <option value="">Toutes catégories</option>
                  {categories.map(c => <option key={c} value={c}>{getCategoryIcon(c)} {c}</option>)}
                </select>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  style={{
                    padding: '8px 12px',
                    background: '#17402C',
                    color: 'white',
                    border: 'none',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  <option value="score_desc">Pertinence</option>
                  <option value="price_asc">Prix ↑</option>
                  <option value="price_desc">Prix ↓</option>
                  <option value="weight_asc">Poids ↑</option>
                </select>
              </div>
              {activeFiltersCount > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginRight: '4px' }}>Filtres :</span>
                  {category && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(11,31,23,0.06)', borderRadius: '999px', fontSize: '11px', color: '#1C2620' }}>{category} <button onClick={() => setCategory('')} style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(11,31,23,0.2)', border: 'none', color: 'white', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button></span>}
                  {search && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(11,31,23,0.06)', borderRadius: '999px', fontSize: '11px', color: '#1C2620' }}>"{search}" <button onClick={() => setSearch('')} style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(11,31,23,0.2)', border: 'none', color: 'white', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button></span>}
                  <button onClick={resetFilters} style={{ fontSize: '11px', color: '#17402C', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset</button>
                </div>
              )}
            </div>

            {/* Product Grid */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
                <span style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(11,31,23,0.1)', borderTopColor: '#1C2620', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: '16px', color: '#6B7A72', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '8px' }}>Aucun produit trouvé</p>
                <p style={{ fontSize: '12px', color: '#6B7A72', marginBottom: '16px' }}>Modifiez vos filtres pour voir plus de résultats.</p>
                <button onClick={resetFilters} style={{ padding: '8px 24px', background: '#1C2620', color: 'white', borderRadius: '999px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Effacer les filtres</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {filteredProducts.map((p) => {
                  const isOwned = isProductOwned(p);
                  const weight = p.weight_g || p.weight_grams || 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#F4F1EA',
                        border: isOwned ? '2px solid #8BAF7C' : '1px solid rgba(11,31,23,0.06)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{ position: 'relative', aspectRatio: '1/1', cursor: 'pointer', overflow: 'hidden' }}
                        onClick={() => router.push(`/produit/${p.slug}`)}
                      >
                        <img
                          src={p.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80'}
                          alt={p.image_alt || p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {isOwned && (
                          <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#8BAF7C', color: 'white', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                            ✓ Possédé
                          </span>
                        )}
                        {!isOwned && (p.category_main || p.category) && (
                          <span style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255,255,255,0.8)', color: '#1C2620', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', backdropFilter: 'blur(4px)' }}>
                            {getCategoryIcon(p.category_main || p.category)} {(p.category_main || p.category)}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '10px' }}>
                        <p style={{ fontSize: '9px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{p.brand}</p>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1C2620', lineHeight: '1.3', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#17402C' }}>{p.price_eur} €</span>
                          <span style={{ fontSize: '10px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace' }}>{weight >= 1000 ? `${(weight/1000).toFixed(1)}kg` : `${weight}g`}</span>
                        </div>
                        {isOwned ? (
                          <div style={{ width: '100%', padding: '8px 0', background: 'rgba(139,175,124,0.1)', color: '#2D5A3D', border: '1px solid rgba(139,175,124,0.3)', borderRadius: '999px', textAlign: 'center', fontSize: '11px', fontWeight: 700 }}>
                            ✓ Possédé
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToInventory(p)}
                            style={{
                              width: '100%',
                              padding: '8px 0',
                              background: '#17402C',
                              color: 'white',
                              border: 'none',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {user ? "Ajouter à l'inventaire" : "Se connecter"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
