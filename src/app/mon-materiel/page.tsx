'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Header from '@/components/Header';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useUserKits, CustomKit } from '@/hooks/useUserKits';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { EQUIPMENT_CATEGORIES, getCategoryIcon } from '@/constants/equipmentCategories';
import GearDetailDrawer from '@/components/inventaire/GearDetailDrawer';
import KitCockpitDrawer from '@/components/inventaire/KitCockpitDrawer';
import LendItemModal from '@/components/inventaire/LendItemModal';
import { addToCart } from '@/lib/cart';
import {
  PlannedHike,
  getPlannedHikes,
  getActivePlannedHike,
  setActivePlannedHikeId,
} from '@/lib/preparation/plannedHikes';
import {
  resolveDeparturePlan,
  recordPostHikeGearUsage,
} from '@/lib/preparation/SmartDepartureEngine';

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  return `${g} g`;
}

function formatDateFR(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// 4 Presets 1-Tap minimalistes
const AI_PRESETS = [
  {
    id: 'trek',
    emoji: '🏔️',
    title: 'Trek montagne',
    titleEm: '3 jours',
    desc: 'Bivouac & D+ · autonomie',
    weightStr: '9,4 kg',
    piecesCount: 32,
    season: 'Été',
    activity: 'Trek Alpin',
    destination: 'Massif Alpin',
    items: [
      { name: 'Sac 45L toile cirée', cat: 'Portage', weight: 1240 },
      { name: 'Duvet 3 saisons −2°C', cat: 'Couchage', weight: 890 },
      { name: 'Tente Trek 1p', cat: 'Couchage', weight: 1320 },
      { name: 'Matelas mousse Z-Lite', cat: 'Couchage', weight: 380 },
      { name: 'Réchaud gaz + popote', cat: 'Cuisine', weight: 240 },
      { name: 'Veste 3 couches', cat: 'Vêtements', weight: 380 },
      { name: 'Softshell coupe-vent', cat: 'Vêtements', weight: 320 },
      { name: 'Bâtons carbone', cat: 'Portage', weight: 420 },
      { name: 'Gourde titane 1L', cat: 'Hydratation', weight: 120 },
      { name: 'Filtre Sawyer Mini', cat: 'Hydratation', weight: 60 },
      { name: 'Lampe frontale', cat: 'Éclairage', weight: 82 },
      { name: 'Trousse secours', cat: 'Sécurité', weight: 150 },
    ],
  },
  {
    id: 'day',
    emoji: '☀️',
    title: 'Journée',
    titleEm: 'estivale',
    desc: 'Léger 15–25 km · sans bivouac',
    weightStr: '3,2 kg',
    piecesCount: 14,
    season: 'Été',
    activity: 'Randonnée Journée',
    destination: 'Moyenne Montagne',
    items: [
      { name: 'Sac 25L daypack', cat: 'Portage', weight: 640 },
      { name: 'Poche 2L tuyau', cat: 'Hydratation', weight: 140 },
      { name: 'Veste coupe-vent', cat: 'Vêtements', weight: 180 },
      { name: 'Casquette & Lunettes', cat: 'Vêtements', weight: 95 },
      { name: 'Couverture survie', cat: 'Sécurité', weight: 90 },
      { name: 'Bâtons carbone', cat: 'Portage', weight: 420 },
    ],
  },
  {
    id: 'bivouac',
    emoji: '🌲',
    title: 'Bivouac forêt',
    titleEm: '2 jours',
    desc: 'Tarp & bushcraft léger',
    weightStr: '7,8 kg',
    piecesCount: 26,
    season: 'Printemps/Automne',
    activity: 'Bivouac Forêt',
    destination: 'Forêt & Massifs',
    items: [
      { name: 'Sac 40L robuste', cat: 'Portage', weight: 1100 },
      { name: 'Tarp 3×3m sylnylon', cat: 'Couchage', weight: 480 },
      { name: 'Duvet 3 saisons', cat: 'Couchage', weight: 890 },
      { name: 'Matelas mousse', cat: 'Couchage', weight: 380 },
      { name: 'Couteau Opinel N°8', cat: 'Accessoires', weight: 42 },
      { name: 'Popote titane 750ml', cat: 'Cuisine', weight: 155 },
      { name: 'Réchaud gaz', cat: 'Cuisine', weight: 85 },
      { name: 'Filtre Sawyer Mini', cat: 'Hydratation', weight: 60 },
      { name: 'Doudoune duvet', cat: 'Vêtements', weight: 240 },
      { name: 'Lampe frontale', cat: 'Éclairage', weight: 82 },
    ],
  },
  {
    id: 'ul',
    emoji: '⚡',
    title: 'Ultra-Light',
    titleEm: '48 h',
    desc: 'Fastpacking · base < 4 kg',
    weightStr: '3,7 kg',
    piecesCount: 18,
    season: 'Été',
    activity: 'Fastpacking',
    destination: 'Sentiers Techniques',
    items: [
      { name: 'Sac 12L fastpacking', cat: 'Portage', weight: 320 },
      { name: 'Tarp 3×3m', cat: 'Couchage', weight: 480 },
      { name: 'Doudoune duvet', cat: 'Vêtements', weight: 240 },
      { name: 'Pastilles Micropur', cat: 'Hydratation', weight: 60 },
      { name: 'Mini-lampe USB-C', cat: 'Éclairage', weight: 28 },
      { name: 'Couverture survie', cat: 'Sécurité', weight: 90 },
      { name: 'Spork titane', cat: 'Cuisine', weight: 18 },
      { name: 'Sardines titane × 8', cat: 'Bivouac', weight: 72 },
    ],
  },
];

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();

  // 1. Équipement & Catalogue
  const {
    equipment,
    products,
    isOwned,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  // 2. Kits Intelligents
  const {
    kits,
    trashKits,
    createKit,
    updateKit,
    moveToTrash,
    handleGearDeleted,
  } = useUserKits(equipment);

  // 3. Randonnées Planifiées
  const [plannedHikes, setPlannedHikes] = useState<PlannedHike[]>([]);
  const [activeHike, setActiveHike] = useState<PlannedHike | null>(null);
  const [selectedKitForDeparture, setSelectedKitForDeparture] = useState<CustomKit | null>(null);
  const [checkedDepartureItems, setCheckedDepartureItems] = useState<Set<string>>(new Set());
  const [departureCompleted, setDepartureCompleted] = useState(false);

  useEffect(() => {
    const hikes = getPlannedHikes();
    setPlannedHikes(hikes);
    const active = getActivePlannedHike();
    setActiveHike(active);
  }, []);

  // Filtres & Recherche
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'owned'>('all');
  const [kitFilter, setKitFilter] = useState<'all' | 'ia' | 'manuel' | 'auto'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modales & Drawers
  const [selectedGearItem, setSelectedGearItem] = useState<UserEquipmentItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cockpitKit, setCockpitKit] = useState<CustomKit | null>(null);
  const [isKitCockpitOpen, setIsKitCockpitOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [lendingItem, setLendingItem] = useState<UserEquipmentItem | null>(null);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set(['w-1']));

  // NL AI
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Formulaire d'ajout
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('Couchage');
  const [formWeight, setFormWeight] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCondition, setFormCondition] = useState<UserEquipmentItem['condition']>('excellent');
  const [formNotes, setFormNotes] = useState('');

  const toggleWishlist = (id: string) => {
    triggerHaptic('light');
    setWishlistItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showNotificationToast = (msg: string) => {
    setCartToast(msg);
    setTimeout(() => setCartToast(null), 3000);
  };

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('inv-search-input')?.focus();
      } else if (e.key === 'n' || e.key === '+') {
        e.preventDefault();
        setShowAddModal(true);
      } else if (e.key === 'i') {
        e.preventDefault();
        document.getElementById('ai-nl-input')?.focus();
      } else if (e.key === 'v') {
        setInventoryFilter((prev) => (prev === 'all' ? 'owned' : 'all'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Décompte de départ
  const daysUntilDeparture = useMemo(() => {
    if (!activeHike?.targetDate) return null;
    const target = new Date(activeHike.targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [activeHike]);

  // Plan de départ
  const departurePlan = useMemo(() => {
    const defaultHikeContext = {
      name: 'Tour du Beaufortain',
      distanceKm: 72,
      elevationGain: 3850,
      elevationLoss: 3850,
      difficulty: 'Difficile',
      season: 'Été',
      terrain: 'Haute Montagne',
      hasWaterPoints: true,
      waterPointsCount: 4,
      hasRefuges: true,
      isOvernight: true,
      nightsCount: 3,
      startDate: '2026-08-20',
      weather: {
        tempC: 18,
        precipitationProbability: 0.25,
        windKmH: 18,
        uvIndex: 6,
        condition: 'Partiellement nuageux',
        isAlert: false,
      },
    };

    const hikeCtx = activeHike
      ? {
          id: activeHike.id,
          name: activeHike.name,
          distanceKm: activeHike.distanceKm || 20,
          elevationGain: activeHike.elevationGain || 800,
          elevationLoss: activeHike.elevationLoss || 800,
          difficulty: activeHike.difficulty || 'Moyen',
          season: activeHike.season || 'Été',
          terrain: activeHike.terrain || 'Sentier Montagne',
          hasWaterPoints: activeHike.hasWaterPoints ?? true,
          waterPointsCount: activeHike.waterPointsCount ?? 2,
          hasRefuges: activeHike.hasRefuges ?? false,
          isOvernight: activeHike.isOvernight ?? false,
          nightsCount: activeHike.nightsCount ?? 0,
          startDate: activeHike.targetDate,
          weather: activeHike.weather || defaultHikeContext.weather,
        }
      : defaultHikeContext;

    const availableKits = selectedKitForDeparture
      ? [selectedKitForDeparture, ...kits.filter((k) => k.id !== selectedKitForDeparture.id)]
      : kits;

    return resolveDeparturePlan(hikeCtx, availableKits, equipment);
  }, [activeHike, selectedKitForDeparture, kits, equipment]);

  // Répartition des poids
  const weightDistribution = useMemo(() => {
    const categoryWeights: Record<string, number> = {};
    equipment.forEach((item) => {
      const cat = item.category || 'Divers';
      categoryWeights[cat] = (categoryWeights[cat] || 0) + (item.weight_g || 0);
    });

    const totalWeight = equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);
    if (totalWeight === 0) return [];

    const colors: Record<string, string> = {
      'Couchage & Tentes': '#5A8DBF',
      'Couchage': '#5A8DBF',
      'Sacs & Portage': '#17402C',
      'Portage': '#17402C',
      'Vêtements & Vestes': '#E4C695',
      'Vêtements': '#E4C695',
      'Chaussures': '#8B7355',
      'Cuisine & Réchauds': '#6BAA55',
      'Cuisine': '#6BAA55',
      'Eau & Filtres': '#60A5FA',
      'Hydratation': '#60A5FA',
      'Navigation': '#D97706',
      'Sécurité & Soins': '#C0532E',
      'Sécurité': '#C0532E',
      'Éclairage': '#FBBF24',
      'Bivouac & Abris': '#78716C',
      'Bivouac': '#78716C',
      'Accessoires': '#6B7770',
      'Divers': '#6B7770',
    };

    return Object.entries(categoryWeights).map(([key, weight]) => ({
      key,
      label: key,
      weight,
      pct: Math.round((weight / totalWeight) * 100),
      color: colors[key] || '#17402C',
    }));
  }, [equipment]);

  const totalWeightG = useMemo(() => {
    return equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);
  }, [equipment]);

  const handleSelectPlannedHike = (hike: PlannedHike) => {
    triggerHaptic('selection');
    setActiveHike(hike);
    setActivePlannedHikeId(hike.id);
    setCheckedDepartureItems(new Set());
    setDepartureCompleted(false);
    showNotificationToast(`Sortie active : ${hike.name.split('—')[0]}`);
  };

  const handleToggleDepartureItem = (itemId: string) => {
    triggerHaptic('light');
    setCheckedDepartureItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleValidateDeparture = async () => {
    triggerHaptic('heavy');
    const usedGearIds = departurePlan.checklist.inPackReady
      .map((i) => i.ownedGearId)
      .filter(Boolean) as string[];

    await recordPostHikeGearUsage(usedGearIds);
    setDepartureCompleted(true);
    showNotificationToast('🚀 Sac verrouillé · bon voyage !');
  };

  const handleAddToCart = (product: any) => {
    triggerHaptic('selection');
    addToCart({
      id: product.id,
      slug: product.slug || product.id,
      name: product.name,
      brand: product.brand || 'LKDV',
      priceEur: product.price_eur || product.priceEur || 29,
      weightG: product.weight_g || product.weightG || 120,
      image: product.image || '/assets/images/no_image.png',
      imageAlt: product.name,
      category: product.category || 'Matériel',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    showNotificationToast(`🛒 « ${product.name} » ajouté au panier`);
  };

  const handleQuickAddProductToInventory = async (product: any) => {
    triggerHaptic('selection');
    await addToEquipment(product, {
      source: 'catalogue',
      condition: 'bon',
    });
    showNotificationToast(`✓ « ${product.name} » ajouté à votre inventaire`);
  };

  const handleGeneratePreset = async (preset: (typeof AI_PRESETS)[0]) => {
    triggerHaptic('selection');
    setIsAiGenerating(true);

    const mappedGear = preset.items.map((pi) => {
      const owned = equipment.find(
        (ue) =>
          ue.name.toLowerCase().includes(pi.name.toLowerCase().split(' ')[0]) ||
          (ue.category && ue.category.toLowerCase() === pi.cat.toLowerCase())
      );
      return {
        item_name: owned ? owned.name : pi.name,
        category: owned ? owned.category : pi.cat,
        weight_g: owned && owned.weight_g ? owned.weight_g : pi.weight,
      };
    });

    const newKit = await createKit({
      name: `${preset.title} ${preset.titleEm}`,
      description: `Généré automatiquement par l'IA (${preset.desc})`,
      for_destination: preset.destination,
      season: preset.season,
      activity: preset.activity,
      source: 'configurator',
      gearItems: mappedGear,
    });

    if (newKit) setSelectedKitForDeparture(newKit);
    setIsAiGenerating(false);
    showNotificationToast(`🤖 Kit « ${preset.title} ${preset.titleEm} » créé`);
  };

  const handleGenerateNL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    triggerHaptic('selection');
    setIsAiGenerating(true);
    const title = aiPrompt.trim().slice(0, 28);

    const mappedGear = equipment.slice(0, 8).map((ue) => ({
      item_name: ue.name,
      category: ue.category,
      weight_g: ue.weight_g || 0,
    }));

    if (mappedGear.length === 0) {
      AI_PRESETS[0].items.forEach((pi) => {
        mappedGear.push({
          item_name: pi.name,
          category: pi.cat,
          weight_g: pi.weight,
        });
      });
    }

    const newKit = await createKit({
      name: `Kit IA — ${title}`,
      description: `Généré pour : « ${aiPrompt.trim()} »`,
      for_destination: 'Aventure personnalisée',
      season: '4-saisons',
      activity: 'Randonnée',
      source: 'configurator',
      gearItems: mappedGear,
    });

    if (newKit) setSelectedKitForDeparture(newKit);
    setAiPrompt('');
    setIsAiGenerating(false);
    showNotificationToast(`🤖 Kit « ${title} » généré`);
  };

  const handleOpenDetail = (item: UserEquipmentItem) => {
    triggerHaptic('selection');
    setSelectedGearItem(item);
    setIsDrawerOpen(true);
  };

  const handleOpenKitCockpit = (kit: CustomKit) => {
    triggerHaptic('selection');
    setCockpitKit(kit);
    setIsKitCockpitOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingItem) {
      await updateEquipment(editingItem.id, {
        name: formName.trim(),
        brand: formBrand.trim(),
        category: formCategory,
        weight_g: formWeight ? parseInt(formWeight) : 0,
        price_eur: formPrice ? parseFloat(formPrice) : undefined,
        condition: formCondition,
        notes: formNotes.trim(),
      });
      showNotificationToast(`« ${formName} » mis à jour`);
    } else {
      await addToEquipment(
        {
          id: crypto.randomUUID(),
          name: formName.trim(),
          brand: formBrand.trim(),
          category: formCategory,
          weight_g: formWeight ? parseInt(formWeight) : 0,
          price_eur: formPrice ? parseFloat(formPrice) : 0,
          image: '/assets/images/no_image.png',
        },
        {
          condition: formCondition,
          notes: formNotes.trim(),
          source: 'manuel',
        }
      );
      showNotificationToast(`✓ « ${formName} » ajouté à votre inventaire`);
    }

    setShowAddModal(false);
    setEditingItem(null);
    setFormName('');
    setFormBrand('');
    setFormWeight('');
    setFormPrice('');
    setFormNotes('');
  };

  const filteredKits = useMemo(() => {
    if (kitFilter === 'all') return kits.filter((k) => k.status === 'active');
    if (kitFilter === 'ia') return kits.filter((k) => k.status === 'active' && k.source === 'configurator');
    if (kitFilter === 'manuel') return kits.filter((k) => k.status === 'active' && k.source === 'manuel');
    if (kitFilter === 'auto') return kits.filter((k) => k.status === 'active' && k.source === 'auto_prepared');
    return kits.filter((k) => k.status === 'active');
  }, [kits, kitFilter]);

  const categoriesWithItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    return EQUIPMENT_CATEGORIES.map((catDef) => {
      const ownedItems = equipment.filter((e) => {
        const matchesCategory =
          e.category.toLowerCase() === catDef.key.toLowerCase() ||
          e.category.toLowerCase().includes(catDef.key.toLowerCase()) ||
          catDef.label.toLowerCase().includes(e.category.toLowerCase());
        const matchesSearch = !q || e.name.toLowerCase().includes(q) || (e.brand && e.brand.toLowerCase().includes(q));
        return matchesCategory && matchesSearch;
      });

      const catalogItems = (products || [])
        .filter((p) => {
          const matchesCategory =
            p.category.toLowerCase() === catDef.key.toLowerCase() ||
            p.category.toLowerCase().includes(catDef.key.toLowerCase()) ||
            catDef.label.toLowerCase().includes(p.category.toLowerCase());
          const notOwned = !equipment.some((e) => e.product_id === p.id || e.name.toLowerCase() === p.name.toLowerCase());
          const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
          return matchesCategory && notOwned && matchesSearch;
        })
        .slice(0, 4);

      const itemsToShow = inventoryFilter === 'owned' ? ownedItems : [...ownedItems, ...catalogItems];
      const categoryWeight = ownedItems.reduce((s, i) => s + (i.weight_g || 0), 0);

      return {
        ...catDef,
        items: itemsToShow,
        ownedCount: ownedItems.length,
        catalogCount: catalogItems.length,
        categoryWeight,
      };
    }).filter((c) => c.items.length > 0);
  }, [equipment, products, search, inventoryFilter]);

  return (
    <div className="min-h-screen bg-[#FBFAF6] text-[#0B1F17] font-sans selection:bg-[#E4EEDF] selection:text-[#17402C]">
      <Header />

      <div className="max-w-[1200px] mx-auto pt-20 pb-16 px-4 sm:px-6 lg:px-8">

        {/* ── BREADCRUMB ── */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#6B7770] tracking-wider mb-2">
          <Link href="/compte" className="hover:text-[#17402C] transition-colors">Compte</Link>
          <span className="text-[#C4CAC5]">/</span>
          <span className="text-[#0B1F17] font-medium">Mon matériel</span>
        </div>

        {/* ── EN-TÊTE ÉPURÉ ── */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-5 border-b border-black/[0.04] mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-[#0B1F17] leading-tight">
              Mon <em className="font-serif-lkv italic text-[#17402C] font-normal">matériel</em>, votre cockpit.
            </h1>
            <p className="font-serif-lkv italic text-xs sm:text-sm text-[#6B7770] mt-0.5">
              Le sac, le kit, le départ, l'inventaire réuni en un seul espace clair.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="lkv-btn lkv-btn-ghost lkv-btn-sm text-xs py-1.5 px-3"
            >
              <span>+ Ajouter</span>
              <span className="kbd text-[10px] min-w-[16px] h-4">n</span>
            </button>
            <Link
              href="/preparer-randonnee"
              className="lkv-btn lkv-btn-primary lkv-btn-sm text-xs py-1.5 px-3.5 shadow-2xs"
            >
              <span>Préparer sortie</span>
              <span>➔</span>
            </Link>
          </div>
        </header>

        {/* ── SECTION 1 : CONFIGURATEUR IA COMPACT & ÉLÉGANT ── */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1F17] via-[#17402C] to-[#1F5C3E] text-white p-5 sm:p-6 shadow-md border border-white/10 mb-6">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 rounded-full text-[10px] font-mono tracking-widest uppercase text-[#9ECB8A] mb-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6BAA55] animate-pulse-lkv" />
                  Configurateur IA · 1-Tap
                </div>
                <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-white leading-snug">
                  Composer un sac en <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">une phrase.</em>
                </h2>
              </div>
              <div className="text-right hidden sm:block shrink-0">
                <div className="font-serif-lkv italic text-lg text-[#9ECB8A]">« Zéro effort. »</div>
                <div className="text-[10px] font-mono uppercase text-white/50">1 tap · 3 secondes</div>
              </div>
            </div>

            {/* 4 Presets compacts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {AI_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleGeneratePreset(preset)}
                  disabled={isAiGenerating}
                  className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/12 border border-white/10 hover:border-white/20 transition-all text-left group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <span className="text-lg block mb-1">{preset.emoji}</span>
                    <div className="text-xs font-semibold text-white truncate">
                      {preset.title} <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">{preset.titleEm}</em>
                    </div>
                    <div className="text-[11px] text-white/60 truncate mt-0.5">{preset.desc}</div>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-[#9ECB8A]">
                    <span>~ {preset.weightStr}</span>
                    <span>{preset.piecesCount} pcs</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Saisie Langage Naturel */}
            <form onSubmit={handleGenerateNL} className="flex gap-2 items-center p-1.5 bg-white/[0.08] border border-white/15 rounded-full">
              <span className="pl-3 text-xs text-[#9ECB8A]">✨</span>
              <input
                type="text"
                id="ai-nl-input"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex : Tour du Beaufortain en 4 jours en autonomie fin août…"
                className="bg-transparent border-none outline-none text-white text-xs sm:text-sm font-serif-lkv italic placeholder:text-white/45 flex-1"
              />
              <button
                type="submit"
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="px-4 py-1.5 rounded-full bg-white text-[#0B1F17] font-semibold text-xs hover:bg-[#F5F3EC] transition-all shrink-0 disabled:opacity-40"
              >
                Composer ➔
              </button>
            </form>
          </div>
        </section>

        {/* ── SECTION 2 : POIDS DU SAC COMPACT ── */}
        <section className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-black/[0.04] grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center mb-6">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770] block">Poids total</span>
            <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[#0B1F17] leading-none">
              {formatWeight(totalWeightG).split(' ')[0]}
              <em className="font-serif-lkv italic text-[#17402C] text-xl ml-1 font-normal">
                {formatWeight(totalWeightG).split(' ')[1] || 'kg'}
              </em>
            </div>
            <div className="font-mono text-[11px] text-[#6B7770]">
              {equipment.length} articles possédés
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            {/* Barre 8px */}
            <div className="w-full h-2.5 bg-[#F5F3EC] rounded-full overflow-hidden flex border border-black/[0.04]">
              {weightDistribution.map((seg) => (
                <div
                  key={seg.key}
                  style={{ width: `${Math.max(seg.pct, 3)}%`, backgroundColor: seg.color }}
                  className="h-full hover:brightness-105 transition-all"
                  title={`${seg.label}: ${formatWeight(seg.weight)} (${seg.pct}%)`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6B7770]">
              {weightDistribution.slice(0, 5).map((seg) => (
                <div key={seg.key} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span>{seg.label}</span>
                  <strong className="text-[#0B1F17] font-mono text-[10px]">{formatWeight(seg.weight)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center md:flex-col md:items-end justify-between gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-black/[0.04]">
            <span className="lkv-chip bg-[#E4EEDF] text-[#17402C] text-[10px] py-0.5 px-2">{kits.length} kits actifs</span>
            <span className="lkv-chip bg-[#E4C695] text-[#0B1F17] text-[10px] py-0.5 px-2">1 sortie active</span>
          </div>
        </section>

        {/* ── SECTION 3 : DÉPART & RANDONNÉE ACTIVE MINIMALISTE ── */}
        <section className="space-y-3 mb-8">
          <div className="flex justify-between items-baseline">
            <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#0B1F17]">
              Départ & randonnée <em className="font-serif-lkv italic text-[#17402C] font-normal">active</em>
            </h3>
            <Link href="/aventures" className="text-xs text-[#6B7770] hover:text-[#17402C] transition-colors">
              Toutes mes sorties ➔
            </Link>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-2xs border border-black/[0.04]">
            {/* Alerte livraison */}
            {daysUntilDeparture !== null && daysUntilDeparture <= 3 && (
              <div className="p-3 bg-[#FBE9E1] text-[#C0532E] border-b border-[#C0532E]/15 flex items-center justify-between gap-2 text-xs">
                <span>⚠️ <strong>Départ dans {daysUntilDeparture} jours :</strong> les commandes passées aujourd'hui risquent d'arriver après.</span>
                <Link href="/panier" className="px-2.5 py-1 rounded-full bg-[#C0532E] text-white text-[11px] font-semibold shrink-0">
                  Express 24h ➔
                </Link>
              </div>
            )}

            {/* Header départ */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0B1F17] to-[#17402C] text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-mono uppercase text-[#9ECB8A] mb-1">
                  <span className="w-1 h-1 rounded-full bg-[#6BAA55] animate-pulse-lkv" />
                  Prochain départ
                </div>
                <h4 className="text-xl sm:text-2xl font-medium text-white">
                  {activeHike?.name.split('—')[0] || 'Tour du Beaufortain'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-white/70 font-mono mt-0.5">
                  <span>📅 {formatDateFR(activeHike?.targetDate || '2026-08-20')}</span>
                  <span>·</span>
                  <span>{Number(departurePlan.hikeContext.distanceKm || 0).toFixed(1)} km</span>
                  <span>·</span>
                  <span>+{departurePlan.hikeContext.elevationGain}m D+</span>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="text-3xl font-medium text-white leading-none">
                  0{daysUntilDeparture ?? 3}<em className="font-serif-lkv italic text-[#9ECB8A] text-lg ml-0.5">j</em>
                </div>
                <div className="text-[9px] font-mono uppercase text-white/60">Compte à rebours</div>
              </div>
            </div>

            {/* Hike selector */}
            <div className="p-2.5 sm:px-4 bg-[#F5F3EC] border-b border-black/[0.04] flex items-center gap-2 overflow-x-auto text-xs">
              {plannedHikes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleSelectPlannedHike(h)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                    activeHike?.id === h.id
                      ? 'bg-[#17402C] text-white shadow-2xs'
                      : 'bg-white text-[#2A3A31] border border-black/10 hover:border-[#17402C]'
                  }`}
                >
                  <span>{h.name.split('—')[0].trim()}</span>
                  <span className={`text-[10px] font-mono ${activeHike?.id === h.id ? 'text-[#9ECB8A]' : 'text-[#6B7770]'}`}>
                    {h.targetDate.slice(5)}
                  </span>
                </button>
              ))}
            </div>

            {/* 3 Métriques compactes */}
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-black/[0.04]">
              {/* Kit tile */}
              <div
                onClick={() => {
                  if (departurePlan.selectedKit) handleOpenKitCockpit(departurePlan.selectedKit);
                }}
                className="p-3.5 rounded-xl bg-[#F5F3EC] border border-black/[0.04] hover:border-[#17402C]/30 transition-all cursor-pointer group flex justify-between items-center"
              >
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770]">Kit & Préparation</div>
                  <div className="text-sm font-semibold text-[#0B1F17] group-hover:text-[#17402C] transition-colors mt-0.5">
                    {departurePlan.selectedKit?.name || 'Trek montagne 3j'}
                  </div>
                  <div className="text-[11px] text-[#6B7770]">
                    Prêt à <strong className="text-[#17402C]">{departurePlan.suitabilityScore}%</strong>
                  </div>
                </div>
                <span className="text-base group-hover:translate-x-0.5 transition-transform text-[#17402C]">➔</span>
              </div>

              {/* Poids tile */}
              <div className="p-3.5 rounded-xl bg-[#F5F3EC] border border-black/[0.04]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770]">Poids estimé</div>
                <div className="text-sm font-semibold text-[#0B1F17] mt-0.5">
                  {formatWeight(departurePlan.totalPackWeightG)}
                </div>
                <div className="text-[11px] text-[#6B7770] font-mono">
                  Eau {departurePlan.consumables.waterLiters}L · Vivres 1kg · Gaz 0.3kg
                </div>
              </div>

              {/* Météo tile */}
              <div className="p-3.5 rounded-xl bg-[#F5F3EC] border border-black/[0.04] flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770]">Météo parcours</div>
                  <div className="text-sm font-semibold text-[#0B1F17] mt-0.5">
                    {departurePlan.weatherSummary.tempMinMax}
                  </div>
                  <div className="text-[11px] text-[#6B7770]">
                    ☔ {departurePlan.weatherSummary.rainRiskPct}% · 💨 {departurePlan.weatherSummary.windKmh} km/h
                  </div>
                </div>
                <span className="text-xl">🌦️</span>
              </div>
            </div>

            {/* Checklist 4 zones épurées */}
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Zone 1 : Dans le sac */}
              <div className="p-3.5 rounded-xl bg-white border border-black/[0.04]">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-bold text-[#0B1F17]">🎒 Dans le sac & prêt ({departurePlan.checklist.inPackReady.length})</span>
                  <span className="font-mono text-[11px] text-[#17402C] font-semibold">{checkedDepartureItems.size}/{departurePlan.checklist.inPackReady.length}</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {departurePlan.checklist.inPackReady.map((item) => {
                    const isChecked = checkedDepartureItems.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleDepartureItem(item.id)}
                        className="flex items-center gap-2 py-1 border-b border-black/[0.03] last:border-none cursor-pointer text-xs"
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${
                          isChecked ? 'bg-[#17402C] border-[#17402C] text-white' : 'border-black/20'
                        }`}>
                          {isChecked && '✓'}
                        </div>
                        <span className={`flex-1 truncate ${isChecked ? 'line-through text-[#9AA39C]' : 'text-[#2A3A31]'}`}>
                          {item.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#6B7770]">{item.weightG}g</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zone 2 : Consommables */}
              <div className="p-3.5 rounded-xl bg-[#E4C695]/10 border border-[#E4C695]/30">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-bold text-[#0B1F17]">📦 Consommables IA ({departurePlan.checklist.consumablesToPack.length})</span>
                  <span className="font-mono text-[11px] text-[#17402C] font-semibold">2/4</span>
                </div>
                <div className="space-y-1">
                  {departurePlan.checklist.consumablesToPack.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-black/[0.03] last:border-none">
                      <span className="text-[#2A3A31] truncate">{item.name}</span>
                      <span className="font-mono text-[10px] text-[#6B7770]">{item.weightG}g</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zone 3 : Alertes */}
              <div className="p-3.5 rounded-xl bg-[#FBE9E1]/50 border border-[#C0532E]/15">
                <div className="text-xs font-bold text-[#0B1F17] mb-2">⚠️ Alertes sécurité</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="truncate"><strong>Lampe frontale</strong> · recharger</span>
                    <span className="text-[#C0532E] font-mono text-[10px]">⚡ 34%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="truncate"><strong>Réchaud</strong> · à récupérer chez Élise</span>
                    <span className="text-[#B08A4E] font-mono text-[10px]">🔄 Prêté</span>
                  </div>
                </div>
              </div>

              {/* Zone 4 : Suggestions */}
              <div className="p-3.5 rounded-xl bg-[#E4EEDF]/60 border border-[#17402C]/10">
                <div className="text-xs font-bold text-[#0B1F17] mb-2">✨ Suggestions de complétion</div>
                <div className="space-y-1.5">
                  {[
                    { name: 'Couverture survie renforcée', price: 14, weight: 90 },
                    { name: 'Sifflet 120dB', price: 8, weight: 12 },
                  ].map((sugg, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white/80 p-1.5 rounded-lg">
                      <span className="truncate pr-2">{sugg.name}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleQuickAddProductToInventory(sugg)}
                          className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white border border-black/10"
                        >
                          + J'ai
                        </button>
                        <button
                          onClick={() => handleAddToCart({ ...sugg, id: `sugg-${idx}` })}
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#17402C] text-white"
                        >
                          🛒 {sugg.price}€
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA Départ */}
            <div className="p-4 bg-[#F5F3EC] border-t border-black/[0.04] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-mono text-[#6B7770]">
                <span>Prêt: <strong className="text-[#17402C]">{departurePlan.suitabilityScore}%</strong></span>
                <span>Poids: <strong className="text-[#0B1F17]">{formatWeight(departurePlan.totalPackWeightG)}</strong></span>
                <span>Autonomie: <strong>4j</strong></span>
              </div>
              <button
                disabled={departureCompleted}
                onClick={handleValidateDeparture}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#17402C] hover:bg-[#0B1F17] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>{departureCompleted ? '✓ Sac validé' : '🚀 Valider mon sac & partir'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION 4 : MES KITS INTELLIGENTS ÉPURÉS ── */}
        <section className="space-y-3 mb-8">
          <div className="flex justify-between items-baseline">
            <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#0B1F17]">
              Mes kits <em className="font-serif-lkv italic text-[#17402C] font-normal">intelligents</em>
            </h3>
            <div className="flex items-center gap-1.5">
              {(['all', 'ia', 'manuel'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setKitFilter(mode)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] capitalize font-medium transition-colors ${
                    kitFilter === mode ? 'bg-[#17402C] text-white' : 'text-[#6B7770] hover:text-[#0B1F17]'
                  }`}
                >
                  {mode === 'all' ? 'Tous' : mode === 'ia' ? 'IA' : 'Manuel'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredKits.map((kit) => (
              <div
                key={kit.id}
                onClick={() => handleOpenKitCockpit(kit)}
                className={`bg-white rounded-xl p-4 border transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between ${
                  kit.source === 'configurator'
                    ? 'border-[#9ECB8A] bg-gradient-to-b from-white to-[#E4EEDF]/20'
                    : 'border-black/[0.04]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-[#F5F3EC] text-[#17402C] font-semibold">
                      {kit.source === 'configurator' ? '🤖 IA' : '👤 Manuel'}
                    </span>
                    <span className="font-semibold text-[#0B1F17]">{formatWeight(kit.total_weight_g)}</span>
                  </div>
                  <div>
                    <h4 className="text-base font-medium text-[#0B1F17] leading-snug">{kit.name}</h4>
                    <p className="text-[11px] text-[#6B7770] line-clamp-1 mt-0.5">{kit.description}</p>
                  </div>
                  <div className="text-[11px] font-mono text-[#6B7770] pt-1 border-t border-black/[0.03] flex justify-between">
                    <span>{kit.items.length} pièces</span>
                    <span className="text-[#17402C] font-medium">Cockpit ➔</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5 : INVENTAIRE & MATÉRIEL PROPRE & MINIMALISTE ── */}
        <section className="space-y-4 mb-12">
          <div className="flex items-baseline justify-between pb-1">
            <h3 className="text-lg sm:text-xl font-medium tracking-tight text-[#0B1F17]">
              Inventaire & <em className="font-serif-lkv italic text-[#17402C] font-normal">matériel</em>
            </h3>
            <span className="text-xs text-[#6B7770] font-mono">{equipment.length} possédés</span>
          </div>

          {/* Controls Bar minimaliste */}
          <div className="p-2.5 bg-white rounded-xl border border-black/[0.04] shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="inline-flex gap-1 p-0.5 bg-[#F5F3EC] rounded-full text-xs shrink-0">
              <button
                onClick={() => setInventoryFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  inventoryFilter === 'all' ? 'bg-[#17402C] text-white' : 'text-[#6B7770]'
                }`}
              >
                Tout (98)
              </button>
              <button
                onClick={() => setInventoryFilter('owned')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  inventoryFilter === 'owned' ? 'bg-[#17402C] text-white' : 'text-[#6B7770]'
                }`}
              >
                Possédé ({equipment.length})
              </button>
            </div>

            <div className="flex-1 max-w-sm w-full">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F3EC] rounded-full text-xs">
                <span className="text-[#6B7770]">🔍</span>
                <input
                  type="text"
                  id="inv-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher équipement, marque..."
                  className="bg-transparent border-none outline-none text-xs text-[#0B1F17] w-full"
                />
                <span className="kbd text-[9px] min-w-[16px] h-3.5">/</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                  viewMode === 'grid' ? 'bg-[#17402C] text-white' : 'bg-[#F5F3EC] text-[#6B7770]'
                }`}
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                  viewMode === 'list' ? 'bg-[#17402C] text-white' : 'bg-[#F5F3EC] text-[#6B7770]'
                }`}
              >
                ≡
              </button>
            </div>
          </div>

          {/* Grille des Catégories */}
          <div className="space-y-6">
            {categoriesWithItems.map((cat) => (
              <div key={cat.key} className="space-y-2.5">
                <div className="flex items-baseline gap-2 pb-1.5 border-b border-black/[0.04]">
                  <span className="text-lg">{getCategoryIcon(cat.key)}</span>
                  <h4 className="text-base font-medium text-[#0B1F17]">{cat.label}</h4>
                  <span className="text-xs text-[#9AA39C] font-mono">({cat.ownedCount} possédés)</span>
                  <span className="ml-auto font-mono text-[11px] text-[#6B7770]">
                    {formatWeight(cat.categoryWeight)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {cat.items.map((item: any) => {
                    const owned = isOwned(item.id || item.product_id);
                    const isWish = wishlistItems.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (owned) handleOpenDetail(item);
                        }}
                        className={`rounded-xl overflow-hidden border transition-all hover:shadow-2xs flex flex-col justify-between ${
                          owned
                            ? 'border-[#9ECB8A]/60 bg-white cursor-pointer'
                            : 'border-black/[0.04] bg-white'
                        }`}
                      >
                        <div className="relative aspect-[4/3] bg-[#F5F3EC] flex items-center justify-center p-2">
                          {owned && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-[#17402C] text-white text-[9px] font-mono">
                              ✓
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(item.id);
                            }}
                            className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[10px] ${
                              isWish ? 'text-[#C0532E]' : 'text-[#6B7770]'
                            }`}
                          >
                            {isWish ? '♥' : '♡'}
                          </button>
                          <span className="text-2xl">{getCategoryIcon(item.category || cat.key)}</span>
                        </div>

                        <div className="p-2.5 flex flex-col justify-between flex-1 space-y-2">
                          <div>
                            <div className="text-[9px] font-mono uppercase text-[#6B7770] truncate">
                              {item.brand || 'LKDV'}
                            </div>
                            <h5 className="text-xs font-medium text-[#0B1F17] leading-snug line-clamp-1">
                              {item.name}
                            </h5>
                          </div>

                          <div className="space-y-1.5 pt-1 border-t border-black/[0.03]">
                            <div className="flex justify-between items-baseline font-mono text-[11px]">
                              <span className="text-[#6B7770]">{item.weight_g ? `${item.weight_g}g` : '—'}</span>
                              <span className="font-semibold text-[#0B1F17]">{item.price_eur ? `${item.price_eur}€` : '—'}</span>
                            </div>

                            {owned ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(item);
                                }}
                                className="w-full py-1 rounded-full bg-[#F5F3EC] hover:bg-[#EAE7DD] text-[#17402C] text-[10px] font-semibold transition-colors"
                              >
                                Fiche article ➔
                              </button>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAddProductToInventory(item);
                                  }}
                                  className="flex-1 py-1 rounded-full bg-[#F5F3EC] text-[#0B1F17] text-[10px] font-medium"
                                >
                                  + J'ai
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(item);
                                  }}
                                  className="flex-1 py-1 rounded-full bg-[#E4C695] text-[#0B1F17] text-[10px] font-bold"
                                >
                                  🛒 Acheter
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ÉPURÉ ── */}
        <footer className="p-6 bg-[#0B1F17] text-white/70 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-white font-medium">Le Kit du Voyageur</span> · Cockpit Matériel
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/50">
            <span>Raccourcis : <strong className="text-white">/</strong> cherche · <strong className="text-white">n</strong> ajout · <strong className="text-white">v</strong> vue</span>
          </div>
        </footer>

      </div>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {cartToast && (
          <motion.div
            initial={{ opacity: 0, y: 15, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 15, x: '-50%' }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[150] bg-[#0B1F17] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xl flex items-center gap-2 border border-white/10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#6BAA55] animate-pulse" />
            <span>{cartToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DRAWERS & MODALES ── */}
      <GearDetailDrawer
        isOpen={isDrawerOpen}
        item={selectedGearItem}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={(item) => {
          setEditingItem(item);
          setFormName(item.name);
          setFormBrand(item.brand || '');
          setFormCategory(item.category);
          setFormWeight(item.weight_g ? item.weight_g.toString() : '');
          setFormPrice(item.price_eur ? item.price_eur.toString() : '');
          setFormCondition(item.condition);
          setFormNotes(item.notes || '');
          setIsDrawerOpen(false);
          setShowAddModal(true);
        }}
        onDelete={async (id) => {
          await removeFromEquipment(id);
          await handleGearDeleted(id);
          setIsDrawerOpen(false);
          showNotificationToast('Équipement retiré');
        }}
        onUpdateNotes={async (gearId, notes) => {
          await updateEquipment(gearId, { notes });
        }}
        onLend={(item) => setLendingItem(item)}
        onToggleFavorite={async (id) => {
          if (!selectedGearItem) return;
          const nextFav = !selectedGearItem.is_favorite;
          await updateEquipment(id, { is_favorite: nextFav });
          setSelectedGearItem((prev) => (prev ? { ...prev, is_favorite: nextFav } : null));
        }}
      />

      <KitCockpitDrawer
        isOpen={isKitCockpitOpen}
        kit={cockpitKit}
        userEquipment={equipment}
        onClose={() => setIsKitCockpitOpen(false)}
        onSelectForDeparture={(kit) => {
          setSelectedKitForDeparture(kit);
          setCheckedDepartureItems(new Set());
          setDepartureCompleted(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          showNotificationToast(`Kit « ${kit.name} » chargé`);
        }}
        onUpdateKit={async (kitId, patch) => {
          await updateKit(kitId, patch);
          setCockpitKit((prev) => (prev && prev.id === kitId ? { ...prev, ...patch } : prev));
        }}
        onDeleteKit={async (kitId) => {
          await moveToTrash(kitId);
          setIsKitCockpitOpen(false);
          showNotificationToast('Kit déplacé dans la corbeille');
        }}
        onAddGearToInventory={async (product) => {
          await handleQuickAddProductToInventory(product);
        }}
        onAddToCart={(product) => {
          handleAddToCart(product);
        }}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-black/[0.06] space-y-3 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.04]">
              <h3 className="text-sm font-bold text-[#0B1F17]">
                {editingItem ? 'Modifier équipement' : 'Nouvel équipement'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-xs text-[#6B7770]">✕</button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#0B1F17] mb-0.5">Nom *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex : Veste 3 couches..."
                  className="w-full px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:border-[#17402C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B1F17] mb-0.5">Marque</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Ex : Arc'teryx"
                    className="w-full px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:border-[#17402C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B1F17] mb-0.5">Catégorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:border-[#17402C] focus:outline-none"
                  >
                    <option value="Sacs & Portage">Sacs & Portage</option>
                    <option value="Couchage & Tentes">Couchage & Tentes</option>
                    <option value="Vêtements & Vestes">Vêtements & Vestes</option>
                    <option value="Chaussures">Chaussures</option>
                    <option value="Cuisine & Réchauds">Cuisine & Réchauds</option>
                    <option value="Eau & Filtres">Eau & Filtres</option>
                    <option value="Navigation">Navigation</option>
                    <option value="Sécurité & Soins">Sécurité & Soins</option>
                    <option value="Éclairage">Éclairage</option>
                    <option value="Bivouac & Abris">Bivouac & Abris</option>
                    <option value="Accessoires">Accessoires</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B1F17] mb-0.5">Poids (g)</label>
                  <input
                    type="number"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    placeholder="Ex : 380"
                    className="w-full px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:border-[#17402C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#0B1F17] mb-0.5">Prix (€)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex : 120"
                    className="w-full px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:border-[#17402C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-full border border-black/15 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-full bg-[#17402C] text-white text-xs font-bold"
                >
                  {editingItem ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lendingItem && (
        <LendItemModal
          item={lendingItem}
          isOpen={Boolean(lendingItem)}
          onClose={() => setLendingItem(null)}
          onSave={async (lendData) => {
            await updateEquipment(lendingItem.id, lendData);
            setLendingItem(null);
            showNotificationToast(`Prêt enregistré`);
          }}
        />
      )}
    </div>
  );
}
