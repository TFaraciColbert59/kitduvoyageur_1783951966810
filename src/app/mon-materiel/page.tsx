'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// 4 Presets 1-Tap ultra-optimisés
const AI_PRESETS = [
  {
    id: 'trek',
    emoji: '🏔️',
    title: 'Trek montagne',
    titleEm: '3 jours',
    desc: 'Bivouac & D+ · autonomie complète',
    weightG: 9400,
    weightStr: '~ 9,4 kg',
    piecesCount: 32,
    season: 'Été',
    activity: 'Trek Alpin',
    destination: 'Massif Alpin',
    items: [
      { name: 'Sac à dos 45L toile cirée', cat: 'Portage', weight: 1240 },
      { name: 'Duvet 3 saisons −2°C', cat: 'Couchage', weight: 890 },
      { name: 'Tente Trek 1p double toit', cat: 'Couchage', weight: 1320 },
      { name: 'Matelas mousse Z-Lite', cat: 'Couchage', weight: 380 },
      { name: 'Réchaud gaz + popote 750ml', cat: 'Cuisine', weight: 240 },
      { name: 'Veste 3 couches Gore-Tex', cat: 'Vêtements', weight: 380 },
      { name: 'Softshell coupe-vent', cat: 'Vêtements', weight: 320 },
      { name: 'Bâtons carbone pliables', cat: 'Portage', weight: 420 },
      { name: 'Gourde titane 1L', cat: 'Hydratation', weight: 120 },
      { name: 'Filtre Sawyer Mini', cat: 'Hydratation', weight: 60 },
      { name: 'Lampe frontale 350 lm', cat: 'Éclairage', weight: 82 },
      { name: 'Trousse secours vérifiée', cat: 'Sécurité', weight: 150 },
    ],
  },
  {
    id: 'day',
    emoji: '☀️',
    title: 'Journée',
    titleEm: 'estivale',
    desc: 'Léger 15–25 km · sans bivouac',
    weightG: 3200,
    weightStr: '~ 3,2 kg',
    piecesCount: 14,
    season: 'Été',
    activity: 'Randonnée Journée',
    destination: 'Moyenne Montagne',
    items: [
      { name: 'Sac 25L daypack', cat: 'Portage', weight: 640 },
      { name: 'Poche 2L avec tuyau', cat: 'Hydratation', weight: 140 },
      { name: 'Veste coupe-vent déperlante', cat: 'Vêtements', weight: 180 },
      { name: 'Casquette & Lunettes cat.3', cat: 'Vêtements', weight: 95 },
      { name: 'Crème solaire & Répulsif', cat: 'Sécurité', weight: 120 },
      { name: 'Couverture de survie renforcée', cat: 'Sécurité', weight: 90 },
      { name: 'Bâtons carbone pliables', cat: 'Portage', weight: 420 },
    ],
  },
  {
    id: 'bivouac',
    emoji: '🌲',
    title: 'Bivouac forêt',
    titleEm: '2 jours',
    desc: 'Tente/tarp · bushcraft léger',
    weightG: 7800,
    weightStr: '~ 7,8 kg',
    piecesCount: 26,
    season: 'Printemps/Automne',
    activity: 'Bivouac Forêt',
    destination: 'Forêt & Massifs',
    items: [
      { name: 'Sac 40L robuste', cat: 'Portage', weight: 1100 },
      { name: 'Tarp 3×3m sylnylon', cat: 'Couchage', weight: 480 },
      { name: 'Duvet 3 saisons −2°C', cat: 'Couchage', weight: 890 },
      { name: 'Matelas mousse Z-Lite', cat: 'Couchage', weight: 380 },
      { name: 'Couteau Opinel N°8', cat: 'Accessoires', weight: 42 },
      { name: 'Popote titane 750ml', cat: 'Cuisine', weight: 155 },
      { name: 'Réchaud gaz pliable', cat: 'Cuisine', weight: 85 },
      { name: 'Filtre Sawyer Mini', cat: 'Hydratation', weight: 60 },
      { name: 'Doudoune duvet 850 fill', cat: 'Vêtements', weight: 240 },
      { name: 'Lampe frontale 350 lm', cat: 'Éclairage', weight: 82 },
    ],
  },
  {
    id: 'ul',
    emoji: '⚡',
    title: 'Ultra-Light',
    titleEm: '48 h',
    desc: 'Fastpacking · base < 4 kg',
    weightG: 3700,
    weightStr: '~ 3,7 kg',
    piecesCount: 18,
    season: 'Été',
    activity: 'Fastpacking',
    destination: 'Sentiers Techniques',
    items: [
      { name: 'Sac 12L fastpacking', cat: 'Portage', weight: 320 },
      { name: 'Tarp 3×3m sylnylon', cat: 'Couchage', weight: 480 },
      { name: 'Doudoune duvet 850 fill', cat: 'Vêtements', weight: 240 },
      { name: 'Pastilles Micropur × 100', cat: 'Hydratation', weight: 60 },
      { name: 'Mini-lampe USB-C', cat: 'Éclairage', weight: 28 },
      { name: 'Couverture de survie renforcée', cat: 'Sécurité', weight: 90 },
      { name: 'Couvert titane spork', cat: 'Cuisine', weight: 18 },
      { name: 'Sardines titane × 8', cat: 'Bivouac', weight: 72 },
    ],
  },
];

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();

  // 1. Équipement de l'utilisateur & Catalogue
  const {
    equipment,
    products,
    loading: equipmentLoading,
    totalPackWeight,
    isOwned,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  // 2. Kits Intelligents & Cycle de vie
  const {
    kits,
    trashKits,
    totalKitsCount,
    loading: kitsLoading,
    createKit,
    updateKit,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
    handleGearDeleted,
  } = useUserKits(equipment);

  // 3. Randonnées Planifiées enregistrées
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

  // Filtre unique Inventaire : 'all' (Tout) | 'owned' (Possédé)
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'owned'>('all');
  const [kitFilter, setKitFilter] = useState<'all' | 'ia' | 'manuel' | 'auto'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Drawer / Modales
  const [selectedGearItem, setSelectedGearItem] = useState<UserEquipmentItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cockpitKit, setCockpitKit] = useState<CustomKit | null>(null);
  const [isKitCockpitOpen, setIsKitCockpitOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);
  const [lendingItem, setLendingItem] = useState<UserEquipmentItem | null>(null);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [wishlistItems, setWishlistItems] = useState<Set<string>>(new Set(['w-1', 'w-3']));

  // NL AI input
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Formulaire d'ajout / édition manuelle de matériel
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('Couchage');
  const [formWeight, setFormWeight] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCondition, setFormCondition] = useState<UserEquipmentItem['condition']>('excellent');
  const [formNotes, setFormNotes] = useState('');

  // Wishlist toggle
  const toggleWishlist = (id: string) => {
    triggerHaptic('light');
    setWishlistItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toast Helper
  const showNotificationToast = (msg: string) => {
    setCartToast(msg);
    setTimeout(() => setCartToast(null), 3500);
  };

  // Raccourcis clavier globaux
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

  // Calcul du délai de départ pour l'alerte livraison anti-conflit
  const daysUntilDeparture = useMemo(() => {
    if (!activeHike?.targetDate) return null;
    const target = new Date(activeHike.targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [activeHike]);

  // Plan de départ intelligent calculé dynamiquement
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

  // Répartition des poids de l'inventaire
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

  // Total weight g
  const totalWeightG = useMemo(() => {
    return equipment.reduce((sum, item) => sum + (item.weight_g || 0), 0);
  }, [equipment]);

  // Switch de randonnée planifiée
  const handleSelectPlannedHike = (hike: PlannedHike) => {
    triggerHaptic('selection');
    setActiveHike(hike);
    setActivePlannedHikeId(hike.id);
    setCheckedDepartureItems(new Set());
    setDepartureCompleted(false);
    showNotificationToast(`Randonnée active : « ${hike.name} »`);
  };

  // Toggle élément checklist
  const handleToggleDepartureItem = (itemId: string) => {
    triggerHaptic('light');
    setCheckedDepartureItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Validation du sac avant départ
  const handleValidateDeparture = async () => {
    triggerHaptic('heavy');
    const usedGearIds = departurePlan.checklist.inPackReady
      .map((i) => i.ownedGearId)
      .filter(Boolean) as string[];

    await recordPostHikeGearUsage(usedGearIds);
    setDepartureCompleted(true);
    showNotificationToast('🚀 Sac verrouillé · usage matériel incrémenté · bonne route !');
  };

  // Ajout direct au panier
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
    showNotificationToast(`🛒 « ${product.name} » ajouté au panier — livraison sous 48 h`);
  };

  // Ajout rapide à l'équipement possédé
  const handleQuickAddProductToInventory = async (product: any) => {
    triggerHaptic('selection');
    await addToEquipment(product, {
      source: 'catalogue',
      condition: 'bon',
    });
    showNotificationToast(`✓ « ${product.name} » intégré à votre matériel possédé`);
  };

  // Génération Preset IA
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

    if (newKit) {
      setSelectedKitForDeparture(newKit);
    }
    setIsAiGenerating(false);
    showNotificationToast(`🤖 Kit « ${preset.title} ${preset.titleEm} » composé — ${preset.piecesCount} pièces ajoutées`);
  };

  // Génération sur mesure NL
  const handleGenerateNL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    triggerHaptic('selection');
    setIsAiGenerating(true);
    const title = aiPrompt.trim().slice(0, 32);

    const mappedGear = equipment.slice(0, 10).map((ue) => ({
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
      description: `Généré selon votre consigne : « ${aiPrompt.trim()} »`,
      for_destination: 'Aventure sur-mesure',
      season: '4-saisons',
      activity: 'Randonnée & Bivouac',
      source: 'configurator',
      gearItems: mappedGear,
    });

    if (newKit) {
      setSelectedKitForDeparture(newKit);
    }
    setAiPrompt('');
    setIsAiGenerating(false);
    showNotificationToast(`🤖 Kit « ${title} » généré et synchronisé avec votre sac`);
  };

  // Ouverture fiche détaillée
  const handleOpenDetail = (item: UserEquipmentItem) => {
    triggerHaptic('selection');
    setSelectedGearItem(item);
    setIsDrawerOpen(true);
  };

  // Ouverture cockpit de kit
  const handleOpenKitCockpit = (kit: CustomKit) => {
    triggerHaptic('selection');
    setCockpitKit(kit);
    setIsKitCockpitOpen(true);
  };

  // Sauvegarde ajout / édition équipement
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
      showNotificationToast(`Équipement « ${formName} » mis à jour`);
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

  // Filtrage des kits
  const filteredKits = useMemo(() => {
    if (kitFilter === 'all') return kits.filter((k) => k.status === 'active');
    if (kitFilter === 'ia') return kits.filter((k) => k.status === 'active' && k.source === 'configurator');
    if (kitFilter === 'manuel') return kits.filter((k) => k.status === 'active' && k.source === 'manuel');
    if (kitFilter === 'auto') return kits.filter((k) => k.status === 'active' && k.source === 'auto_prepared');
    return kits.filter((k) => k.status === 'active');
  }, [kits, kitFilter]);

  // Organisation de l'inventaire par catégories fidèles à Mon Materiel.html
  const categoriesWithItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    return EQUIPMENT_CATEGORIES.map((catDef) => {
      // Équipements possédés
      const ownedItems = equipment.filter((e) => {
        const matchesCategory =
          e.category.toLowerCase() === catDef.key.toLowerCase() ||
          e.category.toLowerCase().includes(catDef.key.toLowerCase()) ||
          catDef.label.toLowerCase().includes(e.category.toLowerCase());
        const matchesSearch = !q || e.name.toLowerCase().includes(q) || (e.brand && e.brand.toLowerCase().includes(q));
        return matchesCategory && matchesSearch;
      });

      // Produits catalogue non possédés
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
      {/* Header Sticky Global */}
      <Header />

      <div className="max-w-[1440px] mx-auto pt-24 pb-20 px-4 sm:px-8 lg:px-14">

        {/* ── BREADCRUMB ── */}
        <div className="flex items-center gap-2 text-xs text-[#6B7770] tracking-wider mb-3">
          <Link href="/compte" className="hover:text-[#17402C] transition-colors">Compte</Link>
          <span className="text-[#C4CAC5]">/</span>
          <span className="text-[#0B1F17] font-medium">Mon matériel</span>
          <span className="text-[#C4CAC5]">·</span>
          <span className="font-mono text-[11px] text-[#9AA39C]">/mon-materiel</span>
        </div>

        {/* ── EN-TÊTE DE PAGE (mm-header) ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8 border-b border-black/[0.06] mb-8">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#0B1F17] leading-[0.98]">
              Mon <em className="font-serif-lkv italic text-[#17402C] font-normal">matériel</em>,<br />
              votre cockpit.
            </h1>
            <p className="font-serif-lkv italic text-base sm:text-lg text-[#6B7770] max-w-xl mt-2 leading-relaxed">
              Tout est là. Le sac, le kit, le départ, l'inventaire. Une seule page — plus rien à chercher.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="lkv-btn lkv-btn-ghost lkv-btn-sm"
              title="Ajouter un équipement (Raccourci: n)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>Ajouter du matériel</span>
              <span className="kbd">n</span>
            </button>
            <Link
              href="/preparer-randonnee"
              className="lkv-btn lkv-btn-primary lkv-btn-sm shadow-sm"
            >
              <span>Préparer une randonnée</span>
              <span>➔</span>
            </Link>
          </div>
        </header>

        {/* ── SECTION 1 : CONFIGURATEUR IA HERO CARD (.ai-hero) ── */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B1F17] via-[#17402C] to-[#1F5C3E] text-white p-7 sm:p-10 shadow-lg border border-white/10 mb-8">
          {/* Halos lumineux */}
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#6BAA55] opacity-25 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-16 w-60 h-60 rounded-full bg-[#E4C695] opacity-15 blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-mono tracking-widest uppercase text-[#9ECB8A] mb-3 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6BAA55] animate-pulse-lkv" />
                  Outil N°1 · Configurateur IA — 1-Tap
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-medium tracking-tight leading-tight text-white">
                  Composer un sac en <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">une phrase.</em>
                </h2>
                <p className="text-sm sm:text-base text-white/75 mt-2 leading-relaxed">
                  L'IA sélectionne le matériel que vous possédez déjà, complète avec ce qui manque, calcule le poids net et injecte le kit dans votre inventaire — instantanément.
                </p>
              </div>

              <div className="lg:text-right shrink-0">
                <div className="font-serif-lkv italic text-2xl sm:text-3xl text-[#9ECB8A]">
                  « Zéro effort. »
                </div>
                <div className="text-[11px] tracking-widest uppercase text-white/50 mt-1 font-mono">
                  Un tap · Trois secondes
                </div>
              </div>
            </div>

            {/* 4 Presets 1-Tap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {AI_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleGeneratePreset(preset)}
                  disabled={isAiGenerating}
                  className="p-4 rounded-2xl bg-white/[0.06] hover:bg-white/10 border border-white/12 hover:border-white/25 transition-all text-left group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <span className="text-2xl block mb-1.5">{preset.emoji}</span>
                    <div className="text-sm font-semibold text-white">
                      {preset.title} <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">{preset.titleEm}</em>
                    </div>
                    <div className="text-xs text-white/60 mt-0.5 line-clamp-1">
                      {preset.desc}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2 font-mono text-[11px] text-[#9ECB8A]">
                    <span>{preset.weightStr}</span>
                    <span className="opacity-40">·</span>
                    <span>{preset.piecesCount} pièces</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Saisie Langage Naturel */}
            <form onSubmit={handleGenerateNL} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center p-2.5 sm:p-3 bg-white/[0.08] border border-white/15 rounded-full">
              <div className="w-8 h-8 rounded-full bg-[#6BAA55] text-[#05130C] flex items-center justify-center shrink-0 ml-1">
                ✨
              </div>
              <input
                type="text"
                id="ai-nl-input"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex : Tour du Beaufortain en 4 jours en autonomie fin août…"
                className="bg-transparent border-none outline-none text-white text-sm sm:text-base font-serif-lkv italic placeholder:text-white/45 w-full"
              />
              <button
                type="submit"
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0B1F17] font-semibold text-xs sm:text-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Composer</span>
                <span>➔</span>
              </button>
            </form>

            {/* Stats du bas */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-white/10 text-xs text-white/60">
              <div className="inline-flex items-center gap-2">
                <span className="text-[#9ECB8A]">✓</span>
                <span><strong className="text-white font-medium">247</strong> kits générés par l'IA <em className="font-serif-lkv italic text-[#9ECB8A]">cette semaine</em></span>
              </div>
              <div className="flex items-center gap-3">
                <span>Temps moyen · <strong className="text-white font-medium">2,4 s</strong></span>
                <span className="opacity-40">·</span>
                <span><strong className="text-white font-medium">98 %</strong> conservés au premier essai</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2 : HERO BANNER POIDS GLOBAL DU SAC (.mm-inventory-hero) ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/[0.06] grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-8 items-center mb-10">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#6B7770]">
              Poids total mesuré
            </span>
            <div className="text-5xl sm:text-6xl font-medium tracking-tight text-[#0B1F17] leading-none">
              {formatWeight(totalWeightG).split(' ')[0]}
              <em className="font-serif-lkv italic text-[#17402C] text-3xl ml-1 font-normal">
                {formatWeight(totalWeightG).split(' ')[1] || 'kg'}
              </em>
            </div>
            <div className="font-mono text-xs text-[#6B7770]">
              {totalWeightG} g · sur {equipment.length} articles possédés
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            {/* Barre segmentée */}
            <div className="w-full h-4 bg-[#F5F3EC] rounded-lg overflow-hidden flex border border-black/[0.06]">
              {weightDistribution.length > 0 ? (
                weightDistribution.map((seg) => (
                  <div
                    key={seg.key}
                    style={{ width: `${Math.max(seg.pct, 3)}%`, backgroundColor: seg.color }}
                    className="h-full transition-all hover:brightness-105"
                    title={`${seg.label}: ${formatWeight(seg.weight)} (${seg.pct}%)`}
                  />
                ))
              ) : (
                <div className="w-full h-full bg-[#E4EEDF]/40" />
              )}
            </div>

            {/* Légende */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#6B7770]">
              {weightDistribution.length > 0 ? (
                weightDistribution.map((seg) => (
                  <div key={seg.key} className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: seg.color }} />
                    <span>{seg.label}</span>
                    <strong className="text-[#0B1F17] font-mono text-[11px] font-medium">{formatWeight(seg.weight)}</strong>
                  </div>
                ))
              ) : (
                <span>Sac en attente de chargement · Ajoutez des équipements pour voir la répartition</span>
              )}
            </div>
          </div>

          <div className="lg:text-right shrink-0 flex flex-col lg:items-end gap-1 border-t lg:border-t-0 pt-4 lg:pt-0 border-black/[0.06]">
            <div className="text-3xl font-medium text-[#0B1F17] leading-none">
              {equipment.length}
              <em className="font-serif-lkv italic text-[#17402C] text-lg ml-1 font-normal">articles</em>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770]">
              Possédés · {weightDistribution.length} catégories
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="lkv-chip bg-[#E4EEDF] text-[#17402C]">{kits.length} kits actifs</span>
              <span className="lkv-chip bg-[#E4C695] text-[#0B1F17]">1 départ</span>
            </div>
          </div>
        </section>

        {/* ── SECTION 3 : DÉPART & RANDONNÉE ACTIVE (.departure-card) ── */}
        <section className="space-y-4 mb-12">
          <div className="flex justify-between items-baseline gap-4">
            <div className="flex items-baseline gap-3">
              <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0B1F17]">
                Départ & randonnée <em className="font-serif-lkv italic text-[#17402C] font-normal">active</em>
              </h3>
              <span className="font-serif-lkv italic text-sm text-[#9AA39C]">
                01 randonnée planifiée
              </span>
            </div>
            <Link
              href="/aventures"
              className="lkv-btn lkv-btn-ghost lkv-btn-sm"
            >
              <span>Voir toutes mes randonnées</span>
            </Link>
          </div>

          <div className="bg-white rounded-[28px] overflow-hidden shadow-xs border border-black/[0.06]">
            {/* Alerte Anti-Conflit Délais de Livraison */}
            {daysUntilDeparture !== null && daysUntilDeparture <= 3 && (
              <div className="p-3 sm:p-4 bg-[#FBE9E1] text-[#C0532E] border-b border-[#C0532E]/20 flex items-center justify-between gap-4 flex-wrap text-xs sm:text-sm font-medium">
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚠️</span>
                  <span>
                    <strong>Attention :</strong> départ dans <em className="font-serif-lkv italic font-normal">{daysUntilDeparture} jours</em>, les commandes passées aujourd'hui risquent d'arriver après votre départ (délai standard 48 h).
                  </span>
                </div>
                <Link
                  href="/panier"
                  className="px-3.5 py-1.5 rounded-full bg-[#C0532E] text-white text-xs font-semibold hover:bg-[#A04322] transition-colors"
                >
                  Livraison express 24 h ➔
                </Link>
              </div>
            )}

            {/* En-tête Départ vert gradient */}
            <div className="p-6 sm:p-8 bg-gradient-to-br from-[#0B1F17] to-[#17402C] text-white relative overflow-hidden">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-mono tracking-widest uppercase text-[#9ECB8A] mb-3 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6BAA55] animate-pulse-lkv" />
                ⚡ Prochain départ planifié
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h4 className="text-3xl sm:text-4xl font-medium tracking-tight text-white leading-tight">
                    {activeHike?.name.split('—')[0] || 'Tour du Beaufortain'}
                  </h4>
                  <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm text-white/75 mt-2 font-mono">
                    <span>📅 {formatDateFR(activeHike?.targetDate || '2026-08-20')}</span>
                    <span className="opacity-40">·</span>
                    <span>{departurePlan.hikeContext.nightsCount ? `${departurePlan.hikeContext.nightsCount + 1} jours` : 'Journée'}</span>
                    <span className="opacity-40">·</span>
                    <span>{Number(departurePlan.hikeContext.distanceKm || 0).toFixed(1)} km · +{departurePlan.hikeContext.elevationGain} m</span>
                    <span className="opacity-40">·</span>
                    <span>Autonomie complète</span>
                  </div>
                </div>

                <div className="md:text-right shrink-0">
                  <div className="text-4xl sm:text-5xl font-medium text-white tracking-tight leading-none">
                    0{daysUntilDeparture ?? 3}
                    <em className="font-serif-lkv italic text-[#9ECB8A] text-2xl font-normal ml-1">j</em>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mt-1">
                    Compte à rebours
                  </div>
                </div>
              </div>
            </div>

            {/* Sélecteur de Randonnées Planifiées */}
            <div className="p-4 sm:px-8 bg-[#F5F3EC] border-b border-black/[0.06] flex items-center gap-2.5 overflow-x-auto">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B7770] shrink-0 mr-2">
                Basculer
              </span>
              {plannedHikes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleSelectPlannedHike(h)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-2 ${
                    activeHike?.id === h.id
                      ? 'bg-[#17402C] text-white shadow-xs'
                      : 'bg-white text-[#2A3A31] border border-black/10 hover:border-[#17402C]'
                  }`}
                >
                  <span>{h.name.split('—')[0].trim()}</span>
                  <span className={`text-[11px] font-mono ${activeHike?.id === h.id ? 'text-[#9ECB8A]' : 'text-[#6B7770]'}`}>
                    {h.targetDate.slice(5)}
                  </span>
                </button>
              ))}
              <Link
                href="/preparer-randonnee"
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#17402C] border border-dashed border-[#17402C]/40 bg-white/60 hover:bg-white transition-colors shrink-0 flex items-center gap-1"
              >
                + Nouvelle randonnée
              </Link>
            </div>

            {/* 3 Cartes Métriques */}
            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-black/[0.06]">
              {/* Carte 1 : Kit & Préparation */}
              <div
                onClick={() => {
                  if (departurePlan.selectedKit) {
                    handleOpenKitCockpit(departurePlan.selectedKit);
                  }
                }}
                className="p-5 rounded-2xl bg-[#F5F3EC] border border-black/[0.06] flex flex-col justify-between hover:shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#6B7770]">
                  <span className="w-6 h-6 rounded-md bg-[#E4EEDF] text-[#17402C] flex items-center justify-center text-xs">🎒</span>
                  Kit & préparation
                </div>

                <div className="flex items-center gap-3 my-3">
                  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="#EAE7DD" strokeWidth="4" />
                      <circle
                        cx="22" cy="22" r="18" fill="none" stroke="#17402C" strokeWidth="4"
                        strokeDasharray={113}
                        strokeDashoffset={113 - (113 * departurePlan.suitabilityScore) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-mono font-bold text-[#17402C]">
                      {departurePlan.suitabilityScore}%
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-medium text-[#0B1F17] group-hover:text-[#17402C] transition-colors">
                      {departurePlan.selectedKit?.name || 'Trek montagne 3j'}
                    </div>
                    <div className="text-xs text-[#6B7770]">
                      Généré par l'IA · <strong className="text-[#17402C]">Prêt à {departurePlan.suitabilityScore}%</strong>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#17402C] font-semibold flex items-center justify-between">
                  <span>✓ {departurePlan.checklist.inPackReady.length} articles dans le sac</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">Gérer ➔</span>
                </div>
              </div>

              {/* Carte 2 : Poids Total Estimé */}
              <div className="p-5 rounded-2xl bg-[#F5F3EC] border border-black/[0.06] flex flex-col justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#6B7770]">
                  <span className="w-6 h-6 rounded-md bg-[#E4EEDF] text-[#17402C] flex items-center justify-center text-xs">⚖️</span>
                  Poids total estimé
                </div>

                <div className="my-2">
                  <div className="text-3xl font-medium text-[#0B1F17] tracking-tight">
                    {formatWeight(departurePlan.totalPackWeightG).split(' ')[0]}
                    <em className="font-serif-lkv italic text-[#17402C] text-lg ml-1 font-normal">
                      {formatWeight(departurePlan.totalPackWeightG).split(' ')[1] || 'kg'}
                    </em>
                  </div>
                  <p className="text-xs font-mono text-[#6B7770] mt-1">
                    Matériel <strong className="text-[#0B1F17]">{(totalWeightG/1000).toFixed(1)}</strong> + Eau <strong className="text-[#0B1F17]">{departurePlan.consumables.waterLiters}L</strong> + Vivres <strong className="text-[#0B1F17]">1,0</strong> + Gaz <strong className="text-[#0B1F17]">0,3</strong>
                  </p>
                </div>

                <div className="text-[11px] font-mono text-[#6B7770]">
                  {Number(departurePlan.hikeContext.distanceKm || 0).toFixed(1)} km · +{departurePlan.hikeContext.elevationGain}m D+
                </div>
              </div>

              {/* Carte 3 : Météo du Parcours */}
              <div className="p-5 rounded-2xl bg-[#F5F3EC] border border-black/[0.06] flex flex-col justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#6B7770]">
                  <span className="w-6 h-6 rounded-md bg-[#E4EEDF] text-[#17402C] flex items-center justify-center text-xs">🌦️</span>
                  Météo du parcours
                </div>

                <div className="my-2 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-2xl font-medium text-[#0B1F17]">
                      {departurePlan.weatherSummary.tempMinMax}
                    </div>
                    <div className="text-xs text-[#6B7770]">{departurePlan.weatherSummary.condition}</div>
                  </div>
                  <div className="text-right text-[11px] text-[#6B7770] space-y-0.5">
                    <div>☔ Pluie · {departurePlan.weatherSummary.rainRiskPct}%</div>
                    <div>💨 Vent · {departurePlan.weatherSummary.windKmh} km/h</div>
                  </div>
                </div>

                <div className="text-[11px] text-[#17402C] font-semibold">
                  {departurePlan.weatherSummary.advice}
                </div>
              </div>
            </div>

            {/* Checklist 4 Zones (.dep-checklist) */}
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ZONE 1 : Dans le sac & prêt */}
              <div className="p-5 rounded-2xl bg-white border border-black/[0.06]">
                <div className="flex justify-between items-baseline mb-3">
                  <h5 className="text-sm font-semibold text-[#0B1F17] flex items-center gap-2">
                    🎒 Dans le sac & prêt <span className="font-mono text-xs text-[#6B7770] font-normal">· {departurePlan.checklist.inPackReady.length} pièces</span>
                  </h5>
                  <span className="font-mono text-xs text-[#6B7770]">
                    <strong className="text-[#17402C]">{checkedDepartureItems.size}</strong>/{departurePlan.checklist.inPackReady.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {departurePlan.checklist.inPackReady.map((item) => {
                    const isChecked = checkedDepartureItems.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleDepartureItem(item.id)}
                        className={`flex items-center gap-3 py-2 border-b border-dashed border-black/[0.06] last:border-none cursor-pointer transition-all ${
                          isChecked ? 'opacity-50' : 'hover:opacity-85'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                          isChecked ? 'bg-[#17402C] border-[#17402C] text-white' : 'bg-white border-black/20'
                        }`}>
                          {isChecked && '✓'}
                        </div>
                        <div className={`flex-1 text-xs text-[#2A3A31] ${isChecked ? 'line-through' : ''}`}>
                          <strong className="font-semibold text-[#0B1F17]">{item.name.split('·')[0]}</strong>
                          {item.name.includes('·') && <span className="text-[#6B7770]"> · {item.name.split('·')[1]}</span>}
                        </div>
                        <span className="font-mono text-[11px] text-[#6B7770] shrink-0">{item.weightG} g</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ZONE 2 : Consommables à charger */}
              <div className="p-5 rounded-2xl bg-[#E4C695]/10 border border-[#E4C695]/40">
                <div className="flex justify-between items-baseline mb-3">
                  <h5 className="text-sm font-semibold text-[#0B1F17] flex items-center gap-2">
                    📦 Consommables à charger <span className="font-mono text-xs text-[#6B7770] font-normal">· estimation IA</span>
                  </h5>
                  <span className="font-mono text-xs text-[#6B7770]">
                    <strong className="text-[#17402C]">2</strong>/{departurePlan.checklist.consumablesToPack.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {departurePlan.checklist.consumablesToPack.map((item) => {
                    const isChecked = checkedDepartureItems.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleDepartureItem(item.id)}
                        className={`flex items-center gap-3 py-2 border-b border-dashed border-black/[0.06] last:border-none cursor-pointer transition-all ${
                          isChecked ? 'opacity-50' : 'hover:opacity-85'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                          isChecked ? 'bg-[#17402C] border-[#17402C] text-white' : 'bg-white border-black/20'
                        }`}>
                          {isChecked && '✓'}
                        </div>
                        <div className={`flex-1 text-xs text-[#2A3A31] ${isChecked ? 'line-through' : ''}`}>
                          <strong className="font-semibold text-[#0B1F17]">{item.name}</strong>
                        </div>
                        <span className="font-mono text-[11px] text-[#6B7770] shrink-0">{item.weightG} g</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ZONE 3 : Alertes sécurité & entretien */}
              <div className="p-5 rounded-2xl bg-[#FBE9E1]/60 border border-[#C0532E]/20">
                <div className="flex justify-between items-baseline mb-3">
                  <h5 className="text-sm font-semibold text-[#0B1F17] flex items-center gap-2">
                    ⚠️ Alertes sécurité & entretien
                  </h5>
                  <span className="font-mono text-xs text-[#C0532E]">
                    <strong>1</strong>/3
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#0B1F17] font-medium truncate"><strong>Lampe frontale</strong> · batterie à recharger</span>
                    <span className="text-[#C0532E] font-mono text-[11px] shrink-0">⚡ 34 %</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#0B1F17] font-medium truncate"><strong>Réchaud</strong> · prêté à Élise — <em>à récupérer</em></span>
                    <span className="text-[#B08A4E] font-mono text-[11px] shrink-0">🔄 Prêté</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#0B1F17] font-medium truncate"><strong>Trousse secours</strong> · vérifiée</span>
                    <span className="text-[#17402C] font-mono text-[11px] shrink-0">✓ OK</span>
                  </div>
                </div>
              </div>

              {/* ZONE 4 : Suggestions de complétion */}
              <div className="p-5 rounded-2xl bg-[#E4EEDF] border border-transparent">
                <div className="flex justify-between items-baseline mb-3">
                  <h5 className="text-sm font-semibold text-[#0B1F17] flex items-center gap-2">
                    ✨ Suggestions de complétion
                  </h5>
                  <span className="text-xs font-bold text-[#17402C]">Essentiel</span>
                </div>

                <div className="space-y-2">
                  {[
                    { name: 'Couverture de survie renforcée', cat: 'Sécurité', price: 14, weight: 90 },
                    { name: 'Sifflet haute-puissance 120dB', cat: 'Sécurité', price: 8, weight: 12 },
                    { name: 'Bonnet mérinos thermique', cat: 'Vêtements', price: 24, weight: 45 },
                  ].map((sugg, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-white/70 p-2.5 rounded-xl">
                      <span className="text-[#0B1F17] font-medium truncate">{sugg.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleQuickAddProductToInventory(sugg)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white border border-black/10 text-[#0B1F17] hover:bg-[#F5F3EC]"
                        >
                          + J'ai déjà
                        </button>
                        <button
                          onClick={() => handleAddToCart({ ...sugg, id: `sugg-${idx}` })}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#17402C] text-white hover:bg-[#0B1F17]"
                        >
                          🛒 {sugg.price} €
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA Départ (.dep-cta) */}
            <div className="p-6 sm:px-8 bg-[#F5F3EC] border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770] block">Préparation</span>
                  <span className="text-lg font-medium text-[#0B1F17] font-sans">
                    {departurePlan.suitabilityScore} <em className="font-serif-lkv italic text-[#17402C] text-sm font-normal">%</em>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770] block">Poids total</span>
                  <span className="text-lg font-medium text-[#0B1F17] font-sans">
                    {formatWeight(departurePlan.totalPackWeightG).split(' ')[0]} <em className="font-serif-lkv italic text-[#17402C] text-sm font-normal">{formatWeight(departurePlan.totalPackWeightG).split(' ')[1] || 'kg'}</em>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770] block">Autonomie</span>
                  <span className="text-lg font-medium text-[#0B1F17] font-sans">
                    4 <em className="font-serif-lkv italic text-[#17402C] text-sm font-normal">jours</em>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7770] block">Livraisons</span>
                  <span className="text-lg font-medium text-[#0B1F17] font-sans">
                    0 <em className="font-serif-lkv italic text-[#17402C] text-sm font-normal">colis</em>
                  </span>
                </div>
              </div>

              <button
                disabled={departureCompleted}
                onClick={handleValidateDeparture}
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#17402C] hover:bg-[#0B1F17] text-white font-medium text-sm sm:text-base shadow-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>🚀</span>
                <span>{departureCompleted ? '✓ Sac validé & Sortie en cours' : 'Valider mon sac & partir'}</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION 4 : MES KITS INTELLIGENTS (.kits-grid) ── */}
        <section className="space-y-4 mb-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-4 pb-2">
            <div className="flex items-baseline gap-3">
              <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0B1F17]">
                Mes kits <em className="font-serif-lkv italic text-[#17402C] font-normal">intelligents</em>
              </h3>
              <span className="font-serif-lkv italic text-sm text-[#9AA39C]">
                {kits.length} kits actifs · {trashKits.length} corbeille
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex gap-1 p-1 bg-[#F5F3EC] rounded-full text-xs">
                {(['all', 'ia', 'manuel', 'auto'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setKitFilter(mode)}
                    className={`px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                      kitFilter === mode ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#6B7770] hover:text-[#0B1F17]'
                    }`}
                  >
                    {mode === 'all' ? 'Tous' : mode === 'ia' ? 'IA' : mode === 'auto' ? 'Auto' : 'Manuel'}
                  </button>
                ))}
              </div>

              {trashKits.length > 0 && (
                <button
                  onClick={() => showNotificationToast('Corbeille : rétention active 10 jours')}
                  className="lkv-btn lkv-btn-ghost lkv-btn-sm text-xs"
                >
                  🗑️ Corbeille · {trashKits.length}
                </button>
              )}

              <button
                onClick={() => {
                  triggerHaptic('selection');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="lkv-btn lkv-btn-primary lkv-btn-sm"
              >
                + Nouveau kit
              </button>
            </div>
          </div>

          {/* Grille des kits */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredKits.map((kit) => (
              <div
                key={kit.id}
                onClick={() => handleOpenKitCockpit(kit)}
                className={`bg-white rounded-[22px] p-6 border transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer flex flex-col justify-between relative group ${
                  kit.source === 'configurator'
                    ? 'border-[#9ECB8A] bg-gradient-to-b from-white to-[#E4EEDF]/40 before:absolute before:top-0 before:left-6 before:right-6 before:h-1 before:bg-gradient-to-r before:from-[#6BAA55] before:to-[#17402C] before:rounded-b-full'
                    : 'border-black/[0.06] shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold ${
                      kit.source === 'configurator'
                        ? 'bg-[#17402C] text-white'
                        : 'bg-[#F5F3EC] text-[#2A3A31]'
                    }`}>
                      {kit.source === 'configurator' ? '🤖 IA Configurator' : '👤 Manuel'}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#0B1F17]">
                      {formatWeight(kit.total_weight_g)}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xl font-medium text-[#0B1F17] group-hover:text-[#17402C] transition-colors leading-snug">
                      {kit.name}
                    </h4>
                    <p className="text-xs text-[#6B7770] mt-1 line-clamp-2 leading-relaxed">
                      {kit.description || `${kit.items.length} articles optimisés pour vos sorties.`}
                    </p>
                  </div>

                  {/* Stats bar */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-black/[0.06] text-xs">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770] block">Poids</span>
                      <span className="font-medium text-[#0B1F17]">{(kit.total_weight_g/1000).toFixed(1)} <em className="font-serif-lkv italic font-normal text-[11px]">kg</em></span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770] block">Pièces</span>
                      <span className="font-medium text-[#0B1F17]">{kit.items.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770] block">Créé</span>
                      <span className="font-medium text-[#0B1F17]">Actif</span>
                    </div>
                  </div>

                  {/* Preview 3 items */}
                  <div className="space-y-1.5 py-1">
                    {kit.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs text-[#2A3A31]">
                        <span className="truncate pr-2">• {item.item_name}</span>
                        <span className="font-mono text-[11px] text-[#6B7770] shrink-0">{item.weight_g} g</span>
                      </div>
                    ))}
                    {kit.items.length > 3 && (
                      <div className="text-[11px] text-[#17402C] font-medium pt-0.5">
                        + {kit.items.length - 3} autres pièces ➔
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-black/[0.06]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKitForDeparture(kit);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      showNotificationToast(`Kit « ${kit.name} » activé pour votre départ`);
                    }}
                    className="flex-1 py-2 px-3 rounded-full bg-[#17402C] hover:bg-[#0B1F17] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>⚡ Préparer une sortie</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenKitCockpit(kit);
                    }}
                    className="w-8 h-8 rounded-full bg-[#F5F3EC] hover:bg-[#EAE7DD] flex items-center justify-center text-xs text-[#2A3A31] transition-colors"
                    title="Éditer"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bannière Auto-Substitution */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F5F3EC] border border-dashed border-black/15 flex items-center justify-between gap-4 text-xs text-[#6B7770]">
            <div>
              <strong className="text-[#0B1F17] font-semibold">Auto-substitution active</strong> — si vous supprimez un équipement de votre inventaire, le système remplace silencieusement dans vos kits actifs par un équivalent disponible. Aucune interruption.
            </div>
            <button
              onClick={() => showNotificationToast('Règles d\'auto-substitution appliquées automatiquement')}
              className="lkv-btn lkv-btn-ghost lkv-btn-sm shrink-0"
            >
              Paramétrer ➔
            </button>
          </div>
        </section>

        {/* ── SECTION 5 : INVENTAIRE & MATÉRIEL PAR CATÉGORIES (.gear-grid) ── */}
        <section className="space-y-6 mb-16">
          <div className="flex items-baseline gap-3 pb-1">
            <h3 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#0B1F17]">
              Inventaire & <em className="font-serif-lkv italic text-[#17402C] font-normal">matériel</em>
            </h3>
            <span className="font-serif-lkv italic text-sm text-[#9AA39C]">
              Rangé par catégories · sous-totaux en direct
            </span>
          </div>

          {/* Controls Bar (.inv-controls) */}
          <div className="p-3 sm:px-5 bg-white rounded-2xl border border-black/[0.06] shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Toggle Tout / Possédé */}
            <div className="inline-flex gap-1 p-1 bg-[#F5F3EC] rounded-full text-xs shrink-0 self-start md:self-auto">
              <button
                onClick={() => setInventoryFilter('all')}
                className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                  inventoryFilter === 'all' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#6B7770] hover:text-[#0B1F17]'
                }`}
              >
                Tout <span className="font-mono text-[11px] opacity-70 ml-1">98</span>
              </button>
              <button
                onClick={() => setInventoryFilter('owned')}
                className={`px-4 py-1.5 rounded-full font-medium transition-all ${
                  inventoryFilter === 'owned' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#6B7770] hover:text-[#0B1F17]'
                }`}
              >
                Possédé <span className="font-mono text-[11px] opacity-70 ml-1">{equipment.length}</span>
              </button>
            </div>

            {/* Barre de Recherche */}
            <div className="relative flex-1 max-w-md w-full">
              <div className="flex items-center gap-2.5 px-4 py-2 bg-[#F5F3EC] rounded-full border border-transparent focus-within:border-[#17402C] focus-within:bg-white transition-all">
                <span className="text-[#6B7770]">🔍</span>
                <input
                  type="text"
                  id="inv-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un équipement, une marque, une catégorie…"
                  className="bg-transparent border-none outline-none text-xs sm:text-sm text-[#0B1F17] w-full"
                />
                <span className="kbd text-[10px]">/</span>
              </div>
            </div>

            {/* View toggles */}
            <div className="flex items-center gap-1.5 self-end md:self-auto shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors ${
                  viewMode === 'grid' ? 'bg-[#17402C] text-white' : 'bg-[#F5F3EC] text-[#6B7770]'
                }`}
                title="Vue grille"
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-colors ${
                  viewMode === 'list' ? 'bg-[#17402C] text-white' : 'bg-[#F5F3EC] text-[#6B7770]'
                }`}
                title="Vue liste"
              >
                ≡
              </button>
            </div>
          </div>

          {/* Blocs Catégories */}
          <div className="space-y-10">
            {categoriesWithItems.map((cat) => (
              <div key={cat.key} className="space-y-4">
                {/* Cat Header */}
                <div className="flex items-baseline gap-3 pb-3 border-b border-black/[0.06]">
                  <span className="text-2xl leading-none">{getCategoryIcon(cat.key)}</span>
                  <h4 className="text-xl sm:text-2xl font-medium text-[#0B1F17] tracking-tight">
                    {cat.label}
                  </h4>
                  <span className="font-serif-lkv italic text-sm text-[#9AA39C]">
                    0{cat.ownedCount} possédés · 0{cat.catalogCount} au catalogue
                  </span>
                  <span className="ml-auto font-mono text-xs text-[#6B7770]">
                    Sous-total · <strong className="text-[#17402C] font-semibold">{formatWeight(cat.categoryWeight)}</strong>
                  </span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cat.items.map((item: any) => {
                    const owned = isOwned(item.id || item.product_id);
                    const isWish = wishlistItems.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (owned) handleOpenDetail(item);
                        }}
                        className={`rounded-[18px] overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-md flex flex-col justify-between ${
                          owned
                            ? 'border-[#9ECB8A] bg-gradient-to-b from-white to-[#E4EEDF]/30 cursor-pointer'
                            : 'border-black/[0.06] bg-white'
                        }`}
                      >
                        {/* Image / Thumbnail */}
                        <div className="relative aspect-[4/3] bg-[#F5F3EC] flex items-center justify-center p-3 overflow-hidden">
                          {owned ? (
                            <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full bg-[#17402C] text-white text-[10px] font-mono font-medium">
                              ✓ Possédé
                            </span>
                          ) : null}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(item.id);
                            }}
                            className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-xs transition-colors shadow-2xs ${
                              isWish ? 'text-[#C0532E]' : 'text-[#6B7770] hover:text-[#17402C]'
                            }`}
                          >
                            {isWish ? '♥' : '♡'}
                          </button>

                          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-[#6B7770] p-2">
                            <span className="text-3xl block mb-1">{getCategoryIcon(item.category || cat.key)}</span>
                            <span className="line-clamp-1 font-semibold">{item.brand || 'LKDV PRO'}</span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-3.5 pb-4 flex flex-col justify-between flex-1 space-y-3">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7770] mb-0.5">
                              {item.category || cat.label}
                            </div>
                            <h5 className="text-sm font-medium text-[#0B1F17] leading-snug line-clamp-2">
                              {item.name}
                            </h5>
                          </div>

                          <div className="space-y-2.5 pt-1">
                            <div className="flex justify-between items-baseline font-mono text-xs text-[#6B7770]">
                              <span>{item.weight_g ? `${item.weight_g} g` : 'Léger'}</span>
                              <span className="font-sans font-semibold text-[#0B1F17] text-sm">
                                {item.price_eur ? `${item.price_eur} €` : '—'}
                              </span>
                            </div>

                            {/* Actions */}
                            {owned ? (
                              <div>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDetail(item);
                                    }}
                                    className="flex-1 py-1.5 rounded-full bg-[#17402C] text-white text-[11px] font-semibold hover:bg-[#0B1F17] transition-colors"
                                  >
                                    ⚡ Utiliser
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDetail(item);
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-[#F5F3EC] text-[#2A3A31] text-[11px] font-medium hover:bg-[#EAE7DD] transition-colors"
                                  >
                                    Détails
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[#6B7770] mt-2 pt-2 border-t border-dashed border-black/[0.06]">
                                  <span>Usage {item.hike_count || 12} sorties</span>
                                  <div className="flex-1 h-1 bg-black/[0.06] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#17402C] rounded-full w-2/5" />
                                  </div>
                                  <span className="text-[#17402C] font-semibold">OK</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAddProductToInventory(item);
                                  }}
                                  className="flex-1 py-1.5 rounded-full bg-[#F5F3EC] text-[#0B1F17] hover:bg-[#EAE7DD] text-[11px] font-medium transition-colors"
                                >
                                  + J'ai déjà
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddToCart(item);
                                  }}
                                  className="flex-1 py-1.5 rounded-full bg-[#E4C695] text-[#0B1F17] hover:bg-[#D4B685] text-[11px] font-bold transition-colors shadow-2xs"
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

        {/* ── FOOTER MANIFESTO & RACCOURCIS (.mm-footer) ── */}
        <footer className="p-8 sm:p-10 bg-[#0B1F17] text-white/70 rounded-3xl grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-8 mt-16">
          <div className="space-y-3">
            <h4 className="text-2xl font-medium text-white tracking-tight">
              Ce que vous emportez, <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">c'est votre voyage.</em>
            </h4>
            <p className="text-xs text-white/60 leading-relaxed max-w-md">
              Un cockpit unique — plus de fragmentation, plus d'onglets, plus de perte de temps. Vous naviguez, vous partez.
            </p>
            <div className="space-y-1.5 pt-2 text-xs">
              <div className="flex items-center gap-2"><span className="text-[#9ECB8A] font-serif-lkv italic">01.</span><span>Préparer une randonnée → date de départ → cockpit</span></div>
              <div className="flex items-center gap-2"><span className="text-[#9ECB8A] font-serif-lkv italic">02.</span><span>L'IA compose le kit sur votre matériel + comble les manques</span></div>
              <div className="flex items-center gap-2"><span className="text-[#9ECB8A] font-serif-lkv italic">03.</span><span>Alerte livraison si &lt; 3 jours · basculement express 24 h</span></div>
              <div className="flex items-center gap-2"><span className="text-[#9ECB8A] font-serif-lkv italic">04.</span><span>« Valider mon sac » → usage matériel incrémenté</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-widest text-white font-semibold">Raccourcis clavier</h5>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center"><span>Rechercher</span><span className="kbd bg-white/10 border-white/20 text-white">/</span></div>
              <div className="flex justify-between items-center"><span>Ajouter matériel</span><span className="kbd bg-white/10 border-white/20 text-white">n</span></div>
              <div className="flex justify-between items-center"><span>Basculer vue</span><span className="kbd bg-white/10 border-white/20 text-white">v</span></div>
              <div className="flex justify-between items-center"><span>Configurateur IA</span><span className="kbd bg-white/10 border-white/20 text-white">i</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-widest text-white font-semibold">Modèles Supabase</h5>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center"><span>custom_kits</span><span className="text-white/40 text-[11px]">source · status</span></div>
              <div className="flex justify-between items-center"><span>custom_kit_items</span><span className="text-white/40 text-[11px]">weight_g · qty</span></div>
              <div className="flex justify-between items-center"><span>record_hike_usage</span><span className="text-white/40 text-[11px]">RPC</span></div>
              <div className="flex justify-between items-center"><span>plannedHikes</span><span className="text-white/40 text-[11px]">YYYY-MM-DD</span></div>
            </div>
          </div>
        </footer>

      </div>

      {/* ── TOAST FLOTTANT ── */}
      <AnimatePresence>
        {cartToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-[#0B1F17] text-white px-5 py-3 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-3 border border-white/15"
          >
            <span className="w-2 h-2 rounded-full bg-[#6BAA55] animate-pulse" />
            <span>{cartToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DRAWER FICHE ARTICLE ── */}
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
          showNotificationToast('Équipement retiré de votre inventaire');
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

      {/* ── COCKPIT DE GESTION DU KIT SÉLECTIONNÉ ── */}
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
          showNotificationToast(`Kit « ${kit.name} » chargé pour votre prochain départ`);
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

      {/* ── MODALE AJOUT / ÉDITION MANUELLE ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-black/[0.06] space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="text-lg font-bold text-[#0B1F17]">
                  {editingItem ? 'Modifier l\'équipement' : 'Nouvel équipement'}
                </h3>
                <p className="text-xs text-[#6B7770]">
                  {editingItem ? 'Mettez à jour les informations' : 'Ajoutez un article à votre inventaire'}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-[#F5F3EC] hover:bg-[#EAE7DD] text-[#0B1F17] flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Nom de l'équipement *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex : Veste 3 couches Gore-Tex..."
                  className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Marque</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Ex : Arc'teryx..."
                    className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Catégorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Poids (g)</label>
                  <input
                    type="number"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    placeholder="Ex : 380"
                    className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Prix estimé (€)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ex : 240"
                    className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B1F17] mb-1">État</label>
                <select
                  value={formCondition}
                  onChange={(e) => setFormCondition(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                >
                  <option value="neuf">Neuf</option>
                  <option value="excellent">Excellent</option>
                  <option value="bon">Bon</option>
                  <option value="use">Usé</option>
                  <option value="a_remplacer">À remplacer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B1F17] mb-1">Notes personnelles</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notes d'entretien, emplacement de rangement..."
                  className="w-full px-3.5 py-2 text-sm border border-black/15 rounded-xl focus:border-[#17402C] focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/15 text-xs font-semibold text-[#0B1F17] hover:bg-[#F5F3EC]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#17402C] text-white text-xs font-bold hover:bg-[#0B1F17] shadow-sm"
                >
                  {editingItem ? 'Enregistrer' : 'Ajouter au sac'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODALE PRÊT MATÉRIEL ── */}
      {lendingItem && (
        <LendItemModal
          item={lendingItem}
          isOpen={Boolean(lendingItem)}
          onClose={() => setLendingItem(null)}
          onSave={async (lendData) => {
            await updateEquipment(lendingItem.id, lendData);
            setLendingItem(null);
            showNotificationToast(`Prêt enregistré pour « ${lendingItem.name} »`);
          }}
        />
      )}
    </div>
  );
}
