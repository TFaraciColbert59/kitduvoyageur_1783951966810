'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { TripFull, TripItem } from '../types/trip.types';
import type { TripKitAnalysis, ContextualGearRecommendation } from '../types/kit.types';
import { getTripDuration } from '../hooks/useTripDuration';
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
  const [showAllRecommendations, setShowAllRecommendations] = useState<boolean>(false);

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
  const tripDuration = getTripDuration(trip);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification d'ajout panier */}
      {cartToast && (
        <div className="fixed bottom-24 right-4 z-50 max-w-sm p-4 rounded-2xl bg-lkv-primary text-white shadow-xl flex items-center justify-between gap-3 animate-slide-up border border-lkv-secondary">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-lkv-secondary shrink-0" />
            <span>{cartToast}</span>
          </div>
          <GlassCapsuleBtn
            href="/panier"
            variant="default"
            size="xs"
          >
            Voir le panier
          </GlassCapsuleBtn>
        </div>
      )}

      {/* 1. En-tête Statut Sac & Bilan de Charge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Carte Complétude */}
        <GlassCard tone="sage" blur="md" className="p-5 rounded-3xl border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-lkv-secondary flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Préparation du Sac
            </span>
            <span className="text-sm font-black text-lkv-primary">{progressPct}%</span>
          </div>
          <div className="text-2xl font-black text-lkv-primary mb-1">
            {packedCount} / {totalCount} <span className="text-sm font-medium text-lkv-secondary">objets prêts</span>
          </div>
          <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-[var(--lkv-secondary)] to-[var(--lkv-primary)] transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </GlassCard>

        {/* Carte Poids (Résolution D3, D4) */}
        <GlassCard tone="neutral" blur="md" className="p-5 rounded-3xl border border-white/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-lkv-secondary flex items-center gap-1.5">
              <Scale className="w-4 h-4" />
              Bilan de Pesée
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                analysis.weightCategory === 'none'
                  ? 'bg-stone-100 text-stone-600'
                  : analysis.weightCategory === 'incomplet'
                  ? 'bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)]'
                  : analysis.weightCategory === 'ultralight'
                  ? 'bg-[var(--lkv-success)]/15 text-[var(--lkv-success)]'
                  : analysis.weightCategory === 'light'
                  ? 'bg-lkv-primary/15 text-lkv-primary'
                  : analysis.weightCategory === 'standard'
                  ? 'bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)]'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {analysis.weightCategory === 'none'
                ? 'Poids non renseigné'
                : analysis.weightCategory === 'incomplet'
                ? `Incomplet (${analysis.unweighedItemsCount || 1} sans poids)`
                : analysis.weightCategory}
            </span>
          </div>
          <div className="text-2xl font-black text-lkv-primary mb-1">
            {totalKg} kg <span className="text-sm font-medium text-lkv-secondary">total</span>
          </div>
          <p className="text-xs text-stone-500">
            Poids de base (sac hors eau/vivres) : <strong className="text-stone-800">{baseKg} kg</strong>
          </p>
        </GlassCard>

        {/* Carte Contexte Expédition (Résolution D2) */}
        <GlassCard tone="neutral" blur="md" className="p-5 rounded-3xl border border-white/70">
          <span className="text-xs font-bold uppercase tracking-wider text-lkv-secondary flex items-center gap-1.5 mb-2">
            <Compass className="w-4 h-4" />
            Contexte Itinéraire
          </span>
          <div className="text-base font-bold text-lkv-primary line-clamp-1">
            {trip.destination_name || 'Expédition Outdoor'}
          </div>
          <div className="text-xs text-stone-600 mt-1 space-y-0.5">
            <div>
              Altitude maximale : <strong className="whitespace-nowrap">{analysis.maxAltitudeM > 0 ? `${analysis.maxAltitudeM} m` : 'Plaine'}</strong>
              {analysis.maxAltitudeM <= 500 && (
                <span className="text-[10px] text-[var(--lkv-text-muted)] ml-1.5">(estimation pays)</span>
              )}
            </div>
            <div>Durée de l’autonomie : <strong>{tripDuration.durationDays} jours</strong></div>
          </div>
        </GlassCard>
      </div>

      {/* Alertes de sécurité & climat */}
      {analysis.climateWarnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--lkv-warning)]/10 border border-[var(--lkv-warning)]/20 text-text-primary text-xs sm:text-sm space-y-1.5">
          <div className="font-bold flex items-center gap-2 text-[var(--lkv-warning)]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--lkv-warning)]" />
            Conditions de terrain identifiées pour votre expédition
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-xs text-text-secondary">
            {analysis.climateWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Recommandations Contextuelles & Boutique LKDV (CŒUR BUSINESS) */}
      {(analysis.vitalGaps.length > 0 || analysis.recommendedGaps.length > 0) && (
        <GlassCard tone="sage" blur="md" className="p-6 rounded-3xl border border-white/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200/60">
            <div>
              <span className="text-xs font-bold text-lkv-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-lkv-secondary" />
                Équipements Manquants Détectés (Gear Gap)
              </span>
              <h3 className="text-lg font-black text-[var(--lkv-text-primary)] mt-0.5">
                Recommandations contextuelles certifiées LKDV
              </h3>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-lkv-primary/10 text-lkv-primary self-start sm:self-auto">
              {analysis.vitalGaps.length + analysis.recommendedGaps.length} équipements conseillés
            </span>
          </div>

          <p className="text-xs text-[var(--lkv-text-secondary)] leading-relaxed">
            Notre moteur analyse vos étapes de trek, l’altitude maximale et la météo saisonnière pour identifier les manques critiques dans votre sac avant le départ.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {(() => {
              const allGaps = [...analysis.vitalGaps, ...analysis.recommendedGaps];
              const displayedGaps = showAllRecommendations ? allGaps : allGaps.slice(0, 6);
              return displayedGaps.map((gap) => {
              const Icon = CATEGORY_ICONS[gap.category] || Package;
              const product = gap.shopProduct;

              return (
                <div
                  key={gap.id}
                  className="glass-sub-card p-4 rounded-[var(--lkv-radius-card)] border border-white/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--lkv-text-secondary)]">
                        <Icon className="w-3 h-3 text-lkv-secondary" />
                        {CATEGORY_LABELS[gap.category] || gap.category}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          gap.priority === 'vital'
                            ? 'bg-[var(--lkv-danger)]/10 text-[var(--lkv-danger)] border-[var(--lkv-danger)]/20'
                            : 'bg-[var(--lkv-warning)]/15 text-[var(--lkv-warning)] border-[var(--lkv-warning)]/25'
                        }`}
                      >
                        {gap.priority === 'vital' ? 'Vital pour la sécurité' : 'Recommandé'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--lkv-text-primary)] mb-1">
                      {product ? product.name : gap.name}
                    </h4>
                    <p className="text-xs text-[var(--lkv-text-secondary)] mb-3 leading-relaxed">
                      {gap.reason}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-[var(--lkv-text-secondary)]">
                      {product ? (
                        <>
                          <strong className="text-sm font-black text-[var(--lkv-text-primary)]">{product.price_eur} €</strong>
                          <span className="text-[var(--lkv-text-muted)]"> · {product.weight_g}g</span>
                        </>
                      ) : (
                        <span className="text-[var(--lkv-text-muted)]">~{gap.weightGrams}g</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {product && (
                        <GlassCapsuleBtn
                          onClick={() => handleBuyOnShop(gap)}
                          disabled={isPending}
                          variant="primary"
                          size="xs"
                          icon={<ShoppingCart className="w-3.5 h-3.5" />}
                          title="Acheter sur la boutique LKDV avec expédition rapide"
                        >
                          Acheter
                        </GlassCapsuleBtn>
                      )}

                      <GlassCapsuleBtn
                        onClick={() => handleAddRecommended(gap)}
                        disabled={isPending}
                        size="xs"
                        icon={<Plus className="w-3.5 h-3.5 text-lkv-secondary" />}
                        title="Ajouter cet élément dans ma check-list sac de voyage"
                      >
                        Dans mon sac
                      </GlassCapsuleBtn>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {(() => {
          const totalCount = analysis.vitalGaps.length + analysis.recommendedGaps.length;
          return totalCount > 6 ? (
            <div className="pt-2 flex justify-center">
              <GlassCapsuleBtn
                type="button"
                onClick={() => setShowAllRecommendations(!showAllRecommendations)}
                size="sm"
                icon={showAllRecommendations ? <ChevronUp className="w-3.5 h-3.5 text-lkv-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-lkv-secondary" />}
              >
                {showAllRecommendations ? 'Afficher moins (6 premiers)' : `Voir tous les équipements conseillés (${totalCount})`}
              </GlassCapsuleBtn>
            </div>
          ) : null;
        })()}
      </GlassCard>
      )}

      {/* 3. Check-list des Objets du Sac & Filtrage */}
      <GlassCard tone="neutral" blur="md" className="p-6 rounded-3xl border border-white/70 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-lkv-primary flex items-center gap-2">
              <Package className="w-5 h-5 text-lkv-secondary" />
              Check-list & Inventaire de l’Expédition
            </h3>
            <p className="text-xs text-stone-500">
              Cochez les équipements au fur et à mesure du chargement de votre sac.
            </p>
          </div>

          <GlassCapsuleBtn
            onClick={() => setIsAddModalOpen(true)}
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            className="self-start sm:self-auto"
          >
            Ajouter un objet
          </GlassCapsuleBtn>
        </div>

        {/* Pilules de Catégories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border min-h-[44px] ${
                selectedCategory === catKey
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-secondary)] hover:bg-white'
              }`}
            >
              {catLabel}
            </button>
          ))}
        </div>

        {/* Liste des équipements */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-[var(--lkv-text-muted)] text-xs">
            <Package className="w-8 h-8 text-[var(--lkv-text-muted)] mx-auto mb-2" />
            <p>Aucun équipement dans cette catégorie.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-3 text-xs font-bold text-lkv-primary hover:underline"
            >
              + Ajouter un premier équipement
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/40">
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
                      className="p-1 text-lkv-primary hover:scale-110 transition-transform shrink-0"
                      aria-label={item.is_packed ? 'Décocher' : 'Cocher comme emballé'}
                    >
                      {item.is_packed ? (
                        <CheckCircle2 className="w-5 h-5 text-lkv-secondary" />
                      ) : (
                        <Circle className="w-5 h-5 text-[var(--lkv-text-muted)] hover:text-lkv-secondary" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${
                            item.is_packed ? 'line-through text-[var(--lkv-text-muted)]' : 'text-[var(--lkv-text-primary)]'
                          }`}
                        >
                          {item.item_name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded glass-sub-card border border-white/60 text-[var(--lkv-text-secondary)]">
                            ×{item.quantity}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[var(--lkv-text-secondary)] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Icon className="w-3 h-3 text-lkv-secondary" />
                          {CATEGORY_LABELS[item.category || 'misc'] || item.category}
                        </span>
                        {item.weight_grams && (
                          <span>· {item.weight_grams} g</span>
                        )}
                        {item.is_vital && (
                          <span className="text-[var(--lkv-danger)] font-bold">· Vital</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full glass-sub-card border border-white/60 text-[var(--lkv-text-muted)] hover:text-[var(--lkv-danger)] hover:bg-[var(--lkv-danger)]/10 transition-all shadow-2xs"
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
          <div className="w-full max-w-md glass border border-white/60 rounded-[var(--lkv-radius-card)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--lkv-text-primary)] mb-4">
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
                <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                  Nom de l’équipement *
                </label>
                <input
                  name="itemName"
                  required
                  placeholder="ex: Sac de couchage 0°C, Lunettes..."
                  className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                    Catégorie
                  </label>
                  <select
                    name="category"
                    className="w-full px-3 py-2 text-sm rounded-[var(--lkv-radius-md)] border border-white/60 bg-white/70 backdrop-blur-md text-[var(--lkv-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--lkv-primary)]/20 shadow-2xs cursor-pointer"
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
                  <label className="block text-xs font-semibold text-[var(--lkv-text-primary)] mb-1">
                    Poids (grammes)
                  </label>
                  <input
                    type="number"
                    name="weightGrams"
                    placeholder="ex: 450"
                    min={0}
                    className="glass-input w-full px-3 py-2 text-sm text-[var(--lkv-text-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs text-[var(--lkv-text-muted)]">
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/40">
                <GlassCapsuleBtn
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Annuler
                </GlassCapsuleBtn>
                <GlassCapsuleBtn
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                >
                  Ajouter au sac
                </GlassCapsuleBtn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
