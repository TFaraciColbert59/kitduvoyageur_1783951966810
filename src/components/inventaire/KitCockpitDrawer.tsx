'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomKit, CustomKitItem } from '@/hooks/useUserKits';
import { UserEquipmentItem } from '@/hooks/useEquipment';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface KitCockpitDrawerProps {
  isOpen: boolean;
  kit: CustomKit | null;
  userEquipment: UserEquipmentItem[];
  onClose: () => void;
  onSelectForDeparture: (kit: CustomKit) => void;
  onUpdateKit: (kitId: string, patch: Partial<CustomKit>) => Promise<void>;
  onDeleteKit: (kitId: string) => Promise<void>;
  onDuplicateKit?: (kit: CustomKit) => Promise<void>;
  onAddGearToInventory: (product: any) => Promise<void>;
  onAddToCart: (product: any) => void;
}

function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
  return `${g} g`;
}

export default function KitCockpitDrawer({
  isOpen,
  kit,
  userEquipment,
  onClose,
  onSelectForDeparture,
  onUpdateKit,
  onDeleteKit,
  onAddGearToInventory,
  onAddToCart,
}: KitCockpitDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState('Autre');
  const [newItemWeight, setNewItemWeight] = useState(150);

  // Synchronisation lors de l'ouverture
  React.useEffect(() => {
    if (kit) {
      setEditedName(kit.name);
      setEditedDescription(kit.description || '');
      setIsEditingTitle(false);
      setShowAddSection(false);
    }
  }, [kit]);

  // Analyse des items du kit par rapport aux équipements possédés
  const itemsAnalysis = useMemo(() => {
    if (!kit) return { ownedCount: 0, missingCount: 0, readinessPct: 0, items: [] };

    const enrichedItems = kit.items.map((item) => {
      const owned = item.gear_item_id
        ? userEquipment.find((g) => g.id === item.gear_item_id)
        : userEquipment.find((g) => g.name.toLowerCase() === item.item_name.toLowerCase());

      return {
        ...item,
        isOwned: Boolean(owned),
        ownedGear: owned || null,
      };
    });

    const ownedCount = enrichedItems.filter((i) => i.isOwned).length;
    const missingCount = enrichedItems.length - ownedCount;
    const readinessPct = enrichedItems.length > 0 ? Math.round((ownedCount / enrichedItems.length) * 100) : 100;

    return {
      ownedCount,
      missingCount,
      readinessPct,
      items: enrichedItems,
    };
  }, [kit, userEquipment]);

  // Répartition des poids par catégorie
  const weightDistribution = useMemo(() => {
    if (!kit || kit.items.length === 0) return [];
    const catMap: Record<string, number> = {};
    kit.items.forEach((item) => {
      const cat = item.category || 'Autre';
      catMap[cat] = (catMap[cat] || 0) + item.weight_g * (item.quantity || 1);
    });

    const colors: Record<string, string> = {
      Couchage: '#2D6A4F',
      Portage: '#17402C',
      Vêtements: '#D97706',
      Hydratation: '#2563EB',
      Cuisine: '#DC2626',
      Sécurité: '#7C3AED',
      Autre: '#6B7A72',
    };

    const total = kit.total_weight_g || 1;
    return Object.entries(catMap).map(([cat, weight]) => ({
      cat,
      weight,
      pct: Math.round((weight / total) * 100),
      color: colors[cat] || '#405B4D',
    }));
  }, [kit]);

  if (!isOpen || !kit) return null;

  // Toggle coche d'un article
  const handleToggleItemCheck = async (itemId: string, currentChecked: boolean) => {
    triggerHaptic('selection');
    const updatedItems = kit.items.map((i) =>
      i.id === itemId ? { ...i, is_checked: !currentChecked } : i
    );
    await onUpdateKit(kit.id, { items: updatedItems });
  };

  // Suppression d'un article du kit
  const handleRemoveItem = async (itemId: string) => {
    triggerHaptic('light');
    const updatedItems = kit.items.filter((i) => i.id !== itemId);
    const newWeight = updatedItems.reduce((sum, i) => sum + (i.weight_g * (i.quantity || 1)), 0);
    await onUpdateKit(kit.id, { items: updatedItems, total_weight_g: newWeight });
  };

  // Ajout manuel d'un article au kit
  const handleAddItemToKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    triggerHaptic('selection');
    const newItem: CustomKitItem = {
      id: crypto.randomUUID(),
      kit_id: kit.id,
      item_name: newItemName.trim(),
      category: newItemCat,
      weight_g: Number(newItemWeight) || 0,
      quantity: 1,
      is_essential: false,
      is_checked: false,
    };

    const updatedItems = [...kit.items, newItem];
    const newWeight = updatedItems.reduce((sum, i) => sum + (i.weight_g * (i.quantity || 1)), 0);

    await onUpdateKit(kit.id, { items: updatedItems, total_weight_g: newWeight });
    setNewItemName('');
    setShowAddSection(false);
  };

  // Ajout rapide d'un article possédé dans le kit
  const handleAddOwnedGearToKit = async (gear: UserEquipmentItem) => {
    triggerHaptic('selection');
    const newItem: CustomKitItem = {
      id: crypto.randomUUID(),
      kit_id: kit.id,
      gear_item_id: gear.id,
      item_name: gear.name,
      category: gear.category,
      weight_g: gear.weight_g || 0,
      quantity: 1,
      is_essential: false,
      is_checked: false,
    };

    const updatedItems = [...kit.items, newItem];
    const newWeight = updatedItems.reduce((sum, i) => sum + (i.weight_g * (i.quantity || 1)), 0);
    await onUpdateKit(kit.id, { items: updatedItems, total_weight_g: newWeight });
  };

  // Sauvegarde des métadonnées du kit
  const handleSaveMeta = async () => {
    if (!editedName.trim()) return;
    await onUpdateKit(kit.id, {
      name: editedName.trim(),
      description: editedDescription.trim(),
    });
    setIsEditingTitle(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex justify-end">
        {/* Backdrop sombre */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
        />

        {/* Panneau Cockpit Kit */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden"
        >
          {/* Header du Cockpit */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-[#17402C] via-[#1C4833] to-[#0E291D] text-white shrink-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {kit.source === 'configurator' ? (
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#FAF0DC] text-amber-950 border border-amber-300">
                    ✨ IA Configurateur
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-white">
                    🎒 Kit Manuel
                  </span>
                )}
                {kit.for_destination && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                    📍 {kit.for_destination}
                  </span>
                )}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                  {kit.season || 'Toutes saisons'}
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Titre & Description éditables */}
            {isEditingTitle ? (
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full bg-white/15 border border-white/30 rounded-xl px-3 py-2 text-white font-bold text-lg focus:outline-none"
                  placeholder="Nom du kit..."
                />
                <input
                  type="text"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-xs text-white/90 focus:outline-none"
                  placeholder="Description ou notes..."
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => setIsEditingTitle(false)}
                    className="px-3 py-1 rounded-lg text-xs bg-white/10 text-white"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveMeta}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-[#17402C]"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div className="group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
                    {kit.name}
                  </h2>
                  <span className="text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    ✏️ Modifier
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-1 line-clamp-2">
                  {kit.description || 'Cliquez pour ajouter une description ou des notes de préparation.'}
                </p>
              </div>
            )}

            {/* Métriques Clés en Barrette */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/15">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 block">
                  Poids net
                </span>
                <span className="text-base font-bold font-mono text-white">
                  {formatWeight(kit.total_weight_g)}
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 block">
                  Articles
                </span>
                <span className="text-base font-bold font-mono text-white">
                  {kit.items.length} dans le sac
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 block">
                  Disponibilité
                </span>
                <span className={`text-base font-bold font-mono ${itemsAnalysis.readinessPct === 100 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {itemsAnalysis.readinessPct}% possédé
                </span>
              </div>
            </div>

            {/* Jauge de répartition de poids */}
            {weightDistribution.length > 0 && (
              <div className="mt-3">
                <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden flex">
                  {weightDistribution.map((w, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${w.pct}%`, backgroundColor: w.color }}
                      className="h-full"
                      title={`${w.cat}: ${formatWeight(w.weight)} (${w.pct}%)`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barre d'action rapide */}
          <div className="p-3 bg-[#FBFAF6] border-b border-black/[0.06] flex items-center justify-between gap-2 flex-wrap shrink-0">
            <button
              onClick={() => {
                triggerHaptic('selection');
                onSelectForDeparture(kit);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#0B1F17] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>🚀 Activer pour mon prochain départ</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddSection(!showAddSection)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-black/[0.08] hover:bg-black/[0.02] text-[#0B1F17] transition-colors"
              >
                {showAddSection ? '✕ Fermer l\'ajout' : '+ Ajouter un article'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Mettre le kit « ${kit.name} » à la corbeille ?`)) {
                    onDeleteKit(kit.id);
                    onClose();
                  }
                }}
                className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                title="Supprimer ce kit"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Section d'ajout d'article (dépliable) */}
          {showAddSection && (
            <div className="p-4 bg-white border-b border-black/[0.06] space-y-4 shrink-0 max-h-60 overflow-y-auto">
              <form onSubmit={handleAddItemToKit} className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nom de l'article (ex: Doudoune plume)..."
                  className="flex-1 min-w-[180px] px-3 py-1.5 text-xs border border-black/15 rounded-lg focus:outline-none"
                  required
                />
                <select
                  value={newItemCat}
                  onChange={(e) => setNewItemCat(e.target.value)}
                  className="px-2 py-1.5 text-xs border border-black/15 rounded-lg focus:outline-none"
                >
                  <option value="Couchage">Couchage</option>
                  <option value="Portage">Portage</option>
                  <option value="Vêtements">Vêtements</option>
                  <option value="Hydratation">Hydratation</option>
                  <option value="Cuisine">Cuisine</option>
                  <option value="Sécurité">Sécurité</option>
                  <option value="Autre">Autre</option>
                </select>
                <input
                  type="number"
                  value={newItemWeight}
                  onChange={(e) => setNewItemWeight(Number(e.target.value))}
                  placeholder="Poids (g)"
                  className="w-20 px-2 py-1.5 text-xs border border-black/15 rounded-lg focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#17402C] text-white text-xs font-bold hover:bg-[#0B1F17]"
                >
                  + Ajouter
                </button>
              </form>

              {/* Sélection rapide parmi le matériel possédé non présent dans le kit */}
              {userEquipment.length > 0 && (
                <div className="pt-2 border-t border-black/[0.04]">
                  <p className="text-[11px] font-semibold text-[#6B7A72] mb-1.5">
                    Ou piocher dans votre inventaire possédé :
                  </p>
                  <div className="flex gap-1.5 flex-wrap max-h-28 overflow-y-auto">
                    {userEquipment
                      .filter((ue) => !kit.items.some((ki) => ki.gear_item_id === ue.id || ki.item_name.toLowerCase() === ue.name.toLowerCase()))
                      .map((gear) => (
                        <button
                          key={gear.id}
                          type="button"
                          onClick={() => handleAddOwnedGearToKit(gear)}
                          className="px-2.5 py-1 rounded-lg bg-[#FBFAF6] hover:bg-[#E1EBDD] border border-black/[0.06] text-[11px] font-medium text-[#0B1F17] flex items-center gap-1 transition-colors"
                        >
                          <span>+ {gear.name}</span>
                          <span className="text-[#6B7A72] font-mono">({gear.weight_g || 0}g)</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Liste Détaillée des Articles du Kit */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#6B7A72]">
                Articles inclus dans le kit ({kit.items.length})
              </h3>
              <span className="text-xs text-[#6B7A72]">
                Cochez pour préparer votre sac
              </span>
            </div>

            {kit.items.length === 0 ? (
              <div className="text-center py-10 text-[#6B7A72] text-xs">
                Ce kit est actuellement vide. Utilisez le bouton ci-dessus pour y ajouter des articles.
              </div>
            ) : (
              <div className="space-y-2">
                {itemsAnalysis.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.is_checked
                        ? 'bg-[#E1EBDD]/40 border-[#A9C6B0]'
                        : item.isOwned
                        ? 'bg-white border-black/[0.06] shadow-2xs'
                        : 'bg-amber-50/60 border-amber-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox empaquetage */}
                      <button
                        type="button"
                        onClick={() => handleToggleItemCheck(item.id, item.is_checked)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                          item.is_checked
                            ? 'bg-[#17402C] border-[#17402C] text-white'
                            : 'border-black/20 bg-white hover:border-[#17402C]'
                        }`}
                      >
                        {item.is_checked && '✓'}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-bold text-[#0B1F17] truncate ${item.is_checked ? 'line-through opacity-70' : ''}`}>
                            {item.item_name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/[0.04] text-[#6B7A72]">
                            {item.category}
                          </span>
                          {item.isOwned ? (
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                              ✓ Possédé
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded">
                              ⚠️ À acquérir
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#6B7A72] mt-0.5">
                          {item.weight_g} g {item.quantity > 1 ? `(x${item.quantity})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Actions de droite */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      {!item.isOwned && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              await onAddGearToInventory({
                                name: item.item_name,
                                category: item.category,
                                weight_g: item.weight_g,
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-black/[0.04] border border-black/15 text-[#0B1F17]"
                            title="Indiquer que vous possédez déjà cet équipement"
                          >
                                            Ajouter
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onAddToCart({
                                id: item.id,
                                name: item.item_name,
                                category: item.category,
                                weight_g: item.weight_g,
                                price_eur: 29,
                                brand: 'LKDV Partner',
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#17402C] hover:bg-[#0B1F17] text-white shadow-2xs"
                            title="Ajouter au panier"
                          >
                            🛒 Acheter
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-[#6B7A72]/60 hover:text-red-600 transition-colors ml-1"
                        title="Retirer du kit"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
