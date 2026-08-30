'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Plus,
  Check,
  Search,
  Scale,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';
import type { ProductSuggestion } from '@/features/materiel/services/getProductSuggestions';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

interface DepartBoutiqueProps {
  products: ProductSuggestion[];
  kitItems?: ChecklistItem[];
}

const CATEGORIES = ['Toutes', 'Bivouac', 'Couchage', 'Cuisine', 'Hydratation', 'Nutrition', 'Sécurité'];

export function DepartBoutique({ products, kitItems = [] }: DepartBoutiqueProps) {
  const [selectedCat, setSelectedCat] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCat !== 'Toutes' && p.category !== selectedCat) return false;
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [products, selectedCat, searchQuery]);

  const handleQuickAdd = (id: string) => {
    setAddedIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="boutique-heading" className="relative">
      <div className="p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#2D6B4A]" aria-hidden="true" />
            <div>
              <h2 id="boutique-heading" className="text-base sm:text-lg font-bold text-[#17402C]">
                Boutique LKDV & Équipements Recommandés
              </h2>
              <p className="text-[11px] text-[#5A7064]">
                Matériel ultraléger testé et optimisé pour compléter votre kit ou alléger votre sac.
              </p>
            </div>
          </div>

          <Link
            href="/materiel/boutique"
            className="glass-capsule-btn primary text-xs !py-1.5 !px-3 inline-flex items-center gap-1 font-bold shadow-2xs self-start sm:self-auto"
          >
            <span>Voir toute la boutique</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Barre de recherche et catégories */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher équipement boutique..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white/50 dark:bg-white/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-[#17402C]/30 text-[#17402C]"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-full pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                  selectedCat === cat
                    ? 'bg-[#17402C] text-white shadow-2xs'
                    : 'bg-white/40 text-[#5A7064] hover:text-[#17402C]'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grille des produits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-white/30 rounded-2xl border border-dashed border-black/10 text-xs text-[#5A7064]">
              Aucun article trouvé dans cette sélection.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isAdded = addedIds.has(p.id);

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/80 flex flex-col justify-between space-y-2.5 shadow-2xs transition-all hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="relative w-full h-28 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 25vw"
                      />
                    </div>

                    <div>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#5A7064] block">
                        {p.category}
                      </span>
                      <h3 className="text-xs font-bold text-[#17402C] line-clamp-2 mt-0.5 leading-snug">
                        {p.name}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-black/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#17402C] text-[13px]">
                        {p.priceEur.toFixed(2)} €
                      </span>
                      {p.weightG > 0 && (
                        <span className="text-[11px] font-mono text-[#5A7064] flex items-center gap-0.5">
                          <Scale size={11} />
                          <span>{formatWeight(p.weightG)}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <Link
                        href={`/produit/${p.slug}`}
                        className="px-2 py-1.5 rounded-xl bg-white/80 border border-black/10 text-[#17402C] text-[10.5px] font-semibold text-center flex items-center justify-center gap-1 hover:bg-white"
                      >
                        <ExternalLink size={10} />
                        <span>Détails</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleQuickAdd(p.id)}
                        className={cn(
                          'px-2 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer',
                          isAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#17402C] text-white hover:bg-[#17402C]/90'
                        )}
                      >
                        {isAdded ? <Check size={11} /> : <Plus size={11} />}
                        <span>{isAdded ? 'Ajouté !' : 'Commander'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </GlassCard>
  );
}
