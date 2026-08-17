'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addToCart } from '@/lib/cart';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConsumableItem {
  id: string;
  name: string;
  unit: string;
  currentQty: number;
  recommendedQty: number;
  category: 'vital' | 'indispensable' | 'consommable';
  urgency: 'critique' | 'élevée' | 'normale';
  price_eur: number;
  icon: string;
  slug?: string;
}

interface ConsumablesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nombre de nuits de la randonnée active */
  nightsCount?: number;
  /** Callback pour afficher toast */
  onToast?: (msg: string) => void;
}

// ── Données initiales ─────────────────────────────────────────────────────────
const DEFAULT_CONSUMABLES: ConsumableItem[] = [
  // VITAL
  { id: 'cs-eau', name: 'Eau (réserve)', unit: 'L', currentQty: 1.5, recommendedQty: 2, category: 'vital', urgency: 'critique', price_eur: 0, icon: '💧', slug: undefined },
  { id: 'cs-cartouche-gaz', name: 'Cartouche gaz', unit: 'unité', currentQty: 0, recommendedQty: 1, category: 'vital', urgency: 'critique', price_eur: 7.5, icon: '🔥', slug: 'cartouche-gaz-100g-achat' },
  { id: 'cs-lampe-pile', name: 'Pile frontale CR123', unit: 'unité', currentQty: 1, recommendedQty: 2, category: 'vital', urgency: 'élevée', price_eur: 4.5, icon: '🔋', slug: 'piles-cr123-achat' },
  // INDISPENSABLE
  { id: 'cs-crème-solaire', name: 'Crème solaire SPF 50+', unit: 'tube', currentQty: 1, recommendedQty: 1, category: 'indispensable', urgency: 'élevée', price_eur: 8.9, icon: '🌞', slug: 'creme-solaire-spf50-achat' },
  { id: 'cs-anti-insectes', name: 'Anti-moustiques', unit: 'spray', currentQty: 0, recommendedQty: 1, category: 'indispensable', urgency: 'élevée', price_eur: 6.5, icon: '🦟', slug: undefined },
  { id: 'cs-pastilles-eau', name: 'Pastilles purification eau', unit: 'boîte', currentQty: 0, recommendedQty: 1, category: 'indispensable', urgency: 'élevée', price_eur: 5.9, icon: '💊', slug: 'pastilles-micropur-achat' },
  // CONSOMMABLE
  { id: 'cs-vivres', name: 'Vivres de course (j)', unit: 'jours', currentQty: 2, recommendedQty: 3, category: 'consommable', urgency: 'normale', price_eur: 12, icon: '🥗', slug: undefined },
  { id: 'cs-barres', name: 'Barres énergétiques', unit: 'unité', currentQty: 4, recommendedQty: 6, category: 'consommable', urgency: 'normale', price_eur: 2.5, icon: '🍫', slug: undefined },
  { id: 'cs-chaussettes', name: 'Chaussettes de rechange', unit: 'paires', currentQty: 1, recommendedQty: 2, category: 'consommable', urgency: 'normale', price_eur: 18, icon: '🧦', slug: 'chaussettes-merino-achat' },
  { id: 'cs-sac-poubelle', name: 'Sacs poubelle étanches', unit: 'unité', currentQty: 2, recommendedQty: 3, category: 'consommable', urgency: 'normale', price_eur: 0.5, icon: '🗑️', slug: undefined },
];

const STORAGE_KEY = 'lkdv_consumables_state';

function loadState(): ConsumableItem[] {
  if (typeof window === 'undefined') return DEFAULT_CONSUMABLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONSUMABLES;
    const parsed = JSON.parse(raw) as ConsumableItem[];
    // merge: keep user qty, keep defaults for new items
    const merged = DEFAULT_CONSUMABLES.map((def) => {
      const saved = parsed.find((p) => p.id === def.id);
      return saved ? { ...def, currentQty: saved.currentQty } : def;
    });
    return merged;
  } catch {
    return DEFAULT_CONSUMABLES;
  }
}

function saveState(items: ConsumableItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// ── Urgency Badge ─────────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }: { urgency: ConsumableItem['urgency'] }) {
  const cfg = {
    critique: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Critique' },
    élevée: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Élevée' },
    normale: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'OK' },
  }[urgency];
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ConsumableRow({
  item,
  onAdjust,
  onAddToCart,
}: {
  item: ConsumableItem;
  onAdjust: (id: string, delta: number) => void;
  onAddToCart: (item: ConsumableItem) => void;
}) {
  const isLow = item.currentQty < item.recommendedQty;
  const isCritical = item.urgency === 'critique' && item.currentQty === 0;

  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        isCritical
          ? 'bg-red-50/60 border-red-200/80'
          : isLow
          ? 'bg-amber-50/40 border-amber-200/60'
          : 'bg-white border-black/[0.05]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none shrink-0">{item.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0B1F17] truncate leading-snug">{item.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <UrgencyBadge urgency={item.urgency} />
              <span className="text-[9px] text-[#6B7770] font-mono">
                {item.currentQty}/{item.recommendedQty} {item.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAdjust(item.id, -1)}
            disabled={item.currentQty <= 0}
            className="w-6 h-6 rounded-full bg-[#F5F3EC] hover:bg-[#EAE7DD] border border-black/10 flex items-center justify-center text-xs font-bold text-[#0B1F17] disabled:opacity-30 transition-colors"
            aria-label={`Retirer un ${item.unit} de ${item.name}`}
          >
            −
          </button>
          <span className={`w-7 text-center text-xs font-mono font-bold ${isLow ? 'text-amber-600' : 'text-[#17402C]'}`}>
            {item.currentQty}
          </span>
          <button
            onClick={() => onAdjust(item.id, +1)}
            className="w-6 h-6 rounded-full bg-[#F5F3EC] hover:bg-[#EAE7DD] border border-black/10 flex items-center justify-center text-xs font-bold text-[#0B1F17] transition-colors"
            aria-label={`Ajouter un ${item.unit} de ${item.name}`}
          >
            +
          </button>

          {/* Cart button — only if purchasable & low */}
          {isLow && item.price_eur > 0 && (
            <button
              onClick={() => onAddToCart(item)}
              className="ml-1 px-2 py-1 rounded-full bg-[#17402C] text-white text-[9px] font-bold hover:bg-[#0B1F17] transition-colors shrink-0"
              title={`Acheter ${item.name} · ${item.price_eur}€`}
            >
              🛒
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {item.recommendedQty > 0 && (
        <div className="mt-2 h-1 rounded-full bg-black/[0.05] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCritical ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-[#6BAA55]'
            }`}
            style={{ width: `${Math.min(100, (item.currentQty / item.recommendedQty) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConsumablesSidebar({
  isOpen,
  onClose,
  nightsCount = 3,
  onToast,
}: ConsumablesSidebarProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [items, setItems] = useState<ConsumableItem[]>(DEFAULT_CONSUMABLES);
  const [cartCount, setCartCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critique' | 'manquant'>('critique');

  // Load from localStorage
  useEffect(() => {
    setItems(loadState());
  }, []);

  const handleAdjust = useCallback((id: string, delta: number) => {
    triggerHaptic('light');
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id
          ? { ...item, currentQty: Math.max(0, item.currentQty + delta) }
          : item
      );
      saveState(next);
      return next;
    });
  }, [triggerHaptic]);

  const handleAddToCart = useCallback((item: ConsumableItem) => {
    triggerHaptic('selection');
    addToCart({
      id: item.id,
      slug: item.slug || item.id,
      name: item.name,
      brand: 'LKDV',
      priceEur: item.price_eur,
      weightG: 50,
      image: '/assets/images/no_image.png',
      imageAlt: item.name,
      category: 'Consommable',
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    setCartCount((c) => c + 1);
    onToast?.(`🛒 « ${item.name} » ajouté au panier`);
  }, [triggerHaptic, onToast]);

  const handleAddAllMissing = useCallback(() => {
    triggerHaptic('heavy');
    const missing = items.filter((i) => i.currentQty < i.recommendedQty && i.price_eur > 0);
    if (missing.length === 0) {
      onToast?.('✓ Tous les consommables sont suffisamment approvisionnés');
      return;
    }
    missing.forEach((item) => {
      addToCart({
        id: item.id,
        slug: item.slug || item.id,
        name: item.name,
        brand: 'LKDV',
        priceEur: item.price_eur,
        weightG: 50,
        image: '/assets/images/no_image.png',
        imageAlt: item.name,
        category: 'Consommable',
      });
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart-updated'));
    }
    setCartCount((c) => c + missing.length);
    onToast?.(`🛒 ${missing.length} consommable${missing.length > 1 ? 's' : ''} ajouté${missing.length > 1 ? 's' : ''} au panier`);
  }, [triggerHaptic, items, onToast]);

  // Filter & sort
  const filteredItems = items
    .filter((item) => {
      if (activeFilter === 'critique') return item.urgency === 'critique';
      if (activeFilter === 'manquant') return item.currentQty < item.recommendedQty;
      return true;
    })
    .sort((a, b) => {
      const order = { critique: 0, élevée: 1, normale: 2 };
      return order[a.urgency] - order[b.urgency];
    });

  const criticalCount = items.filter((i) => i.urgency === 'critique' && i.currentQty < i.recommendedQty).length;
  const missingCount = items.filter((i) => i.currentQty < i.recommendedQty).length;

  const categoryGroups: { key: ConsumableItem['category']; label: string; icon: string }[] = [
    { key: 'vital', label: 'Vital & Sécurité', icon: '🚨' },
    { key: 'indispensable', label: 'Indispensables', icon: '⭐' },
    { key: 'consommable', label: 'Consommables', icon: '📦' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto cursor-pointer"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-sm bg-[#FBFAF6] h-full shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-br from-[#0B1F17] to-[#17402C] text-white shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-mono tracking-widest uppercase text-[#9ECB8A] mb-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6BAA55] animate-pulse" />
                    Consommables & Stocks
                  </div>
                  <h2 className="text-lg font-medium tracking-tight leading-snug">
                    Gestion <em className="font-serif-lkv italic text-[#9ECB8A] font-normal">des stocks</em>
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5 font-mono">
                    Sortie de {nightsCount} nuit{nightsCount > 1 ? 's' : ''} · {missingCount} article{missingCount > 1 ? 's' : ''} insuffisant{missingCount > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm shrink-0 transition-colors"
                  aria-label="Fermer la sidebar consommables"
                >
                  ✕
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="block text-[10px] font-mono text-white/60 uppercase">Critique</span>
                  <span className={`text-lg font-bold font-mono ${criticalCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {criticalCount}
                  </span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="block text-[10px] font-mono text-white/60 uppercase">Manquant</span>
                  <span className={`text-lg font-bold font-mono ${missingCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {missingCount}
                  </span>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <span className="block text-[10px] font-mono text-white/60 uppercase">Articles</span>
                  <span className="text-lg font-bold font-mono text-white">{items.length}</span>
                </div>
              </div>
            </div>

            {/* Action rapide */}
            {missingCount > 0 && (
              <div className="px-3 py-2.5 bg-[#F5F3EC] border-b border-black/[0.05] flex items-center justify-between gap-2 shrink-0">
                <p className="text-[11px] text-[#6B7770]">
                  <strong className="text-[#C0532E]">{missingCount}</strong> article{missingCount > 1 ? 's' : ''} sous le niveau recommandé
                </p>
                <button
                  onClick={handleAddAllMissing}
                  className="px-3 py-1.5 rounded-full bg-[#17402C] text-white text-[10px] font-bold hover:bg-[#0B1F17] transition-colors shrink-0 shadow-xs"
                >
                  🛒 Tout commander
                </button>
              </div>
            )}

            {/* Filter tabs */}
            <div className="px-3 pt-3 pb-2 flex gap-1 shrink-0">
              {([
                { key: 'critique', label: 'Vital' },
                { key: 'manquant', label: `Manquant (${missingCount})` },
                { key: 'all', label: 'Tout' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
                    activeFilter === tab.key
                      ? 'bg-[#17402C] text-white shadow-xs'
                      : 'bg-white text-[#6B7770] border border-black/10 hover:border-[#17402C]/30'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-3 pb-5 space-y-4">
              {activeFilter === 'all' ? (
                // Grouped by category
                categoryGroups.map(({ key, label, icon }) => {
                  const groupItems = filteredItems.filter((i) => i.category === key);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-1.5 mb-2 pt-1">
                        <span className="text-sm">{icon}</span>
                        <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-[#6B7770]">{label}</span>
                      </div>
                      <div className="space-y-2">
                        {groupItems.map((item) => (
                          <ConsumableRow
                            key={item.id}
                            item={item}
                            onAdjust={handleAdjust}
                            onAddToCart={handleAddToCart}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Flat filtered list
                <div className="space-y-2 pt-1">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-10 text-[#6B7770] text-xs">
                      <span className="text-2xl block mb-2">✓</span>
                      Tous les articles sont suffisamment approvisionnés !
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <ConsumableRow
                        key={item.id}
                        item={item}
                        onAdjust={handleAdjust}
                        onAddToCart={handleAddToCart}
                      />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer sticky */}
            <div className="p-3 bg-white border-t border-black/[0.05] shrink-0">
              <p className="text-[10px] text-[#6B7770] text-center font-mono">
                Quantités enregistrées localement · Classé par urgence pour votre prochaine sortie
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
