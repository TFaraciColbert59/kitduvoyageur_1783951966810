'use client';
import React, { useOptimistic, useTransition, useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Package,
  AlertCircle,
  Zap,
  Droplets,
  RotateCcw,
  Sparkles,
  Search,
  Plus,
  Volume2,
  VolumeX,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { updateItemQuantity } from '@/features/materiel/actions/updateItemQuantity';
import { deleteDepartItem } from '@/features/materiel/actions/deleteDepartItem';
import { queueOfflineAction } from '@/features/materiel/offline/departOfflineQueue';
import type { ChecklistItem, Participant } from '@/features/materiel/types/trekHub';

interface CategoryGroup {
  name: string;
  items: ChecklistItem[];
  done: number;
}

const CATEGORIES = [
  'Bivouac',
  'Couchage',
  'Vivres & Eau',
  'Vêtements',
  'Cuisine',
  'Sécurité',
  'Hydratation',
  'Électronique',
  'Hygiène',
  'Autre',
];

function groupByCategory(items: ChecklistItem[]): CategoryGroup[] {
  const map = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const cat = item.category ?? 'Autre';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries())
    .map(([name, catItems]) => ({
      name,
      items: catItems,
      done: catItems.filter((i) => i.is_checked).length,
    }))
    .sort((a, b) => {
      const aComplete = a.done === a.items.length;
      const bComplete = b.done === b.items.length;
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return a.name.localeCompare(b.name, 'fr');
    });
}

interface DepartChecklistProps {
  items: ChecklistItem[];
  consumables?: Record<string, number> | null;
  participants?: Participant[];
  kitId?: string;
  isRealKit: boolean;
}

export function DepartChecklist({
  items,
  consumables,
  participants = [],
  kitId,
  isRealKit,
}: DepartChecklistProps) {
  const shouldReduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'remaining'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Formulaire d'ajout
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Bivouac');
  const [newItemWeight, setNewItemWeight] = useState(150);
  const [newItemVital, setNewItemVital] = useState(false);
  const [newItemAddToInv, setNewItemAddToInv] = useState(false);

  // Intégration auto des consommables dans la checklist sous Vivres & Eau
  const initialItems = useMemo(() => {
    const base = [...items];
    const hasConsumableItems = base.some((i) => i.category === 'Vivres & Eau' || i.is_consumable);

    if (!hasConsumableItems && consumables) {
      if ((consumables.water ?? 0) > 0) {
        base.push({
          id: 'consumable-water',
          name: `Eau potable (${consumables.water} L)`,
          category: 'Vivres & Eau',
          weight_g: Math.round((consumables.water ?? 0) * 1000),
          is_checked: false,
          is_consumable: true,
          is_vital: true,
        });
      }
      if ((consumables.gas ?? 0) > 0) {
        base.push({
          id: 'consumable-gas',
          name: `Cartouche de gaz (${consumables.gas} g)`,
          category: 'Vivres & Eau',
          weight_g: consumables.gas,
          is_checked: false,
          is_consumable: true,
        });
      }
      if ((consumables.meals ?? 0) > 0) {
        base.push({
          id: 'consumable-meals',
          name: `Rations repas (${consumables.meals} repas)`,
          category: 'Vivres & Eau',
          weight_g: consumables.meals * 150,
          is_checked: false,
          is_consumable: true,
        });
      }
      if ((consumables.snacks ?? 0) > 0) {
        base.push({
          id: 'consumable-snacks',
          name: `En-cas & barres (${consumables.snacks} rations)`,
          category: 'Vivres & Eau',
          weight_g: consumables.snacks * 50,
          is_checked: false,
          is_consumable: true,
        });
      }
    }
    return base;
  }, [items, consumables]);

  const [localItems, setLocalItems] = useState<ChecklistItem[]>(initialItems);

  useEffect(() => {
    setLocalItems(initialItems);
  }, [initialItems]);

  const [optimisticItems, addOptimistic] = useOptimistic(
    localItems,
    (state: ChecklistItem[], payload: { id: string; checked: boolean }) =>
      state.map((item) =>
        (item.id ?? item.name) === payload.id ? { ...item, is_checked: payload.checked } : item
      )
  );

  const [isPending, startTransition] = useTransition();
  const [openCats, setOpenCats] = useState<Set<string>>(() => {
    const incomplete = new Set<string>();
    const grps = groupByCategory(initialItems);
    for (const g of grps) {
      if (g.done < g.items.length) {
        incomplete.add(g.name);
      }
    }
    return incomplete.size > 0 ? incomplete : new Set(grps.map((g) => g.name));
  });

  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [failedItem, setFailedItem] = useState<ChecklistItem | null>(null);

  // Filtrage recherche & mode restants
  const filteredItems = useMemo(() => {
    return optimisticItems.filter((i) => {
      if (filterMode === 'remaining' && i.is_checked) return false;
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    });
  }, [optimisticItems, filterMode, searchQuery]);

  const groups = useMemo(() => groupByCategory(filteredItems), [filteredItems]);

  const toggleCat = (cat: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleToggle = useCallback(
    (item: ChecklistItem) => {
      const nextChecked = !item.is_checked;
      const itemKey = item.id ?? item.name;

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(8); } catch {}
      }

      setErrorItemId(null);
      setFailedItem(null);
      addOptimistic({ id: itemKey, checked: nextChecked });

      setLocalItems((prev) =>
        prev.map((i) =>
          (i.id ?? i.name) === itemKey ? { ...i, is_checked: nextChecked } : i
        )
      );

      if (!isRealKit || !item.id || item.id.startsWith('consumable-')) return;

      if (typeof window !== 'undefined' && !navigator.onLine) {
        queueOfflineAction({
          type: 'toggle',
          payload: { itemId: item.id, currentChecked: !nextChecked },
        });
        return;
      }

      startTransition(async () => {
        try {
          const res = await toggleKitItem(item.id!, nextChecked);
          if (!res.success) {
            queueOfflineAction({
              type: 'toggle',
              payload: { itemId: item.id, currentChecked: !nextChecked },
            });
          }
        } catch {
          queueOfflineAction({
            type: 'toggle',
            payload: { itemId: item.id, currentChecked: !nextChecked },
          });
        }
      });
    },
    [addOptimistic, isRealKit]
  );

  const handleQuantityChange = async (item: ChecklistItem, delta: number) => {
    const currentQty = item.quantity ?? 1;
    const nextQty = Math.max(1, Math.min(99, currentQty + delta));
    if (nextQty === currentQty) return;

    setLocalItems((prev) =>
      prev.map((i) => ((i.id ?? i.name) === (item.id ?? item.name) ? { ...i, quantity: nextQty } : i))
    );

    if (isRealKit && item.id && !item.id.startsWith('consumable-')) {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        queueOfflineAction({
          type: 'quantity',
          payload: { itemId: item.id, quantity: nextQty, kitId },
        });
      } else {
        try {
          await updateItemQuantity(item.id, nextQty, kitId);
        } catch {
          queueOfflineAction({
            type: 'quantity',
            payload: { itemId: item.id, quantity: nextQty, kitId },
          });
        }
      }
    }
  };

  const handleDelete = async (item: ChecklistItem) => {
    setLocalItems((prev) => prev.filter((i) => (i.id ?? i.name) !== (item.id ?? item.name)));
    if (isRealKit && item.id && !item.id.startsWith('consumable-')) {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        queueOfflineAction({
          type: 'delete',
          payload: { itemId: item.id, kitId },
        });
      } else {
        try {
          await deleteDepartItem(item.id, kitId);
        } catch {
          queueOfflineAction({
            type: 'delete',
            payload: { itemId: item.id, kitId },
          });
        }
      }
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      name: newItemName.trim(),
      category: newItemCategory,
      weight_g: Number(newItemWeight) || 100,
      quantity: 1,
      is_checked: false,
      is_vital: newItemVital,
    };

    setLocalItems((prev) => [...prev, newItem]);
    setIsAddModalOpen(false);
    setNewItemName('');

    if (isRealKit && kitId) {
      const payload = {
        kitId,
        name: newItem.name,
        category: newItem.category ?? 'Autre',
        weightG: newItem.weight_g,
        isVital: newItemVital,
        addToInventory: newItemAddToInv,
      };

      if (typeof window !== 'undefined' && !navigator.onLine) {
        queueOfflineAction({
          type: 'add',
          payload,
        });
      } else {
        try {
          await addDepartItem(payload);
        } catch {
          queueOfflineAction({
            type: 'add',
            payload,
          });
        }
      }
    }
  };

  // Text-to-Speech : lecture à voix haute des articles restants
  const handleToggleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const remaining = localItems.filter((i) => !i.is_checked);
    if (remaining.length === 0) {
      const u = new SpeechSynthesisUtterance('Bravo ! Tous vos équipements sont prêts dans votre sac.');
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
      return;
    }

    const text = `Articles restants à mettre dans votre sac : ${remaining.map((i) => i.name).join(', ')}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Écoute des événements d ancrage
  useEffect(() => {
    const handleHighlight = (e: any) => {
      const targetId = e?.detail?.id;
      if (!targetId) return;
      setHighlightedItemId(targetId);
      for (const group of groups) {
        if (group.items.some((i) => (i.id ?? i.name) === targetId)) {
          setOpenCats((prev) => new Set(prev).add(group.name));
          break;
        }
      }
      setTimeout(() => {
        const el = document.getElementById(`checklist-item-${targetId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setTimeout(() => setHighlightedItemId(null), 3000);
    };

    const handleToggleFromAlert = (e: any) => {
      const targetId = e?.detail?.id;
      if (!targetId) return;
      const it = localItems.find((i) => (i.id ?? i.name) === targetId);
      if (it) handleToggle(it);
    };

    window.addEventListener('highlight-checklist-item', handleHighlight);
    window.addEventListener('toggle-item-from-alert', handleToggleFromAlert);

    return () => {
      window.removeEventListener('highlight-checklist-item', handleHighlight);
      window.removeEventListener('toggle-item-from-alert', handleToggleFromAlert);
    };
  }, [groups, localItems, handleToggle]);

  const total = localItems.length;
  const done = localItems.filter((i) => i.is_checked).length;
  const remaining = total - done;

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="depart-checklist-heading" className="relative h-full max-h-full flex flex-col justify-between overflow-hidden select-none">
      <div className="p-3.5 flex flex-col h-full max-h-full min-h-0 justify-between gap-2">
        {/* ════ HEADER CHECKLIST FIXE IMMOBILE SUR UNE SEULE LIGNE ════ */}
        <div className="shrink-0 flex items-center justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-1.5 shrink-0">
            <Package size={14} className="text-[#2D6B4A] shrink-0" aria-hidden="true" />
            <h2 id="depart-checklist-heading" className="text-[12px] sm:text-[13px] font-bold text-[#17402C] whitespace-nowrap">
              Préparation active du sac
            </h2>
            <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#17402C]/10 text-[#17402C] shrink-0">
              {done}/{total}
            </span>
          </div>

          {/* Barre d actions droite : Filtres + Audio + Bouton Plus Icône Seule */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bascule Reste à faire / Tous */}
            <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-xl p-0.5 text-[10.5px] font-semibold">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={cn(
                  'px-2 py-0.5 rounded-lg transition-colors cursor-pointer',
                  filterMode === 'all' ? 'bg-[#17402C] text-white shadow-2xs' : 'text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                Tous ({total})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('remaining')}
                className={cn(
                  'px-2 py-0.5 rounded-lg transition-colors cursor-pointer',
                  filterMode === 'remaining' ? 'bg-[#17402C] text-white shadow-2xs' : 'text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                Restants ({remaining})
              </button>
            </div>

            {/* Lecture Audio Text-to-Speech */}
            <button
              type="button"
              onClick={handleToggleSpeak}
              className={cn(
                'w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0',
                isSpeaking
                  ? 'bg-[#2D6B4A] text-white animate-pulse'
                  : 'bg-white/60 dark:bg-white/10 text-[#17402C] hover:bg-white'
              )}
              title={isSpeaking ? 'Arrêter la lecture' : 'Lire les articles restants à voix haute'}
              aria-label={isSpeaking ? 'Arrêter la lecture audio' : 'Lire la checklist à voix haute'}
            >
              {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>

            {/* Bouton Ajouter un équipement (JUSTE L'ICÔNE PLUS) */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="w-7 h-7 rounded-xl bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs flex items-center justify-center cursor-pointer shrink-0 transition-transform active:scale-95"
              title="Ajouter un équipement au sac"
              aria-label="Ajouter un équipement au sac"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Toast de retry en cas d erreur réseau */}
        {failedItem && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <span>Échec de synchronisation pour <strong>{failedItem.name}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(failedItem)}
              className="px-2 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] flex items-center gap-1 hover:bg-red-700"
            >
              <RotateCcw size={11} />
              <span>Réessayer</span>
            </button>
          </div>
        )}

        {/* ════ GROUPES PAR CATÉGORIE (SEUL CET INTÉRIEUR EST SCROLLABLE) ════ */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5" role="list" aria-label="Catégories du matériel">
          {groups.map((group) => {
            const isOpen = openCats.has(group.name);
            const allDone = group.done === group.items.length;
            const isFoodWater = group.name === 'Vivres & Eau' || group.name === 'Hydratation' || group.name === 'Nutrition';

            return (
              <div
                key={group.name}
                role="listitem"
                className={cn(
                  'rounded-2xl transition-opacity',
                  allDone && !isOpen ? 'opacity-80 hover:opacity-100' : 'opacity-100'
                )}
              >
                {/* Header catégorie — bouton accordéon */}
                <button
                  type="button"
                  onClick={() => toggleCat(group.name)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl transition-colors text-left cursor-pointer',
                    'focus-visible:outline-2 focus-visible:outline-[#17402C]',
                    allDone
                      ? 'bg-black/4 dark:bg-white/5 text-[#17402C]/80 hover:bg-black/6'
                      : isFoodWater
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/25 text-[#17402C] font-semibold border border-emerald-200/60 shadow-2xs'
                      : 'bg-white/50 dark:bg-white/10 text-[#17402C] font-semibold shadow-2xs'
                  )}
                  aria-expanded={isOpen}
                  aria-controls={`checklist-cat-${group.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        allDone ? 'bg-[#2D6B4A]' : isFoodWater ? 'bg-[#2D6B4A]' : 'bg-[#C89A3B]'
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-xs sm:text-[13px] font-semibold truncate flex items-center gap-1.5">
                      {isFoodWater && <Droplets size={12} className="text-[#2D6B4A]" />}
                      <span>{group.name}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'text-[10.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-md font-semibold',
                        allDone
                          ? 'bg-[#5B7F55]/15 text-[#17402C]'
                          : 'bg-black/5 dark:bg-white/10 text-[#5A7064]'
                      )}
                    >
                      {group.done}/{group.items.length}
                    </span>
                    <motion.span
                      animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                    >
                      <ChevronDown size={13} className="text-[#5A7064]" aria-hidden="true" />
                    </motion.span>
                  </div>
                </button>

                {/* Items de la catégorie */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      id={`checklist-cat-${group.name}`}
                      initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                      aria-label={`${group.name} — ${group.done} sur ${group.items.length}`}
                    >
                      <div className="pt-1 pb-1 pl-1 sm:pl-2 space-y-1">
                        {group.items.map((item) => {
                          const itemKey = item.id ?? item.name;
                          const hasError = errorItemId === itemKey;
                          const isHighlighted = highlightedItemId === itemKey;
                          const qty = item.quantity ?? 1;

                          return (
                            <li
                              key={itemKey}
                              id={`checklist-item-${itemKey}`}
                              className={cn(
                                'flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl transition-all',
                                'min-h-[44px]',
                                isHighlighted && 'ring-2 ring-[#8A241B] bg-[#8A241B]/15',
                                item.is_checked
                                  ? 'bg-black/2 hover:bg-black/4 opacity-75 hover:opacity-100'
                                  : 'bg-white/40 hover:bg-white/60 shadow-2xs'
                              )}
                            >
                              {/* Bouton cocher toggle principal */}
                              <button
                                type="button"
                                onClick={() => handleToggle(item)}
                                disabled={isPending}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none"
                                aria-pressed={item.is_checked}
                                aria-label={`${item.is_checked ? 'Décocher' : 'Cocher'} : ${item.name}`}
                              >
                                <span
                                  className={cn(
                                    'shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-150',
                                    hasError
                                      ? 'border-red-400 bg-red-50'
                                      : item.is_checked
                                      ? 'bg-[#17402C] border-[#17402C]'
                                      : 'border-[#5A7064]/50 bg-white/40'
                                  )}
                                  aria-hidden="true"
                                >
                                  {item.is_checked && (
                                    <motion.span
                                      initial={shouldReduceMotion ? false : { scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                    >
                                      <Check size={9} className="text-white" strokeWidth={3} />
                                    </motion.span>
                                  )}
                                  {hasError && <AlertCircle size={9} className="text-red-400" />}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={cn(
                                        'text-xs sm:text-[13px] font-medium leading-snug',
                                        item.is_checked
                                          ? 'line-through text-[#5A7064]/90 decoration-[#5A7064]/70'
                                          : 'text-[#17402C] font-semibold'
                                      )}
                                    >
                                      {item.name}
                                    </span>
                                    {item.is_vital && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#8A241B]/15 text-[#8A241B] flex items-center gap-0.5">
                                        <Zap size={8} />
                                        Vital
                                      </span>
                                    )}
                                    {item.is_worn && (
                                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-black/5 text-[#5A7064]">
                                        Porté
                                      </span>
                                    )}
                                    {item.is_consumable && (
                                      <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-100/80 text-emerald-900 flex items-center gap-0.5">
                                        <Sparkles size={8} />
                                        Consommable
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {/* Poids, Contrôle Quantité (+/-), Bouton Boutique LKDV */}
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Contrôle Quantité (+ / -) */}
                                {!item.is_consumable && (
                                  <div className="flex items-center bg-black/5 rounded-lg text-xs font-mono">
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(item, -1)}
                                      disabled={qty <= 1}
                                      className="px-1.5 py-0.5 text-[#5A7064] hover:text-[#17402C] disabled:opacity-30 cursor-pointer"
                                      title="Diminuer la quantité"
                                    >
                                      -
                                    </button>
                                    <span className="px-1 font-bold text-[11px] text-[#17402C]">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(item, 1)}
                                      className="px-1.5 py-0.5 text-[#5A7064] hover:text-[#17402C] cursor-pointer"
                                      title="Augmenter la quantité"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}

                                {/* Poids affiché */}
                                {item.weight_g > 0 && (
                                  <span
                                    className={cn(
                                      'text-[11px] font-mono tabular-nums min-w-[42px] text-right',
                                      item.is_checked ? 'text-[#5A7064]/60' : 'text-[#5A7064]'
                                    )}
                                  >
                                    {item.weight_g * qty < 1000
                                      ? `${item.weight_g * qty} g`
                                      : `${((item.weight_g * qty) / 1000).toFixed(1)} kg`}
                                  </span>
                                )}

                                {/* Lien boutique si article manquant */}
                                {!item.is_checked && (
                                  <Link
                                    href={`/materiel/boutique?q=${encodeURIComponent(item.name)}`}
                                    className="p-1 rounded-lg text-[#5A7064] hover:text-[#17402C] hover:bg-black/5"
                                    title="Voir dans la boutique LKDV"
                                  >
                                    <ShoppingBag size={12} />
                                  </Link>
                                )}

                                {/* Suppression */}
                                {!item.is_consumable && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item)}
                                    className="p-1 rounded-lg text-[#5A7064]/50 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                    title="Supprimer de ce départ"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </div>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════ MODAL AJOUT D UN ÉQUIPEMENT OUBLIÉ ════ */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-5 rounded-3xl max-w-md w-full border border-white/80 shadow-2xl space-y-4 bg-white/95 text-[#17402C]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#17402C]">
                  Ajouter un équipement
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-[#5A7064] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                    Nom de l équipement
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Ex: Couteau pliant, Lampe frontale..."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#17402C]/40 text-[#17402C]"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Catégorie
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A7064] block mb-1">
                      Poids (g)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20000}
                      value={newItemWeight}
                      onChange={(e) => setNewItemWeight(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 border border-black/10 text-[#17402C]"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#17402C] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemVital}
                      onChange={(e) => setNewItemVital(e.target.checked)}
                      className="rounded accent-[#17402C]"
                    />
                    <span>Classer comme équipement vital</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-[#17402C] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemAddToInv}
                      onChange={(e) => setNewItemAddToInv(e.target.checked)}
                      className="rounded accent-[#17402C]"
                    />
                    <span>Ajouter aussi à mon inventaire général</span>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 text-[#5A7064] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C]/90 shadow-2xs cursor-pointer"
                  >
                    Valider l ajout
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
