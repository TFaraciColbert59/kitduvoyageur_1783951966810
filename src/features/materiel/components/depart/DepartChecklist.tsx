'use client';
import { useOptimistic, useTransition, useState, useCallback } from 'react';
import { Check, ChevronDown, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';

type KitItem = DepartDetail['assignedKit']['items'][number];

interface CategoryGroup {
  name: string;
  items: KitItem[];
  done: number;
}

/** Groupe les items par categorie et trie : categories incompletes d abord. */
function groupByCategory(items: KitItem[]): CategoryGroup[] {
  const map = new Map<string, KitItem[]>();
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
      // Categories incompletes en premier, puis par nom
      const aComplete = a.done === a.items.length;
      const bComplete = b.done === b.items.length;
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return a.name.localeCompare(b.name, 'fr');
    });
}

interface DepartChecklistProps {
  items: KitItem[];
  /** True si les items viennent d un kit reel (mutation activee). False pour showcase. */
  isRealKit: boolean;
}

export function DepartChecklist({ items, isRealKit }: DepartChecklistProps) {
  // Etat local des items (pour optimistic update)
  const [localItems, setLocalItems] = useState<KitItem[]>(items);
  const [optimisticItems, addOptimistic] = useOptimistic(
    localItems,
    (state: KitItem[], payload: { id: string; checked: boolean }) =>
      state.map((item) =>
        (item.id ?? item.name) === payload.id ? { ...item, is_checked: payload.checked } : item
      )
  );
  const [isPending, startTransition] = useTransition();
  const [errorItemId, setErrorItemId] = useState<string | null>(null);

  // Categories ouvertes (toutes par defaut sauf 100% done)
  const groups = groupByCategory(optimisticItems);
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
    (item: KitItem) => {
      if (!isRealKit || !item.id) {
        // Showcase : toggle local uniquement, pas de mutation
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

      startTransition(async () => {
        addOptimistic({ id: itemKey, checked: !item.is_checked });
        const result = await toggleKitItem(item.id!, item.is_checked);
        if (!result.success) {
          // Rollback : remet l etat precedent
          addOptimistic({ id: itemKey, checked: item.is_checked });
          setErrorItemId(itemKey);
          setTimeout(() => setErrorItemId(null), 3000);
        } else {
          // Sync local state avec serveur
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

  const totalItems = optimisticItems.length;
  const totalDone = optimisticItems.filter((i) => i.is_checked).length;

  if (totalItems === 0) {
    return (
      <GlassCard tone="neutral">
        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <Package size={28} className="text-[#5A7064]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#17402C]">Kit vide</p>
            <p className="text-xs text-[#5A7064] mt-0.5">Ajoutez des articles dans la section Kits.</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard tone="neutral">
      <div className="p-4 sm:p-5 space-y-1">
        {/* En-tete global */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] sm:text-sm font-semibold text-[#17402C] flex items-center gap-2">
            <Package size={15} className="text-[#5A7064]" aria-hidden="true" />
            Checklist du kit
          </h2>
          <span
            className="text-xs font-mono font-bold text-[#17402C] tabular-nums"
            aria-label={`${totalDone} articles sur ${totalItems} cochés`}
          >
            {totalDone}/{totalItems}
          </span>
        </div>

        {/* Groupes par categorie */}
        <div className="space-y-1" role="list" aria-label="Checklist du kit de départ">
          {groups.map((group) => {
            const isOpen = openCats.has(group.name);
            const allDone = group.done === group.items.length;

            return (
              <div key={group.name} role="listitem">
                {/* Header categorie — bouton accordeon */}
                <button
                  onClick={() => toggleCat(group.name)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-[#17402C]',
                    allDone
                      ? 'bg-[rgba(91,127,85,0.08)] hover:bg-[rgba(91,127,85,0.12)]'
                      : 'bg-white/20 hover:bg-white/30'
                  )}
                  aria-expanded={isOpen}
                  aria-controls={`checklist-cat-${group.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {allDone && (
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#17402C] flex items-center justify-center">
                        <Check size={9} className="text-white" aria-hidden="true" />
                      </span>
                    )}
                    <span className={cn(
                      'text-xs sm:text-[13px] font-semibold truncate',
                      allDone ? 'text-[#5A7064] line-through decoration-[#5A7064]/50' : 'text-[#17402C]'
                    )}>
                      {group.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Compteur */}
                    <span className={cn(
                      'text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                      allDone
                        ? 'bg-[rgba(91,127,85,0.15)] text-[#2D6B4A]'
                        : group.done > 0
                        ? 'bg-[rgba(200,154,59,0.12)] text-[#8C6418]'
                        : 'bg-white/40 text-[#5A7064]'
                    )}>
                      {group.done}/{group.items.length}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                    >
                      <ChevronDown size={13} className="text-[#5A7064]" aria-hidden="true" />
                    </motion.span>
                  </div>
                </button>

                {/* Items de la categorie */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      id={`checklist-cat-${group.name}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                      aria-label={`${group.name} — ${group.done} sur ${group.items.length}`}
                    >
                      <div className="pt-1 pb-1 pl-2 space-y-0.5">
                        {group.items.map((item) => {
                          const itemKey = item.id ?? item.name;
                          const hasError = errorItemId === itemKey;

                          return (
                            <li key={itemKey}>
                              <button
                                onClick={() => handleToggle(item)}
                                disabled={isPending}
                                className={cn(
                                  'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors',
                                  'focus-visible:outline-2 focus-visible:outline-[#17402C]',
                                  'min-h-[44px]', // Touch target iOS minimum
                                  item.is_checked
                                    ? 'hover:bg-white/10'
                                    : 'hover:bg-white/20',
                                  isPending && 'opacity-70 cursor-wait'
                                )}
                                aria-pressed={item.is_checked}
                                aria-label={`${item.is_checked ? 'Décocher' : 'Cocher'} : ${item.name}`}
                              >
                                {/* Checkbox custom */}
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
                                      initial={{ scale: 0 }}
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

                                {/* Nom + poids */}
                                <span className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                  <span className={cn(
                                    'text-xs sm:text-[13px] leading-snug truncate',
                                    item.is_checked
                                      ? 'line-through text-[#5A7064] decoration-[#5A7064]/50'
                                      : 'text-[#17402C] font-medium'
                                  )}>
                                    {item.name}
                                  </span>
                                  {item.weight_g > 0 && (
                                    <span className={cn(
                                      'text-[10px] font-mono tabular-nums shrink-0',
                                      item.is_checked ? 'text-[#5A7064]/60' : 'text-[#5A7064]'
                                    )}>
                                      {item.weight_g < 1000
                                        ? `${item.weight_g} g`
                                        : `${(item.weight_g / 1000).toFixed(1)} kg`}
                                    </span>
                                  )}
                                </span>
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
