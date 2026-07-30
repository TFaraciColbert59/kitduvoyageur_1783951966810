'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import InventaireHero from '@/components/inventaire/InventaireHero';
import InventaireToolbar, { CategoryFilter, SortOption } from '@/components/inventaire/InventaireToolbar';
import CategorySection from '@/components/inventaire/CategorySection';
import WeightDistributionCard from '@/components/inventaire/WeightDistributionCard';
import KitsAssemblersCard from '@/components/inventaire/KitsAssemblersCard';
import RepairsReplacementsCard from '@/components/inventaire/RepairsReplacementsCard';
import LoansCard from '@/components/inventaire/LoansCard';
import RecommendationsCard from '@/components/inventaire/RecommendationsCard';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import MobileInventaireView from '@/components/inventaire/MobileInventaireView';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  MOCK_INVENTAIRE_ITEMS,
  MOCK_USER_KITS,
  MOCK_LOANS,
  MOCK_REPAIRS,
  MOCK_RECOMMENDATIONS,
  GearItemData,
} from '@/lib/mock/inventaire-marceline';

export default function InventairePage() {
  const [items, setItems] = useState<GearItemData[]>(MOCK_INVENTAIRE_ITEMS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('weight');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GearItemData | null>(null);
  const [addCategoryTarget, setAddCategoryTarget] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load items from Supabase DB
  const loadGearFromDB = useCallback(async () => {
    if (!user) {
      setItems(MOCK_INVENTAIRE_ITEMS);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gear_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedData: GearItemData[] = data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          name: d.name,
          brand: d.brand || '',
          model: d.model || '',
          category: d.category || 'autre',
          condition: d.condition || 'excellent',
          weight_g: d.weight_g || 0,
          purchase_price: d.purchase_price || 0,
          purchase_date: d.purchase_date,
          image: d.image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
          alt: d.alt || d.name,
          quantity: d.quantity || 1,
          is_favorite: d.is_favorite || false,
          notes: d.notes || '',
          loan_status: d.loan_status,
          loan_to_name: d.loan_to_name,
          is_listed_for_sale: d.is_listed_for_sale || false,
        }));
        setItems(mappedData);
      } else {
        setItems(MOCK_INVENTAIRE_ITEMS);
      }
    } catch {
      setItems(MOCK_INVENTAIRE_ITEMS);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadGearFromDB();
  }, [loadGearFromDB]);

  // Toggle Favorite
  const handleToggleFavorite = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const newFav = !target.is_favorite;

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_favorite: newFav } : item))
    );

    if (user) {
      await supabase
        .from('gear_items')
        .update({ is_favorite: newFav })
        .eq('id', id)
        .eq('user_id', user.id);
    }
    showToast(newFav ? 'Ajouté aux favoris !' : 'Retiré des favoris');
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet équipement de votre inventaire ?')) return;

    setItems((prev) => prev.filter((item) => item.id !== id));

    if (user) {
      await supabase.from('gear_items').delete().eq('id', id).eq('user_id', user.id);
    }
    showToast('Équipement supprimé');
  };

  // Save Item (Add or Edit)
  const handleSaveItem = async (itemData: Partial<GearItemData>) => {
    if (itemData.id) {
      // Edit
      setItems((prev) =>
        prev.map((i) => (i.id === itemData.id ? { ...i, ...itemData } as GearItemData : i))
      );

      if (user) {
        await supabase
          .from('gear_items')
          .update({
            name: itemData.name,
            brand: itemData.brand,
            model: itemData.model,
            category: itemData.category,
            condition: itemData.condition,
            weight_g: itemData.weight_g,
            purchase_price: itemData.purchase_price,
            quantity: itemData.quantity,
            image: itemData.image,
            notes: itemData.notes,
          })
          .eq('id', itemData.id)
          .eq('user_id', user.id);
      }
      showToast('Équipement mis à jour !');
    } else {
      // Add
      const newItem: GearItemData = {
        id: `g-new-${Date.now()}`,
        name: itemData.name || 'Nouvel équipement',
        brand: itemData.brand || '',
        model: itemData.model || '',
        category: (itemData.category as any) || 'couchage',
        condition: (itemData.condition as any) || 'excellent',
        weight_g: itemData.weight_g || 0,
        purchase_price: itemData.purchase_price || 0,
        quantity: itemData.quantity || 1,
        image: itemData.image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
        alt: itemData.name || 'Équipement',
        is_favorite: false,
        notes: itemData.notes || '',
      };

      setItems((prev) => [newItem, ...prev]);

      if (user) {
        await supabase.from('gear_items').insert({
          user_id: user.id,
          name: newItem.name,
          brand: newItem.brand,
          model: newItem.model,
          category: newItem.category,
          condition: newItem.condition,
          weight_g: newItem.weight_g,
          purchase_price: newItem.purchase_price,
          quantity: newItem.quantity,
          image: newItem.image,
          alt: newItem.alt,
          notes: newItem.notes,
          source: 'manuel',
        });
      }
      showToast('Article ajouté à votre inventaire !');
    }
  };

  // Derived Statistics
  const totalArticles = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalWeightG = useMemo(
    () => items.reduce((sum, item) => sum + item.weight_g * item.quantity, 0),
    [items]
  );

  const totalWeightKg = totalWeightG / 1000;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: totalArticles };
    items.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + item.quantity;
    });
    return counts;
  }, [items, totalArticles]);

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (activeCategory !== 'all' && item.category !== activeCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchBrand = item.brand.toLowerCase().includes(q);
          const matchNotes = (item.notes || '').toLowerCase().includes(q);
          if (!matchName && !matchBrand && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'weight') return b.weight_g - a.weight_g;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'price') return b.purchase_price - a.purchase_price;
        return 0;
      });
  }, [items, activeCategory, search, sortBy]);

  // Group items by category for section display
  const categorizedSections = useMemo(() => {
    const groups: Record<string, { title: string; tag?: string; items: GearItemData[] }> = {
      couchage: { title: 'Couchage & abri', items: [] },
      portage: { title: 'Portage & sacs', tag: 'RECOMMANDATION : SAC TRAIL À RENOUVELER', items: [] },
      cuisine: { title: 'Cuisine & hydratation', tag: '1 FILTRE À EAU · 1 POPOTE TITANE', items: [] },
      vêtement: { title: 'Vêtements techniques', tag: 'DERNIÈRE COMMANDE : VESTE GORE-TEX', items: [] },
      navigation: { title: 'Navigation & électronique', tag: 'BATTERIE TOTALE : 30 000 MAH', items: [] },
      sécurité: { title: 'Sécurité & soin', items: [] },
      autre: { title: 'Autres équipements', items: [] },
    };

    filteredItems.forEach((item) => {
      const key = groups[item.category] ? item.category : 'autre';
      groups[key].items.push(item);
    });

    return Object.entries(groups).filter(([_, group]) => group.items.length > 0);
  }, [filteredItems]);

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#FAF8F5] text-[#132219] selection:bg-emerald-900/20 font-sans">
          <Header />

          <main className="pt-24 pb-16">
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">

              {/* 1. Immersive Photographic Hero */}
              <InventaireHero
                totalArticles={totalArticles}
                totalWeightKg={totalWeightKg}
                kitsCount={MOCK_USER_KITS.length}
                repairsCount={MOCK_REPAIRS.length}
                loansCount={MOCK_LOANS.length}
                onOpenAddModal={() => { setEditingItem(null); setAddCategoryTarget(undefined); setIsAddModalOpen(true); }}
                onOpenPhotoModal={() => showToast('Reconnaissance IA de photo activée !')}
              />

              {/* 2. Search, Filter & View Mode Toolbar */}
              <InventaireToolbar
                search={search}
                onSearchChange={setSearch}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                sortBy={sortBy}
                onSortChange={setSortBy}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                categoryCounts={categoryCounts}
              />

              {/* 3. Main 2-Column Grid Layout (68% Left / 32% Right Sidebar) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN (Categorized Gear Sections) */}
                <div className="lg:col-span-8 space-y-4">
                  {categorizedSections.length > 0 ? (
                    categorizedSections.map(([catKey, group]) => (
                      <CategorySection
                        key={catKey}
                        title={group.title}
                        categoryKey={catKey}
                        items={group.items}
                        recommendationTag={group.tag}
                        viewMode={viewMode}
                        onToggleFavorite={handleToggleFavorite}
                        onEdit={(item) => { setEditingItem(item); setIsAddModalOpen(true); }}
                        onDelete={handleDeleteItem}
                        onAddCategoryItem={() => { setEditingItem(null); setAddCategoryTarget(catKey); setIsAddModalOpen(true); }}
                      />
                    ))
                  ) : (
                    <div className="bg-white rounded-[2rem] p-12 border border-[#E8E4D8] text-center space-y-4 shadow-sm">
                      <div className="w-16 h-16 rounded-full bg-[#F5F3ED] text-[#132219]/40 flex items-center justify-center text-3xl mx-auto">
                        🎒
                      </div>
                      <h3 className="font-display font-800 text-xl text-[#132219]">Aucun équipement trouvé</h3>
                      <p className="text-xs text-[#132219]/60 max-w-md mx-auto">
                        Aucun article ne correspond à votre recherche ou filtre actuel. Ajoutez un nouvel équipement !
                      </p>
                      <button
                        onClick={() => { setSearch(''); setActiveCategory('all'); }}
                        className="px-6 py-2.5 bg-[#132219] text-white rounded-full text-xs font-bold hover:bg-[#2D5A3D] transition-colors"
                      >
                        Réinitialiser les filtres
                      </button>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN (Sidebar Widgets) */}
                <div className="lg:col-span-4 space-y-6">

                  {/* 1. Weight Breakdown Progress Bar Widget */}
                  <WeightDistributionCard items={items} />

                  {/* 2. User Kits Widget */}
                  <KitsAssemblersCard kits={MOCK_USER_KITS} />

                  {/* 3. Items to Repair / Replace Widget */}
                  <RepairsReplacementsCard
                    repairs={MOCK_REPAIRS}
                    onAction={(r) => showToast(`Réparation engagée pour ${r.item_name}`)}
                  />

                  {/* 4. Active Loans Widget */}
                  <LoansCard loans={MOCK_LOANS} />

                  {/* 5. Boutique Recommendations Widget */}
                  <RecommendationsCard recommendations={MOCK_RECOMMENDATIONS} />

                </div>

              </div>

            </div>
          </main>

          {/* 4. Full-Width Footer Banner */}
          <div className="bg-[#132219] text-white py-12 px-6 border-t border-white/10 mt-12 font-sans">
            <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="font-display font-900 text-2xl sm:text-3xl text-white">
                  Un sac bien fait, <span className="font-serif italic font-normal text-emerald-200">c&apos;est déjà un voyage réussi.</span>
                </h3>
                <p className="text-xs text-white/60 mt-1 font-mono">
                  © 2026 Le Kit du Voyageur — Inventaire de Marceline Chevrier · {totalArticles} articles pesés
                </p>
              </div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold text-white transition-all shrink-0"
              >
                Haut de page ↑
              </button>
            </div>
          </div>

          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <MobileInventaireView
            items={items}
            kits={MOCK_USER_KITS}
            totalArticles={totalArticles}
            totalWeightKg={totalWeightKg}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onToggleFavorite={handleToggleFavorite}
            onEdit={(item) => { setEditingItem(item); setIsAddModalOpen(true); }}
            onDelete={handleDeleteItem}
            onOpenAddModal={() => { setEditingItem(null); setIsAddModalOpen(true); }}
          />
        </MobilePageShell>
      </div>

      {/* Shared Modals & Toasts */}
      <AddEditGearModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        initialItem={editingItem}
        defaultCategory={addCategoryTarget}
        onSave={handleSaveItem}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-[#132219] text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-2xl animate-fade-in-up flex items-center gap-2 border border-white/20">
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}