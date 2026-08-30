'use client';
import { useOptimistic, useTransition, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Check,
  ChevronDown,
  Package,
  AlertCircle,
  Zap,
  Droplets,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

interface CategoryGroup {
  name: string;
  items: ChecklistItem[];
  done: number;
}

/** Groupe les items par catégorie et trie : catégories incomplètes d abord. */
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
      // Catégories incomplètes en premier, puis par nom
      const aComplete = a.done === a.items.length;
      const bComplete = b.done === b.items.length;
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return a.name.localeCompare(b.name, 'fr');
    });
}

interface DepartChecklistProps {
  items: ChecklistItem[];
  consumables?: Record<string, number> | null;
  isRealKit: boolean;
}

export function DepartChecklist({ items, consumables, isRealKit }: DepartChecklistProps) {
  const shouldReduceMotion = useReducedMotion();

  // Intégration auto des consommables dans la checklist sous "Vivres & Eau" (§3.2)
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
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [failedItem, setFailedItem] = useState<ChecklistItem | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const groups = groupByCategory(optimisticItems);

  // Par défaut, ouvrir uniquement les catégories incomplètes (§3.1)
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.done < g.items.length).map((g) => g.name))
  );

  const toggleCat = (name: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleToggle = useCallback(
    (item: ChecklistItem) => {
      // Haptique légère mobile
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(8);
        } catch {}
      }

      // Si item virtuel (consommable généré ou showcase), toggle local sans Server Action
      if (!isRealKit || !item.id || item.id.startsWith('consumable-')) {
        setLocalItems((prev) =>
          prev.map((i) =>
            (i.id ?? i.name) === (item.id ?? item.name)
              ? { ...i, is_checked: !i.is_checked }
              : i
          )
        );
        return;
      }

      const itemKey = item.id ?? item.name;
      setErrorItemId(null);
      setFailedItem(null);

      startTransition(async () => {
        addOptimistic({ id: itemKey, checked: !item.is_checked });
        const result = await toggleKitItem(item.id!, item.is_checked);
        if (!result.success) {
          addOptimistic({ id: itemKey, checked: item.is_checked });
          setErrorItemId(itemKey);
          setFailedItem(item);
          setTimeout(() => setErrorItemId(null), 5000);
        } else {
          setLocalItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, is_checked: result.newChecked ?? !item.is_checked } : i
            )
          );
        }
      });
    },
    [isRealKit, addOptimistic]
  );

  // Écoute des événements déclenchés depuis les alertes interactives (§2.4)
  useEffect(() => {
    const handleHighlight = (e: any) => {
      const targetId = e?.detail?.id;
      if (!targetId) return;

      const targetItem = optimisticItems.find((i) => (i.id ?? i.name) === targetId);
      if (targetItem?.category) {
        setOpenCats((prev) => new Set(prev).add(targetItem.category!));
      }

      setHighlightedItemId(targetId);
      setTimeout(() => {
        const itemEl = document.getElementById(`checklist-item-${targetId}`);
        itemEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      setTimeout(() => setHighlightedItemId(null), 2500);
    };

    const handleToggleFromAlert = (e: any) => {
      const targetId = e?.detail?.id;
      if (!targetId) return;
      const targetItem = optimisticItems.find((i) => (i.id ?? i.name) === targetId);
      if (targetItem) {
        handleToggle(targetItem);
      }
    };

    window.addEventListener('highlight-checklist-item', handleHighlight);
    window.addEventListener('toggle-item-from-alert', handleToggleFromAlert);

    return () => {
      window.removeEventListener('highlight-checklist-item', handleHighlight);
      window.removeEventListener('toggle-item-from-alert', handleToggleFromAlert);
    };
  }, [optimisticItems, handleToggle]);

  const totalItems = optimisticItems.length;
  const totalDone = optimisticItems.filter((i) => i.is_checked).length;
  const remainingItems = optimisticItems.filter((i) => !i.is_checked);

  // Résumé textuel « encore X : tente, trousse... » (§3.1)
  const remainingSummary = remainingItems.length > 0
    ? `encore ${remainingItems.length} : ${remainingItems.slice(0, 3).map((i) => i.name).join(', ')}${remainingItems.length > 3 ? '...' : ''}`
    : 'Tout est prêt dans votre sac !';

  if (totalItems === 0) {
    return (
      <GlassCard tone="neutral">
        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <Package size={28} className="text-[#5A7064]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#17402C]">Kit vide</p>
            <p className="text-xs text-[#5A7064] mt-0.5">Ajoutez des articles dans votre kit de départ.</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="checklist-heading">
      <div className="p-4 sm:p-5 space-y-2.5">
        {/* ════ EN-TÊTE STICKY DU PACK (§3.1) ════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-black/5 dark:border-white/10">
          <div>
            <h2 id="checklist-heading" className="text-xs sm:text-[13px] font-bold text-[#17402C] flex items-center gap-2">
              <Package size={15} className="text-[#2D6B4A]" aria-hidden="true" />
              <span>Checklist de préparation du sac</span>
            </h2>
            <p className="text-[11px] text-[#5A7064] mt-0.5 truncate max-w-lg">
              {totalDone}/{totalItems} articles prêts · <span className="font-semibold text-[#17402C]">{remainingSummary}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] tabular-nums"
              aria-label={`${totalDone} sur ${totalItems} cochés`}
            >
              {Math.round((totalDone / totalItems) * 100)}%
            </span>
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

        {/* ════ GROUPES PAR CATÉGORIE ════ */}
        <div className="space-y-1.5" role="list" aria-label="Catégories du matériel">
          {groups.map((group) => {
            const isOpen = openCats.has(group.name);
            const allDone = group.done === group.items.length;
            const isFoodWater = group.name === 'Vivres & Eau' || group.name === 'Hydratation' || group.name === 'Nutrition';

            return (
              <div key={group.name} role="listitem" className={cn('rounded-2xl transition-opacity', allDone && !isOpen && 'opacity-65 hover:opacity-100')}>
                {/* Header catégorie — bouton accordéon */}
                <button
                  onClick={() => toggleCat(group.name)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl transition-colors text-left cursor-pointer',
                    'focus-visible:outline-2 focus-visible:outline-[#17402C]',
                    allDone
                      ? 'bg-black/3 dark:bg-white/3 text-[#5A7064]'
                      : isFoodWater
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 text-[#17402C] font-semibold border border-emerald-200/50 shadow-2xs'
                      : 'bg-white/40 dark:bg-white/10 text-[#17402C] font-semibold shadow-2xs'
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
                      <div className="pt-1 pb-1 pl-1 sm:pl-2 space-y-0.5">
                        {group.items.map((item) => {
                          const itemKey = item.id ?? item.name;
                          const hasError = errorItemId === itemKey;
                          const isHighlighted = highlightedItemId === itemKey;

                          return (
                            <li key={itemKey} id={`checklist-item-${itemKey}`}>
                              <button
                                onClick={() => handleToggle(item)}
                                disabled={isPending}
                                className={cn(
                                  'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-all cursor-pointer',
                                  'focus-visible:outline-2 focus-visible:outline-[#17402C]',
                                  'min-h-[44px]',
                                  isHighlighted && 'ring-2 ring-[#8A241B] bg-[#8A241B]/15',
                                  item.is_checked
                                    ? 'hover:bg-white/10 opacity-70 hover:opacity-100'
                                    : 'hover:bg-white/20',
                                  isPending && 'opacity-70 cursor-wait'
                                )}
                                aria-pressed={item.is_checked}
                                aria-label={`${item.is_checked ? 'Décocher' : 'Cocher'} : ${item.name}`}
                              >
                                {/* Checkbox custom ≥44px touch-target safe */}
                                <span
                                  className={cn(
                                    'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150',
                                    hasError
                                      ? 'border-red-400 bg-red-50'
                                      : item.is_checked
                                      ? 'bg-[#17402C] border-[#17402C]'
                                      : 'border-[#5A7064]/50 bg-white/30'
                                  )}
                                  aria-hidden="true"
                                >
                                  {item.is_checked && (
                                    <motion.span
                                      initial={shouldReduceMotion ? false : { scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                    >
                                      <Check size={11} className="text-white" strokeWidth={2.5} />
                                    </motion.span>
                                  )}
                                  {hasError && (
                                    <AlertCircle size={11} className="text-red-400" />
                                  )}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={cn(
                                        'text-xs sm:text-[13px] font-medium leading-snug',
                                        item.is_checked
                                          ? 'line-through text-[#5A7064]/70'
                                          : 'text-[#17402C]'
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

                                {item.weight_g > 0 && (
                                  <span
                                    className={cn(
                                      'shrink-0 text-[11px] font-mono tabular-nums',
                                      item.is_checked
                                        ? 'text-[#5A7064]/50'
                                        : 'text-[#5A7064]'
                                    )}
                                  >
                                    {item.weight_g < 1000
                                      ? `${item.weight_g} g`
                                      : `${(item.weight_g / 1000).toFixed(1)} kg`}
                                  </span>
                                )}
                              </button>
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
    </GlassCard>
  );
}
