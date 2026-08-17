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

/* ─────────────────────────────────────────────────────────────────────────────
   APPLE LIQUID GLASS DESIGN SYSTEM (STRICT SCALES & TOKENS)
   
   1. ELEVATION LEVELS:
      - Level 0: 100% Crisp Background (Zero blur, tinted glazing + vignette)
      - Level 1: Structure Panels (Dock, Columns 1/2/3, Floating Capsule)
      - Level 2: Nested Cards (Item cards, AI prompt bubble, Combos, Hero stage, HUD tiles)
      - Level 3: Active / Selected Item & Overlays (Highlighted items, Drawers, Modals)

   2. STRICT BORDER RADIUS SCALE:
      - 4px  (rounded-[4px])  : Micro indicators / status pips
      - 8px  (rounded-[8px])  : Compact category chips
      - 12px (rounded-[12px]) : Product image preview containers
      - 16px (rounded-[16px]) : Nested cards, tiles & inner sections
      - 20px (rounded-[20px]) : Main structural panels
      - full (rounded-full)   : Navigation capsules, pills & circular buttons

   3. STRICT TYPOGRAPHY SCALE:
      - text-[9px] font-mono  : Uppercase HUD labels & telemetry metadata
      - text-[11px]           : Secondary metadata, categories & brand tags
      - text-xs (12px)        : Body copy, input fields & descriptions
      - text-sm (14px)        : Item titles & section headers
      - text-lg / text-xl     : Hero product titles & primary numeric telemetry

   4. STRICT ICON SCALE:
      - 16px : Navigation & primary dock icons (strokeWidth="2")
      - 14px : Inline interactive icons (search, external link) (strokeWidth="2")
      - 12px : Micro indicator icons (strokeWidth="2")

   5. EASING CURVE:
      - Apple Physics Easing : [0.16, 1, 0.3, 1]
───────────────────────────────────────────────────────────────────────────── */

// Elevation CSS styles
const GLASS_STYLE_LEVEL_1: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.10)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.20)',
  borderTop: '1px solid rgba(255, 255, 255, 0.45)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
  borderRadius: '20px',
};

const GLASS_STYLE_LEVEL_2: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.14)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderTop: '1px solid rgba(255, 255, 255, 0.35)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
  borderRadius: '16px',
};

const GLASS_STYLE_LEVEL_3_ACTIVE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.24)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.40)',
  borderTop: '1px solid rgba(255, 255, 255, 0.70)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
  borderRadius: '16px',
};

// Physics easing
const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

// Formatters
function formatWeight(g: number): string {
  if (g >= 1000) {
    return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${g} g`;
}

// Brand filter pills
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

  // Supabase Hooks (Read-only contract respected)
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
    if (equipment.length > 0) {
      if (!selectedItemId || !equipment.some((e) => e.id === selectedItemId)) {
        setSelectedItemId(equipment[0].id);
      }
    } else {
      setSelectedItemId(null);
    }
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

  // Active selected item
  const activeItem = useMemo(() => {
    if (filteredEquipment.length > 0) {
      return filteredEquipment.find((e) => e.id === selectedItemId) || filteredEquipment[0] || null;
    }
    return equipment.find((e) => e.id === selectedItemId) || equipment[0] || null;
  }, [filteredEquipment, equipment, selectedItemId]);

  // Total weight
  const totalWeightG = useMemo(() => {
    return equipment.reduce((sum, it) => sum + (it.weight_g || 0) * (it.quantity || 1), 0);
  }, [equipment]);

  // Reset all search and category filters
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

  return (
    <div className="fixed inset-0 z-40 h-screen w-screen overflow-hidden text-white select-none flex flex-col p-2.5 sm:p-3 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          NIVEAU 0 : BACKGROUND SCENE (100% Crisp, No Blur, Vignette)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/assets/images/journal-refuge.jpg"
          alt="Refuge alpin de haute montagne"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center scale-100 transition-transform duration-1000 motion-reduce:transition-none"
        />
        
        {/* Neutral Tinted Glazing Layer */}
        <div className="absolute inset-0 bg-black/25 mix-blend-multiply" />

        {/* Ambient Corner Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.45) 100%)',
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          COCKPIT ROOT CONTAINER (100% Fullscreen Height, No Window Scroll)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex gap-2.5 sm:gap-3 min-h-0 max-h-full overflow-hidden">
        
        {/* ─── NIVEAU 1 : LEFT DOCK (Apple Liquid Glass Rail) ─── */}
        <aside
          className="w-12 sm:w-14 shrink-0 flex flex-col items-center justify-between py-3 px-1 transition-all"
          style={GLASS_STYLE_LEVEL_1}
        >
          {/* Brand Mark */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={{ duration: 0.2, ease: APPLE_EASE }}
          >
            <Link
              href="/"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] bg-[#17402C] border border-white/40 flex items-center justify-center text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              title="Accueil LKDV"
            >
              <svg viewBox="0 0 32 32" width="16" height="16" fill="none">
                <path d="M2 24 L10 10 L14 16 L20 6 L30 24 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M2 24 L30 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
          </motion.div>

          {/* Navigation Icons Dock */}
          <div className="flex flex-col gap-2.5">
            {/* Inventory (Primary) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ duration: 0.2, ease: APPLE_EASE }}
              onClick={() => {
                triggerHaptic('light');
                setActiveNav('inventory');
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${
                activeNav === 'inventory'
                  ? 'bg-[#17402C] text-[#D4F973] border border-[#D4F973]/40 shadow-[0_0_16px_rgba(212,249,115,0.35)]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Inventaire Complet"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="2" />
                <rect x="14" y="3" width="7" height="7" rx="2" />
                <rect x="3" y="14" width="7" height="7" rx="2" />
                <rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </motion.button>

            {/* Telemetry / Kits */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ duration: 0.2, ease: APPLE_EASE }}
              onClick={() => {
                triggerHaptic('light');
                setIsKitDrawerOpen(true);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              title="Kits & Télémétrie Poids"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </motion.button>

            {/* Favorites */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ duration: 0.2, ease: APPLE_EASE }}
              onClick={() => {
                triggerHaptic('light');
                setActiveNav(activeNav === 'favorites' ? 'inventory' : 'favorites');
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${
                activeNav === 'favorites'
                  ? 'bg-[#17402C] text-[#D4F973] border border-[#D4F973]/40 shadow-[0_0_16px_rgba(212,249,115,0.35)]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Favoris"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={activeNav === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 20s-7-4.35-7-10a4 4 0 017-2.65A4 4 0 0119 10c0 5.65-7 10-7 10z" />
              </svg>
            </motion.button>
          </div>

          {/* Settings */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={{ duration: 0.2, ease: APPLE_EASE }}
          >
            <Link
              href="/compte"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              title="Paramètres"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </Link>
          </motion.div>
        </aside>

        {/* ─── MAIN COCKPIT BODY ─── */}
        <div className="flex-1 flex flex-col min-w-0 max-h-full overflow-hidden space-y-2">
          
          {/* NIVEAU 1 : TOP APPLE FLOATING CAPSULE BAR */}
          <header className="flex items-center justify-between gap-3 shrink-0 h-10">
            {/* Title & Brand Display */}
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-widest text-xs sm:text-sm text-[#D4F973] uppercase font-mono drop-shadow-sm">
                LE KIT DU VOYAGEUR
              </span>
              <span className="text-white/30 hidden sm:inline">/</span>
              <span className="text-xs text-white/80 font-medium hidden sm:inline">
                Cockpit Télémétrique v2.5
              </span>
            </div>

            {/* Apple Liquid Glass Capsule */}
            <div
              className="flex items-center gap-1.5 p-1 rounded-full"
              style={GLASS_STYLE_LEVEL_1}
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: APPLE_EASE }}
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCategory('all');
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] ${
                  activeCategory === 'all'
                    ? 'bg-[#17402C] text-[#D4F973] border border-[#D4F973]/40 shadow-[0_0_12px_rgba(212,249,115,0.3)]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                Mon Matériel
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: APPLE_EASE }}
                onClick={() => {
                  triggerHaptic('light');
                  setIsKitDrawerOpen(true);
                }}
                className="px-3.5 py-1 rounded-full text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
              >
                Kits Assemblés
              </motion.button>

              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: APPLE_EASE }}
                className="hidden sm:inline-block"
              >
                <Link
                  href="/boutique"
                  className="px-3.5 py-1 rounded-full text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                >
                  Boutique
                </Link>
              </motion.div>

              {/* Location Badge */}
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] text-[11px] text-[#AECBB4] font-medium border border-white/15">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#D4F973]"
                  style={{
                    animation: 'apple-glow-pulse 2s ease-in-out infinite',
                  }}
                />
                <span>Massif Alpin · 2 450 m</span>
              </div>

              {/* Notification Bell */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.15, ease: APPLE_EASE }}
                className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/20 flex items-center justify-center text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
              >
                🔔
              </motion.button>

              {/* User Avatar */}
              <Link
                href="/compte"
                className="w-7 h-7 rounded-full bg-[#17402C] border border-[#D4F973]/50 flex items-center justify-center text-white text-[10px] font-bold shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
              >
                MC
              </Link>
            </div>
          </header>

          {/* ─────────────────────────────────────────────────────────
              3-COLUMNS STAGE (100% Height, No Window Scroll)
          ───────────────────────────────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[270px_1fr] lg:grid-cols-[280px_310px_1fr] xl:grid-cols-[300px_340px_1fr] gap-2.5 min-h-0 overflow-hidden">
            
            {/* ═════════════════════════════════════════════════════════
                NIVEAU 1 : COLUMN 1 (Inventory List & Filters)
            ═════════════════════════════════════════════════════════ */}
            <div
              className="flex flex-col h-full p-3 overflow-hidden"
              style={GLASS_STYLE_LEVEL_1}
            >
              {/* Header: Title & Search */}
              <div className="space-y-2 pb-2.5 border-b border-white/10 shrink-0">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-bold tracking-tight text-white">
                    Mon Équipement
                  </h2>
                  <span className="text-[11px] font-mono text-[#D4F973] font-bold">
                    {filteredEquipment.length} items · {formatWeight(totalWeightG)}
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher équipement..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-7 pr-6 py-1.5 bg-black/25 rounded-[12px] border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 shadow-inner transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs focus-visible:outline-none"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Chips Bar */}
                <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                  {['all', 'couchage', 'portage', 'cuisine', 'vêtement', 'navigation'].map((cat) => (
                    <motion.button
                      key={cat}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.15, ease: APPLE_EASE }}
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveCategory(cat);
                      }}
                      className={`px-2.5 py-0.5 rounded-[8px] capitalize whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] ${
                        activeCategory === cat
                          ? 'bg-[#17402C] text-[#D4F973] font-bold border border-[#D4F973]/40 shadow-xs'
                          : 'bg-white/[0.08] text-white/70 hover:bg-white/15 hover:text-white border border-white/10'
                      }`}
                    >
                      {cat === 'all' ? 'Tous' : cat}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Item List Container */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 pt-2 custom-scrollbar">
                
                {/* 1. LOADING SKELETON STATE */}
                {isLoading && equipment.length === 0 ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="p-2 rounded-[16px] animate-pulse flex items-center gap-2.5"
                        style={GLASS_STYLE_LEVEL_2}
                      >
                        <div className="w-11 h-11 rounded-[12px] bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="w-3/4 h-3 rounded bg-white/15" />
                          <div className="w-1/2 h-2.5 rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEquipment.length === 0 ? (
                  /* 2. EMPTY STATE */
                  <div
                    className="p-4 rounded-[16px] text-center space-y-3 flex flex-col items-center justify-center my-2"
                    style={GLASS_STYLE_LEVEL_2}
                  >
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                      🧭
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Aucun équipement trouvé</h4>
                      <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                        {searchQuery
                          ? `Aucun résultat pour « ${searchQuery} »`
                          : 'Aucun article dans cette catégorie'}
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ duration: 0.2, ease: APPLE_EASE }}
                      onClick={handleResetFilters}
                      className="px-3 py-1.5 rounded-[8px] bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                    >
                      Réinitialiser les filtres
                    </motion.button>
                  </div>
                ) : (
                  /* 3. ITEM CARDS LIST (Niveau 2 & Niveau 3 Active) */
                  filteredEquipment.map((item) => {
                    const isSelected = item.id === selectedItemId;
                    return (
                      <motion.div
                        key={item.id}
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedItemId(item.id);
                        }}
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.2, ease: APPLE_EASE }}
                        style={isSelected ? GLASS_STYLE_LEVEL_3_ACTIVE : GLASS_STYLE_LEVEL_2}
                        className="p-2 transition-all cursor-pointer flex items-center gap-2.5 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                      >
                        {/* Selected Indicator Pill */}
                        {isSelected && (
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-[4px] bg-[#D4F973] shadow-[0_0_8px_rgba(212,249,115,0.8)]" />
                        )}

                        {/* Image Preview Box */}
                        <div className="w-11 h-11 rounded-[12px] bg-black/40 overflow-hidden relative shrink-0 border border-white/15 flex items-center justify-center p-1 shadow-inner">
                          <Image
                            src={item.image || '/assets/images/no_image.png'}
                            alt={item.name}
                            fill
                            className="object-contain p-0.5"
                          />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate leading-tight">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/70 mt-0.5 truncate">
                            <span>{item.brand || 'Outdoor'}</span>
                            <span>·</span>
                            <span className="font-mono text-[#D4F973] font-bold">{formatWeight(item.weight_g || 0)}</span>
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
                          className="text-white/40 hover:text-[#D4F973] p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] rounded-[4px]"
                          title="Ouvrir la fiche"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </button>
                      </motion.div>
                    );
                  })
                )}

                {/* + Add Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.2, ease: APPLE_EASE }}
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-[16px] border border-dashed border-white/30 hover:border-[#D4F973] bg-white/[0.06] hover:bg-white/[0.14] text-white/80 hover:text-[#D4F973] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                >
                  <span className="text-sm">+</span> Ajouter un article
                </motion.button>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════
                NIVEAU 1 : COLUMN 2 (AI Gear Copilot & Smart Combos)
            ═════════════════════════════════════════════════════════ */}
            <div
              className="hidden md:flex flex-col h-full p-3.5 overflow-hidden justify-between space-y-2"
              style={GLASS_STYLE_LEVEL_1}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-300 text-sm">⭐</span>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      Copilote IA Équipement
                    </h3>
                    <span className="text-[9px] text-[#D4F973] font-bold font-mono uppercase tracking-wider">Assistance active</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.15, ease: APPLE_EASE }}
                  onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                  className="w-5 h-5 rounded-[6px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-[11px] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                  title="Prompt suivant"
                >
                  ↗
                </motion.button>
              </div>

              {/* NIVEAU 2 : AI Thought / Prompt Bubble */}
              <div
                className="p-3 shadow-inner"
                style={GLASS_STYLE_LEVEL_2}
              >
                <p className="text-xs text-white/90 leading-relaxed italic font-serif">
                  "{aiPrompts[aiPromptIndex]}"
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-[#D4F973] font-mono font-bold">✦ Recommandation prête</span>
                  <button
                    type="button"
                    onClick={() => setIsKitDrawerOpen(true)}
                    className="text-white/70 hover:text-[#D4F973] font-semibold underline focus-visible:outline-none"
                  >
                    Voir l'analyse
                  </button>
                </div>
              </div>

              {/* NIVEAU 2 : Mini Combo Cards */}
              <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                {AI_PRESET_COMBOS.map((combo) => (
                  <motion.div
                    key={combo.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.2, ease: APPLE_EASE }}
                    onClick={() => {
                      const gear = equipment.find((e) => e.name.toLowerCase().includes(combo.gearQuery.toLowerCase()));
                      if (gear) setSelectedItemId(gear.id);
                    }}
                    style={GLASS_STYLE_LEVEL_2}
                    className="p-2 flex flex-col justify-between cursor-pointer hover:bg-white/[0.20] transition-all group shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                  >
                    <div className="relative aspect-[16/10] w-full rounded-[12px] overflow-hidden bg-black/40 flex items-center justify-center">
                      <Image
                        src={combo.image}
                        alt={combo.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform motion-reduce:transition-none"
                      />
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[4px] bg-[#17402C]/90 text-[9px] font-mono text-[#D4F973] font-bold border border-[#D4F973]/30 shadow-xs">
                        {combo.savedWeight}
                      </span>
                    </div>
                    <div className="pt-1.5">
                      <h5 className="text-[11px] font-bold text-white truncate">{combo.title}</h5>
                      <div className="flex items-center justify-between text-[11px] text-white/70 mt-0.5">
                        <span className="font-mono text-[#D4F973] font-bold">{combo.weightStr}</span>
                        <span className="text-white/50 font-medium">1-Tap</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Apple Audio Waveform Bar */}
              <div className="h-9 rounded-[16px] bg-black/35 border border-white/15 px-3 flex items-center justify-between text-xs text-white/70 shadow-inner shrink-0">
                <button
                  type="button"
                  className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white text-[11px] focus-visible:outline-none"
                  title="Historique"
                >
                  ⏱️
                </button>

                {/* Animated Waveform Lines */}
                <div className="flex items-center gap-1">
                  <span className="w-0.5 h-2.5 bg-emerald-400/70 rounded-full animate-pulse motion-reduce:animate-none" />
                  <span className="w-0.5 h-4 bg-[#D4F973] rounded-full animate-pulse motion-reduce:animate-none" />
                  <span className="w-0.5 h-2 bg-emerald-400/70 rounded-full animate-pulse motion-reduce:animate-none" />
                  
                  {/* Glowing AI Orb */}
                  <div className="w-4 h-4 mx-1 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-[#D4F973] shadow-[0_0_12px_rgba(212,249,115,0.6)] animate-spin-slow motion-reduce:animate-none" />
                  
                  <span className="w-0.5 h-3.5 bg-emerald-400/70 rounded-full animate-pulse motion-reduce:animate-none" />
                  <span className="w-0.5 h-1.5 bg-[#D4F973] rounded-full animate-pulse motion-reduce:animate-none" />
                  <span className="w-0.5 h-2.5 bg-emerald-400/70 rounded-full animate-pulse motion-reduce:animate-none" />
                </div>

                <button
                  type="button"
                  onClick={() => setAiPromptIndex((prev) => (prev + 1) % aiPrompts.length)}
                  className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white text-[11px] focus-visible:outline-none"
                  title="Discussion"
                >
                  💬
                </button>
              </div>

            </div>

            {/* ═════════════════════════════════════════════════════════
                NIVEAU 1 : COLUMN 3 (Hero Item Spotlight & Telemetry)
            ═════════════════════════════════════════════════════════ */}
            <div
              className="flex flex-col h-full p-3.5 sm:p-4 overflow-hidden justify-between space-y-2"
              style={GLASS_STYLE_LEVEL_1}
            >
              {/* Brand Filter Ribbon */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 border-b border-white/10 scrollbar-none shrink-0">
                {BRAND_FILTERS.map((b) => {
                  const isSelected = selectedBrand === b.name;
                  return (
                    <motion.button
                      key={b.name}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.15, ease: APPLE_EASE }}
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedBrand(b.name);
                      }}
                      className={`px-2.5 py-1 rounded-full flex items-center gap-1 text-[11px] transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973] ${
                        isSelected
                          ? 'bg-[#17402C] text-[#D4F973] font-bold border border-[#D4F973]/50 shadow-[0_0_12px_rgba(212,249,115,0.35)]'
                          : 'bg-white/[0.08] hover:bg-white/15 text-white/80 border border-white/15'
                      }`}
                      title={b.name}
                    >
                      <span>{b.icon}</span>
                      <span>{b.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Active Item Title & Actions Header (With Smooth AnimatePresence) */}
              <AnimatePresence mode="wait">
                {activeItem ? (
                  <motion.div
                    key={activeItem.id + '-header'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: APPLE_EASE }}
                    className="flex items-start justify-between gap-2 shrink-0"
                  >
                    <div>
                      <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
                        {activeItem.name}
                      </h1>
                      <p className="text-xs text-white/80 font-sans mt-0.5 font-medium">
                        {activeItem.brand || 'Outdoor'} · Catégorie <span className="capitalize font-bold text-[#D4F973]">{activeItem.category}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ duration: 0.15, ease: APPLE_EASE }}
                        onClick={() => setIsDetailDrawerOpen(true)}
                        className="px-4 py-1.5 rounded-full bg-[#17402C] hover:bg-[#1f543a] text-white font-bold text-xs transition-all border border-[#D4F973]/40 shadow-[0_0_16px_rgba(23,64,44,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                      >
                        Fiche Complète
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.90 }}
                        transition={{ duration: 0.15, ease: APPLE_EASE }}
                        onClick={(e) => handleToggleFavorite(activeItem, e)}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs transition-transform shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4F973]"
                        title="Favori"
                      >
                        {activeItem.is_favorite ? '❤️' : '🤍'}
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  /* Fallback State for account with 0 gear */
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="text-sm font-bold text-white">Aucun équipement sélectionné</h3>
                      <p className="text-[11px] text-white/60">Ajoutez votre premier article pour commencer</p>
                    </div>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-full bg-[#17402C] text-white text-xs font-bold border border-[#D4F973]/40"
                    >
                      + Ajouter
                    </motion.button>
                  </div>
                )}
              </AnimatePresence>

              {/* NIVEAU 2 : HERO PRODUCT SPOTLIGHT STAGE (With Studio Lighting & Realistic Floor Shadow) */}
              <div
                className="relative flex-1 min-h-[150px] overflow-hidden flex flex-col items-center justify-center p-4 group shadow-inner"
                style={GLASS_STYLE_LEVEL_2}
              >
                {/* Directional Studio Lighting (Ambient highlight top-left) */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.20) 0%, transparent 60%)',
                  }}
                />

                {/* Subtle Emerald Atmosphere Halo */}
                <div className="absolute w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                {/* Physical Floor Contact Shadow (Dark Ellipse under product) */}
                <div
                  className="absolute bottom-4 sm:bottom-5 w-48 sm:w-56 h-6 rounded-[100%] pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 70%)',
                    filter: 'blur(12px)',
                  }}
                />

                {/* Hero Item Image Standing on Floor with Smooth Transition */}
                <AnimatePresence mode="wait">
                  {activeItem ? (
                    <motion.div
                      key={activeItem.id}
                      initial={{ opacity: 0, scale: 0.95, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -4 }}
                      transition={{ duration: 0.28, ease: APPLE_EASE }}
                      className="relative z-10 w-full h-full max-h-[220px] flex items-center justify-center"
                    >
                      <Image
                        src={activeItem.image || '/assets/images/no_image.png'}
                        alt={activeItem.name}
                        fill
                        className="object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-500 motion-reduce:transition-none"
                      />
                    </motion.div>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                      <span className="text-3xl mb-1">🎒</span>
                      <p className="text-xs text-white/70">Plateau d'exposition vide</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Price & Weight Key Metrics Bar */}
              {activeItem ? (
                <div className="flex items-center justify-between px-1.5 pt-1 border-t border-white/10 shrink-0">
                  <div>
                    <span className="text-[9px] text-white/60 uppercase tracking-widest block font-mono font-semibold">POIDS PESÉ</span>
                    <span className="text-xl font-bold font-mono text-[#D4F973]">
                      {formatWeight(activeItem.weight_g || 0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-white/60 uppercase tracking-widest block font-mono font-semibold">VALEUR NEUF</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {activeItem.purchase_price ? `${activeItem.purchase_price} €` : '249 €'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* NIVEAU 2 : 3 Specifications Horizontal HUD Tiles */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                
                {/* Tile 1: Condition */}
                <div
                  className="p-2.5 flex items-center gap-2 shadow-sm"
                  style={GLASS_STYLE_LEVEL_2}
                >
                  <span className="text-base">⏱️</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate leading-none capitalize">
                      {activeItem?.condition || 'Excellent'}
                    </span>
                    <span className="text-[9px] text-white/60 uppercase font-mono mt-0.5 block truncate font-semibold">
                      ÉTAT D'USURE
                    </span>
                  </div>
                </div>

                {/* Tile 2: Polyvalence */}
                <div
                  className="p-2.5 flex items-center gap-2 shadow-sm"
                  style={GLASS_STYLE_LEVEL_2}
                >
                  <span className="text-base">🏕️</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate leading-none">
                      3 Saisons
                    </span>
                    <span className="text-[9px] text-white/60 uppercase font-mono mt-0.5 block truncate font-semibold">
                      POLYVALENCE
                    </span>
                  </div>
                </div>

                {/* Tile 3: Score KDV */}
                <div
                  className="p-2.5 flex items-center gap-2 shadow-sm"
                  style={GLASS_STYLE_LEVEL_2}
                >
                  <span className="text-base text-[#D4F973]">⚡</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#D4F973] block truncate leading-none">
                      9.6 / 10
                    </span>
                    <span className="text-[9px] text-white/60 uppercase font-mono mt-0.5 block truncate font-semibold">
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
          MODALS & DRAWERS (NIVEAU 3 OVERLAYS)
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
