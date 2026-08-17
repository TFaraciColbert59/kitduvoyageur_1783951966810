'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Header from '@/components/Header';
import ProductCard from '@/components/ui/ProductCard';
import { useEquipment, UserEquipmentItem } from '@/hooks/useEquipment';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const CATEGORIES = [
  { key: 'all', label: 'Tout le matériel', icon: '🎒' },
  { key: 'Couchage', label: 'Couchage & Tentes', icon: '🛏️' },
  { key: 'Vêtements', label: 'Vêtements & Vestes', icon: '🧥' },
  { key: 'Chaussures', label: 'Chaussures', icon: '🥾' },
  { key: 'Sacs à dos', label: 'Sacs & Portage', icon: '🎒' },
  { key: 'Cuisine', label: 'Cuisine & Réchauds', icon: '🍳' },
  { key: 'Hydratation', label: 'Eau & Filtres', icon: '💧' },
  { key: 'Navigation', label: 'Navigation & Sécurité', icon: '🧭' },
  { key: 'Autre', label: 'Accessoires & Outils', icon: '🔧' },
];

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${g} g`;
}

export default function MonMaterielPage() {
  const { triggerHaptic } = useHapticFeedback();
  const {
    equipment,
    products,
    loading,
    totalPackWeight,
    addToEquipment,
    removeFromEquipment,
    updateEquipment,
  } = useEquipment();

  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAssistant, setShowAssistant] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<UserEquipmentItem | null>(null);

  // Formulaire d'ajout manuel
  const [newItemName, setNewItemName] = useState('');
  const [newItemBrand, setNewItemBrand] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Couchage');
  const [newItemWeight, setNewItemWeight] = useState('');
  const [newItemCondition, setNewItemCondition] = useState<UserEquipmentItem['condition']>('excellent');

  // Assistant IA State
  const [assistant, setAssistant] = useState<{
    question: string;
    answer: string | null;
    tips: string[];
    loading: boolean;
  }>({
    question: '',
    answer: null,
    tips: [],
    loading: false,
  });

  const askAssistant = useCallback(async () => {
    if (!assistant.question.trim()) return;
    triggerHaptic('selection');
    setAssistant((prev) => ({ ...prev, loading: true, answer: null, tips: [] }));
    try {
      const res = await fetch('/api/trip-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: assistant.question }),
      });
      const data = await res.json();
      setAssistant((prev) => ({
        ...prev,
        loading: false,
        answer: data.answer || null,
        tips: data.tips || [],
      }));
    } catch {
      setAssistant((prev) => ({
        ...prev,
        loading: false,
        answer: 'Erreur lors de la consultation de l\'assistant.',
        tips: [],
      }));
    }
  }, [assistant.question, triggerHaptic]);

  // Filtrage du matériel
  const filteredEquipment = useMemo(() => {
    if (activeCategory === 'all') return equipment;
    return equipment.filter(
      (item) => item.category?.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [equipment, activeCategory]);

  const filteredWeight = useMemo(() => {
    return filteredEquipment.reduce(
      (sum, item) => sum + (item.weight_g || 0) * (item.quantity || 1),
      0
    );
  }, [filteredEquipment]);

  // Création / Ajout d'article manuel
  const handleSaveManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    triggerHaptic('selection');

    if (editingItem) {
      await updateEquipment(editingItem.id, {
        name: newItemName.trim(),
        brand: newItemBrand.trim() || null,
        category: newItemCategory,
        weight_g: Number(newItemWeight) || 0,
        condition: newItemCondition,
      });
      setEditingItem(null);
    } else {
      await addToEquipment(
        {
          name: newItemName.trim(),
          brand: newItemBrand.trim() || 'Matériel personnel',
          category: newItemCategory,
          weight_g: Number(newItemWeight) || 0,
        },
        {
          condition: newItemCondition,
          source: 'manuel',
        }
      );
    }

    setNewItemName('');
    setNewItemBrand('');
    setNewItemWeight('');
    setShowAddModal(false);
  };

  const handleOpenEdit = (item: UserEquipmentItem) => {
    triggerHaptic('light');
    setEditingItem(item);
    setNewItemName(item.name);
    setNewItemBrand(item.brand || '');
    setNewItemCategory(item.category || 'Couchage');
    setNewItemWeight(String(item.weight_g || ''));
    setNewItemCondition(item.condition || 'excellent');
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#0B1F17] font-sans selection:bg-[#17402C]/10">
      {/* Header Desktop */}
      <div className="hidden md:block">
        <Header />
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 md:pt-28 pb-24">
        {/* ── 1. HEADER & SYNTHÈSE POIDS DU SAC ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-black/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#17402C] bg-[#E1EBDD] px-2.5 py-0.5 rounded-full">
                🎒 Mon Inventaire Voyageur
              </span>
              <span className="text-xs text-[#5C6B63] font-mono">
                {equipment.length} équipement{equipment.length > 1 ? 's' : ''} enregistré{equipment.length > 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#0B1F17]">
              Mon Matériel & <em className="font-serif italic font-normal text-[#17402C]">Fond de Sac</em>
            </h1>
            <p className="text-xs sm:text-sm text-[#5C6B63] max-w-xl mt-1">
              Gérez l'état de votre équipement, contrôlez le poids total de votre paquetage et trouvez les compléments recommandés.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Jauge Poids Sac */}
            <div className="px-4 py-2.5 rounded-2xl bg-white border border-black/[0.06] shadow-2xs flex items-center gap-3">
              <span className="text-2xl">⚖️</span>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C6B63]">Poids Total du Sac</p>
                <p className="text-sm font-bold text-[#17402C] font-mono">
                  {formatWeight(totalPackWeight)}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('selection');
                setEditingItem(null);
                setNewItemName('');
                setNewItemBrand('');
                setNewItemWeight('');
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-[#17402C] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-transform"
            >
              <span>+ Ajouter du matériel</span>
            </button>

            <Link
              href="/boutique"
              onClick={() => triggerHaptic('light')}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#0B1F17] border border-black/[0.08] font-bold text-xs flex items-center gap-1.5 shadow-2xs hover:bg-[#F4F1EB] active:scale-95 transition-transform"
            >
              <span>🛒 Explorer la Boutique</span>
            </Link>
          </div>
        </div>

        {/* ── 2. ASSISTANT IA DE PRÉPARATION ── */}
        <div className="pt-4 pb-2">
          {!showAssistant ? (
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowAssistant(true);
              }}
              className="w-full p-4 rounded-2xl bg-white border border-black/[0.06] shadow-2xs hover:border-[#17402C]/30 transition-all text-left flex items-center justify-between gap-3 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E1EBDD] flex items-center justify-center text-xl shrink-0">
                  ✨
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#0B1F17]">
                    Assistant IA de Préparation
                  </h4>
                  <p className="text-[11px] sm:text-xs text-[#5C6B63]">
                    Vérifiez l'adéquation de votre sac pour un GR20, l'Islande ou un bivouac d'altitude.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#17402C] px-3 py-1.5 rounded-full bg-[#E1EBDD]">
                Poser une question →
              </span>
            </button>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-black/[0.08] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h4 className="text-sm font-bold text-[#0B1F17]">Assistant IA Randonnée & Matériel</h4>
                </div>
                <button
                  onClick={() => setShowAssistant(false)}
                  className="text-xs text-[#5C6B63] hover:text-[#0B1F17] p-1"
                >
                  ✕ Fermer
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={assistant.question}
                  onChange={(e) => setAssistant((p) => ({ ...p, question: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && askAssistant()}
                  placeholder="Ex : Quel duvet choisir pour un bivouac à 2500m en août ?"
                  className="flex-1 bg-[#F4F1EB] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                />
                <button
                  onClick={askAssistant}
                  disabled={assistant.loading || !assistant.question.trim()}
                  className="px-4 py-2.5 bg-[#17402C] text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-[#0B1F17] transition-colors"
                >
                  {assistant.loading ? 'Analyse…' : 'Envoyer'}
                </button>
              </div>

              {assistant.answer && (
                <div className="p-3.5 rounded-xl bg-[#F4F1EB] border border-black/[0.04] text-xs leading-relaxed space-y-2">
                  <p className="text-[#0B1F17]">{assistant.answer}</p>
                  {assistant.tips.length > 0 && (
                    <ul className="space-y-1 pt-1 border-t border-black/[0.06]">
                      {assistant.tips.map((tip, i) => (
                        <li key={i} className="text-[#5C6B63] flex items-start gap-1.5">
                          <span>💡</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. FILTRES CATÉGORIES & VUE ── */}
        <div className="flex items-center justify-between gap-3 py-3 overflow-x-auto scrollbar-none">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCategory(cat.key);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors border ${
                  activeCategory === cat.key
                    ? 'bg-[#17402C] text-white border-[#17402C]'
                    : 'bg-white text-[#5C6B63] border-black/[0.06] hover:bg-[#F4F1EB]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Toggle Vue Grille / Liste */}
          <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-2xl border border-black/[0.06] shadow-2xs shrink-0">
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

        {/* Poids de la catégorie sélectionnée */}
        {activeCategory !== 'all' && filteredWeight > 0 && (
          <div className="my-2 p-3 rounded-xl bg-[#E1EBDD] border border-[#A9C6B0]/40 flex items-center justify-between text-xs font-semibold text-[#17402C]">
            <span>Poids {CATEGORIES.find((c) => c.key === activeCategory)?.label}</span>
            <span className="font-mono font-bold">{formatWeight(filteredWeight)}</span>
          </div>
        )}

        {/* ── 4. GRILLE / LISTE DU MATÉRIEL ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white border border-black/[0.04] animate-pulse p-4 flex flex-col justify-between">
                <div className="w-full aspect-square bg-[#F4F1EB] rounded-xl" />
                <div className="h-4 bg-[#F4F1EB] rounded w-3/4" />
                <div className="h-4 bg-[#F4F1EB] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="p-12 sm:p-16 text-center rounded-3xl bg-white border border-dashed border-black/10 my-6">
            <p className="text-4xl mb-3">🎒</p>
            <h3 className="font-serif text-lg font-bold text-[#0B1F17]">
              {activeCategory === 'all'
                ? 'Votre inventaire est vide'
                : 'Aucun article dans cette catégorie'}
            </h3>
            <p className="text-xs text-[#5C6B63] max-w-sm mx-auto mt-1 mb-5">
              Ajoutez vos équipements possédés ou parcourez le catalogue pour composer votre sac.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setNewItemName('');
                  setNewItemBrand('');
                  setNewItemWeight('');
                  setShowAddModal(true);
                }}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#17402C] text-white shadow-xs"
              >
                + Ajouter manuellement
              </button>
              <Link
                href="/boutique"
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#F4F1EB] text-[#0B1F17] border border-black/[0.08]"
              >
                Catalogue boutique →
              </Link>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3 pt-2">
            {filteredEquipment.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  id: item.id,
                  name: item.name,
                  brand: item.brand,
                  category: item.category,
                  weight_g: item.weight_g,
                  price_eur: item.purchase_price,
                  image: item.image,
                  condition: item.condition,
                  quantity: item.quantity,
                  notes: item.notes,
                }}
                viewMode="list"
                context="inventory"
                isOwned={true}
                onEdit={() => handleOpenEdit(item)}
                onRemoveFromEquipment={() => removeFromEquipment(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 pt-2">
            {filteredEquipment.map((item) => (
              <ProductCard
                key={item.id}
                product={{
                  id: item.id,
                  name: item.name,
                  brand: item.brand,
                  category: item.category,
                  weight_g: item.weight_g,
                  price_eur: item.purchase_price,
                  image: item.image,
                  condition: item.condition,
                  quantity: item.quantity,
                  notes: item.notes,
                }}
                viewMode="grid"
                context="inventory"
                isOwned={true}
                onEdit={() => handleOpenEdit(item)}
                onRemoveFromEquipment={() => removeFromEquipment(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── MODALE AJOUT / ÉDITION MANUELLE D'ÉQUIPEMENT ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <h3 className="text-base font-bold text-[#0B1F17]">
                {editingItem ? 'Modifier l\'équipement' : 'Ajouter un équipement'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#5C6B63] p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0B1F17] mb-1">
                  Nom du matériel *
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ex : MSR Hubba Hubba NX"
                  className="w-full bg-[#F4F1EB] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">
                    Marque
                  </label>
                  <input
                    type="text"
                    value={newItemBrand}
                    onChange={(e) => setNewItemBrand(e.target.value)}
                    placeholder="Ex : MSR, Osprey..."
                    className="w-full bg-[#F4F1EB] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">
                    Poids (grammes)
                  </label>
                  <input
                    type="number"
                    value={newItemWeight}
                    onChange={(e) => setNewItemWeight(e.target.value)}
                    placeholder="Ex : 1540"
                    className="w-full bg-[#F4F1EB] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-[#F4F1EB] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  >
                    {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F17] mb-1">
                    État du matériel
                  </label>
                  <select
                    value={newItemCondition}
                    onChange={(e) => setNewItemCondition(e.target.value as any)}
                    className="w-full bg-[#F4F1EB] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
                  >
                    <option value="neuf">Neuf</option>
                    <option value="excellent">Excellent état</option>
                    <option value="bon">Bon état</option>
                    <option value="moyen">État moyen</option>
                    <option value="usé">Usé</option>
                    <option value="à_réparer">À réparer</option>
                    <option value="à_remplacer">À remplacer</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#F4F1EB] text-[#0B1F17]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#17402C] text-white shadow-xs"
                >
                  {editingItem ? 'Enregistrer' : 'Ajouter au sac'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
