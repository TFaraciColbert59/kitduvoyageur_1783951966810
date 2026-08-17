'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import AddEditGearModal from '@/components/inventaire/AddEditGearModal';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';

// Formatter
function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

const CATEGORIES = ['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'];

export default function MonMaterielCockpitPage() {
  const { triggerHaptic } = useHapticFeedback();

  // Supabase Hooks
  const {
    equipment,
    loading: equipmentLoading,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  const {
    kits,
    loading: kitsLoading,
    updateKit,
    moveToTrash,
  } = useUserKits(equipment);

  const isLoading = equipmentLoading || kitsLoading;

  // States
  const [activeNav, setActiveNav] = useState<'inventory' | 'telemetry' | 'favorites' | 'settings'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Tous');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isKitDrawerOpen, setIsKitDrawerOpen] = useState(false);
  const [selectedKitForCockpit, setSelectedKitForCockpit] = useState<CustomKit | null>(null);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);

  // Set default selected item
  useEffect(() => {
    if (equipment.length > 0) {
      if (!selectedItemId || !equipment.some((e) => e.id === selectedItemId)) {
        setSelectedItemId(equipment[0].id);
      }
    }
  }, [equipment, selectedItemId]);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (activeNav === 'favorites' && !item.is_favorite) return false;
      if (selectedBrand && selectedBrand !== 'Tous') {
        if (!item.brand?.toLowerCase().includes(selectedBrand.toLowerCase())) return false;
      }
      if (activeCategory !== 'all') {
        const cat = (item.category || '').toLowerCase();
        if (!cat.includes(activeCategory.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchBrand = item.brand?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat) return false;
      }
      return true;
    });
  }, [equipment, activeNav, selectedBrand, activeCategory, searchQuery]);

  // Active selected item
  const activeItem = useMemo(() => {
    if (filteredEquipment.length > 0) {
      const found = filteredEquipment.find((e) => e.id === selectedItemId);
      if (found) return found;
      return filteredEquipment[0];
    }
    return equipment.find((e) => e.id === selectedItemId) || equipment[0] || null;
  }, [filteredEquipment, equipment, selectedItemId]);

  // Total weight
  const totalWeightG = useMemo(() => {
    return equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0);
  }, [equipment]);

  // Total value
  const totalValue = useMemo(() => {
    return equipment.reduce((sum, it) => sum + (Number(it.purchase_price) || 0) * (it.quantity || 1), 0);
  }, [equipment]);

  // Favorites count
  const favoritesCount = useMemo(() => equipment.filter((e) => e.is_favorite).length, [equipment]);

  // Category distribution (top by weight)
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    equipment.forEach((it) => {
      const cat = (it.category || 'Autre').split(/[&/]/)[0].trim();
      map.set(cat, (map.get(cat) || 0) + (it.weight_g || 0) * (it.quantity || 1));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([label, grams]) => ({ label, grams, pct: Math.round((grams / total) * 100) }))
      .sort((a, b) => b.grams - a.grams)
      .slice(0, 4);
  }, [equipment]);

  // Reset all filters
  const handleResetFilters = () => {
    triggerHaptic('light');
    setSearchQuery('');
    setSelectedBrand('Tous');
    setActiveCategory('all');
    setActiveNav('inventory');
  };

  // Toggle favorite
  const handleToggleFavorite = async (item: UserEquipmentItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    await updateEquipment(item.id, {
      is_favorite: !item.is_favorite,
    });
  };

  const glassCard =
    'rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_60px_-15px_rgba(11,31,23,0.55)]';

  return (
    <div className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-[#0B1F17] text-white select-none font-sans flex flex-col p-3 sm:p-4">

      {/* ═══════════════ BACKGROUND : Blurred alpine trek landscape ═══════════════ */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/assets/images/hero-misty.jpg"
          alt="Paysage de montagne — trek alpin"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-110"
          style={{ filter: 'blur(28px) saturate(1.15)' }}
        />
        {/* Depth overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1F17]/70 via-[#0B1F17]/55 to-[#0B1F17]/80" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, transparent 20%, rgba(11,31,23,0.85) 100%)',
          }}
        />
      </div>

      {/* ═══════════════ TOP FLOATING GLASS BAR ═══════════════ */}
      <header className="relative z-10 flex items-center justify-between gap-3 shrink-0 h-12 px-3 mb-3 rounded-full border border-white/10 bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_12px_40px_-12px_rgba(11,31,23,0.6)]">
        <div className="flex items-center gap-2.5 pl-1">
          <span className="w-8 h-8 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner">
            <svg viewBox="0 0 32 32" width="17" height="17" fill="none">
              <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="#A3C4A3" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-semibold tracking-wide text-sm text-white">Mon Équipement</span>
          <span className="text-white/25 hidden sm:inline">·</span>
          <span className="text-[11px] text-white/60 font-medium hidden sm:inline tracking-wide">
            Cockpit d&apos;équipement
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsKitDrawerOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 hidden sm:inline-block"
          >
            Kits assemblés
          </button>
          <Link
            href="/boutique"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 hidden md:inline-block"
          >
            Boutique
          </Link>
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-[11px] text-[#C7DCC7] font-medium border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A3C4A3] animate-pulse" />
            <span>Massif Alpin · 2 450 m</span>
          </div>
          <Link
            href="/compte"
            className="w-8 h-8 rounded-full bg-[#A3C4A3] text-[#0B1F17] flex items-center justify-center text-[11px] font-extrabold shadow-sm transition-transform active:scale-90"
          >
            MC
          </Link>
        </div>
      </header>

      {/* ═══════════════ MAIN COCKPIT — 100% viewport, no page scroll ═══════════════ */}
      <div className="relative z-10 flex-1 flex gap-3 sm:gap-4 min-h-0 max-h-full overflow-hidden">

        {/* ─── LEFT RAIL (glass dock) ─── */}
        <aside className={`w-14 shrink-0 hidden sm:flex flex-col items-center justify-between py-4 px-1.5 ${glassCard}`}>
          <Link
            href="/"
            className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-transform active:scale-95"
            title="Accueil LKDV"
          >
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
              <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="#A3C4A3" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setActiveNav('inventory'); }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                activeNav === 'inventory'
                  ? 'bg-[#A3C4A3] text-[#0B1F17] shadow-[0_0_20px_rgba(163,196,163,0.45)] scale-105'
                  : 'text-white/55 hover:text-white hover:bg-white/8'
              }`}
              title="Inventaire"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setIsKitDrawerOpen(true); }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/8 transition-all active:scale-95"
              title="Kits assemblés"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setActiveNav(activeNav === 'favorites' ? 'inventory' : 'favorites'); }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                activeNav === 'favorites'
                  ? 'bg-[#A3C4A3] text-[#0B1F17] shadow-[0_0_20px_rgba(163,196,163,0.45)] scale-105'
                  : 'text-white/55 hover:text-white hover:bg-white/8'
              }`}
              title="Favoris"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill={activeNav === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z" />
              </svg>
            </button>
          </div>

          <Link
            href="/compte"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/55 hover:text-white hover:bg-white/8 transition-all active:scale-95"
            title="Paramètres"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </aside>

        {/* ─── COLUMN 1 : INVENTORY LIST (glass) ─── */}
        <div className={`w-[280px] lg:w-[320px] xl:w-[340px] shrink-0 flex flex-col h-full p-3.5 overflow-hidden ${glassCard}`}>
          {/* Header + counter */}
          <div className="space-y-2.5 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold tracking-tight text-white">Inventaire</h2>
              <span className="text-xs font-mono text-[#A3C4A3] font-bold">
                {filteredEquipment.length} · {formatWeight(totalWeightG)}
              </span>
            </div>

            {/* Search */}
            <div className="relative flex items-center">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 text-white/40">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher équipement…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-2 bg-black/25 rounded-2xl border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#A3C4A3]/50 transition-colors"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 text-white/40 hover:text-white text-xs">✕</button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { triggerHaptic('light'); setActiveCategory(cat); }}
                  className={`px-3 py-1 rounded-full capitalize whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'bg-[#A3C4A3] text-[#0B1F17] font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {cat === 'all' ? 'Tous' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Item cards (internal scroll only) */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 pt-2.5">
            {isLoading && equipment.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="p-3 rounded-2xl bg-white/5 animate-pulse flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="w-3/4 h-3 rounded bg-white/15" />
                      <div className="w-1/2 h-2.5 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 text-center space-y-2.5 my-3 border border-white/10">
                <span className="text-2xl block">🧭</span>
                <p className="text-xs text-white/70 font-medium">Aucun équipement trouvé</p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all active:scale-95"
                >
                  Réinitialiser
                </button>
              </div>
            ) : (
              filteredEquipment.map((item) => {
                const isSelected = item.id === (activeItem?.id || selectedItemId);
                return (
                  <div
                    key={item.id}
                    onClick={() => { triggerHaptic('light'); setSelectedItemId(item.id); }}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative group ${
                      isSelected
                        ? 'bg-white/[0.12] border-[#A3C4A3]/50 ring-1 ring-[#A3C4A3]/30 shadow-[0_8px_24px_-8px_rgba(11,31,23,0.6)]'
                        : 'bg-white/[0.04] border-white/8 hover:bg-white/[0.08] hover:border-white/15'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-[#A3C4A3] shadow-[0_0_10px_rgba(163,196,163,0.8)]" />
                    )}
                    <div className="w-12 h-12 rounded-xl bg-black/30 overflow-hidden relative shrink-0 border border-white/10 flex items-center justify-center p-1.5 shadow-inner">
                      <Image
                        src={item.image || '/assets/images/no_image.png'}
                        alt={item.name}
                        width={44}
                        height={44}
                        className="object-contain max-h-full max-w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-[13px] font-bold text-white truncate leading-tight">{item.name}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-0.5 truncate">
                        <span>{item.brand || 'Outdoor'}</span>
                        <span>·</span>
                        <span className="font-mono text-[#A3C4A3] font-bold">{formatWeight(item.weight_g || 0)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemId(item.id);
                        setIsDetailDrawerOpen(true);
                      }}
                      className="text-white/40 hover:text-[#A3C4A3] p-1 transition-colors"
                      title="Ouvrir la fiche"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }}
              className="w-full py-2.5 rounded-2xl border border-dashed border-white/20 hover:border-[#A3C4A3] bg-white/[0.03] hover:bg-white/[0.08] text-white/80 hover:text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <span className="text-sm">+</span> Ajouter un article
            </button>
          </div>
        </div>

        {/* ─── COLUMN 2 : HERO SPOTLIGHT of active item (glass) ─── */}
        <div className={`flex-1 min-w-0 flex flex-col h-full p-4 sm:p-5 overflow-hidden ${glassCard}`}>
          {/* Top: title + actions */}
          {activeItem ? (
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight truncate">
                  {activeItem.name}
                </h1>
                <p className="text-xs text-white/60 mt-0.5">
                  {activeItem.brand || 'Outdoor'} · Catégorie{' '}
                  <span className="capitalize font-bold text-[#A3C4A3]">{activeItem.category}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDetailDrawerOpen(true)}
                  className="px-5 py-2 rounded-full bg-[#A3C4A3] hover:bg-[#b3d4b3] text-[#0B1F17] font-extrabold text-xs transition-all shadow-[0_0_20px_rgba(163,196,163,0.4)] active:scale-95"
                >
                  Fiche complète
                </button>
                <button
                  type="button"
                  onClick={(e) => handleToggleFavorite(activeItem, e)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs transition-transform active:scale-90"
                  title="Favori"
                >
                  {activeItem.is_favorite ? '❤️' : '🤍'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/60">Sélectionnez un équipement</div>
          )}

          {/* Big hero stage */}
          <div className="relative flex-1 min-h-0 mt-3 rounded-[24px] bg-gradient-to-b from-white/[0.06] to-black/20 border border-white/10 overflow-hidden flex items-center justify-center p-4 group">
            {/* highlight sheen */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.14) 0%, transparent 58%)' }}
            />
            {/* floor shadow */}
            <div
              className="absolute bottom-6 w-56 sm:w-72 h-6 rounded-[100%] pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(11,31,23,0.8) 0%, rgba(11,31,23,0) 70%)', filter: 'blur(10px)' }}
            />
            {activeItem ? (
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <Image
                  src={activeItem.image || '/assets/images/no_image.png'}
                  alt={activeItem.name}
                  width={340}
                  height={260}
                  className="object-contain max-h-full max-w-full drop-shadow-[0_20px_32px_rgba(11,31,23,0.7)] group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ) : (
              <span className="text-4xl">🎒</span>
            )}
          </div>

          {/* Key metrics bar */}
          {activeItem && (
            <div className="flex items-center justify-between px-2 pt-3 mt-3 border-t border-white/10 shrink-0">
              <div>
                <span className="text-[10px] text-white/50 uppercase tracking-widest block font-mono font-semibold">Poids pesé</span>
                <span className="text-2xl font-bold font-mono text-[#A3C4A3]">{formatWeight(activeItem.weight_g || 0)}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-white/50 uppercase tracking-widest block font-mono font-semibold">État</span>
                <span className="text-base font-bold capitalize text-white">{activeItem.condition || 'Excellent'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/50 uppercase tracking-widest block font-mono font-semibold">Valeur</span>
                <span className="text-2xl font-bold font-mono text-white">
                  {activeItem.purchase_price ? `${activeItem.purchase_price} €` : '— €'}
                </span>
              </div>
            </div>
          )}

          {/* Action row */}
          {activeItem && (
            <div className="grid grid-cols-3 gap-2.5 shrink-0 mt-3">
              <button
                type="button"
                onClick={() => { setEditingItem(activeItem); setIsAddModalOpen(true); }}
                className="py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                ✎ Éditer
              </button>
              <button
                type="button"
                onClick={() => setIsLendModalOpen(true)}
                className="py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                🤝 Prêter
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  addToCart({
                    id: activeItem.product_id || activeItem.id,
                    slug: 'equipement',
                    name: activeItem.name,
                    brand: activeItem.brand || 'LKDV',
                    priceEur: activeItem.purchase_price || 99,
                    weightG: activeItem.weight_g || 100,
                    image: activeItem.image || '/assets/images/no_image.png',
                    imageAlt: activeItem.name,
                    category: activeItem.category || 'équipement',
                  });
                }}
                className="py-2.5 rounded-2xl bg-[#A3C4A3]/15 hover:bg-[#A3C4A3]/25 border border-[#A3C4A3]/40 text-[#A3C4A3] text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                ↻ Racheter
              </button>
            </div>
          )}
        </div>

        {/* ─── COLUMN 3 : TELEMETRY + AI COPILOT (glass) ─── */}
        <div className="hidden md:flex w-[290px] lg:w-[320px] xl:w-[350px] shrink-0 flex-col h-full gap-3 sm:gap-4 overflow-hidden">

          {/* Telemetry card */}
          <div className={`p-4 shrink-0 ${glassCard}`}>
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Télémétrie du pack</h3>
              <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">Live</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
                <span className="block text-lg font-bold font-mono text-[#A3C4A3]">{equipment.length}</span>
                <span className="block text-[9px] text-white/50 uppercase font-mono mt-0.5">Articles</span>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
                <span className="block text-lg font-bold font-mono text-white">{formatWeight(totalWeightG)}</span>
                <span className="block text-[9px] text-white/50 uppercase font-mono mt-0.5">Poids</span>
              </div>
              <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 text-center">
                <span className="block text-lg font-bold font-mono text-white">{favoritesCount}</span>
                <span className="block text-[9px] text-white/50 uppercase font-mono mt-0.5">Favoris</span>
              </div>
            </div>
            {/* Distribution bars */}
            <div className="mt-3 space-y-1.5">
              {categoryStats.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center justify-between text-[10px] text-white/60 mb-0.5">
                    <span className="capitalize truncate">{c.label}</span>
                    <span className="font-mono text-[#A3C4A3]">{formatWeight(c.grams)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full bg-[#A3C4A3]" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-white/60 pt-2.5 border-t border-white/10">
              <span>Valeur totale du kit</span>
              <span className="font-mono font-bold text-white">{Math.round(totalValue)} €</span>
            </div>
          </div>

          {/* AI Copilot card (fills remaining space) */}
          <div className={`flex-1 min-h-0 flex flex-col p-4 overflow-hidden ${glassCard}`}>
            <div className="flex items-center gap-2 pb-2.5 border-b border-white/10 shrink-0">
              <span className="text-sm">✦</span>
              <div>
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Copilote IA Équipement</h3>
                <span className="text-[9px] text-[#A3C4A3] font-mono font-bold uppercase tracking-wider">Assistance active</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-2.5 pr-0.5">
              <div className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/10 shadow-inner">
                <p className="text-xs text-white/90 leading-relaxed">
                  Peux-tu m&apos;optimiser un pack{' '}
                  <span className="text-[#A3C4A3] font-semibold italic">bivouac 3 jours</span>{' '}
                  <span className="text-[#A3C4A3] font-semibold italic">sous 9,5 kg</span> ?
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-[#A3C4A3] font-mono font-bold">✦ Recommandation prête</span>
                  <button
                    type="button"
                    onClick={() => setIsKitDrawerOpen(true)}
                    className="text-white/60 hover:text-white font-medium underline"
                  >
                    Voir l&apos;analyse
                  </button>
                </div>
              </div>

              {kits.slice(0, 3).map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => { setSelectedKitForCockpit(kit as CustomKit); setIsKitDrawerOpen(true); }}
                  className="w-full text-left p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 hover:border-[#A3C4A3]/40 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{kit.name || 'Kit assemblé'}</span>
                    <span className="text-[10px] font-mono text-[#A3C4A3]">→</span>
                  </div>
                  <span className="text-[10px] text-white/50">Kit personnalisé</span>
                </button>
              ))}
            </div>

            {/* Waveform pill */}
            <div className="h-11 mt-3 rounded-2xl bg-black/25 border border-white/10 px-3.5 flex items-center justify-between text-white/70 shadow-inner shrink-0">
              <button type="button" className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white text-xs" title="Historique">⏱️</button>
              <div className="flex items-center gap-1">
                <span className="w-0.5 h-2 bg-[#A3C4A3]/70 rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-[#A3C4A3] rounded-full animate-pulse" />
                <span className="w-0.5 h-2 bg-[#A3C4A3]/70 rounded-full animate-pulse" />
                <div className="w-5 h-5 mx-1.5 rounded-full bg-gradient-to-tr from-[#2D6B4A] via-[#A3C4A3] to-white/80 shadow-[0_0_14px_rgba(163,196,163,0.7)]" />
                <span className="w-0.5 h-3.5 bg-[#A3C4A3]/70 rounded-full animate-pulse" />
                <span className="w-0.5 h-1.5 bg-[#A3C4A3] rounded-full animate-pulse" />
                <span className="w-0.5 h-2.5 bg-[#A3C4A3]/70 rounded-full animate-pulse" />
              </div>
              <button type="button" className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white text-xs" title="Discussion">💬</button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ MODALS & DRAWERS ═══════════════ */}

      <GearDetailDrawer
        isOpen={isDetailDrawerOpen}
        item={activeItem}
        onClose={() => setIsDetailDrawerOpen(false)}
        onEdit={(item) => {
          setIsDetailDrawerOpen(false);
          setEditingItem(item);
          setIsAddModalOpen(true);
        }}
        onDelete={(id) => {
          removeFromEquipment(id);
          setIsDetailDrawerOpen(false);
        }}
        onLend={() => {
          setIsDetailDrawerOpen(false);
          setIsLendModalOpen(true);
        }}
        onToggleFavorite={() => {
          if (activeItem) handleToggleFavorite(activeItem);
        }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
        }}
      />

      <AddEditGearModal
        isOpen={isAddModalOpen}
        initialItem={
          editingItem
            ? {
                id: editingItem.id,
                name: editingItem.name,
                brand: editingItem.brand || undefined,
                category: editingItem.category,
                weight_g: editingItem.weight_g,
                weight: editingItem.weight_g,
                count: editingItem.quantity || 1,
                quantity: editingItem.quantity || 1,
                condition: editingItem.condition as any,
                image: editingItem.image || undefined,
                purchase_price: editingItem.purchase_price || undefined,
                purchase_date: editingItem.purchase_date || undefined,
                is_favorite: editingItem.is_favorite,
                is_rented: false,
                notes: editingItem.notes || undefined,
              }
            : null
        }
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={async (itemData) => {
          if (editingItem && editingItem.id) {
            await updateEquipment(editingItem.id, {
              name: itemData.name,
              brand: itemData.brand,
              category: itemData.category,
              weight_g: itemData.weight_g,
              condition: itemData.condition as any,
              notes: itemData.notes,
              image: itemData.image,
              purchase_price: itemData.purchase_price,
            });
          } else {
            await addToEquipment(
              {
                name: itemData.name || 'Nouvel équipement',
                category: itemData.category || 'autre',
                weight_g: itemData.weight_g || 100,
                brand: itemData.brand || undefined,
                image: itemData.image || undefined,
              },
              {
                condition: (itemData.condition as any) || 'excellent',
                notes: itemData.notes || undefined,
                purchase_price: itemData.purchase_price || undefined,
              }
            );
          }
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
      />

      <KitCockpitDrawer
        isOpen={isKitDrawerOpen}
        kit={selectedKitForCockpit || kits[0] || null}
        userEquipment={equipment}
        onClose={() => {
          setIsKitDrawerOpen(false);
          setSelectedKitForCockpit(null);
        }}
        onSelectForDeparture={(kit) => {
          setSelectedKitForCockpit(kit);
          setIsKitDrawerOpen(false);
        }}
        onUpdateKit={async (kitId, patch) => {
          await updateKit(kitId, patch);
        }}
        onDeleteKit={async (kitId) => {
          await moveToTrash(kitId);
          setIsKitDrawerOpen(false);
          setSelectedKitForCockpit(null);
        }}
        onAddGearToInventory={async (product) => {
          await addToEquipment({
            name: product.name,
            brand: product.brand,
            category: product.category || 'Autre',
            weight_g: product.weight_g || 100,
            image: product.image,
          });
        }}
        onAddToCart={(p) => {
          addToCart({
            id: p.id || 'prod',
            slug: p.slug || 'equipement',
            name: p.name || 'Équipement',
            brand: p.brand || 'LKDV',
            priceEur: p.price_eur || p.priceEur || 99,
            weightG: p.weight_g || p.weightG || 100,
            image: p.image || '/assets/images/no_image.png',
            imageAlt: p.name || 'Équipement',
            category: p.category || 'équipement',
          });
        }}
      />

      <LendItemModal
        isOpen={isLendModalOpen}
        item={activeItem}
        onClose={() => setIsLendModalOpen(false)}
        onSaveLoan={async (borrowerName, returnDate, notes) => {
          if (activeItem) {
            await updateEquipment(activeItem.id, {
              loan_status: 'prêté',
              loan_to_name: borrowerName,
              notes: notes || activeItem.notes,
            });
          }
          setIsLendModalOpen(false);
        }}
      />

    </div>
  );
}
