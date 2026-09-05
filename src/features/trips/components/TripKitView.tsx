'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  Package,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ShoppingCart,
  Sparkles,
  AlertTriangle,
  Scale,
  Compass,
  Flame,
  Tent,
  Shirt,
  Droplet,
  Battery,
  Shield,
  Navigation,
} from 'lucide-react';
import type { TripFull, TripItem } from '../types/trip.types';
import type { TripKitAnalysis, ContextualGearRecommendation } from '../types/kit.types';
import { getTripDurationDays } from '../engine/contextualKitEngine';
import {
  togglePackedAction,
  addCustomTripItemAction,
  deleteTripItemAction,
  addRecommendedItemAction,
} from '@/app/voyages/kit-actions';
import { addToCart } from '@/lib/cart';

export interface TripKitViewProps {
  trip: TripFull;
  analysis: TripKitAnalysis;
  showBackLink?: boolean;
}

const CATEGORY_ICONS: Record<string, any> = {
  shelter: Tent,
  sleep: Tent,
  clothing: Shirt,
  cook: Flame,
  water: Droplet,
  tech: Battery,
  safety: Shield,
  navigation: Navigation,
  misc: Package,
};

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Tout afficher',
  safety: 'Sécurité & Secours',
  shelter: 'Abri & Tente',
  sleep: 'Sommeil',
  clothing: 'Vêtements',
  cook: 'Cuisine',
  water: 'Hydratation',
  tech: 'Énergie & Tech',
  misc: 'Matériel',
};

export function TripKitView({ trip, analysis, showBackLink: _showBackLink = false }: TripKitViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useState<TripItem[]>(trip.items || []);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Filtrer les items par catégorie
  const filteredItems = optimisticItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const handleTogglePacked = (item: TripItem) => {
    const nextPacked = !item.is_packed;
    setOptimisticItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_packed: nextPacked } : i))
    );

    startTransition(async () => {
      await togglePackedAction(item.id, nextPacked, trip.slug);
    });
  };

  const handleDeleteItem = (itemId: string) => {
    setOptimisticItems((prev) => prev.filter((i) => i.id !== itemId));

    startTransition(async () => {
      await deleteTripItemAction(itemId, trip.slug);
    });
  };

  const handleAddRecommended = (rec: ContextualGearRecommendation) => {
    startTransition(async () => {
      await addRecommendedItemAction(trip.id, trip.slug, rec);
    });
  };

  const handleBuyOnShop = (rec: ContextualGearRecommendation) => {
    if (!rec.shopProduct) return;
    const p = rec.shopProduct;

    addToCart(
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        priceEur: p.price_eur,
        weightG: p.weight_g,
        image: p.image || '/images/placeholder-product.jpg',
        imageAlt: p.image_alt || p.name,
        category: p.category_main,
      },
      1
    );

    setCartToast(`« ${p.name} » a été ajouté à votre panier !`);
    setTimeout(() => setCartToast(null), 4000);
  };

  const packedCount = optimisticItems.filter((i) => i.is_packed).length;
  const totalCount = optimisticItems.length;
  const progressPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
  const totalKg = (analysis.totalWeightGrams / 1000).toFixed(1);
  const baseKg = (analysis.baseWeightGrams / 1000).toFixed(1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification d'ajout panier */}
      {cartToast && (
        <div className="fixed bottom-24 right-4 z-50 max-w-sm p-4 rounded-2xl bg-[#17402C] text-white shadow-xl flex items-center justify-between gap-3 animate-slide-up border border-[#5B7F55]">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-[#A6C1A0] shrink-0" />
            <span>{cartToast}</span>
          </div>
          <Link
            href="/panier"
            className="px-3 py-1 text-xs font-bold bg-[#FAF8F5] text-[#17402C] rounded-lg hover:bg-white transition-all shrink-0"
          >
            Voir le panier
          </Link>
        </div>
      )}

      {/* 1. En-tête Statut Sac & Bilan de Charge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Carte Complétude */}
        <GlassCard tone="sage" blur="md" className="p-5 rounded-[24px] border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B7F55] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Préparation du Sac
            </span>
            <span className="text-sm font-black text-[#17402C]">{progressPct}%</span>
          </div>
          <div className="text-2xl font-black text-[#17402C] mb-1">
            {packedCount} / {totalCount} <span className="text-sm font-medium text-[#5B7F55]">objets prêts</span>
          </div>
          <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-[#5B7F55] to-[#17402C] transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </GlassCard>

        {/* Carte Poids */}
        <GlassCard tone="neutral" blur="md" className="p-5 rounded-[24px] border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B7F55] flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              Bilan de Pesée
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                analysis.weightCategory === 'ultralight'
                  ? 'bg-emerald-100 text-emerald-800'
                  : analysis.weightCategory === 'light'
                  ? 'bg-blue-100 text-blue-800'
                  : analysis.weightCategory === 'standard'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {analysis.weightCategory}
            </span>
          </div>
          <div className="text-2xl font-black text-[#17402C] mb-1">
            {totalKg} kg <span className="text-sm font-medium text-[#5B7F55]">total</span>
          </div>
          <p className="text-xs text-stone-500">
            Poids de base (sac hors eau/vivres) : <strong className="text-stone-800">{baseKg} kg</strong>
          </p>
        </GlassCard>

        {/* Carte Contexte Expédition */}
        <GlassCard tone="neutral" blur="md" className="p-5 rounded-[24px] border border-white/70">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5B7F55] flex items-center gap-1.5 mb-2">
            <Compass className="w-4 h-4" />
            Contexte Itinéraire
          </span>
          <div className="text-base font-bold text-[#17402C] line-clamp-1">
            {trip.destination_name || 'Expédition Outdoor'}
          </div>
          <div className="text-xs text-stone-600 mt-1 space-y-0.5">
            <div>Altitude maximale : <strong>{analysis.maxAltitudeM > 0 ? `${analysis.maxAltitudeM} m` : 'Plaine'}</strong></div>
            <div>Durée de l’autonomie : <strong>{getTripDurationDays(trip)} jours</strong></div>
          </div>
        </GlassCard>
      </div>

      {/* Alertes de sécurité & climat */}
      {analysis.climateWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs sm:text-sm space-y-1.5">
          <div className="font-bold flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            Conditions de terrain identifiées pour votre expédition
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-xs text-amber-800/90">
            {analysis.climateWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Recommandations Contextuelles & Boutique LKDV (CŒUR BUSINESS) */}
      {(analysis.vitalGaps.length > 0 || analysis.recommendedGaps.length > 0) && (
        <GlassCard tone="sage" blur="md" className="p-6 rounded-[28px] border border-white/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200/60">
            <div>
              <span className="text-xs font-bold text-[#5B7F55] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#5B7F55]" />
                Équipements Manquants Détectés (Gear Gap)
              </span>
              <h3 className="text-lg font-black text-stone-900 mt-0.5">
                Recommandations contextuelles certifiées LKDV
              </h3>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#17402C]/10 text-[#17402C] self-start sm:self-auto">
              {analysis.vitalGaps.length + analysis.recommendedGaps.length} équipements conseillés
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Notre moteur analyse vos étapes de trek, l’altitude maximale et la météo saisonnière pour identifier les manques critiques dans votre sac avant le départ.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {[...analysis.vitalGaps, ...analysis.recommendedGaps].slice(0, 6).map((gap) => {
              const Icon = CATEGORY_ICONS[gap.category] || Package;
              const product = gap.shopProduct;

              return (
                <div
                  key={gap.id}
                  className="p-4 rounded-[20px] bg-white/90 border border-stone-200/80 shadow-sm hover:border-[#5B7F55]/60 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500">
                        <Icon className="w-3 h-3 text-[#5B7F55]" />
                        {CATEGORY_LABELS[gap.category] || gap.category}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          gap.priority === 'vital'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {gap.priority === 'vital' ? 'Vital pour la sécurité' : 'Recommandé'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-stone-900 mb-1">
                      {product ? product.name : gap.name}
                    </h4>
                    <p className="text-xs text-stone-600 mb-3 leading-relaxed">
                      {gap.reason}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-stone-700">
                      {product ? (
                        <>
                          <strong className="text-sm font-black text-[#17402C]">{product.price_eur} €</strong>
                          <span className="text-stone-400"> · {product.weight_g}g</span>
                        </>
                      ) : (
                        <span className="text-stone-400">~{gap.weightGrams}g</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {product && (
                        <button
                          onClick={() => handleBuyOnShop(gap)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-xl bg-[#17402C] hover:bg-[#123323] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Acheter sur la boutique LKDV avec expédition rapide"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Acheter</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleAddRecommended(gap)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all flex items-center gap-1"
                        title="Ajouter cet élément dans ma check-list sac de voyage"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#5B7F55]" />
                        <span>Dans mon sac</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 3. Check-list des Objets du Sac & Filtrage */}
      <GlassCard tone="neutral" blur="md" className="p-6 rounded-[28px] border border-white/70 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#17402C] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#5B7F55]" />
              Check-list & Inventaire de l’Expédition
            </h3>
            <p className="text-xs text-stone-500">
              Cochez les équipements au fur et à mesure du chargement de votre sac.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#17402C] hover:bg-[#123323] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Ajouter un objet
          </button>
        </div>

        {/* Pilules de Catégories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === catKey
                  ? 'bg-[#17402C] text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {catLabel}
            </button>
          ))}
        </div>

        {/* Liste des équipements */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-stone-500 text-xs">
            <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p>Aucun équipement dans cette catégorie.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-3 text-xs font-bold text-[#17402C] hover:underline"
            >
              + Ajouter un premier équipement
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredItems.map((item) => {
              const Icon = CATEGORY_ICONS[item.category || 'misc'] || Package;

              return (
                <div
                  key={item.id}
                  className={`py-3 flex items-center justify-between gap-3 transition-colors ${
                    item.is_packed ? 'opacity-60' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleTogglePacked(item)}
                      className="p-1 text-[#17402C] hover:scale-110 transition-transform shrink-0"
                      aria-label={item.is_packed ? 'Décocher' : 'Cocher comme emballé'}
                    >
                      {item.is_packed ? (
                        <CheckCircle2 className="w-5 h-5 text-[#5B7F55]" />
                      ) : (
                        <Circle className="w-5 h-5 text-stone-300 hover:text-[#5B7F55]" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${
                            item.is_packed ? 'line-through text-stone-500' : 'text-stone-900'
                          }`}
                        >
                          {item.item_name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600">
                            ×{item.quantity}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Icon className="w-3 h-3 text-[#5B7F55]" />
                          {CATEGORY_LABELS[item.category || 'misc'] || item.category}
                        </span>
                        {item.weight_grams && (
                          <span>· {item.weight_grams} g</span>
                        )}
                        {item.is_vital && (
                          <span className="text-rose-600 font-bold">· Vital</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 text-stone-300 hover:text-rose-600 rounded-lg transition-colors"
                      title="Supprimer du sac"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Modal Ajout Rapide d'Équipement */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900 mb-4">
              Ajouter un équipement au sac
            </h3>

            <form
              action={(formData) => {
                startTransition(async () => {
                  await addCustomTripItemAction(trip.id, trip.slug, formData);
                  setIsAddModalOpen(false);
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nom de l’équipement *
                </label>
                <input
                  name="itemName"
                  required
                  placeholder="ex: Sac de couchage 0°C, Lunettes..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#17402C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    name="category"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#17402C]"
                  >
                    <option value="safety">Sécurité & Secours</option>
                    <option value="shelter">Abri & Tente</option>
                    <option value="sleep">Sommeil</option>
                    <option value="clothing">Vêtements</option>
                    <option value="cook">Cuisine</option>
                    <option value="water">Hydratation</option>
                    <option value="tech">Énergie & Tech</option>
                    <option value="misc">Matériel divers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Poids (grammes)
                  </label>
                  <input
                    type="number"
                    name="weightGrams"
                    placeholder="ex: 450"
                    min={0}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#17402C]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs text-stone-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isVital" value="true" className="rounded" />
                  <span>Équipement vital pour la sécurité ou survie</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isWorn" value="true" className="rounded" />
                  <span>Porté sur soi (exclu du poids de base du sac)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isConsumable" value="true" className="rounded" />
                  <span>Consommable (eau, vivres, gaz)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-bold bg-[#17402C] text-white rounded-xl hover:bg-[#123323] transition-all"
                >
                  Ajouter au sac
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
