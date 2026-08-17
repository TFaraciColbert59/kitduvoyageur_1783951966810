'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Formatters
function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

// Brand filter pills for right showcase
const BRAND_FILTERS = [
  { name: 'Tous', icon: '✦' },
  { name: 'MSR', icon: '⛺' },
  { name: 'Osprey', icon: '🎒' },
  { name: 'Salomon', icon: '🥾' },
  { name: 'Petzl', icon: '🔦' },
  { name: 'Therm-a-Rest', icon: '🛌' },
  { name: 'Sea to Summit', icon: '🌊' },
  { name: 'Patagonia', icon: '🧥' },
];

const AI_PRESET_COMBOS = [
  {
    id: 'bivouac-3s',
    title: 'Kit Bivouac 3 Saisons',
    weightStr: '9,4 kg',
    savedWeight: '-1,8 kg',
    desc: 'Tente 2P + Duvet 0°C + Réchaud',
    image: '/assets/images/adventure-bivouac.jpg',
    gearQuery: 'MSR',
  },
  {
    id: 'ultra-light',
    title: 'Pack Ultra-Light 48h',
    weightStr: '4,2 kg',
    savedWeight: '-3,1 kg',
    desc: 'Tarp + Matelas NeoAir + Popote',
    image: '/assets/images/adventure-hiking.jpg',
    gearQuery: 'NeoAir',
  },
];

export default function MonMaterielAppleLiquidGlassPage() {
  const { triggerHaptic } = useHapticFeedback();

  // Supabase Hooks
  const {
    equipment,
    products,
    isOwned,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  const {
    kits,
    trashKits,
    createKit,
    updateKit,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
  } = useUserKits(equipment);

  // Cockpit States
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

  // AI Prompt Interactive Suggestion
  const [aiPromptIndex, setAiPromptIndex] = useState(0);
  const aiPrompts = [
    "Optimise mon sac pour un bivouac 3 jours en haute montagne sous 9,5 kg.",
    "Détecte le matériel usé ou à remplacer avant mon départ pour le GR20.",
    "Compare le poids de mes tentes et matelas pour une rando ultra-légère.",
    "Propose la liste d'équipements indispensables pour une météo pluvieuse.",
  ];

  // Set default selected item
  useEffect(() => {
    if (equipment.length > 0 && !selectedItemId) {
      setSelectedItemId(equipment[0].id);
    }
  }, [equipment, selectedItemId]);

  // Active selected item
  const activeItem = useMemo(() => {
    return equipment.find((e) => e.id === selectedItemId) || equipment[0] || null;
  }, [equipment, selectedItemId]);

  // Filtered equipment list for Column 1
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

  // Total weight
  const totalWeightG = useMemo(() => {
    return equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0);
  }, [equipment]);

  // Toggle favorite
  const handleToggleFavorite = async (item: UserEquipmentItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    await updateEquipment(item.id, {
      is_favorite: !item.is_favorite,
    });
  };

  return (
    <div className="fixed inset-0 z-40 h-screen w-screen overflow-hidden text-[#0B1F17] select-none flex flex-col p-2.5 sm:p-3 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          BACKGROUND: Luminous Alpine Landscape with Soft Blur
      ───────────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none scale-105 opacity-90 transition-all duration-700"
        style={{
          backgroundImage: "url('/assets/images/hero-editorial.jpg')",
          filter: 'blur(8px) brightness(1.02) saturate(1.05)',
        }}
      />

      {/* Frosted Daylight Ambient Wash */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-white/35 via-white/15 to-white/40 backdrop-blur-[2px]" />

      {/* ─────────────────────────────────────────────────────────────
          COCKPIT ROOT WRAPPER (100% Fullscreen Height, No Window Scroll)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex gap-2.5 sm:gap-3 min-h-0 max-h-full overflow-hidden">
        
        {/* ─── LEFT DOCK (Apple Frosted Glass Rail) ─── */}
        <aside className="w-12 sm:w-14 shrink-0 flex flex-col items-center justify-between py-3 px-1 rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]">
          {/* Brand Mark */}
          <Link
            href="/"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#17402C] to-[#1F4A3A] border border-white/40 flex items-center justify-center text-white hover:scale-105 transition-transform shadow-md"
            title="Accueil LKDV"
          >
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
              <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </Link>

          {/* Navigation Icons Dock */}
          <div className="flex flex-col gap-2">
            {/* Inventory (Primary) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveNav('inventory');
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                activeNav === 'inventory'
                  ? 'bg-[#17402C] text-white shadow-[0_4px_14px_rgba(23,64,44,0.35)] scale-105'
                  : 'text-[#0B1F17]/70 hover:text-[#0B1F17] hover:bg-white/60'
              }`}
              title="Inventaire Complet"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </button>

            {/* Telemetry / Weight */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsKitDrawerOpen(true);
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                activeNav === 'telemetry'
                  ? 'bg-[#17402C] text-white shadow-[0_4px_14px_rgba(23,64,44,0.35)] scale-105'
                  : 'text-[#0B1F17]/70 hover:text-[#0B1F17] hover:bg-white/60'
              }`}
              title="Kits & Télémétrie Poids"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </button>

            {/* Favorites */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveNav(activeNav === 'favorites' ? 'inventory' : 'favorites');
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                activeNav === 'favorites'
                  ? 'bg-[#17402C] text-white shadow-[0_4px_14px_rgba(23,64,44,0.35)] scale-105'
                  : 'text-[#0B1F17]/70 hover:text-[#0B1F17] hover:bg-white/60'
              }`}
              title="Favoris"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill={activeNav === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2">
                <path d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z" />
              </svg>
            </button>
          </div>

          {/* Settings */}
          <Link
            href="/compte"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-[#0B1F17]/70 hover:text-[#0B1F17] hover:bg-white/60 transition-colors"
            title="Paramètres du compte"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </aside>

        {/* ─── MAIN COCKPIT BODY ─── */}
        <div className="flex-1 flex flex-col min-w-0 max-h-full overflow-hidden space-y-2">
          
          {/* TOP APPLE FLOATING CAPSULE BAR */}
          <header className="flex items-center justify-between gap-3 shrink-0 h-10">
            {/* Title & Brand Display */}
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-widest text-xs sm:text-sm text-[#17402C] uppercase font-mono">
                LE KIT DU VOYAGEUR
              </span>
              <span className="text-[#0B1F17]/30 hidden sm:inline">/</span>
              <span className="text-xs text-[#0B1F17]/70 font-semibold hidden sm:inline">
                Cockpit Télémétrique v2.5
              </span>
            </div>

            {/* Apple Liquid Glass Capsule */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/75 backdrop-blur-3xl border border-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCategory('all');
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[#17402C] text-white shadow-[0_2px_8px_rgba(23,64,44,0.3)]'
                    : 'text-[#0B1F17]/75 hover:text-[#0B1F17]'
                }`}
              >
                Mon Matériel
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsKitDrawerOpen(true);
                }}
                className="px-3.5 py-1 rounded-full text-xs font-medium text-[#0B1F17]/75 hover:text-[#0B1F17] transition-colors"
              >
                Kits Assemblés
              </button>

              <Link
                href="/boutique"
                className="px-3.5 py-1 rounded-full text-xs font-medium text-[#0B1F17]/75 hover:text-[#0B1F17] transition-colors hidden sm:inline-block"
              >
                Boutique
              </Link>

              {/* Location Badge */}
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-[11px] text-[#17402C] font-semibold border border-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Massif Alpin · 2 450 m</span>
              </div>

              {/* Notification Bell */}
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-xs text-[#0B1F17] transition-transform active:scale-90"
              >
                🔔
              </button>

              {/* User Avatar */}
              <Link
                href="/compte"
                className="w-7 h-7 rounded-full bg-[#17402C] border border-white/60 flex items-center justify-center text-white text-[10px] font-bold shadow-xs"
              >
                MC
              </Link>
            </div>
          </header>

          {/* ─────────────────────────────────────────────────────────
              3-COLUMNS APPLE LIQUID GLASS STAGE (100% Height, No Scroll)
          ───────────────────────────────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[270px_1fr] lg:grid-cols-[280px_310px_1fr] xl:grid-cols-[300px_340px_1fr] gap-2.5 min-h-0 overflow-hidden">
            
            {/* ═════════════════════════════════════════════════════════
                COLUMN 1: INVENTORY ITEM SELECTOR & SEARCH (Left)
            ═════════════════════════════════════════════════════════ */}
            <div className="flex flex-col h-full rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/80 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] overflow-hidden">
              
              {/* Header: Title & Search */}
              <div className="space-y-2 pb-2.5 border-b border-black/[0.06] shrink-0">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-bold tracking-tight text-[#0B1F17]">
                    Mon Équipement
                  </h2>
                  <span className="text-[11px] font-mono text-[#17402C] font-bold">
                    {filteredEquipment.length} items · {formatWeight(totalWeightG)}
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#0B1F17]/40"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher équipement..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-6 py-1.5 bg-white/60 rounded-xl border border-black/[0.08] text-xs text-[#0B1F17] placeholder-[#0B1F17]/40 focus:outline-none focus:ring-1.5 focus:ring-[#17402C] shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#0B1F17]/40 hover:text-[#0B1F17] text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Chips Bar */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[10px]">
                  {['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveCategory(cat);
                      }}
                      className={`px-2.5 py-0.5 rounded-lg capitalize whitespace-nowrap transition-colors ${
                        activeCategory === cat
                          ? 'bg-[#17402C] text-white font-bold shadow-xs'
                          : 'bg-white/50 text-[#0B1F17]/70 hover:bg-white hover:text-[#0B1F17]'
                      }`}
                    >
                      {cat === 'all' ? 'Tous' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stack of Sleek Horizontal Item Cards (Liquid Glass) */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 pt-2 custom-scrollbar">
                {filteredEquipment.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedItemId(item.id);
                      }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`p-2 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 relative group ${
                        isSelected
                          ? 'bg-white/95 border-[#17402C]/40 shadow-[0_6px_20px_rgba(23,64,44,0.12),inset_0_1px_1px_rgba(255,255,255,1)]'
                          : 'bg-white/45 border-white/60 hover:bg-white/75 hover:border-black/[0.08] shadow-xs'
                      }`}
                    >
                      {/* Image Preview Box */}
                      <div className="w-11 h-11 rounded-xl bg-white overflow-hidden relative shrink-0 border border-black/[0.06] flex items-center justify-center p-1 shadow-2xs">
                        <Image
                          src={item.image || '/assets/images/no_image.png'}
                          alt={item.name}
                          fill
                          className="object-contain p-0.5"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[12.5px] font-bold text-[#0B1F17] truncate leading-tight">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#0B1F17]/65 mt-0.5 truncate">
                          <span>{item.brand || 'Outdoor'}</span>
                          <span>·</span>
                          <span className="font-mono text-[#17402C] font-bold">{formatWeight(item.weight_g || 0)}</span>
                        </div>
                      </div>

                      {/* Detail Link Icon */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(item.id);
                          setIsDetailDrawerOpen(true);
                        }}
                        className="text-[#0B1F17]/30 hover:text-[#17402C] p-1 transition-colors"
                        title="Ouvrir la fiche"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </button>
                    </motion.div>
                  );
                })}

                {/* + Add Button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-[#17402C]/30 hover:border-[#17402C] bg-white/30 hover:bg-white/70 text-[#17402C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  <span className="text-sm">+</span> Ajouter un article
                </button>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════
                COLUMN 2: AI GEAR COPILOT & SMART COMBOS (Center)
            ═════════════════════════════════════════════════════════ */}
            <div className="hidden md:flex flex-col h-full rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/80 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] overflow-hidden justify-between space-y-2">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500 text-sm">⭐</span>
                  <div>
                    <h3 className="text-xs font-extrabold text-[#0B1F17] uppercase tracking-wider">
                      Copilote IA Équipement
                    </h3>
                    <span className="text-[9.5px] text-[#17402C] font-bold font-mono">Assistance active</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                  className="w-5 h-5 rounded-lg bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[11px] text-[#0B1F17]"
                  title="Prompt suivant"
                >
                  ↗
                </button>
              </div>

              {/* AI Thought / Prompt Bubble */}
              <div className="bg-white/80 rounded-2xl p-3 border border-white/90 shadow-sm">
                <p className="text-xs text-[#0B1F17]/90 leading-relaxed italic font-serif">
                  "{aiPrompts[aiPromptIndex]}"
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-[#17402C] font-mono font-bold">✦ Recommandation prête</span>
                  <button
                    type="button"
                    onClick={() => setIsKitDrawerOpen(true)}
                    className="text-[#0B1F17]/70 hover:text-[#17402C] font-semibold underline"
                  >
                    Voir l'analyse
                  </button>
                </div>
              </div>

              {/* Mini Combo Cards */}
              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {AI_PRESET_COMBOS.map((combo) => (
                  <div
                    key={combo.id}
                    onClick={() => {
                      const gear = equipment.find((e) => e.name.toLowerCase().includes(combo.gearQuery.toLowerCase()));
                      if (gear) setSelectedItemId(gear.id);
                    }}
                    className="rounded-2xl bg-white/60 border border-white/90 p-2 flex flex-col justify-between cursor-pointer hover:bg-white/90 hover:border-[#17402C]/30 transition-all group shadow-2xs"
                  >
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center">
                      <Image
                        src={combo.image}
                        alt={combo.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-[#17402C] text-[8.5px] font-mono text-white font-bold shadow-xs">
                        {combo.savedWeight}
                      </span>
                    </div>
                    <div className="pt-1.5">
                      <h5 className="text-[11px] font-bold text-[#0B1F17] truncate">{combo.title}</h5>
                      <div className="flex items-center justify-between text-[9.5px] text-[#0B1F17]/70 mt-0.5">
                        <span className="font-mono text-[#17402C] font-bold">{combo.weightStr}</span>
                        <span className="text-[#0B1F17]/50 font-medium">1-Tap</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Apple Audio Waveform Bar */}
              <div className="h-9 rounded-2xl bg-white/75 border border-white/90 px-3 flex items-center justify-between text-xs text-[#0B1F17]/70 shadow-xs shrink-0">
                <button
                  type="button"
                  className="w-5 h-5 rounded-full hover:bg-black/[0.05] flex items-center justify-center text-[#0B1F17] text-[10px]"
                  title="Historique"
                >
                  ⏱️
                </button>

                {/* Animated Waveform Lines */}
                <div className="flex items-center gap-1">
                  <span className="w-0.5 h-2.5 bg-emerald-600 rounded-full animate-pulse" />
                  <span className="w-0.5 h-4 bg-[#17402C] rounded-full animate-pulse" />
                  <span className="w-0.5 h-2 bg-emerald-600 rounded-full animate-pulse" />
                  
                  {/* Glowing AI Orb */}
                  <div className="w-4 h-4 mx-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-[#17402C] shadow-[0_0_10px_rgba(23,64,44,0.4)] animate-spin-slow" />
                  
                  <span className="w-0.5 h-3.5 bg-emerald-600 rounded-full animate-pulse" />
                  <span className="w-0.5 h-1.5 bg-[#17402C] rounded-full animate-pulse" />
                  <span className="w-0.5 h-2.5 bg-emerald-600 rounded-full animate-pulse" />
                </div>

                <button
                  type="button"
                  onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                  className="w-5 h-5 rounded-full hover:bg-black/[0.05] flex items-center justify-center text-[#0B1F17] text-[10px]"
                  title="Discussion"
                >
                  💬
                </button>
              </div>

            </div>

            {/* ═════════════════════════════════════════════════════════
                COLUMN 3: HERO ITEM SPOTLIGHT & TELEMETRY (Right)
            ═════════════════════════════════════════════════════════ */}
            <div className="flex flex-col h-full rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/80 p-3.5 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] overflow-hidden justify-between space-y-2">
              
              {/* Brand Filter Ribbon */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 border-b border-black/[0.06] scrollbar-none shrink-0">
                {BRAND_FILTERS.map((b) => {
                  const isSelected = selectedBrand === b.name;
                  return (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedBrand(b.name);
                      }}
                      className={`px-2.5 py-1 rounded-full flex items-center gap-1 text-[11px] transition-all shrink-0 ${
                        isSelected
                          ? 'bg-[#17402C] text-white font-bold shadow-[0_2px_8px_rgba(23,64,44,0.3)] scale-105'
                          : 'bg-white/60 hover:bg-white text-[#0B1F17]/75 border border-white/90 shadow-2xs'
                      }`}
                      title={b.name}
                    >
                      <span>{b.icon}</span>
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Item Title & Actions Header */}
              {activeItem ? (
                <div className="flex items-start justify-between gap-2 shrink-0">
                  <div>
                    <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0B1F17] leading-tight">
                      {activeItem.name}
                    </h1>
                    <p className="text-xs text-[#0B1F17]/70 font-sans mt-0.5 font-medium">
                      {activeItem.brand || 'Outdoor'} · Catégorie <span className="capitalize font-bold text-[#17402C]">{activeItem.category}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsDetailDrawerOpen(true)}
                      className="px-4 py-1.5 rounded-full bg-[#17402C] hover:bg-[#1f543a] text-white font-bold text-xs transition-all shadow-[0_4px_12px_rgba(23,64,44,0.25)] active:scale-95"
                    >
                      Fiche Complète
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(activeItem, e)}
                      className="w-8 h-8 rounded-full bg-white hover:bg-stone-50 border border-black/[0.08] flex items-center justify-center text-[#0B1F17] text-xs transition-transform active:scale-90 shadow-xs"
                      title="Favori"
                    >
                      {activeItem.is_favorite ? '❤️' : '🤍'}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Large Spotlight Box (Apple Clean Frosted Stage) */}
              <div className="relative flex-1 min-h-[140px] rounded-2xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 border border-white/90 overflow-hidden flex items-center justify-center p-3 group shadow-inner">
                
                {/* Soft Ambient Halo */}
                <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

                {/* Hero Item Image */}
                {activeItem ? (
                  <div className="relative w-full h-full max-h-[230px]">
                    <Image
                      src={activeItem.image || '/assets/images/no_image.png'}
                      alt={activeItem.name}
                      fill
                      className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)] group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : null}
              </div>

              {/* Price & Weight Key Metrics Bar */}
              {activeItem ? (
                <div className="flex items-center justify-between px-1.5 pt-1 border-t border-black/[0.06] shrink-0">
                  <div>
                    <span className="text-[9.5px] text-[#0B1F17]/50 uppercase tracking-widest block font-mono font-bold">POIDS PESÉ</span>
                    <span className="text-xl font-bold font-mono text-[#17402C]">
                      {formatWeight(activeItem.weight_g || 0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9.5px] text-[#0B1F17]/50 uppercase tracking-widest block font-mono font-bold">VALEUR NEUF</span>
                    <span className="text-xl font-bold font-mono text-[#0B1F17]">
                      {activeItem.purchase_price ? `${activeItem.purchase_price} €` : '249 €'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 3 Specifications Horizontal HUD Tiles (Apple Frosted Glass) */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                
                {/* Tile 1: Condition */}
                <div className="p-2 rounded-2xl bg-white/80 border border-white/90 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-sm">⏱️</span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-[#0B1F17] block truncate leading-none capitalize">
                      {activeItem?.condition || 'Excellent'}
                    </span>
                    <span className="text-[8.5px] text-[#0B1F17]/60 uppercase font-mono mt-0.5 block truncate font-semibold">
                      ÉTAT D'USURE
                    </span>
                  </div>
                </div>

                {/* Tile 2: Polyvalence */}
                <div className="p-2 rounded-2xl bg-white/80 border border-white/90 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-sm">🏕️</span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-[#0B1F17] block truncate leading-none">
                      3 Saisons
                    </span>
                    <span className="text-[8.5px] text-[#0B1F17]/60 uppercase font-mono mt-0.5 block truncate font-semibold">
                      POLYVALENCE
                    </span>
                  </div>
                </div>

                {/* Tile 3: Score KDV */}
                <div className="p-2 rounded-2xl bg-white/80 border border-white/90 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-sm text-emerald-600">⚡</span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-[#17402C] block truncate leading-none">
                      9.6 / 10
                    </span>
                    <span className="text-[8.5px] text-[#0B1F17]/60 uppercase font-mono mt-0.5 block truncate font-semibold">
                      SCORE KDV
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODALS & DRAWERS
      ───────────────────────────────────────────────────────────── */}
      
      {/* Item Detail Drawer */}
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
        onLend={(item) => {
          setIsDetailDrawerOpen(false);
          setIsLendModalOpen(true);
        }}
        onToggleFavorite={(id) => {
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

      {/* Add / Edit Item Modal */}
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

      {/* Kit Cockpit Drawer */}
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

      {/* Lend Item Modal */}
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
